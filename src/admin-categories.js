
import { isAdminAuthenticated } from "./admin-auth.js";

const API_PATH = "/api/admin/categories";

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

async function getEnabledLanguages(env) {
  const result = await env.DB.prepare(`
    SELECT code, name, native_name
    FROM languages
    WHERE is_enabled = 1
    ORDER BY sort_order, code
  `).all();

  return result.results || [];
}

function validateSlug(slug) {
  return typeof slug === "string" &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function validateTranslations(translations, languages) {
  if (
    !translations ||
    typeof translations !== "object" ||
    Array.isArray(translations)
  ) {
    return false;
  }

  return languages.every(language => {
    const value = translations[language.code];

    return typeof value === "string" &&
      value.trim().length > 0 &&
      value.trim().length <= 150;
  });
}

function cleanTranslations(translations, languages) {
  const result = {};

  for (const language of languages) {
    result[language.code] = translations[language.code].trim();
  }

  return result;
}

// GET /api/admin/categories
async function listCategories(env) {
  const [categoryResult, translationResult, languages] =
    await Promise.all([
      env.DB.prepare(`
        SELECT
          c.id,
          c.slug,
          c.name,
          COUNT(DISTINCT e.id) AS exam_count
        FROM exam_categories c
        LEFT JOIN exams e ON e.category_id = c.id
        GROUP BY c.id, c.slug, c.name
        ORDER BY c.id
      `).all(),

      env.DB.prepare(`
        SELECT category_id, language_code, name
        FROM exam_category_translations
      `).all(),

      getEnabledLanguages(env)
    ]);

  const translationMap = {};

  for (const row of translationResult.results || []) {
    if (!translationMap[row.category_id]) {
      translationMap[row.category_id] = {};
    }

    translationMap[row.category_id][row.language_code] = row.name;
  }

  const categories = (categoryResult.results || []).map(category => ({
    ...category,
    translations: translationMap[category.id] || {}
  }));

  return jsonResponse({
    categories,
    languages
  });
}

// POST /api/admin/categories
async function createCategory(request, env) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }

  const slug = typeof body.slug === "string"
    ? body.slug.trim().toLowerCase()
    : "";

  const languages = await getEnabledLanguages(env);

  if (!validateSlug(slug)) {
    return jsonResponse({
      error: "Slug must contain lowercase letters, numbers and hyphens."
    }, 400);
  }

  if (!validateTranslations(body.translations, languages)) {
    return jsonResponse({
      error: "Please provide a name for every enabled language. Names must be 150 characters or fewer."
    }, 400);
  }

  const translations = cleanTranslations(body.translations, languages);
  const defaultName = translations.en;

  if (!defaultName) {
    return jsonResponse({
      error: "English translation is required."
    }, 400);
  }

  const statements = [
    env.DB.prepare(`
      INSERT INTO exam_categories (slug, name)
      VALUES (?, ?)
    `).bind(slug, defaultName),

    ...languages.map(language =>
      env.DB.prepare(`
        INSERT INTO exam_category_translations
          (category_id, language_code, name)
        SELECT id, ?, ?
        FROM exam_categories
        WHERE slug = ?
      `).bind(language.code, translations[language.code], slug)
    ),

    env.DB.prepare(`
      INSERT INTO admin_audit_logs
        (actor, action, entity_type, entity_id, details_json)
      SELECT
        'admin',
        'create',
        'exam_category',
        CAST(id AS TEXT),
        ?
      FROM exam_categories
      WHERE slug = ?
    `).bind(JSON.stringify({ slug }), slug)
  ];

  try {
    await env.DB.batch(statements);

    return jsonResponse({
      success: true,
      message: "Category created successfully."
    }, 201);
  } catch (error) {
    console.error("Create category error:", error);

    return jsonResponse({
      error: "Unable to create category. The slug may already exist."
    }, 409);
  }
}

