
import { isAdminAuthenticated } from "./admin-auth.js";

const API_PATH = "/api/admin/exams";

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
    const item = translations[language.code];

    return item &&
      typeof item.title === "string" &&
      item.title.trim().length > 0 &&
      item.title.trim().length <= 200 &&
      typeof item.description === "string" &&
      item.description.trim().length <= 2000;
  });
}

function cleanTranslations(translations, languages) {
  const result = {};

  for (const language of languages) {
    result[language.code] = {
      title: translations[language.code].title.trim(),
      description: translations[language.code].description.trim()
    };
  }

  return result;
}

function validateExamFields(body) {
  const regionId = Number(body.region_id);
  const categoryId = Number(body.category_id);
  const questionCount = Number(body.question_count);
  const timeLimit = body.time_limit_minutes === null ||
    body.time_limit_minutes === ""
    ? null
    : Number(body.time_limit_minutes);
  const passingScore = Number(body.passing_score_percent);

  const status = body.status;
  const defaultLanguage = body.default_language;

  if (!Number.isInteger(regionId) || regionId <= 0) {
    return { error: "Please select a valid region." };
  }

  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return { error: "Please select a valid category." };
  }

  if (!Number.isInteger(questionCount) ||
      questionCount < 1 || questionCount > 1000) {
    return { error: "Question count must be between 1 and 1000." };
  }

  if (
    timeLimit !== null &&
    (!Number.isInteger(timeLimit) || timeLimit < 1 || timeLimit > 600)
  ) {
    return { error: "Time limit must be between 1 and 600 minutes." };
  }

  if (
    !Number.isInteger(passingScore) ||
    passingScore < 1 ||
    passingScore > 100
  ) {
    return { error: "Passing score must be between 1 and 100." };
  }

  if (!["draft", "published", "archived"].includes(status)) {
    return { error: "Invalid exam status." };
  }

  if (!["en", "zh-CN", "zh-TW"].includes(defaultLanguage)) {
    return { error: "Invalid default language." };
  }

  return {
    values: {
      regionId,
      categoryId,
      questionCount,
      timeLimit,
      passingScore,
      status,
      defaultLanguage
    }
  };
}

async function validateRelations(env, regionId, categoryId) {
  const [region, category] = await Promise.all([
    env.DB.prepare(`
      SELECT r.id, r.country_id
      FROM regions r
      WHERE r.id = ?
    `).bind(regionId).first(),

    env.DB.prepare(`
      SELECT id
      FROM exam_categories
      WHERE id = ?
    `).bind(categoryId).first()
  ]);

  if (!region) {
    return { error: "Selected region does not exist." };
  }

  if (!category) {
    return { error: "Selected category does not exist." };
  }

  return { region, category };
}

// GET /api/admin/exams
async function listExams(env) {
  const [
    examResult,
    translationResult,
    languages,
    countriesResult,
    regionsResult,
    categoriesResult
  ] = await Promise.all([
    env.DB.prepare(`
      SELECT
        e.id,
        e.region_id,
        e.category_id,
        e.slug,
        e.status,
        e.default_language,
        e.question_count,
        e.time_limit_minutes,
        e.passing_score_percent,
        e.created_at,
        r.code AS region_code,
        r.name AS region_name,
        c.id AS country_id,
        c.code AS country_code,
        c.name AS country_name,
        cat.slug AS category_slug,
        cat.name AS category_name,
        (
          SELECT COUNT(*)
          FROM questions q
          WHERE q.exam_id = e.id
        ) AS bank_question_count
      FROM exams e
      JOIN regions r ON r.id = e.region_id
      JOIN countries c ON c.id = r.country_id
      JOIN exam_categories cat ON cat.id = e.category_id
      ORDER BY e.id DESC
    `).all(),

    env.DB.prepare(`
      SELECT exam_id, language_code, title, description
      FROM exam_translations
    `).all(),

    getEnabledLanguages(env),

    env.DB.prepare(`
      SELECT id, code, name
      FROM countries
      ORDER BY name
    `).all(),

    env.DB.prepare(`
      SELECT id, country_id, code, name
      FROM regions
      ORDER BY name
    `).all(),

    env.DB.prepare(`
      SELECT id, slug, name
      FROM exam_categories
      ORDER BY name
    `).all()
  ]);

  const translationMap = {};

  for (const row of translationResult.results || []) {
    if (!translationMap[row.exam_id]) {
      translationMap[row.exam_id] = {};
    }

    translationMap[row.exam_id][row.language_code] = {
      title: row.title,
      description: row.description
    };
  }

  const exams = (examResult.results || []).map(exam => ({
    ...exam,
    translations: translationMap[exam.id] || {}
  }));

  return jsonResponse({
    exams,
    languages,
    countries: countriesResult.results || [],
    regions: regionsResult.results || [],
    categories: categoriesResult.results || []
  });
}

