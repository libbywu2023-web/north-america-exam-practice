
import { isAdminAuthenticated } from "./admin-auth.js";

const API_PATH = "/api/admin/topics";

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

function validateTopicFields(body) {
  const examId = Number(body.exam_id);
  const sortOrder = Number(body.sort_order ?? 0);
  const topicType = body.topic_type || "standard";

  if (!Number.isInteger(examId) || examId <= 0) {
    return { error: "Please select a valid exam." };
  }

  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    return { error: "Sort order must be a non-negative integer." };
  }

  if (!["standard", "mixed"].includes(topicType)) {
    return { error: "Invalid topic type." };
  }

  const slug = typeof body.slug === "string"
    ? body.slug.trim().toLowerCase()
    : "";

  if (!validateSlug(slug)) {
    return {
      error: "Slug must contain lowercase letters, numbers and hyphens."
    };
  }

  let selectionMode = "all";
  let randomQuestionCount = null;

  if (topicType === "mixed") {
    selectionMode = body.selection_mode || "all";

    if (!["all", "random"].includes(selectionMode)) {
      return { error: "Invalid selection mode." };
    }

    if (selectionMode === "random") {
      randomQuestionCount = Number(body.random_question_count);

      if (
        !Number.isInteger(randomQuestionCount) ||
        randomQuestionCount <= 0 ||
        randomQuestionCount > 1000
      ) {
        return {
          error: "Random question count must be between 1 and 1000."
        };
      }
    }
  }

  return {
    value: {
      examId,
      slug,
      sortOrder,
      topicType,
      selectionMode,
      randomQuestionCount
    }
  };
}

async function examExists(env, examId) {
  return await env.DB.prepare(`
    SELECT id
    FROM exams
    WHERE id = ?
  `).bind(examId).first();
}

// GET /api/admin/topics
async function listTopics(env) {
  const [topicResult, translationResult, languages, examResult] =
    await Promise.all([
      env.DB.prepare(`
        SELECT
          t.id,
          t.exam_id,
          t.slug,
          t.sort_order,
          t.topic_type,
          t.selection_mode,
          t.random_question_count,
          e.slug AS exam_slug,
          COALESCE(et.title, e.slug) AS exam_title,
          COUNT(DISTINCT q.id) AS question_count
        FROM topics t
        JOIN exams e ON e.id = t.exam_id
        LEFT JOIN exam_translations et
          ON et.exam_id = e.id
          AND et.language_code = 'en'
        LEFT JOIN questions q ON q.topic_id = t.id
        GROUP BY
          t.id,
          t.exam_id,
          t.slug,
          t.sort_order,
          t.topic_type,
          t.selection_mode,
          t.random_question_count,
          e.slug,
          et.title
        ORDER BY e.id, t.sort_order, t.id
      `).all(),

      env.DB.prepare(`
        SELECT topic_id, language_code, name
        FROM topic_translations
      `).all(),

      getEnabledLanguages(env),

      env.DB.prepare(`
        SELECT
          e.id,
          e.slug,
          COALESCE(et.title, e.slug) AS title
        FROM exams e
        LEFT JOIN exam_translations et
          ON et.exam_id = e.id
          AND et.language_code = 'en'
        ORDER BY e.id
      `).all()
    ]);

  const translationMap = {};

  for (const row of translationResult.results || []) {
    if (!translationMap[row.topic_id]) {
      translationMap[row.topic_id] = {};
    }

    translationMap[row.topic_id][row.language_code] = row.name;
  }

  const topics = (topicResult.results || []).map(topic => ({
    ...topic,
    translations: translationMap[topic.id] || {}
  }));

  return jsonResponse({
    topics,
    languages,
    exams: examResult.results || []
  });
}

