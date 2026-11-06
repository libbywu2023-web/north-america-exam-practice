import { isAdminAuthenticated } from "./admin-auth.js";

const API_PATH = "/api/admin/questions";

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

function validateQuestion(body, languages) {
  const examId = Number(body.exam_id);
  const topicId = body.topic_id === "" ||
    body.topic_id === null ||
    body.topic_id === undefined
    ? null
    : Number(body.topic_id);

  if (!Number.isInteger(examId) || examId <= 0) {
    return { error: "Please select an exam." };
  }

  if (
    topicId !== null &&
    (!Number.isInteger(topicId) || topicId <= 0)
  ) {
    return { error: "Please select a valid topic." };
  }

  if (!["easy", "normal", "hard"].includes(body.difficulty)) {
    return { error: "Invalid difficulty." };
  }

  if (!["draft", "published", "archived"].includes(body.status)) {
    return { error: "Invalid question status." };
  }

  if (
    !body.translations ||
    typeof body.translations !== "object" ||
    Array.isArray(body.translations)
  ) {
    return { error: "Question translations are required." };
  }

  for (const language of languages) {
    const translation = body.translations[language.code];

    if (
      !translation ||
      typeof translation.question_text !== "string" ||
      !translation.question_text.trim()
    ) {
      return {
        error: `Please enter the question in ${language.native_name}.`
      };
    }

    if (
      typeof translation.explanation !== "string"
    ) {
      return {
        error: `Please enter a valid explanation in ${language.native_name}.`
      };
    }
  }

  if (!Array.isArray(body.options) || body.options.length < 2 || body.options.length > 8) {
    return { error: "A question must have between 2 and 8 options." };
  }

  const keys = new Set();
  let correctCount = 0;

  for (let index = 0; index < body.options.length; index++) {
    const option = body.options[index];

    if (!option || typeof option !== "object") {
      return { error: "Invalid question option." };
    }

    const key = String(option.option_key || "").trim().toUpperCase();

    if (!/^[A-H]$/.test(key) || keys.has(key)) {
      return { error: "Option keys must be unique letters from A to H." };
    }

    keys.add(key);

    if (option.is_correct === true || option.is_correct === 1) {
      correctCount++;
    }

    if (
      !option.translations ||
      typeof option.translations !== "object"
    ) {
      return { error: `Please provide translations for option ${key}.` };
    }

    for (const language of languages) {
      const text = option.translations[language.code];

      if (typeof text !== "string" || !text.trim()) {
        return {
          error: `Please enter option ${key} in ${language.native_name}.`
        };
      }
    }
  }

  if (correctCount !== 1) {
    return { error: "Please select exactly one correct answer." };
  }

  const sourceUrl = body.explanation_source_url == null
    ? null
    : String(body.explanation_source_url).trim();

  if (
    sourceUrl &&
    !/^https:\/\/\S+$/i.test(sourceUrl)
  ) {
    return { error: "Source URL must start with https://." };
  }

  return {
    values: {
      examId,
      topicId,
      difficulty: body.difficulty,
      status: body.status,
      sourceUrl,
      translations: body.translations,
      options: body.options.map((option, index) => ({
        optionKey: String(option.option_key).trim().toUpperCase(),
        sortOrder: index + 1,
        isCorrect:
          option.is_correct === true || option.is_correct === 1 ? 1 : 0,
        translations: option.translations
      }))
    }
  };
}

async function validateRelations(env, examId, topicId) {
  const exam = await env.DB.prepare(`
    SELECT id
    FROM exams
    WHERE id = ?
  `).bind(examId).first();

  if (!exam) {
    return { error: "Selected exam does not exist." };
  }

  if (topicId !== null) {
    const topic = await env.DB.prepare(`
      SELECT id
      FROM topics
      WHERE id = ? AND exam_id = ?
    `).bind(topicId, examId).first();

    if (!topic) {
      return { error: "Selected topic does not belong to this exam." };
    }
  }

  return {};
}

