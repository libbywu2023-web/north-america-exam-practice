import { isAdminAuthenticated } from "./admin-auth.js";

const ALLOWED_STATUSES = [
  "waiting_for_image",
  "pending_review",
  "approved",
  "rejected",
  "published"
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

// A language is required only when non-empty content was supplied for it.
async function suppliedLanguages(db, id, enabled) {
  const result = await db.prepare(`
    SELECT language_code FROM question_translations_staging
    WHERE staging_question_id = ? AND (TRIM(question_text) <> '' OR TRIM(COALESCE(explanation, '')) <> '')
    UNION
    SELECT ot.language_code FROM option_translations_staging ot
    JOIN question_options_staging qo ON qo.id = ot.staging_option_id
    WHERE qo.staging_question_id = ? AND TRIM(ot.option_text) <> ''
  `).bind(id, id).all();
  const supplied = new Set((result.results || []).map(row => row.language_code));
  const scope = await db.prepare(`SELECT el.language_code FROM exam_languages el
    JOIN import_batches ib ON ib.exam_id = el.exam_id
    JOIN questions_staging qs ON qs.batch_id = ib.id
    WHERE qs.id = ?`).bind(id).all();
  const allowed = new Set((scope.results || []).map(row => row.language_code));
  return enabled.filter(code => allowed.has(code) && (code === 'en' || supplied.has(code)));
}

async function listReviewQuestions(request, env) {
  const url = new URL(request.url);
  const examSlug = (url.searchParams.get("exam") || "").trim();
  const status = (url.searchParams.get("status") || "").trim();

  if (status && !ALLOWED_STATUSES.includes(status)) {
    return json({ error: "Invalid review status." }, 400);
  }

  const examsResult = await env.DB.prepare(`
    SELECT
      e.slug,
      COALESCE(et.title, e.slug) AS title,
      e.status AS exam_status
    FROM exams e
    LEFT JOIN exam_translations et
      ON et.exam_id = e.id
      AND et.language_code = 'en'
    ORDER BY e.id DESC
  `).all();

  const conditions = [];
  const values = [];

  if (examSlug) {
    conditions.push("e.slug = ?");
    values.push(examSlug);
  }

  if (status) {
    conditions.push("qs.status = ?");
    values.push(status);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const result = await env.DB.prepare(`
    SELECT
      qs.id,
      qs.external_question_id,
      qs.difficulty,
      qs.has_image,
      qs.status,
      qs.created_at,
      e.id AS exam_id,
      e.slug AS exam_slug,
      COALESCE(et.title, e.slug) AS exam_title,
      COALESCE(qt.question_text, '') AS question_en,
      (
        SELECT COUNT(*)
        FROM question_options_staging qos
        WHERE qos.staging_question_id = qs.id
      ) AS option_count,
      (
        SELECT COUNT(*)
        FROM staging_question_images sqi
        WHERE sqi.staging_question_id = qs.id
      ) AS image_count,
      CASE WHEN NOT EXISTS (
        SELECT 1
        FROM languages l
        WHERE l.is_enabled = 1 AND EXISTS (SELECT 1 FROM exam_languages el WHERE el.exam_id = e.id AND el.language_code = l.code)
          AND (l.code = 'en' OR EXISTS (
            SELECT 1 FROM question_translations_staging qx WHERE qx.staging_question_id = qs.id AND qx.language_code = l.code AND (TRIM(qx.question_text) <> '' OR TRIM(COALESCE(qx.explanation, '')) <> '')
          ) OR EXISTS (
            SELECT 1 FROM option_translations_staging ox JOIN question_options_staging qox ON qox.id = ox.staging_option_id WHERE qox.staging_question_id = qs.id AND ox.language_code = l.code AND TRIM(ox.option_text) <> ''
          ))
          AND (
            NOT EXISTS (
              SELECT 1
              FROM question_translations_staging qt2
              WHERE qt2.staging_question_id = qs.id
                AND qt2.language_code = l.code
                AND TRIM(COALESCE(qt2.question_text, '')) <> ''
            )
            OR EXISTS (
              SELECT 1
              FROM question_options_staging qos2
              WHERE qos2.staging_question_id = qs.id
                AND NOT EXISTS (
                  SELECT 1
                  FROM option_translations_staging ot2
                  WHERE ot2.staging_option_id = qos2.id
                    AND ot2.language_code = l.code
                    AND TRIM(COALESCE(ot2.option_text, '')) <> ''
                )
            )
          )
      ) THEN 1 ELSE 0 END AS translation_complete,
      CASE WHEN
        EXISTS (
          SELECT 1
          FROM question_translations_staging qt3
          JOIN languages l3 ON l3.code = qt3.language_code
          WHERE qt3.staging_question_id = qs.id
            AND l3.is_enabled = 1 AND EXISTS (SELECT 1 FROM exam_languages el WHERE el.exam_id = e.id AND el.language_code = l3.code)
            AND TRIM(qt3.question_text) <> '' AND qt3.translation_source = 'machine'
        )
        OR EXISTS (
          SELECT 1
          FROM question_options_staging qos3
          JOIN option_translations_staging ot3
            ON ot3.staging_option_id = qos3.id
          JOIN languages l4 ON l4.code = ot3.language_code
          WHERE qos3.staging_question_id = qs.id
            AND l4.is_enabled = 1 AND EXISTS (SELECT 1 FROM exam_languages el WHERE el.exam_id = e.id AND el.language_code = l4.code)
            AND TRIM(ot3.option_text) <> '' AND ot3.translation_source = 'machine'
        )
      THEN 1 ELSE 0 END AS translation_has_machine,
      CASE WHEN
        NOT EXISTS (
          SELECT 1
          FROM languages l5
          WHERE l5.is_enabled = 1 AND EXISTS (SELECT 1 FROM exam_languages el WHERE el.exam_id = e.id AND el.language_code = l5.code)
          AND (l5.code = 'en' OR EXISTS (
            SELECT 1 FROM question_translations_staging qx WHERE qx.staging_question_id = qs.id AND qx.language_code = l5.code AND (TRIM(qx.question_text) <> '' OR TRIM(COALESCE(qx.explanation, '')) <> '')
          ) OR EXISTS (
            SELECT 1 FROM option_translations_staging ox JOIN question_options_staging qox ON qox.id = ox.staging_option_id WHERE qox.staging_question_id = qs.id AND ox.language_code = l5.code AND TRIM(ox.option_text) <> ''
          ))
            AND (
              NOT EXISTS (
                SELECT 1
                FROM question_translations_staging qt5
                WHERE qt5.staging_question_id = qs.id
                  AND qt5.language_code = l5.code
                  AND TRIM(COALESCE(qt5.question_text, '')) <> ''
                  AND qt5.translation_source = 'manual'
              )
              OR EXISTS (
                SELECT 1
                FROM question_options_staging qos5
                WHERE qos5.staging_question_id = qs.id
                  AND NOT EXISTS (
                    SELECT 1
                    FROM option_translations_staging ot5
                    WHERE ot5.staging_option_id = qos5.id
                      AND ot5.language_code = l5.code
                      AND TRIM(COALESCE(ot5.option_text, '')) <> ''
                      AND ot5.translation_source = 'manual'
                  )
              )
            )
        )
      THEN 1 ELSE 0 END AS translation_all_manual
    FROM questions_staging qs
    JOIN import_batches ib
      ON ib.id = qs.batch_id
    JOIN exams e
      ON e.id = ib.exam_id
    LEFT JOIN exam_translations et
      ON et.exam_id = e.id
      AND et.language_code = 'en'
    LEFT JOIN question_translations_staging qt
      ON qt.staging_question_id = qs.id
      AND qt.language_code = 'en'
    ${whereClause}
    ORDER BY qs.created_at DESC, qs.id DESC
    LIMIT 500
  `).bind(...values).all();

  return json({
    exams: examsResult.results || [],
    questions: result.results || []
  });
}

async function getReviewQuestion(env, id) {
  const question = await env.DB.prepare(`
    SELECT
      qs.id,
      qs.batch_id,
      qs.external_question_id,
      qs.topic_id,
      qs.difficulty,
      qs.has_image,
      qs.status,
      qs.published_question_id,
      qs.created_at,
      ib.source_filename,
      e.id AS exam_id,
      e.slug AS exam_slug,
      COALESCE(et.title, e.slug) AS exam_title,
      t.slug AS topic_slug,
      COALESCE(tt.name, t.slug, '') AS topic_name
    FROM questions_staging qs
    JOIN import_batches ib
      ON ib.id = qs.batch_id
    JOIN exams e
      ON e.id = ib.exam_id
    LEFT JOIN exam_translations et
      ON et.exam_id = e.id
      AND et.language_code = 'en'
    LEFT JOIN topics t
      ON t.id = qs.topic_id
    LEFT JOIN topic_translations tt
      ON tt.topic_id = t.id
      AND tt.language_code = 'en'
    WHERE qs.id = ?
  `).bind(id).first();

  if (!question) {
    return null;
  }

  const [translationsResult, optionsResult, imagesResult, enabledLanguagesResult] =
    await Promise.all([
      env.DB.prepare(`
        SELECT
          language_code,
          question_text,
          explanation,
          translation_source
        FROM question_translations_staging
        WHERE staging_question_id = ?
        ORDER BY language_code
      `).bind(id).all(),

      env.DB.prepare(`
        SELECT
          qos.id,
          qos.option_key,
          qos.sort_order,
          qos.is_correct,
          ot.language_code,
          ot.option_text,
          ot.translation_source
        FROM question_options_staging qos
        LEFT JOIN option_translations_staging ot
          ON ot.staging_option_id = qos.id
        WHERE qos.staging_question_id = ?
        ORDER BY qos.sort_order, ot.language_code
      `).bind(id).all(),

      env.DB.prepare(`
        SELECT
          id,
          r2_key,
          original_filename,
          mime_type,
          alt_text,
          sort_order,
          created_at
        FROM staging_question_images
        WHERE staging_question_id = ?
        ORDER BY sort_order, id
      `).bind(id).all(),

      env.DB.prepare(`
        SELECT l.code FROM languages l JOIN exam_languages el ON el.language_code = l.code
        WHERE l.is_enabled = 1 AND el.exam_id = ?
        ORDER BY l.sort_order, l.code
      `).bind(question.exam_id).all()
    ]);

  const enabledLanguages = (enabledLanguagesResult.results || [])
    .map(item => item.code);

  const translations = {};
  for (const item of translationsResult.results || []) {
    translations[item.language_code] = {
      questionText: item.question_text,
      explanation: item.explanation,
      translationSource: item.translation_source
    };
  }

  const optionsById = new Map();

  for (const item of optionsResult.results || []) {
    if (!optionsById.has(item.id)) {
      optionsById.set(item.id, {
        id: item.id,
        optionKey: item.option_key,
        sortOrder: item.sort_order,
        isCorrect: item.is_correct === 1,
        translations: {}
      });
    }

    if (item.language_code) {
      optionsById.get(item.id).translations[item.language_code] = {
        text: item.option_text,
        translationSource: item.translation_source
      };
    }
  }

  const images = (imagesResult.results || []).map((image) => ({
    ...image,
    url: `/images/${image.r2_key}`
  }));

  return {
    ...question,
    hasImage: question.has_image === 1,
    enabledLanguages,
    translations,
    options: Array.from(optionsById.values()),
    images
  };
}



async function saveReviewQuestion(request, env, id) {
  const existing = await env.DB.prepare(`
    SELECT qs.*, ib.exam_id
    FROM questions_staging qs
    JOIN import_batches ib ON ib.id = qs.batch_id
    WHERE qs.id = ?
  `).bind(id).first();

  if (!existing) {
    return json({ error: "Question not found." }, 404);
  }

  if (existing.status === "published") {
    return json({ error: "Published questions cannot be edited." }, 409);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const difficulty = String(body.difficulty || "normal").trim();
  const topicId = body.topicId ? Number(body.topicId) : null;
  const translations = body.translations || {};
  const options = body.options;

  if (!["easy", "normal", "hard"].includes(difficulty)) {
    return json({ error: "Invalid difficulty." }, 400);
  }

  if (topicId !== null) {
    if (!Number.isInteger(topicId) || topicId <= 0) {
      return json({ error: "Invalid topic." }, 400);
    }

    const topic = await env.DB.prepare(`
      SELECT id FROM topics
      WHERE id = ? AND exam_id = ?
    `).bind(topicId, existing.exam_id).first();

    if (!topic) {
      return json({ error: "Topic does not belong to this exam." }, 400);
    }
  }

  const enabledLanguagesResult = await env.DB.prepare(`
    SELECT l.code FROM languages l JOIN exam_languages el ON el.language_code = l.code
    WHERE l.is_enabled = 1 AND el.exam_id = ?
  `).bind(existing.exam_id).all();

  const languages = (enabledLanguagesResult.results || [])
    .map(row => row.code);

  if (!languages.includes("en")) {
    return json({ error: "English must be enabled in Language Management." }, 400);
  }

  for (const language of languages) {
    const item = translations[language];
    if (language === "en" && (!item || typeof item.questionText !== "string")) {
      return json({ error: `Missing ${language} question translation.` }, 400);
    }
  }

  if (!translations.en.questionText.trim()) {
    return json({ error: "English question is required." }, 400);
  }

  if (!Array.isArray(options) || options.length < 2 || options.length > 8) {
    return json({ error: "A question must have 2 to 8 options." }, 400);
  }

  const keys = new Set();
  const orders = new Set();
  let correctCount = 0;

  for (const option of options) {
    if (!/^[A-H]$/.test(String(option.optionKey || "")) ||
      keys.has(option.optionKey)) {
      return json({ error: "Option keys must be unique letters A-H." }, 400);
    }

    keys.add(option.optionKey);

    const order = Number(option.sortOrder);
    if (!Number.isInteger(order) || order < 1 || orders.has(order)) {
      return json({ error: "Option sort orders must be unique positive integers." }, 400);
    }
    orders.add(order);

    if (option.isCorrect) correctCount++;

    for (const language of languages) {
      const text = option.translations?.[language]?.text;
      if (language === "en" && typeof text !== "string") {
        return json({ error: `Missing ${language} translation for option ${option.optionKey}.` }, 400);
      }
    }

    if (!option.translations.en.text.trim()) {
      return json({ error: `English text is required for option ${option.optionKey}.` }, 400);
    }
  }

  if (correctCount !== 1) {
    return json({ error: "Exactly one option must be correct." }, 400);
  }

  const statements = [];

  const currentResult = await env.DB.prepare(`
    SELECT id, option_key
    FROM question_options_staging
    WHERE staging_question_id = ?
  `).bind(id).all();

  const currentByKey = new Map(
    (currentResult.results || []).map(item => [item.option_key, item.id])
  );

  const submittedKeys = new Set(options.map(item => item.optionKey));

  // Move existing sort orders temporarily to unique negative values.
  // This prevents conflicts when options exchange positions.
  statements.push(env.DB.prepare(`
    UPDATE question_options_staging
    SET sort_order = -id
    WHERE staging_question_id = ?
  `).bind(id));

  statements.push(env.DB.prepare(`
    UPDATE questions_staging
    SET topic_id = ?,
        difficulty = ?,
        status = CASE
          WHEN status = 'approved' THEN 'pending_review'
          ELSE status
        END
    WHERE id = ?
  `).bind(topicId, difficulty, id));

  for (const language of languages) {
    const item = translations[language] || {};
    if (!String(item.questionText || "").trim() && !String(item.explanation || "").trim()) {
      statements.push(env.DB.prepare(`DELETE FROM question_translations_staging WHERE staging_question_id = ? AND language_code = ?`).bind(id, language));
      continue;
    }

    statements.push(env.DB.prepare(`
      INSERT INTO question_translations_staging (
        staging_question_id, language_code, question_text,
        explanation, translation_source
      )
      VALUES (?, ?, ?, ?, 'manual')
      ON CONFLICT(staging_question_id, language_code)
      DO UPDATE SET
        question_text = excluded.question_text,
        explanation = excluded.explanation,
        translation_source = 'manual'
    `).bind(
      id,
      language,
      String(item.questionText || "").trim(),
      String(item.explanation || "")
    ));
  }

  // Remove options omitted from the submitted review.
  for (const [key, optionId] of currentByKey) {
    if (!submittedKeys.has(key)) {
      statements.push(env.DB.prepare(`
        DELETE FROM question_options_staging
        WHERE id = ? AND staging_question_id = ?
      `).bind(optionId, id));
    }
  }

  for (const option of options) {
    const currentId = currentByKey.get(option.optionKey);

    if (currentId) {
      statements.push(env.DB.prepare(`
        UPDATE question_options_staging
        SET sort_order = ?, is_correct = ?
        WHERE id = ? AND staging_question_id = ?
      `).bind(
        Number(option.sortOrder),
        option.isCorrect ? 1 : 0,
        currentId,
        id
      ));
    } else {
      statements.push(env.DB.prepare(`
        INSERT INTO question_options_staging (
          staging_question_id, option_key, sort_order, is_correct
        )
        VALUES (?, ?, ?, ?)
      `).bind(
        id,
        option.optionKey,
        Number(option.sortOrder),
        option.isCorrect ? 1 : 0
      ));
    }

    // Resolve the option ID inside the batch, including newly inserted options.
    for (const language of languages) {
      const text = String(option.translations?.[language]?.text || "").trim();
      if (!text) {
        statements.push(env.DB.prepare(`DELETE FROM option_translations_staging WHERE language_code = ? AND staging_option_id IN (SELECT id FROM question_options_staging WHERE staging_question_id = ? AND option_key = ?)`).bind(language, id, option.optionKey));
        continue;
      }
      statements.push(env.DB.prepare(`
        INSERT INTO option_translations_staging (
          staging_option_id, language_code, option_text, translation_source
        )
        SELECT id, ?, ?, 'manual'
        FROM question_options_staging
        WHERE staging_question_id = ? AND option_key = ?
        ON CONFLICT(staging_option_id, language_code)
        DO UPDATE SET
          option_text = excluded.option_text,
          translation_source = 'manual'
      `).bind(
        language,
        text,
        id,
        option.optionKey
      ));
    }
  }

  try {
    if (statements.length) {
      await env.DB.batch(statements);
    }

    const question = await getReviewQuestion(env, id);
    return json({ success: true, question });
  } catch (error) {
    console.error("Review save failed:", error);
    return json({ error: "Could not save question changes." }, 500);
  }
}
async function bulkReviewQuestions(request, env) {
  let body;

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const action = body.action;
  const ids = body.ids;

  if (!["approve", "reject"].includes(action)) {
    return json({ error: "Invalid bulk action." }, 400);
  }

  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500) {
    return json({ error: "Select between 1 and 500 questions." }, 400);
  }

  const uniqueIds = [...new Set(ids.map(Number))];

  if (uniqueIds.some(id => !Number.isInteger(id) || id <= 0)) {
    return json({ error: "Invalid question IDs." }, 400);
  }

  const placeholders = uniqueIds.map(() => "?").join(", ");

  try {
    const questionsResult = await env.DB.prepare(`
      SELECT id, status, has_image
      FROM questions_staging
      WHERE id IN (${placeholders})
    `).bind(...uniqueIds).all();

    const questions = questionsResult.results || [];
    const questionMap = new Map(questions.map(q => [q.id, q]));

    const enabledLanguagesResult = await env.DB.prepare(`
      SELECT code
      FROM languages
      WHERE is_enabled = 1
    `).all();

    const enabled = (enabledLanguagesResult.results || [])
      .map(row => row.code);

    const results = [];
    const updates = [];
    const updateIds = [];

    for (const id of uniqueIds) {
      const question = questionMap.get(id);

      if (!question) {
        results.push({
          id,
          success: false,
          reason: "Question not found."
        });
        continue;
      }

      if (question.status !== "pending_review") {
        results.push({
          id,
          success: false,
          reason: `Cannot process status: ${question.status}.`
        });
        continue;
      }

      if (action === "approve") {
        const languages = await suppliedLanguages(env.DB, id, enabled);
        if (!languages.includes("en")) {
          results.push({
            id,
            success: false,
            reason: "English must be enabled."
          });
          continue;
        }

        const validation = await env.DB.prepare(`
          SELECT
            (
              SELECT COUNT(*)
              FROM question_translations_staging qt
              WHERE qt.staging_question_id = ?
                AND qt.language_code IN (${languages.map(() => "?").join(", ")})
                AND TRIM(COALESCE(qt.question_text, '')) <> ''
                AND qt.translation_source = 'manual'
            ) AS valid_question_translations,

            (
              SELECT COUNT(*)
              FROM question_options_staging qos
              WHERE qos.staging_question_id = ?
            ) AS option_count,

            (
              SELECT COUNT(*)
              FROM question_options_staging qos
              WHERE qos.staging_question_id = ?
                AND qos.is_correct = 1
            ) AS correct_count,

            (
              SELECT COUNT(*)
              FROM question_options_staging qos
              WHERE qos.staging_question_id = ?
                AND (
                  SELECT COUNT(*)
                  FROM option_translations_staging ot
                  WHERE ot.staging_option_id = qos.id
                    AND ot.language_code IN (${languages.map(() => "?").join(", ")})
                    AND TRIM(COALESCE(ot.option_text, '')) <> ''
                    AND ot.translation_source = 'manual'
                ) = ?
            ) AS valid_options,

            (
              SELECT COUNT(*)
              FROM staging_question_images
              WHERE staging_question_id = ?
            ) AS image_count
        `).bind(
          id, ...languages,
          id,
          id,
          id, ...languages, languages.length,
          id
        ).first();

                const optionStructure = await env.DB.prepare(`
          SELECT
            COUNT(*) AS total,
            COUNT(DISTINCT option_key) AS unique_keys,
            COUNT(DISTINCT sort_order) AS unique_orders,
            SUM(
              CASE
                WHEN option_key NOT IN ('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H')
                THEN 1 ELSE 0
              END
            ) AS invalid_keys,
            SUM(
              CASE
                WHEN typeof(sort_order) <> 'integer' OR sort_order < 1
                THEN 1 ELSE 0
              END
            ) AS invalid_orders
          FROM question_options_staging
          WHERE staging_question_id = ?
        `).bind(id).first();

        const reasons = [];

        if (validation.valid_question_translations !== languages.length) {
          reasons.push("Question translations are incomplete or not all manual.");
        }

        if (validation.option_count < 2 || validation.option_count > 8) {
          reasons.push("Question must have 2 to 8 options.");
        }

        if (validation.correct_count !== 1) {
          reasons.push("Question must have exactly one correct option.");
        }
                if (
          optionStructure.invalid_keys > 0 ||
          optionStructure.unique_keys !== optionStructure.total
        ) {
          reasons.push("Option keys must be unique letters A-H.");
        }

        if (
          optionStructure.invalid_orders > 0 ||
          optionStructure.unique_orders !== optionStructure.total
        ) {
          reasons.push("Option sort orders must be unique positive integers.");
        }

        if (validation.valid_options !== validation.option_count) {
          reasons.push("Option translations are incomplete or not all manual.");
        }

        if (question.has_image === 1 && validation.image_count < 1) {
          reasons.push("Question requires at least one image.");
        }

        if (reasons.length) {
          results.push({
            id,
            success: false,
            reason: reasons.join(" ")
          });
          continue;
        }
      }

      updates.push(
        env.DB.prepare(`
    UPDATE questions_staging
    SET status = ?
    WHERE id = ?
      AND status = 'pending_review'
  `).bind(
          action === "approve" ? "approved" : "rejected",
          id
        )
      );

      updateIds.push(id);
    }

    if (updates.length) {
      const updateResults = await env.DB.batch(updates);

      for (let i = 0; i < updateResults.length; i++) {
        const id = updateIds[i];

        if (updateResults[i].meta?.changes === 1) {
          results.push({
            id,
            success: true,
            status: action === "approve" ? "approved" : "rejected"
          });
        } else {
          results.push({
            id,
            success: false,
            reason: "Question status changed before processing."
          });
        }
      }
    }

    const succeeded = results.filter(item => item.success).length;

    return json({
      success: true,
      action,
      total: uniqueIds.length,
      succeeded,
      skipped: uniqueIds.length - succeeded,
      results
    });

  } catch (error) {
    console.error("Bulk review failed:", error);
    return json({ error: "Could not process bulk review." }, 500);
  }
}


async function bulkPublishQuestions(request, env) {
  let body;

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const ids = body.ids;

  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500) {
    return json({ error: "Select between 1 and 500 questions." }, 400);
  }

  const uniqueIds = [...new Set(ids.map(Number))];

  if (uniqueIds.some(id => !Number.isInteger(id) || id <= 0)) {
    return json({ error: "Invalid question IDs." }, 400);
  }

  const placeholders = uniqueIds.map(() => "?").join(", ");

  try {
    const languagesResult = await env.DB.prepare(`
      SELECT code
      FROM languages
      WHERE is_enabled = 1
    `).all();

    const enabled = (languagesResult.results || []).map(row => row.code);

    if (!enabled.includes("en")) {
      return json({ error: "English must be enabled." }, 400);
    }

    const results = [];

    for (const stagingId of uniqueIds) {
      try {
        const question = await env.DB.prepare(`
          SELECT
            qs.*,
            ib.exam_id
          FROM questions_staging qs
          JOIN import_batches ib ON ib.id = qs.batch_id
          WHERE qs.id = ?
        `).bind(stagingId).first();

        if (!question) {
          results.push({
            id: stagingId,
            success: false,
            reason: "Question not found."
          });
          continue;
        }

        if (question.status !== "approved") {
          results.push({
            id: stagingId,
            success: false,
            reason: `Cannot publish status: ${question.status}.`
          });
          continue;
        }

        if (question.published_question_id) {
          results.push({
            id: stagingId,
            success: false,
            reason: "Question already has a published question ID."
          });
          continue;
        }
        if (question.topic_id !== null) {
  const topic = await env.DB.prepare(`
    SELECT id
    FROM topics
    WHERE id = ? AND exam_id = ?
  `).bind(question.topic_id, question.exam_id).first();

  if (!topic) {
    results.push({
      id: stagingId,
      success: false,
      reason: "Topic does not belong to the question's exam."
    });
    continue;
  }
}

        const existing = await env.DB.prepare(`
          SELECT id
          FROM questions
          WHERE exam_id = ?
            AND external_question_id = ?
        `).bind(
          question.exam_id,
          question.external_question_id
        ).first();

        if (existing) {
          results.push({
            id: stagingId,
            success: false,
            reason: "A production question with this external ID already exists."
          });
          continue;
        }

        const questionTranslations = await env.DB.prepare(`
          SELECT language_code, question_text, explanation, translation_source
          FROM question_translations_staging
          WHERE staging_question_id = ?
        `).bind(stagingId).all();

        const translationMap = new Map(
          (questionTranslations.results || []).map(row => [
            row.language_code,
            row
          ])
        );

        const languages = await suppliedLanguages(env.DB, stagingId, enabled);
        if (!languages.includes("en")) {
          results.push({ id: stagingId, success: false, reason: "English must be enabled for this exam." });
          continue;
        }
        const missingQuestionLanguage = languages.find(language => {
          const row = translationMap.get(language);
          return !row || !row.question_text.trim() ||
            row.translation_source !== "manual";
        });

        if (missingQuestionLanguage) {
          results.push({
            id: stagingId,
            success: false,
            reason: `Question translation is missing or not manually reviewed: ${missingQuestionLanguage}.`
          });
          continue;
        }

        const optionsResult = await env.DB.prepare(`
          SELECT id, option_key, sort_order, is_correct
          FROM question_options_staging
          WHERE staging_question_id = ?
          ORDER BY sort_order
        `).bind(stagingId).all();

        const options = optionsResult.results || [];

        if (options.length < 2 || options.length > 8) {
          results.push({
            id: stagingId,
            success: false,
            reason: "Question must have between 2 and 8 options."
          });
          continue;
        }

        if (options.filter(option => option.is_correct === 1).length !== 1) {
          results.push({
            id: stagingId,
            success: false,
            reason: "Question must have exactly one correct option."
          });
          continue;
        }

        const optionKeys = options.map(option => option.option_key);
        const sortOrders = options.map(option => option.sort_order);

        if (
          new Set(optionKeys).size !== options.length ||
          optionKeys.some(key => !["A", "B", "C", "D", "E", "F", "G", "H"].includes(key)) ||
          new Set(sortOrders).size !== options.length ||
          sortOrders.some(order => !Number.isInteger(order) || order < 1)
        ) {
          results.push({
            id: stagingId,
            success: false,
            reason: "Invalid option keys or sort orders."
          });
          continue;
        }

        const optionTranslationsResult = await env.DB.prepare(`
          SELECT
            sot.staging_option_id,
            sot.language_code,
            sot.option_text,
            sot.translation_source
          FROM option_translations_staging sot
          JOIN question_options_staging qos
            ON qos.id = sot.staging_option_id
          WHERE qos.staging_question_id = ?
        `).bind(stagingId).all();

        const optionTranslationMap = new Map();

        for (const row of optionTranslationsResult.results || []) {
          optionTranslationMap.set(
            `${row.staging_option_id}:${row.language_code}`,
            row
          );
        }

        let invalidOptionTranslation = false;

        for (const option of options) {
          for (const language of languages) {
            const translation = optionTranslationMap.get(
              `${option.id}:${language}`
            );

            if (
              !translation ||
              !translation.option_text.trim() ||
              translation.translation_source !== "manual"
            ) {
              invalidOptionTranslation = true;
              break;
            }
          }

          if (invalidOptionTranslation) break;
        }

        if (invalidOptionTranslation) {
          results.push({
            id: stagingId,
            success: false,
            reason: "One or more option translations are missing or not manually reviewed."
          });
          continue;
        }

        const imagesResult = await env.DB.prepare(`
          SELECT id, r2_key, alt_text, sort_order
          FROM staging_question_images
          WHERE staging_question_id = ?
          ORDER BY sort_order
        `).bind(stagingId).all();

        const images = imagesResult.results || [];

        if (images.length > 8) {
          results.push({
            id: stagingId,
            success: false,
            reason: "A question cannot have more than 8 images."
          });
          continue;
        }

        if (Boolean(question.has_image) !== (images.length > 0)) {
          results.push({
            id: stagingId,
            success: false,
            reason: "Image records do not match the question image setting."
          });
          continue;
        }

        let missingImage = false;

        for (const image of images) {
          if (
            !/^questions\/[a-f0-9-]+\.(jpg|png|webp)$/i.test(image.r2_key)
          ) {
            missingImage = true;
            break;
          }

          const object = await env.exam_question_images.head(image.r2_key);

          if (!object) {
            missingImage = true;
            break;
          }
        }

        if (missingImage) {
          results.push({
            id: stagingId,
            success: false,
            reason: "One or more R2 images are missing or have invalid keys."
          });
          continue;
        }

        const statements = [];

        statements.push(env.DB.prepare(`
          INSERT INTO questions (
            exam_id,
            topic_id,
            difficulty,
            status,
            external_question_id,
            reviewed_at
          )
          SELECT
            ib.exam_id,
            qs.topic_id,
            qs.difficulty,
            'published',
            qs.external_question_id,
            CURRENT_TIMESTAMP
          FROM questions_staging qs
          JOIN import_batches ib ON ib.id = qs.batch_id
          WHERE qs.id = ?
            AND qs.status = 'approved'
            AND qs.published_question_id IS NULL
        `).bind(stagingId));

        statements.push(env.DB.prepare(`
          INSERT INTO question_translations (
            question_id,
            language_code,
            question_text,
            explanation,
            question_text_source,
            explanation_source
          )
          SELECT
            q.id,
            qts.language_code,
            qts.question_text,
            qts.explanation,
            qts.translation_source,
            qts.translation_source
          FROM question_translations_staging qts
          JOIN questions_staging qs
            ON qs.id = qts.staging_question_id
          JOIN import_batches ib
            ON ib.id = qs.batch_id
          JOIN questions q
            ON q.exam_id = ib.exam_id
            AND q.external_question_id = qs.external_question_id
          WHERE qs.id = ?
            AND qs.status = 'approved'
            AND qs.published_question_id IS NULL
          AND qts.language_code IN (${languages.map(() => "?").join(", ")})
        `).bind(stagingId, ...languages));

        statements.push(env.DB.prepare(`
          INSERT INTO question_options (
            question_id,
            option_key,
            sort_order,
            is_correct
          )
          SELECT
            q.id,
            qos.option_key,
            qos.sort_order,
            qos.is_correct
          FROM question_options_staging qos
          JOIN questions_staging qs
            ON qs.id = qos.staging_question_id
          JOIN import_batches ib
            ON ib.id = qs.batch_id
          JOIN questions q
            ON q.exam_id = ib.exam_id
            AND q.external_question_id = qs.external_question_id
          WHERE qs.id = ?
            AND qs.status = 'approved'
            AND qs.published_question_id IS NULL
        `).bind(stagingId));

        statements.push(env.DB.prepare(`
          INSERT INTO option_translations (
            option_id,
            language_code,
            option_text,
            translation_source
          )
          SELECT
            qo.id,
            ots.language_code,
            ots.option_text,
            ots.translation_source
          FROM option_translations_staging ots
          JOIN question_options_staging qos
            ON qos.id = ots.staging_option_id
          JOIN questions_staging qs
            ON qs.id = qos.staging_question_id
          JOIN import_batches ib
            ON ib.id = qs.batch_id
          JOIN questions q
            ON q.exam_id = ib.exam_id
            AND q.external_question_id = qs.external_question_id
          JOIN question_options qo
            ON qo.question_id = q.id
            AND qo.option_key = qos.option_key
          WHERE qs.id = ?
            AND qs.status = 'approved'
            AND qs.published_question_id IS NULL
          AND ots.language_code IN (${languages.map(() => "?").join(", ")})
        `).bind(stagingId, ...languages));

        statements.push(env.DB.prepare(`
          INSERT INTO question_images (
            question_id,
            image_url,
            alt_text,
            sort_order
          )
          SELECT
            q.id,
            '/images/' || sqi.r2_key,
            sqi.alt_text,
            sqi.sort_order
          FROM staging_question_images sqi
          JOIN questions_staging qs
            ON qs.id = sqi.staging_question_id
          JOIN import_batches ib
            ON ib.id = qs.batch_id
          JOIN questions q
            ON q.exam_id = ib.exam_id
            AND q.external_question_id = qs.external_question_id
          WHERE qs.id = ?
            AND qs.status = 'approved'
            AND qs.published_question_id IS NULL
        `).bind(stagingId));

        statements.push(env.DB.prepare(`
          UPDATE questions_staging
          SET
            status = 'published',
            published_question_id = (
              SELECT q.id
              FROM questions q
              JOIN import_batches ib
                ON ib.exam_id = q.exam_id
              WHERE ib.id = questions_staging.batch_id
                AND q.external_question_id = questions_staging.external_question_id
            )
          WHERE id = ?
            AND status = 'approved'
            AND published_question_id IS NULL
        `).bind(stagingId));

        statements.push(env.DB.prepare(`
          INSERT INTO admin_audit_logs (
            actor,
            action,
            entity_type,
            entity_id,
            details_json
          )
          SELECT
            'admin',
            'publish',
            'question',
            CAST(q.id AS TEXT),
            json_object(
              'staging_id', qs.id,
              'exam_id', ib.exam_id,
              'external_question_id', qs.external_question_id
            )
          FROM questions_staging qs
          JOIN import_batches ib ON ib.id = qs.batch_id
          JOIN questions q
            ON q.exam_id = ib.exam_id
            AND q.external_question_id = qs.external_question_id
          WHERE qs.id = ?
            AND qs.status = 'published'
        `).bind(stagingId));

        await env.DB.batch(statements);

        const published = await env.DB.prepare(`
          SELECT published_question_id
          FROM questions_staging
          WHERE id = ?
            AND status = 'published'
        `).bind(stagingId).first();

        if (!published?.published_question_id) {
          throw new Error("Publication did not complete.");
        }

        results.push({
          id: stagingId,
          success: true,
          published_question_id: published.published_question_id
        });

      } catch (error) {
        console.error(`Publish failed for staging question ${stagingId}:`, error);

        results.push({
          id: stagingId,
          success: false,
          reason: "Publication failed. Check server logs."
        });
      }
    }

    const succeeded = results.filter(item => item.success).length;

    return json({
      success: true,
      action: "publish",
      total: uniqueIds.length,
      succeeded,
      skipped: uniqueIds.length - succeeded,
      results
    });

  } catch (error) {
    console.error("Bulk publish failed:", error);
    return json({ error: "Could not publish questions." }, 500);
  }
}

export async function handleAdminReview(request, env) {
  if (!await isAdminAuthenticated(request, env)) {
    return json({ error: "Unauthorized." }, 401);
  }

  const url = new URL(request.url);

  if (url.pathname === "/api/admin/review" && request.method === "GET") {
    try {
      return await listReviewQuestions(request, env);
    } catch (error) {
      console.error("Review list failed:", error);
      return json({ error: "Could not load review questions." }, 500);
    }
  }

  if (
    url.pathname === "/api/admin/review/bulk" &&
    request.method === "POST"
  ) {
    return await bulkReviewQuestions(request, env);
  }
  if (
  url.pathname === "/api/admin/review/publish" &&
  request.method === "POST"
) {
  return await bulkPublishQuestions(request, env);
}

  const match = url.pathname.match(
    /^\/api\/admin\/review\/(\d+)$/
  );

  if (match && request.method === "PUT") {
    return await saveReviewQuestion(request, env, Number(match[1]));
  }

  if (match && request.method === "GET") {
    try {
      const question = await getReviewQuestion(env, Number(match[1]));

      if (!question) {
        return json({ error: "Question not found." }, 404);
      }

      return json({ question });
    } catch (error) {
      console.error("Review detail failed:", error);
      return json({ error: "Could not load question details." }, 500);
    }
  }

  return json({ error: "Not found." }, 404);
}