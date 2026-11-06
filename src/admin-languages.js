
import { isAdminAuthenticated } from "./admin-auth.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function validateLanguage(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Invalid request body.";
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const nativeName =
    typeof body.native_name === "string"
      ? body.native_name.trim()
      : "";

  if (!/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(code)) {
    return "Invalid language code. Example: en, fr, zh-CN.";
  }

  if (!name || name.length > 100) {
    return "Language name is required and must be at most 100 characters.";
  }

  if (!nativeName || nativeName.length > 100) {
    return "Native name is required and must be at most 100 characters.";
  }

  const sortOrder = Number(body.sort_order ?? 0);

  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) {
    return "Sort order must be an integer between 0 and 10000.";
  }

  if (
    body.is_enabled !== undefined &&
    ![0, 1, true, false].includes(body.is_enabled)
  ) {
    return "Invalid enabled status.";
  }

  return null;
}

function cleanLanguage(body) {
  return {
    code: body.code.trim(),
    name: body.name.trim(),
    native_name: body.native_name.trim(),
    is_enabled:
      body.is_enabled === undefined
        ? 1
        : (body.is_enabled === true || body.is_enabled === 1 ? 1 : 0),
    sort_order: Number(body.sort_order ?? 0)
  };
}

export async function handleAdminLanguages(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (!path.startsWith("/api/admin/languages")) {
    return null;
  }

  if (!await isAdminAuthenticated(request, env)) {
    return json({ error: "Unauthorized." }, 401);
  }

  if (!env.DB) {
    return json({ error: "D1 database is not configured." }, 500);
  }

  // GET: list all languages
  if (request.method === "GET" && path === "/api/admin/languages") {
    const result = await env.DB.prepare(`
      SELECT code, name, native_name, is_enabled, sort_order
      FROM languages
      ORDER BY sort_order, code
    `).all();

    return json({ languages: result.results || [] });
  }

  // POST: create language
  if (request.method === "POST" && path === "/api/admin/languages") {
    const body = await request.json().catch(() => null);
    const validationError = validateLanguage(body);

    if (validationError) {
      return json({ error: validationError }, 400);
    }

    const language = cleanLanguage(body);

    try {
      await env.DB.batch([
        env.DB.prepare(`
          INSERT INTO languages
            (code, name, native_name, is_enabled, sort_order)
          VALUES (?, ?, ?, ?, ?)
        `).bind(
          language.code,
          language.name,
          language.native_name,
          language.is_enabled,
          language.sort_order
        ),

        env.DB.prepare(`
          INSERT INTO admin_audit_logs
            (actor, action, entity_type, entity_id, details_json)
          VALUES ('admin', 'create', 'language', ?, ?)
        `).bind(
          language.code,
          JSON.stringify(language)
        )
      ]);

      return json({
        message: "Language created.",
        language
      }, 201);
    } catch (error) {
      if (String(error).includes("UNIQUE")) {
        return json({
          error: "This language code already exists."
        }, 409);
      }

      throw error;
    }
  }

  const match = path.match(/^\/api\/admin\/languages\/([^/]+)$/);

  if (!match) {
    return json({ error: "Language API route not found." }, 404);
  }

  const code = decodeURIComponent(match[1]);

  // PUT: update language
  if (request.method === "PUT") {
    const body = await request.json().catch(() => null);
    const validationError = validateLanguage(body);

    if (validationError) {
      return json({ error: validationError }, 400);
    }

    const language = cleanLanguage(body);

    if (language.code !== code) {
      return json({
        error: "Language codes cannot be changed because translations reference them."
      }, 400);
    }

    const existing = await env.DB.prepare(`
      SELECT code FROM languages WHERE code = ?
    `).bind(code).first();

    if (!existing) {
      return json({ error: "Language not found." }, 404);
    }

    await env.DB.batch([
      env.DB.prepare(`
        UPDATE languages
        SET name = ?,
            native_name = ?,
            is_enabled = ?,
            sort_order = ?
        WHERE code = ?
      `).bind(
        language.name,
        language.native_name,
        language.is_enabled,
        language.sort_order,
        code
      ),

      env.DB.prepare(`
        INSERT INTO admin_audit_logs
          (actor, action, entity_type, entity_id, details_json)
        VALUES ('admin', 'update', 'language', ?, ?)
      `).bind(
        code,
        JSON.stringify(language)
      )
    ]);

    return json({ message: "Language updated." });
  }

  return json({ error: "Method not allowed." }, 405);
}