async function listQuestions(env) {
  const [
    questionResult,
    questionTranslationResult,
    optionResult,
    optionTranslationResult,
    languages,
    examsResult,
    topicsResult,
    imageResult
  ] = await Promise.all([
    env.DB.prepare(`
      SELECT
        q.id,
        q.exam_id,
        q.topic_id,
        q.difficulty,
        q.status,
        q.explanation_source_url,
        q.reviewed_at,
        q.created_at,
        e.slug AS exam_slug,
        COALESCE(et.title, e.slug) AS exam_title,
        t.slug AS topic_slug,
        COALESCE(tt.name, t.slug) AS topic_name,
        (
          SELECT COUNT(*)
          FROM question_images qi
          WHERE qi.question_id = q.id
        ) AS image_count,
        (
          SELECT COUNT(*)
          FROM attempt_questions aq
          WHERE aq.question_id = q.id
        ) AS attempt_count
      FROM questions q
      JOIN exams e ON e.id = q.exam_id
      LEFT JOIN exam_translations et
        ON et.exam_id = e.id
        AND et.language_code = e.default_language
      LEFT JOIN topics t ON t.id = q.topic_id
      LEFT JOIN topic_translations tt
        ON tt.topic_id = t.id
        AND tt.language_code = e.default_language
      ORDER BY q.id DESC
    `).all(),

    env.DB.prepare(`
      SELECT question_id, language_code, question_text, explanation
      FROM question_translations
    `).all(),

    env.DB.prepare(`
      SELECT id, question_id, option_key, sort_order, is_correct
      FROM question_options
      ORDER BY question_id, sort_order
    `).all(),

    env.DB.prepare(`
      SELECT option_id, language_code, option_text
      FROM option_translations
    `).all(),

    getEnabledLanguages(env),

    env.DB.prepare(`
      SELECT id, slug
      FROM exams
      ORDER BY id DESC
    `).all(),

    env.DB.prepare(`
      SELECT id, exam_id, slug
      FROM topics
      ORDER BY exam_id, sort_order
    `).all(),

    env.DB.prepare(`
      SELECT question_id, image_url, alt_text, sort_order
      FROM question_images
      ORDER BY question_id, sort_order
    `).all()
  ]);

    const imagesByQuestion = {};

  for (const row of imageResult.results || []) {
    imagesByQuestion[row.question_id] ||= [];

    imagesByQuestion[row.question_id].push({
      url: row.image_url,
      alt: row.alt_text,
      sort_order: row.sort_order
    });
  }
  const questionTranslations = {};
  for (const row of questionTranslationResult.results || []) {
    questionTranslations[row.question_id] ||= {};
    questionTranslations[row.question_id][row.language_code] = {
      question_text: row.question_text,
      explanation: row.explanation
    };
  }

  const optionTranslations = {};
  for (const row of optionTranslationResult.results || []) {
    optionTranslations[row.option_id] ||= {};
    optionTranslations[row.option_id][row.language_code] = row.option_text;
  }

  const optionsByQuestion = {};
  for (const row of optionResult.results || []) {
    optionsByQuestion[row.question_id] ||= [];
    optionsByQuestion[row.question_id].push({
      id: row.id,
      option_key: row.option_key,
      sort_order: row.sort_order,
      is_correct: row.is_correct === 1,
      translations: optionTranslations[row.id] || {}
    });
  }

  const questions = (questionResult.results || []).map(row => ({
    ...row,
    translations: questionTranslations[row.id] || {},
    options: optionsByQuestion[row.id] || [],
    images: imagesByQuestion[row.id] || []
  }));

  return jsonResponse({
    questions,
    languages,
    exams: examsResult.results || [],
    topics: topicsResult.results || []
  });
}

