
const COOKIE_NAME = "__Host-admin_session";
const SESSION_SECONDS = 8 * 60 * 60;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers
    }
  });
}

function getCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie") || "";

  for (const item of cookieHeader.split(";")) {
    const index = item.indexOf("=");
    if (index < 0) continue;

    const key = item.slice(0, index).trim();
    const value = item.slice(index + 1).trim();

    if (key === name) return value;
  }

  return null;
}

function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);

  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function getSigningKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function createSession(secret) {
  const payload = {
    sub: "admin",
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS
  };

  const encodedPayload = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(payload))
  );

  const key = await getSigningKey(secret);

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(encodedPayload)
  );

  return `${encodedPayload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function verifySession(token, secret) {
  if (!token || !secret) return false;

  try {
    const parts = token.split(".");
    if (parts.length !== 2) return false;

    const [encodedPayload, encodedSignature] = parts;
    const signature = base64UrlDecode(encodedSignature);

    const key = await getSigningKey(secret);

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      new TextEncoder().encode(encodedPayload)
    );

    if (!valid) return false;

    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(encodedPayload))
    );

    return payload.sub === "admin" &&
      Number.isInteger(payload.exp) &&
      payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function cookieHeader(value, maxAge) {
  return [
    `${COOKIE_NAME}=${value}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${maxAge}`
  ].join("; ");
}

function isSameOrigin(request) {
  const origin = request.headers.get("Origin");
  return origin === new URL(request.url).origin;
}

export async function handleAdminAuth(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (!path.startsWith("/api/admin/")) {
    return null;
  }

  if (!env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET) {
    return json({ error: "Admin authentication is not configured." }, 503);
  }

  if (path === "/api/admin/login" && request.method === "POST") {
    if (!isSameOrigin(request)) {
      return json({ error: "Invalid request origin." }, 403);
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body.password !== "string") {
      return json({ error: "Password is required." }, 400);
    }

    if (body.password !== env.ADMIN_PASSWORD) {
      return json({ error: "Invalid password." }, 401);
    }

    const token = await createSession(env.ADMIN_SESSION_SECRET);

    return json(
      { authenticated: true },
      200,
      {
        "set-cookie": cookieHeader(token, SESSION_SECONDS)
      }
    );
  }

  if (path === "/api/admin/me" && request.method === "GET") {
    const token = getCookie(request, COOKIE_NAME);

    const authenticated = await verifySession(
      token,
      env.ADMIN_SESSION_SECRET
    );

    if (!authenticated) {
      return json({ authenticated: false }, 401);
    }

    return json({ authenticated: true });
  }

  if (path === "/api/admin/logout" && request.method === "POST") {
    if (!isSameOrigin(request)) {
      return json({ error: "Invalid request origin." }, 403);
    }

    return json(
      { authenticated: false },
      200,
      {
        "set-cookie": cookieHeader("", 0)
      }
    );
  }

  return json({ error: "Admin API route not found." }, 404);
}