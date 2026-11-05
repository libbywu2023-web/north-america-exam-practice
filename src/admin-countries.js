
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

function validCountryCode(value) {
  return typeof value === "string" && /^[A-Z]{2,3}$/.test(value);
}

function validTranslations(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every(
    name => typeof name === "string" && name.trim().length > 0
  );
}

async function getEnabledLanguages(db) {
  const result = await db.prepare(`
    SELECT code, name, native_name
    FROM languages
    WHERE is_enabled = 1
    ORDER BY sort_order, code
  `).all();

  return result.results || [];
}

function validateCountryInput(body, languages) {
  if (
    !body ||
    !validCountryCode(body.code) ||
    !validTranslations(body.translations)
  ) {
    return "A valid country code and translations are required.";
  }

  const enabledCodes = new Set(languages.map(item => item.code));

  for (const code of Object.keys(body.translations)) {
    if (!enabledCodes.has(code)) {
      return `Unsupported language: ${code}`;
    }
  }

  for (const language of languages) {
    const name = body.translations[language.code];

    if (typeof name !== "string" || !name.trim()) {
      return `Translation required for ${language.code}.`;
    }
  }

  if (!body.translations.en) {
    return "English translation is required.";
  }

  return null;
}

async function listCountries(db) {
  const result = await db.prepare(`
    SELECT
      c.id,
      c.code,
      c.name AS default_name,
      ct.language_code,
      ct.name AS translated_name
    FROM countries c
    LEFT JOIN country_translations ct
      ON ct.country_id = c.id
    ORDER BY c.id, ct.language_code
  `).all();

  const countries = new Map();

  for (const row of result.results || []) {
    if (!countries.has(row.id)) {
      countries.set(row.id, {
        id: row.id,
        code: row.code,
        name: row.default_name,
        translations: {}
      });
    }

    if (row.language_code) {
      countries.get(row.id).translations[row.language_code] =
        row.translated_name;
    }
  }

  return [...countries.values()];
}

export async function handleAdminCountries(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (!path.startsWith("/api/admin/countries")) {
    return null;
  }

  if (!await isAdminAuthenticated(request, env)) {
    return json({ error: "Unauthorized." }, 401);
  }

  if (!env.DB) {
    return json({ error: "D1 database is not configured." }, 500);
  }

  // GET: list countries
  if (request.method === "GET" && path === "/api/admin/countries") {
    const countries = await listCountries(env.DB);
    const languages = await getEnabledLanguages(env.DB);

    return json({ countries, languages });
  }

  // POST: create country
  if (request.method === "POST" && path === "/api/admin/countries") {
    const body = await request.json().catch(() => null);
    const languages = await getEnabledLanguages(env.DB);
    const validationError = validateCountryInput(body, languages);

    if (validationError) {
      return json({ error: validationError }, 400);
    }

    const code = body.code.trim();
    const englishName = body.translations.en.trim();

    const statements = [
      env.DB.prepare(`
        INSERT INTO countries (code, name)
        VALUES (?, ?)
      `).bind(code, englishName),

      ...Object.entries(body.translations).map(
        ([languageCode, name]) => env.DB.prepare(`
          INSERT INTO country_translations
            (country_id, language_code, name)
          SELECT id, ?, ?
          FROM countries
          WHERE code = ?
        `).bind(languageCode, name.trim(), code)
      ),

      env.DB.prepare(`
        INSERT INTO admin_audit_logs
          (actor, action, entity_type, entity_id, details_json)
        SELECT
          'admin', 'create', 'country', CAST(id AS TEXT), ?
        FROM countries
        WHERE code = ?
      `).bind(JSON.stringify({ code }), code)
    ];

    try {
      await env.DB.batch(statements);

      const country = await env.DB.prepare(`
        SELECT id FROM countries WHERE code = ?
      `).bind(code).first();

      return json({
        id: country.id,
        message: "Country created."
      }, 201);
    } catch (error) {
      if (String(error).includes("UNIQUE")) {
        return json({
          error: "This country code already exists."
        }, 409);
      }

      throw error;
    }
  }

  const match = path.match(/^\/api\/admin\/countries\/(\d+)$/);

  if (!match) {
    return json({ error: "Country API route not found." }, 404);
  }

  const countryId = Number(match[1]);

  // PUT: update country
  if (request.method === "PUT") {
    const body = await request.json().catch(() => null);
    const languages = await getEnabledLanguages(env.DB);
    const validationError = validateCountryInput(body, languages);

    if (validationError) {
      return json({ error: validationError }, 400);
    }

    const existing = await env.DB.prepare(`
      SELECT id FROM countries WHERE id = ?
    `).bind(countryId).first();

    if (!existing) {
      return json({ error: "Country not found." }, 404);
    }

    const code = body.code.trim();
    const englishName = body.translations.en.trim();

    const statements = [
      env.DB.prepare(`
        UPDATE countries
        SET code = ?, name = ?
        WHERE id = ?
      `).bind(code, englishName, countryId),

      ...Object.entries(body.translations).map(
        ([languageCode, name]) => env.DB.prepare(`
          INSERT INTO country_translations
            (country_id, language_code, name)
          VALUES (?, ?, ?)
          ON CONFLICT(country_id, language_code)
          DO UPDATE SET name = excluded.name
        `).bind(countryId, languageCode, name.trim())
      ),

      env.DB.prepare(`
        INSERT INTO admin_audit_logs
          (actor, action, entity_type, entity_id, details_json)
        VALUES ('admin', 'update', 'country', ?, ?)
      `).bind(
        String(countryId),
        JSON.stringify({ code })
      )
    ];

    try {
      await env.DB.batch(statements);

      return json({ message: "Country updated." });
    } catch (error) {
      if (String(error).includes("UNIQUE")) {
        return json({
          error: "This country code already exists."
        }, 409);
      }

      throw error;
    }
  }

  // DELETE: delete country
  if (request.method === "DELETE") {
    const existing = await env.DB.prepare(`
      SELECT id, code FROM countries WHERE id = ?
    `).bind(countryId).first();

    if (!existing) {
      return json({ error: "Country not found." }, 404);
    }

    const regionCount = await env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM regions
      WHERE country_id = ?
    `).bind(countryId).first();

    if (regionCount.count > 0) {
      return json({
        error: "This country has associated regions and cannot be deleted."
      }, 409);
    }

    const statements = [
      env.DB.prepare(`
        DELETE FROM countries WHERE id = ?
      `).bind(countryId),

      env.DB.prepare(`
        INSERT INTO admin_audit_logs
          (actor, action, entity_type, entity_id, details_json)
        VALUES ('admin', 'delete', 'country', ?, ?)
      `).bind(
        String(countryId),
        JSON.stringify({ code: existing.code })
      )
    ];

    try {
      await env.DB.batch(statements);

      return json({ message: "Country deleted." });
    } catch (error) {
      return json({
        error: "Country deletion failed. It may have associated records."
      }, 409);
    }
  }

  return json({ error: "Method not allowed." }, 405);
}