async function saveQuestion(id, request, env) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }

  const languages = await getEnabledLanguages(env);
  if (!languages.length) {
    return jsonResponse({ error: "No enabled languages found." }, 400);
  }

  const validated = validateQuestion(body, languages);
  if (validated.error) {
    return jsonResponse({ error: validated.error }, 400);
  }

  const values = validated.values;
  const relations = await validateRelations(
    env,
    values.examId,
    values.topicId
  );

  if (relations.error) {
    return jsonResponse({ error: relations.error }, 400);
  }

  let questionId = id;

  if (id !== null) {
    const existing = await env.DB.prepare(`
      SELECT id
      FROM questions
      WHERE id = ?
    `).bind(id).first();

    if (!existing) {
      return jsonResponse({ error: "Question not found." }, 404);
    }
  }

  try {
    if (id === null) {
      const inserted = await env.DB.prepare(`
        INSERT INTO questions (
          exam_id,
          topic_id,
          difficulty,
          status,
          explanation_source_url
        )
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        values.examId,
        values.topicId,
        values.difficulty,
        values.status,
        values.sourceUrl
      ).run();

      questionId = Number(inserted.meta.last_row_id);
    } else {
      await env.DB.prepare(`
        UPDATE questions
        SET
          exam_id = ?,
          topic_id = ?,
          difficulty = ?,
          status = ?,
          explanation_source_url = ?
        WHERE id = ?
      `).bind(
        values.examId,
        values.topicId,
        values.difficulty,
        values.status,
        values.sourceUrl,
        id
      ).run();
    }

    const statements = [];

    statements.push(
      env.DB.prepare(`
        DELETE FROM question_translations
        WHERE question_id = ?
      `).bind(questionId)
    );

    for (const language of languages) {
      const translation = values.translations[language.code];

      statements.push(
        env.DB.prepare(`
          INSERT INTO question_translations (
            question_id,
            language_code,
            question_text,
            explanation
          )
          VALUES (?, ?, ?, ?)
        `).bind(
          questionId,
          language.code,
          translation.question_text.trim(),
          translation.explanation.trim()
        )
      );
    }

    const existingOptionsResult = await env.DB.prepare(`
      SELECT id, option_key
      FROM question_options
      WHERE question_id = ?
    `).bind(questionId).all();

    const existingOptions = existingOptionsResult.results || [];
    const incomingKeys = new Set(values.options.map(option => option.optionKey));

    for (const existing of existingOptions) {
      if (!incomingKeys.has(existing.option_key)) {
        const used = await env.DB.prepare(`
          SELECT COUNT(*) AS total
          FROM attempt_questions
          WHERE selected_option_id = ?
        `).bind(existing.id).first();

        if (Number(used?.total || 0) > 0) {
          throw new Error(
            `Option ${existing.option_key} has been used in exam records and cannot be removed.`
          );
        }

        statements.push(
          env.DB.prepare(`
            DELETE FROM question_options
            WHERE id = ?
          `).bind(existing.id)
        );
      }
    }

    for (const option of values.options) {
      const existing = existingOptions.find(
        item => item.option_key === option.optionKey
      );

      if (existing) {
        statements.push(
          env.DB.prepare(`
            UPDATE question_options
            SET sort_order = ?, is_correct = ?
            WHERE id = ?
          `).bind(
            option.sortOrder,
            option.isCorrect,
            existing.id
          )
        );

        statements.push(
          env.DB.prepare(`
            DELETE FROM option_translations
            WHERE option_id = ?
          `).bind(existing.id)
        );

        for (const language of languages) {
          statements.push(
            env.DB.prepare(`
              INSERT INTO option_translations (
                option_id,
                language_code,
                option_text
              )
              VALUES (?, ?, ?)
            `).bind(
              existing.id,
              language.code,
              option.translations[language.code].trim()
            )
          );
        }
      } else {
        statements.push(
          env.DB.prepare(`
            INSERT INTO question_options (
              question_id,
              option_key,
              sort_order,
              is_correct
            )
            VALUES (?, ?, ?, ?)
          `).bind(
            questionId,
            option.optionKey,
            option.sortOrder,
            option.isCorrect
          )
        );

        for (const language of languages) {
          statements.push(
            env.DB.prepare(`
              INSERT INTO option_translations (
                option_id,
                language_code,
                option_text
              )
              SELECT id, ?, ?
              FROM question_options
              WHERE question_id = ? AND option_key = ?
            `).bind(
              language.code,
              option.translations[language.code].trim(),
              questionId,
              option.optionKey
            )
          );
        }
      }
    }

        // Save question images
    statements.push(
      env.DB.prepare(`
        DELETE FROM question_images
        WHERE question_id = ?
      `).bind(questionId)
    );

    const images = Array.isArray(body.images) ? body.images : [];

    for (const image of images) {
      const imageUrl = String(image.url || "").trim();

      if (!imageUrl) continue;

      statements.push(
        env.DB.prepare(`
          INSERT INTO question_images (
            question_id,
            image_url,
            alt_text,
            sort_order
          )
          VALUES (?, ?, ?, ?)
        `).bind(
          questionId,
          imageUrl,
          String(image.alt || "").trim(),
          images.indexOf(image) + 1
        )
      );
    }

    statements.push(
      env.DB.prepare(`
        INSERT INTO admin_audit_logs (
          actor,
          action,
          entity_type,
          entity_id,
          details_json
        )
        VALUES ('admin', ?, 'question', ?, ?)
      `).bind(
        id === null ? "create" : "update",
        String(questionId),
        JSON.stringify({
          exam_id: values.examId,
          topic_id: values.topicId,
          status: values.status
        })
      )
    );

    await env.DB.batch(statements);

    return jsonResponse({
      success: true,
      id: questionId,
      message: id === null
        ? "Question created successfully."
        : "Question updated successfully."
    }, id === null ? 201 : 200);
  } catch (error) {
    console.error("Save question error:", error);

    if (id === null && questionId) {
      await env.DB.prepare(`
        DELETE FROM questions
        WHERE id = ?
      `).bind(questionId).run().catch(() => {});
    }

    return jsonResponse({
      error: error.message || "Unable to save question."
    }, 409);
  }
}

async function deleteQuestion(id, env) {
  const existing = await env.DB.prepare(`
    SELECT id, status
    FROM questions
    WHERE id = ?
  `).bind(id).first();

  if (!existing) {
    return jsonResponse({ error: "Question not found." }, 404);
  }

  const usage = await env.DB.prepare(`
    SELECT COUNT(*) AS total
    FROM attempt_questions
    WHERE question_id = ?
  `).bind(id).first();

  if (Number(usage?.total || 0) > 0) {
    return jsonResponse({
      error: "This question has exam history. Please archive it instead of deleting it."
    }, 409);
  }

  try {
    await env.DB.batch([
      env.DB.prepare(`
        DELETE FROM questions
        WHERE id = ?
      `).bind(id),
      env.DB.prepare(`
        INSERT INTO admin_audit_logs (
          actor, action, entity_type, entity_id, details_json
        )
        VALUES ('admin', 'delete', 'question', ?, ?)
      `).bind(String(id), JSON.stringify({ previous_status: existing.status }))
    ]);

    return jsonResponse({
      success: true,
      message: "Question deleted successfully."
    });
  } catch (error) {
    console.error("Delete question error:", error);
    return jsonResponse({
      error: "Unable to delete question."
    }, 409);
  }
}

export async function handleAdminQuestions(request, env) {
  if (!(await isAdminAuthenticated(request, env))) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  const url = new URL(request.url);
  const method = request.method;

  if (url.pathname === API_PATH) {
    if (method === "GET") {
      return listQuestions(env);
    }

    if (method === "POST") {
      return saveQuestion(null, request, env);
    }

    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const match = url.pathname.match(
    /^\/api\/admin\/questions\/(\d+)$/
  );

  if (match) {
    const id = Number(match[1]);

    if (method === "PUT") {
      return saveQuestion(id, request, env);
    }

    if (method === "DELETE") {
      return deleteQuestion(id, env);
    }

    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  return jsonResponse({ error: "Not found." }, 404);
}
