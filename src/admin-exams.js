import { translateTexts } from "./services/translation.js";

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

async function getExamLanguageData(env) {
  const [configured, coverage] = await Promise.all([
    env.DB.prepare(`SELECT exam_id, language_code, is_enabled FROM exam_languages`).all(),
    env.DB.prepare(`
      SELECT e.id AS exam_id, l.code AS language_code,
        CASE WHEN et.title IS NOT NULL AND TRIM(et.title) <> '' THEN 1 ELSE 0 END AS title_ready,
        (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id AND q.status = 'published') AS question_total,
        (SELECT COUNT(*) FROM questions q JOIN question_translations qt ON qt.question_id = q.id
         WHERE q.exam_id = e.id AND q.status = 'published' AND qt.language_code = l.code
           AND TRIM(qt.question_text) <> '') AS question_ready,
        (SELECT COUNT(*) FROM question_options o JOIN questions q ON q.id = o.question_id
         WHERE q.exam_id = e.id AND q.status = 'published') AS option_total,
        (SELECT COUNT(*) FROM question_options o JOIN questions q ON q.id = o.question_id
         JOIN option_translations ot ON ot.option_id = o.id
         WHERE q.exam_id = e.id AND q.status = 'published' AND ot.language_code = l.code
           AND TRIM(ot.option_text) <> '') AS option_ready,
        (SELECT COUNT(DISTINCT t.id) FROM topics t JOIN questions q ON q.topic_id = t.id
         WHERE q.exam_id = e.id AND q.status = 'published') AS topic_total,
        (SELECT COUNT(DISTINCT t.id) FROM topics t JOIN questions q ON q.topic_id = t.id
         JOIN topic_translations tt ON tt.topic_id = t.id
         WHERE q.exam_id = e.id AND q.status = 'published' AND tt.language_code = l.code
           AND TRIM(tt.name) <> '') AS topic_ready
      FROM exams e CROSS JOIN languages l
      LEFT JOIN exam_translations et
        ON et.exam_id = e.id AND et.language_code = l.code
      WHERE l.is_enabled = 1
    `).all()
  ]);
  const byExam = {};
  for (const row of configured.results || []) {
    (byExam[row.exam_id] ||= {})[row.language_code] = { is_enabled: Number(row.is_enabled) };
  }
  const byCoverage = {};
  for (const row of coverage.results || []) {
    (byCoverage[row.exam_id] ||= {})[row.language_code] = row;
  }
  return { byExam, byCoverage };
}

function parseExamLanguages(input, languages, defaultLanguage) {
  if (!Array.isArray(input) || !input.length) return { error: 'Select at least one supported language.' };
  const allowed = new Set(languages.map(language => language.code));
  const seen = new Set();
  const rows = [];
  for (const item of input) {
    if (!item || typeof item !== 'object' || !allowed.has(item.language_code) ||
        typeof item.is_enabled !== 'boolean' || seen.has(item.language_code)) {
      return { error: 'Invalid supported language configuration.' };
    }
    seen.add(item.language_code);
    rows.push({ language_code: item.language_code, is_enabled: item.is_enabled ? 1 : 0 });
  }
  if (!seen.has(defaultLanguage)) return { error: 'Default language must be selected as supported.' };
  return { rows };
}

function isTranslationReady(coverage, titleOverride = null) {
  if (!coverage) return false;
  const titleReady = titleOverride === null ? Number(coverage.title_ready) === 1 : Boolean(titleOverride);
  return titleReady && Number(coverage.question_total) > 0 &&
    Number(coverage.question_ready) === Number(coverage.question_total) &&
    Number(coverage.option_ready) === Number(coverage.option_total) &&
    Number(coverage.topic_ready) === Number(coverage.topic_total);
}