// PUT /api/admin/categories/:id
async function updateCategory(id, request, env) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }

  const slug = typeof body.slug === "string"
    ? body.slug.trim().toLowerCase()
    : "";

  const languages = await getEnabledLanguages(env);

  if (!validateSlug(slug)) {
    return jsonResponse({
      error: "Slug must contain lowercase letters, numbers and hyphens."
    }, 400);
  }

  if (!validateTranslations(body.translations, languages)) {
    return jsonResponse({
      error: "Please provide a name for every enabled language. Names must be 150 characters or fewer."
    }, 400);
  }

  const translations = cleanTranslations(body.translations, languages);
  const defaultName = translations.en;

  if (!defaultName) {
    return jsonResponse({
      error: "English translation is required."
    }, 400);
  }

  const existing = await env.DB.prepare(`
    SELECT id
    FROM exam_categories
    WHERE id = ?
  `).bind(id).first();

  if (!existing) {
    return jsonResponse({ error: "Category not found." }, 404);
  }

  const statements = [
    env.DB.prepare(`
      UPDATE exam_categories
      SET slug = ?, name = ?
      WHERE id = ?
    `).bind(slug, defaultName, id),

    ...languages.map(language =>
      env.DB.prepare(`
        INSERT INTO exam_category_translations
          (category_id, language_code, name)
        VALUES (?, ?, ?)
        ON CONFLICT(category_id, language_code)
        DO UPDATE SET name = excluded.name
      `).bind(id, language.code, translations[language.code])
    ),

    env.DB.prepare(`
      INSERT INTO admin_audit_logs
        (actor, action, entity_type, entity_id, details_json)
      VALUES ('admin', 'update', 'exam_category', ?, ?)
    `).bind(
      String(id),
      JSON.stringify({ slug })
    )
  ];

  try {
    await env.DB.batch(statements);

    return jsonResponse({
      success: true,
      message: "Category updated successfully."
    });
  } catch (error) {
    console.error("Update category error:", error);

    return jsonResponse({
      error: "Unable to update category. The slug may already exist."
    }, 409);
  }
}

// DELETE /api/admin/categories/:id
async function deleteCategory(id, env) {
  const existing = await env.DB.prepare(`
    SELECT id
    FROM exam_categories
    WHERE id = ?
  `).bind(id).first();

  if (!existing) {
    return jsonResponse({ error: "Category not found." }, 404);
  }

  const usage = await env.DB.prepare(`
    SELECT COUNT(*) AS total
    FROM exams
    WHERE category_id = ?
  `).bind(id).first();

  if (Number(usage?.total || 0) > 0) {
    return jsonResponse({
      error: "This category is used by exams and cannot be deleted."
    }, 409);
  }

  try {
    await env.DB.batch([
      env.DB.prepare(`
        DELETE FROM exam_category_translations
        WHERE category_id = ?
      `).bind(id),

      env.DB.prepare(`
        DELETE FROM exam_categories
        WHERE id = ?
      `).bind(id),

      env.DB.prepare(`
        INSERT INTO admin_audit_logs
          (actor, action, entity_type, entity_id, details_json)
        VALUES ('admin', 'delete', 'exam_category', ?, '{}')
      `).bind(String(id))
    ]);

    return jsonResponse({
      success: true,
      message: "Category deleted successfully."
    });
  } catch (error) {
    console.error("Delete category error:", error);

    return jsonResponse({
      error: "Unable to delete category."
    }, 409);
  }
}

// Main router
export async function handleAdminCategories(request, env) {
  if (!(await isAdminAuthenticated(request, env))) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  const url = new URL(request.url);
  const method = request.method;

  if (url.pathname === API_PATH) {
    if (method === "GET") {
      return listCategories(env);
    }

    if (method === "POST") {
      return createCategory(request, env);
    }

    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const match = url.pathname.match(
    /^\/api\/admin\/categories\/(\d+)$/
  );

  if (match) {
    const id = Number(match[1]);

    if (method === "PUT") {
      return updateCategory(id, request, env);
    }

    if (method === "DELETE") {
      return deleteCategory(id, env);
    }

    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  return jsonResponse({ error: "Not found." }, 404);
}
