
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

function validRegionCode(value) {
  return typeof value === "string" &&
    /^[A-Z0-9-]{1,10}$/.test(value);
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

async function getCountries(db) {
  const result = await db.prepare(`
    SELECT id, code, name
    FROM countries
    ORDER BY name
  `).all();

  return result.results || [];
}

function validateRegionInput(body, languages) {
  if (
    !body ||
    !Number.isInteger(Number(body.country_id)) ||
    Number(body.country_id) <= 0 ||
    !validRegionCode(body.code) ||
    !validTranslations(body.translations)
  ) {
    return "A valid country, region code and translations are required.";
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

async function listRegions(db) {
  const result = await db.prepare(`
    SELECT
      r.id,
      r.country_id,
      r.code,
      r.name AS default_name,
      c.code AS country_code,
      c.name AS country_name,
      rt.language_code,
      rt.name AS translated_name
    FROM regions r
    INNER JOIN countries c
      ON c.id = r.country_id
    LEFT JOIN region_translations rt
      ON rt.region_id = r.id
    ORDER BY c.name, r.code, rt.language_code
  `).all();

  const regions = new Map();

  for (const row of result.results || []) {
    if (!regions.has(row.id)) {
      regions.set(row.id, {
        id: row.id,
        country_id: row.country_id,
        country_code: row.country_code,
        country_name: row.country_name,
        code: row.code,
        name: row.default_name,
        translations: {}
      });
    }

    if (row.language_code) {
      regions.get(row.id).translations[row.language_code] =
        row.translated_name;
    }
  }

  return [...regions.values()];
}

export async function handleAdminRegions(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (!path.startsWith("/api/admin/regions")) {
    return null;
  }

  if (!await isAdminAuthenticated(request, env)) {
    return json({ error: "Unauthorized." }, 401);
  }

  if (!env.DB) {
    return json({ error: "D1 database is not configured." }, 500);
  }

  // GET: list regions, countries and enabled languages
  if (request.method === "GET" && path === "/api/admin/regions") {
    const [regions, countries, languages] = await Promise.all([
      listRegions(env.DB),
      getCountries(env.DB),
      getEnabledLanguages(env.DB)
    ]);

    return json({ regions, countries, languages });
  }

  // POST: create region
  if (request.method === "POST" && path === "/api/admin/regions") {
    const body = await request.json().catch(() => null);
    const languages = await getEnabledLanguages(env.DB);
    const validationError = validateRegionInput(body, languages);

    if (validationError) {
      return json({ error: validationError }, 400);
    }

    const countryId = Number(body.country_id);
    const code = body.code.trim();
    const englishName = body.translations.en.trim();

    const country = await env.DB.prepare(`
      SELECT id FROM countries WHERE id = ?
    `).bind(countryId).first();

    if (!country) {
      return json({ error: "Selected country not found." }, 404);
    }

    const statements = [
      env.DB.prepare(`
        INSERT INTO regions (country_id, code, name)
        VALUES (?, ?, ?)
      `).bind(countryId, code, englishName),

      ...Object.entries(body.translations).map(
        ([languageCode, name]) => env.DB.prepare(`
          INSERT INTO region_translations
            (region_id, language_code, name)
          SELECT id, ?, ?
          FROM regions
          WHERE country_id = ? AND code = ?
        `).bind(languageCode, name.trim(), countryId, code)
      ),

      env.DB.prepare(`
        INSERT INTO admin_audit_logs
          (actor, action, entity_type, entity_id, details_json)
        SELECT
          'admin', 'create', 'region', CAST(id AS TEXT), ?
        FROM regions
        WHERE country_id = ? AND code = ?
      `).bind(
        JSON.stringify({ country_id: countryId, code }),
        countryId,
        code
      )
    ];

    try {
      await env.DB.batch(statements);

      const region = await env.DB.prepare(`
        SELECT id
        FROM regions
        WHERE country_id = ? AND code = ?
      `).bind(countryId, code).first();

      return json({
        id: region.id,
        message: "Region created."
      }, 201);

    } catch (error) {
      if (String(error).includes("UNIQUE")) {
        return json({
          error: "This region code already exists in the selected country."
        }, 409);
      }

      throw error;
    }
  }

  const match = path.match(/^\/api\/admin\/regions\/(\d+)$/);

  if (!match) {
    return json({ error: "Region API route not found." }, 404);
  }

  const regionId = Number(match[1]);

  // PUT: update region
  if (request.method === "PUT") {
    const body = await request.json().catch(() => null);
    const languages = await getEnabledLanguages(env.DB);
    const validationError = validateRegionInput(body, languages);

    if (validationError) {
      return json({ error: validationError }, 400);
    }

    const existing = await env.DB.prepare(`
      SELECT id FROM regions WHERE id = ?
    `).bind(regionId).first();

    if (!existing) {
      return json({ error: "Region not found." }, 404);
    }

    const countryId = Number(body.country_id);
    const code = body.code.trim();
    const englishName = body.translations.en.trim();

    const country = await env.DB.prepare(`
      SELECT id FROM countries WHERE id = ?
    `).bind(countryId).first();

    if (!country) {
      return json({ error: "Selected country not found." }, 404);
    }

    const statements = [
      env.DB.prepare(`
        UPDATE regions
        SET country_id = ?, code = ?, name = ?
        WHERE id = ?
      `).bind(countryId, code, englishName, regionId),

      ...Object.entries(body.translations).map(
        ([languageCode, name]) => env.DB.prepare(`
          INSERT INTO region_translations
            (region_id, language_code, name)
          VALUES (?, ?, ?)
          ON CONFLICT(region_id, language_code)
          DO UPDATE SET name = excluded.name
        `).bind(regionId, languageCode, name.trim())
      ),

      env.DB.prepare(`
        INSERT INTO admin_audit_logs
          (actor, action, entity_type, entity_id, details_json)
        VALUES ('admin', 'update', 'region', ?, ?)
      `).bind(
        String(regionId),
        JSON.stringify({ country_id: countryId, code })
      )
    ];

    try {
      await env.DB.batch(statements);

      return json({ message: "Region updated." });

    } catch (error) {
      if (String(error).includes("UNIQUE")) {
        return json({
          error: "This region code already exists in the selected country."
        }, 409);
      }

      throw error;
    }
  }

  // DELETE: delete region
  if (request.method === "DELETE") {
    const existing = await env.DB.prepare(`
      SELECT id, country_id, code
      FROM regions
      WHERE id = ?
    `).bind(regionId).first();

    if (!existing) {
      return json({ error: "Region not found." }, 404);
    }

    const examCount = await env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM exams
      WHERE region_id = ?
    `).bind(regionId).first();

    if (examCount.count > 0) {
      return json({
        error: "This region has associated exams and cannot be deleted."
      }, 409);
    }

    const statements = [
      env.DB.prepare(`
        DELETE FROM regions WHERE id = ?
      `).bind(regionId),

      env.DB.prepare(`
        INSERT INTO admin_audit_logs
          (actor, action, entity_type, entity_id, details_json)
        VALUES ('admin', 'delete', 'region', ?, ?)
      `).bind(
        String(regionId),
        JSON.stringify({
          country_id: existing.country_id,
          code: existing.code
        })
      )
    ];

    try {
      await env.DB.batch(statements);

      return json({ message: "Region deleted." });

    } catch (error) {
      return json({
        error: "Region deletion failed. It may have associated records."
      }, 409);
    }
  }

  return json({ error: "Method not allowed." }, 405);
}