function validateSlug(slug) {
  return typeof slug === "string" &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function validateTranslations(translations, languages) {
  if (!translations || typeof translations !== "object" || Array.isArray(translations)) return false;
  const allowed = new Set(languages.map(language => language.code));
  if (!Object.keys(translations).every(code => allowed.has(code))) return false;
  const english = translations.en;
  if (!english || typeof english.title !== "string" || !english.title.trim()) return false;
  return Object.values(translations).every(item => {
    if (!item || typeof item !== "object") return false;
    const title = item.title ?? "";
    const description = item.description ?? "";
    return typeof title === "string" && title.length <= 200 &&
      typeof description === "string" && description.length <= 2000;
  });
}

function cleanTranslations(translations, languages) {
  const result = {};
  for (const language of languages) {
    const item = translations[language.code];
    if (item && typeof item.title === "string" && item.title.trim()) {
      result[language.code] = {
        title: item.title.trim(), description: (item.description || "").trim()
      };
    }
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
  const showNewBadge = body.show_new_badge === true;
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

  if (typeof defaultLanguage !== "string" || !/^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(defaultLanguage)) {
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
      defaultLanguage,
      showNewBadge
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
    categoriesResult,
    languageData
  ] = await Promise.all([
    env.DB.prepare(`
      SELECT
        e.id,
        e.region_id,
        e.category_id,
        e.slug,
        e.status,
        e.show_new_badge,
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
    `).all(),
    getExamLanguageData(env)
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
    translations: translationMap[exam.id] || {},
    supported_languages: languageData.byExam[exam.id] || {},
    language_coverage: languageData.byCoverage[exam.id] || {}
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
    defaultLanguage,
    showNewBadge
  } = fields.values;

  const relation = await validateRelations(env, regionId, categoryId);

  if (relation.error) {
    return jsonResponse({ error: relation.error }, 400);
  }

  const languages = await getEnabledLanguages(env);

  if (!validateTranslations(body.translations, languages)) {
    return jsonResponse({
      error: "Please provide an English title; other language translations are optional."
    }, 400);
  }

  const translations = cleanTranslations(body.translations, languages);

  if (!languages.some(language => language.code === defaultLanguage)) {
    return jsonResponse({
      error: "Default language must be enabled."
    }, 400);
  }

  const languageSelection = parseExamLanguages(body.supported_languages, languages, defaultLanguage);
  if (languageSelection.error) return jsonResponse({ error: languageSelection.error }, 400);
  // New exams have no published questions. Keep all selected languages preparing.
  if (languageSelection.rows.some(row => row.is_enabled)) {
    return jsonResponse({ error: 'New exams have no published questions. Save languages as Preparing.' }, 400);
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
        passing_score_percent,
        show_new_badge
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      regionId,
      categoryId,
      slug,
      status,
      defaultLanguage,
      questionCount,
      timeLimit,
      passingScore,
      showNewBadge ? 1 : 0
    ),

    ...Object.keys(translations).map(code =>
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
        code,
        translations[code].title,
        translations[code].description,
        slug
      )
    ),

    ...languageSelection.rows.map(row => env.DB.prepare(`
      INSERT INTO exam_languages (exam_id, language_code, is_enabled)
      SELECT id, ?, ? FROM exams WHERE slug = ?
    `).bind(row.language_code, row.is_enabled, slug)),

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
    defaultLanguage,
    showNewBadge
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
      error: "Please provide an English title; other language translations are optional."
    }, 400);
  }

  const translations = cleanTranslations(body.translations, languages);

  if (!languages.some(language => language.code === defaultLanguage)) {
    return jsonResponse({
      error: "Default language must be enabled."
    }, 400);
  }

  const languageSelection = parseExamLanguages(body.supported_languages, languages, defaultLanguage);
  if (languageSelection.error) return jsonResponse({ error: languageSelection.error }, 400);
  const current = await env.DB.prepare(`
    SELECT language_code, is_enabled FROM exam_languages WHERE exam_id = ?
  `).bind(id).all();
  const previous = new Map((current.results || []).map(row => [row.language_code, Number(row.is_enabled)]));
  const coverageRows = await getExamLanguageData(env);
  for (const row of languageSelection.rows) {
    if (row.is_enabled && previous.get(row.language_code) !== 1 &&
        !isTranslationReady(coverageRows.byCoverage[id]?.[row.language_code], translations[row.language_code]?.title || '')) {
      return jsonResponse({ error: `Cannot enable ${row.language_code}: title, published questions, options or topic translations are incomplete.` }, 400);
    }
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
        passing_score_percent = ?,
        show_new_badge = ?
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
      showNewBadge ? 1 : 0,
      id
    ),

    ...Object.keys(translations).map(code =>
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
        code,
        translations[code].title,
        translations[code].description
      )
    ),

    env.DB.prepare(`DELETE FROM exam_languages WHERE exam_id = ?`).bind(id),
    ...languageSelection.rows.map(row => env.DB.prepare(`
      INSERT INTO exam_languages (exam_id, language_code, is_enabled) VALUES (?, ?, ?)
    `).bind(id, row.language_code, row.is_enabled)),

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

      env.DB.prepare(`DELETE FROM exam_languages WHERE exam_id = ?`).bind(id),

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