// POST /api/admin/topics
async function createTopic(request, env) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }

  const validated = validateTopicFields(body);

  if (validated.error) {
    return jsonResponse({ error: validated.error }, 400);
  }

  const fields = validated.value;
  const languages = await getEnabledLanguages(env);

  if (!validateTranslations(body.translations, languages)) {
    return jsonResponse({
      error: "Please provide a name for every enabled language. Names must be 150 characters or fewer."
    }, 400);
  }

  if (!(await examExists(env, fields.examId))) {
    return jsonResponse({ error: "Exam not found." }, 404);
  }

  const translations = cleanTranslations(body.translations, languages);

  const statements = [
    env.DB.prepare(`
      INSERT INTO topics (
        exam_id,
        slug,
        sort_order,
        topic_type,
        selection_mode,
        random_question_count
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      fields.examId,
      fields.slug,
      fields.sortOrder,
      fields.topicType,
      fields.selectionMode,
      fields.randomQuestionCount
    ),

    ...languages.map(language =>
      env.DB.prepare(`
        INSERT INTO topic_translations
          (topic_id, language_code, name)
        SELECT id, ?, ?
        FROM topics
        WHERE exam_id = ? AND slug = ?
      `).bind(
        language.code,
        translations[language.code],
        fields.examId,
        fields.slug
      )
    ),

    env.DB.prepare(`
      INSERT INTO admin_audit_logs
        (actor, action, entity_type, entity_id, details_json)
      SELECT
        'admin',
        'create',
        'topic',
        CAST(id AS TEXT),
        ?
      FROM topics
      WHERE exam_id = ? AND slug = ?
    `).bind(
      JSON.stringify({
        exam_id: fields.examId,
        slug: fields.slug,
        topic_type: fields.topicType
      }),
      fields.examId,
      fields.slug
    )
  ];

  try {
    await env.DB.batch(statements);

    return jsonResponse({
      success: true,
      message: "Topic created successfully."
    }, 201);
  } catch (error) {
    console.error("Create topic error:", error);

    return jsonResponse({
      error: "Unable to create topic. The slug may already exist, or this exam may already have a Mixed Practice topic."
    }, 409);
  }
}

// PUT /api/admin/topics/:id
async function updateTopic(id, request, env) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }

  const validated = validateTopicFields(body);

  if (validated.error) {
    return jsonResponse({ error: validated.error }, 400);
  }

  const fields = validated.value;
  const languages = await getEnabledLanguages(env);

  if (!validateTranslations(body.translations, languages)) {
    return jsonResponse({
      error: "Please provide a name for every enabled language. Names must be 150 characters or fewer."
    }, 400);
  }

  const existing = await env.DB.prepare(`
    SELECT id, exam_id, topic_type
    FROM topics
    WHERE id = ?
  `).bind(id).first();

  if (!existing) {
    return jsonResponse({ error: "Topic not found." }, 404);
  }

  if (!(await examExists(env, fields.examId))) {
    return jsonResponse({ error: "Exam not found." }, 404);
  }

  // Do not move a topic to another exam if questions are already assigned.
  if (Number(existing.exam_id) !== fields.examId) {
    const usage = await env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM questions
      WHERE topic_id = ?
    `).bind(id).first();

    if (Number(usage?.total || 0) > 0) {
      return jsonResponse({
        error: "This topic has questions assigned and cannot be moved to another exam."
      }, 409);
    }
  }

  // Keep topic type stable after creation to avoid accidental conversion.
  if (existing.topic_type !== fields.topicType) {
    return jsonResponse({
      error: "Topic type cannot be changed after creation. Create a new topic instead."
    }, 400);
  }

  const translations = cleanTranslations(body.translations, languages);

  const statements = [
    env.DB.prepare(`
      UPDATE topics
      SET
        exam_id = ?,
        slug = ?,
        sort_order = ?,
        selection_mode = ?,
        random_question_count = ?
      WHERE id = ?
    `).bind(
      fields.examId,
      fields.slug,
      fields.sortOrder,
      fields.selectionMode,
      fields.randomQuestionCount,
      id
    ),

    ...languages.map(language =>
      env.DB.prepare(`
        INSERT INTO topic_translations
          (topic_id, language_code, name)
        VALUES (?, ?, ?)
        ON CONFLICT(topic_id, language_code)
        DO UPDATE SET name = excluded.name
      `).bind(id, language.code, translations[language.code])
    ),

    env.DB.prepare(`
      INSERT INTO admin_audit_logs
        (actor, action, entity_type, entity_id, details_json)
      VALUES ('admin', 'update', 'topic', ?, ?)
    `).bind(
      String(id),
      JSON.stringify({
        exam_id: fields.examId,
        slug: fields.slug,
        topic_type: fields.topicType,
        selection_mode: fields.selectionMode,
        random_question_count: fields.randomQuestionCount
      })
    )
  ];

  try {
    await env.DB.batch(statements);

    return jsonResponse({
      success: true,
      message: "Topic updated successfully."
    });
  } catch (error) {
    console.error("Update topic error:", error);

    return jsonResponse({
      error: "Unable to update topic. The slug may already exist."
    }, 409);
  }
}

// DELETE /api/admin/topics/:id
async function deleteTopic(id, env) {
  const existing = await env.DB.prepare(`
    SELECT id, topic_type
    FROM topics
    WHERE id = ?
  `).bind(id).first();

  if (!existing) {
    return jsonResponse({ error: "Topic not found." }, 404);
  }

  const usage = await env.DB.prepare(`
    SELECT COUNT(*) AS total
    FROM questions
    WHERE topic_id = ?
  `).bind(id).first();

  if (Number(usage?.total || 0) > 0) {
    return jsonResponse({
      error: "This topic has questions assigned and cannot be deleted. Reassign or remove its questions first."
    }, 409);
  }

  try {
    await env.DB.batch([
      env.DB.prepare(`
        DELETE FROM topic_translations
        WHERE topic_id = ?
      `).bind(id),

      env.DB.prepare(`
        DELETE FROM topics
        WHERE id = ?
      `).bind(id),

      env.DB.prepare(`
        INSERT INTO admin_audit_logs
          (actor, action, entity_type, entity_id, details_json)
        VALUES ('admin', 'delete', 'topic', ?, ?)
      `).bind(
        String(id),
        JSON.stringify({ topic_type: existing.topic_type })
      )
    ]);

    return jsonResponse({
      success: true,
      message: "Topic deleted successfully."
    });
  } catch (error) {
    console.error("Delete topic error:", error);

    return jsonResponse({
      error: "Unable to delete topic."
    }, 409);
  }
}

// Main router
export async function handleAdminTopics(request, env) {
  if (!(await isAdminAuthenticated(request, env))) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  const url = new URL(request.url);
  const method = request.method;

  if (url.pathname === API_PATH) {
    if (method === "GET") {
      return listTopics(env);
    }

    if (method === "POST") {
      return createTopic(request, env);
    }

    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const match = url.pathname.match(
    /^\/api\/admin\/topics\/(\d+)$/
  );

  if (match) {
    const id = Number(match[1]);

    if (method === "PUT") {
      return updateTopic(id, request, env);
    }

    if (method === "DELETE") {
      return deleteTopic(id, env);
    }

    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  return jsonResponse({ error: "Not found." }, 404);
}
