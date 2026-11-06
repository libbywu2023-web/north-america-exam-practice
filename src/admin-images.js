import { isAdminAuthenticated } from "./admin-auth.js";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function isSameOrigin(request) {
  const origin = request.headers.get("Origin");
  return origin === new URL(request.url).origin;
}

function hasValidImageSignature(bytes, type) {
  if (type === "image/jpeg") {
    return bytes[0] === 0xFF &&
      bytes[1] === 0xD8 &&
      bytes[2] === 0xFF;
  }

  if (type === "image/png") {
    return bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4E &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0D &&
      bytes[5] === 0x0A &&
      bytes[6] === 0x1A &&
      bytes[7] === 0x0A;
  }

  if (type === "image/webp") {
    return bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }

  return false;
}

async function uploadImage(request, env) {
  if (!isSameOrigin(request)) {
    return jsonResponse({ error: "Invalid request origin." }, 403);
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return jsonResponse({ error: "Invalid upload data." }, 400);
  }

  const file = formData.get("file");

  if (!file || typeof file.arrayBuffer !== "function") {
    return jsonResponse({ error: "Please select an image." }, 400);
  }

  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return jsonResponse({
      error: "Image size must be between 1 byte and 5MB."
    }, 400);
  }

  const extension = ALLOWED_TYPES[file.type];

  if (!extension) {
    return jsonResponse({
      error: "Only JPG, PNG and WebP images are allowed."
    }, 400);
  }

  const imageData = await file.arrayBuffer();
  const bytes = new Uint8Array(imageData);

  if (!hasValidImageSignature(bytes, file.type)) {
    return jsonResponse({
      error: "The uploaded file is not a valid image."
    }, 400);
  }

  const key = `questions/${crypto.randomUUID()}.${extension}`;

  try {
    await env.exam_question_images.put(key, imageData, {
      httpMetadata: {
        contentType: file.type,
        cacheControl: "public, max-age=31536000, immutable"
      }
    });

    return jsonResponse({
      success: true,
      key,
      url: `/images/${key}`,
      size: file.size,
      content_type: file.type
    });
  } catch (error) {
    console.error("Image upload failed:", error);

    return jsonResponse({
      error: "Image upload failed."
    }, 500);
  }
}

async function deleteImage(request, env) {
  if (!isSameOrigin(request)) {
    return jsonResponse({ error: "Invalid request origin." }, 403);
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body.key !== "string") {
    return jsonResponse({ error: "Invalid image key." }, 400);
  }

  const key = body.key;

  if (!/^questions\/[a-f0-9-]+\.(jpg|png|webp)$/i.test(key)) {
    return jsonResponse({ error: "Invalid image key." }, 400);
  }

  const imageUrl = `/images/${key}`;

  const reference = await env.DB.prepare(`
    SELECT COUNT(*) AS total
    FROM question_images
    WHERE image_url = ?
  `).bind(imageUrl).first();

  if (reference && reference.total > 0) {
    return jsonResponse({
      error: "This image is still used by a question. Remove it from the question first."
    }, 409);
  }

  try {
    await env.exam_question_images.delete(key);

    return jsonResponse({
      success: true,
      message: "Image deleted."
    });
  } catch (error) {
    console.error("Image deletion failed:", error);

    return jsonResponse({
      error: "Image deletion failed."
    }, 500);
  }
}

export async function handleAdminImages(request, env) {
  if (!await isAdminAuthenticated(request, env)) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  if (!env.exam_question_images) {
    return jsonResponse({
      error: "R2 storage is not configured."
    }, 503);
  }

  if (request.method === "POST") {
    return uploadImage(request, env);
  }

  if (request.method === "DELETE") {
    return deleteImage(request, env);
  }

  return jsonResponse({ error: "Method not allowed." }, 405);
}
export async function handlePublicImage(request, env) {
  if (request.method !== "GET") {
    return new Response("Method not allowed.", {
      status: 405
    });
  }

  const url = new URL(request.url);
  const match = url.pathname.match(
    /^\/images\/questions\/([a-f0-9-]+\.(?:jpg|png|webp))$/i
  );

  if (!match) {
    return new Response("Not found.", { status: 404 });
  }

  const key = `questions/${match[1]}`;

  try {
    const object = await env.exam_question_images.get(key);

    if (!object) {
      return new Response("Image not found.", { status: 404 });
    }

    const headers = new Headers({
      "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
      "Cache-Control": object.httpMetadata?.cacheControl || "public, max-age=31536000, immutable"
    });

    if (object.httpEtag) {
      headers.set("ETag", object.httpEtag);
    }

    return new Response(object.body, { headers });
  } catch (error) {
    console.error("Public image retrieval failed:", error);

    return new Response("Image retrieval failed.", {
      status: 500
    });
  }
}