// POST /api/admin/exams/:id/translate-missing
// Small, explicit batches. Existing translations are never overwritten.
async function translateMissingExamQuestions(id, request, env) {
  const body = await request.json().catch(() => null);
  const language = body?.language_code;
  if (typeof language !== "string" || language === "en") {
    return jsonResponse({ error: "Choose a non-English target language." }, 400);
  }
  const requested = Number(body?.limit ?? 5);
  if (!Number.isInteger(requested) || requested < 1 || requested > 10) {
    return jsonResponse({ error: "Batch size must be between 1 and 10 questions." }, 400);
  }
  const exam = await env.DB.prepare(`
    SELECT e.id, e.default_language, el.is_enabled
    FROM exams e JOIN exam_languages el ON el.exam_id = e.id
    JOIN languages l ON l.code = el.language_code AND l.is_enabled = 1
    WHERE e.id = ? AND el.language_code = ?
  `).bind(id, language).first();
  if (!exam) return jsonResponse({ error: "Configure the target language for this exam first." }, 400);
  if (Number(exam.is_enabled) === 1) {
    return jsonResponse({ error: "Disable the public language before bulk translation." }, 409);
  }
  // Only missing rows, never overwrite existing text (including manual edits).
  const candidates = await env.DB.prepare(`
    SELECT q.id
    FROM questions q
    JOIN question_translations en ON en.question_id = q.id
      AND en.language_code = 'en' AND TRIM(en.question_text) <> ''
    WHERE q.exam_id = ? AND q.status = 'published'
      AND (
        NOT EXISTS (SELECT 1 FROM question_translations qt
          WHERE qt.question_id = q.id AND qt.language_code = ?)
        OR EXISTS (SELECT 1 FROM question_options o
          JOIN option_translations src ON src.option_id = o.id
            AND src.language_code = 'en' AND TRIM(src.option_text) <> ''
          WHERE o.question_id = q.id
            AND NOT EXISTS (SELECT 1 FROM option_translations dest
              WHERE dest.option_id = o.id AND dest.language_code = ?))
      )
    ORDER BY q.id LIMIT ?
  `).bind(id, language, language, requested).all();
  const ids = (candidates.results || []).map(row => row.id);
  if (!ids.length) return jsonResponse({ processed_questions: 0, translated_texts: 0, complete: true });
  const placeholders = ids.map(() => '?').join(',');
  const [questions, options] = await Promise.all([
    env.DB.prepare(`SELECT q.id, src.question_text, src.explanation
      FROM questions q JOIN question_translations src ON src.question_id = q.id AND src.language_code = 'en'
      LEFT JOIN question_translations dest ON dest.question_id = q.id AND dest.language_code = ?
      WHERE q.id IN (${placeholders}) AND dest.question_id IS NULL ORDER BY q.id`)
      .bind(language, ...ids).all(),
    env.DB.prepare(`SELECT o.id, src.option_text FROM question_options o
      JOIN option_translations src ON src.option_id = o.id AND src.language_code = 'en'
      LEFT JOIN option_translations dest ON dest.option_id = o.id AND dest.language_code = ?
      WHERE o.question_id IN (${placeholders}) AND dest.option_id IS NULL ORDER BY o.id`)
      .bind(language, ...ids).all()
  ]);
  const qrows = questions.results || [];
  const orows = options.results || [];
  const texts = [...qrows.map(row => row.question_text), ...orows.map(row => row.option_text)];
  if (!texts.length) return jsonResponse({ error: "No translatable English source texts found." }, 409);
  let translated;
  try { translated = await translateTexts(texts, language, env); }
  catch (error) {
    console.error("Batch translation failed:", error.message);
    return jsonResponse({ error: "Translation service failed; no changes were saved." }, 502);
  }
  if (translated.some(text => !text?.trim())) {
    return jsonResponse({ error: "Translation returned empty content; no changes were saved." }, 502);
  }
  const statements = [
    ...qrows.map((row, i) => env.DB.prepare(`
      INSERT INTO question_translations
      (question_id, language_code, question_text, explanation, question_text_source, explanation_source)
      VALUES (?, ?, ?, '', 'machine', 'machine') ON CONFLICT(question_id, language_code) DO NOTHING
    `).bind(row.id, language, translated[i])),
    ...orows.map((row, i) => env.DB.prepare(`
      INSERT INTO option_translations (option_id, language_code, option_text, translation_source)
      VALUES (?, ?, ?, 'machine') ON CONFLICT(option_id, language_code) DO NOTHING
    `).bind(row.id, language, translated[qrows.length + i]))
  ];
  try { await env.DB.batch(statements); }
  catch (error) {
    console.error("Batch translation database error:", error);
    return jsonResponse({ error: "Unable to save translated texts." }, 500);
  }
  return jsonResponse({ processed_questions: ids.length, translated_texts: texts.length,
    message: "Batch saved. Review translations before enabling this language." });
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

  const translateMatch = url.pathname.match(/^\/api\/admin\/exams\/(\d+)\/translate-missing$/);
  if (translateMatch) {
    if (method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);
    return translateMissingExamQuestions(Number(translateMatch[1]), request, env);
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