// POST /api/admin/exams
async function createExam(request, env) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }

  const slug = typeof body.slug === "string"
    ? body.slug.trim().toLowerCase()
    : "";

  if (!validateSlug(slug)) {
    return jsonResponse({
      error: "Slug must contain lowercase letters, numbers and hyphens."
    }, 400);
  }

  const fields = validateExamFields(body);

  if (fields.error) {
    return jsonResponse({ error: fields.error }, 400);
  }

  const {
    regionId,
    categoryId,
    questionCount,
    timeLimit,
    passingScore,
    status,
    defaultLanguage
  } = fields.values;

  const relation = await validateRelations(env, regionId, categoryId);

  if (relation.error) {
    return jsonResponse({ error: relation.error }, 400);
  }

  const languages = await getEnabledLanguages(env);

  if (!validateTranslations(body.translations, languages)) {
    return jsonResponse({
      error: "Please provide a title and description for every enabled language."
    }, 400);
  }

  const translations = cleanTranslations(body.translations, languages);

  if (!languages.some(language => language.code === defaultLanguage)) {
    return jsonResponse({
      error: "Default language must be enabled."
    }, 400);
  }

  const statements = [
    env.DB.prepare(`
      INSERT INTO exams (
        region_id,
        category_id,
        slug,
        status,
        default_language,
        question_count,
        time_limit_minutes,
        passing_score_percent
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      regionId,
      categoryId,
      slug,
      status,
      defaultLanguage,
      questionCount,
      timeLimit,
      passingScore
    ),

    ...languages.map(language =>
      env.DB.prepare(`
        INSERT INTO exam_translations (
          exam_id,
          language_code,
          title,
          description
        )
        SELECT id, ?, ?, ?
        FROM exams
        WHERE slug = ?
      `).bind(
        language.code,
        translations[language.code].title,
        translations[language.code].description,
        slug
      )
    ),

    env.DB.prepare(`
      INSERT INTO admin_audit_logs (
        actor,
        action,
        entity_type,
        entity_id,
        details_json
      )
      SELECT
        'admin',
        'create',
        'exam',
        CAST(id AS TEXT),
        ?
      FROM exams
      WHERE slug = ?
    `).bind(
      JSON.stringify({ slug, regionId, categoryId }),
      slug
    )
  ];

  try {
    await env.DB.batch(statements);

    return jsonResponse({
      success: true,
      message: "Exam created successfully."
    }, 201);
  } catch (error) {
    console.error("Create exam error:", error);

    return jsonResponse({
      error: "Unable to create exam. The slug may already exist."
    }, 409);
  }
}

// PUT /api/admin/exams/:id
async function updateExam(id, request, env) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }

  const slug = typeof body.slug === "string"
    ? body.slug.trim().toLowerCase()
    : "";

  if (!validateSlug(slug)) {
    return jsonResponse({
      error: "Slug must contain lowercase letters, numbers and hyphens."
    }, 400);
  }

  const fields = validateExamFields(body);

  if (fields.error) {
    return jsonResponse({ error: fields.error }, 400);
  }

  const {
    regionId,
    categoryId,
    questionCount,
    timeLimit,
    passingScore,
    status,
    defaultLanguage
  } = fields.values;

  const existing = await env.DB.prepare(`
    SELECT id
    FROM exams
    WHERE id = ?
  `).bind(id).first();

  if (!existing) {
    return jsonResponse({ error: "Exam not found." }, 404);
  }

  const relation = await validateRelations(env, regionId, categoryId);

  if (relation.error) {
    return jsonResponse({ error: relation.error }, 400);
  }

  const languages = await getEnabledLanguages(env);

  if (!validateTranslations(body.translations, languages)) {
    return jsonResponse({
      error: "Please provide a title and description for every enabled language."
    }, 400);
  }

  const translations = cleanTranslations(body.translations, languages);

  if (!languages.some(language => language.code === defaultLanguage)) {
    return jsonResponse({
      error: "Default language must be enabled."
    }, 400);
  }

  const statements = [
    env.DB.prepare(`
      UPDATE exams
      SET
        region_id = ?,
        category_id = ?,
        slug = ?,
        status = ?,
        default_language = ?,
        question_count = ?,
        time_limit_minutes = ?,
        passing_score_percent = ?
      WHERE id = ?
    `).bind(
      regionId,
      categoryId,
      slug,
      status,
      defaultLanguage,
      questionCount,
      timeLimit,
      passingScore,
      id
    ),

    ...languages.map(language =>
      env.DB.prepare(`
        INSERT INTO exam_translations (
          exam_id,
          language_code,
          title,
          description
        )
        VALUES (?, ?, ?, ?)
        ON CONFLICT(exam_id, language_code)
        DO UPDATE SET
          title = excluded.title,
          description = excluded.description
      `).bind(
        id,
        language.code,
        translations[language.code].title,
        translations[language.code].description
      )
    ),

    env.DB.prepare(`
      INSERT INTO admin_audit_logs (
        actor,
        action,
        entity_type,
        entity_id,
        details_json
      )
      VALUES ('admin', 'update', 'exam', ?, ?)
    `).bind(
      String(id),
      JSON.stringify({ slug, regionId, categoryId })
    )
  ];

  try {
    await env.DB.batch(statements);

    return jsonResponse({
      success: true,
      message: "Exam updated successfully."
    });
  } catch (error) {
    console.error("Update exam error:", error);

    return jsonResponse({
      error: "Unable to update exam. The slug may already exist."
    }, 409);
  }
}

// DELETE /api/admin/exams/:id
async function deleteExam(id, env) {
  const existing = await env.DB.prepare(`
    SELECT id, slug
    FROM exams
    WHERE id = ?
  `).bind(id).first();

  if (!existing) {
    return jsonResponse({ error: "Exam not found." }, 404);
  }

  const usage = await env.DB.prepare(`
    SELECT
      (SELECT COUNT(*) FROM topics WHERE exam_id = ?) AS topic_count,
      (SELECT COUNT(*) FROM questions WHERE exam_id = ?) AS question_count,
      (SELECT COUNT(*) FROM exam_attempts WHERE exam_id = ?) AS attempt_count
  `).bind(id, id, id).first();

  if (
    Number(usage?.topic_count || 0) > 0 ||
    Number(usage?.question_count || 0) > 0 ||
    Number(usage?.attempt_count || 0) > 0
  ) {
    return jsonResponse({
      error: "This exam has topics, questions or exam records and cannot be deleted."
    }, 409);
  }

  try {
    await env.DB.batch([
      env.DB.prepare(`
        DELETE FROM exam_translations
        WHERE exam_id = ?
      `).bind(id),

      env.DB.prepare(`
        DELETE FROM exams
        WHERE id = ?
      `).bind(id),

      env.DB.prepare(`
        INSERT INTO admin_audit_logs (
          actor,
          action,
          entity_type,
          entity_id,
          details_json
        )
        VALUES ('admin', 'delete', 'exam', ?, ?)
      `).bind(
        String(id),
        JSON.stringify({ slug: existing.slug })
      )
    ]);

    return jsonResponse({
      success: true,
      message: "Exam deleted successfully."
    });
  } catch (error) {
    console.error("Delete exam error:", error);

    return jsonResponse({
      error: "Unable to delete exam."
    }, 409);
  }
}

// Main router
export async function handleAdminExams(request, env) {
  if (!(await isAdminAuthenticated(request, env))) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  const url = new URL(request.url);
  const method = request.method;

  if (url.pathname === API_PATH) {
    if (method === "GET") {
      return listExams(env);
    }

    if (method === "POST") {
      return createExam(request, env);
    }

    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const match = url.pathname.match(
    /^\/api\/admin\/exams\/(\d+)$/
  );

  if (match) {
    const id = Number(match[1]);

    if (method === "PUT") {
      return updateExam(id, request, env);
    }

    if (method === "DELETE") {
      return deleteExam(id, env);
    }

    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  return jsonResponse({ error: "Not found." }, 404);
}
