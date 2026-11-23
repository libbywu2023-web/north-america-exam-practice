import { isAdminAuthenticated } from "./admin-auth.js";
import { translateTexts } from "./services/translation.js";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS
  });
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseBoolean(value, defaultValue = false) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null || value === "") {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();

  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;

  return null;
}

function addError(errors, rowNumber, externalId, severity, code, message) {
  errors.push({
    rowNumber: rowNumber ?? null,
    externalQuestionId: externalId || "",
    severity,
    code,
    message
  });
}

async function saveErrors(db, batchId, errors) {
  if (!errors.length) return;

  const statements = errors.map((item) =>
    db.prepare(`
      INSERT INTO import_errors (
        batch_id,
        row_number,
        external_question_id,
        severity,
        error_code,
        message
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      batchId,
      item.rowNumber,
      item.externalQuestionId,
      item.severity,
      item.code,
      item.message
    )
  );

  // Keep each D1 batch small.
  for (let i = 0; i < statements.length; i += 50) {
    await db.batch(statements.slice(i, i + 50));
  }
}

async function translateInChunks(texts, language, env) {
  const results = [];
  let start = 0;

  while (start < texts.length) {
    let end = start;
    let totalCharacters = 0;

    while (end < texts.length && end - start < 50) {
      const length = texts[end].length;

      if (end > start && totalCharacters + length > 20000) break;

      totalCharacters += length;
      end++;
    }

    const translated = await translateTexts(
      texts.slice(start, end),
      language,
      env
    );

    results.push(...translated);
    start = end;
  }

  return results;
}

async function translateRecords(records, env, errors, enabledLanguages) {
  for (const language of ["zh-CN", "zh-TW", "fr"]) {
    if (!enabledLanguages.has(language)) continue;
    const tasks = [];

    for (const record of records) {
      if (!record.questionTranslations[language].text) {
        tasks.push({
          type: "question",
          record,
          text: record.questionEn
        });
      }

      for (const option of record.options) {
        if (!option.translations[language].text) {
          tasks.push({
            type: "option",
            record,
            option,
            text: option.optionEn
          });
        }
      }
    }

    if (!tasks.length) continue;

    try {
      const translated = await translateInChunks(
        tasks.map((task) => task.text),
        language,
        env
      );

      tasks.forEach((task, index) => {
        const value = translated[index] || "";

        if (task.type === "question") {
          task.record.questionTranslations[language] = {
            text: value,
            source: "machine"
          };
        } else {
          task.option.translations[language] = {
            text: value,
            source: "machine"
          };
        }
      });
    } catch (error) {
      // Translation failure must not block English question import.
      for (const task of tasks) {
        addError(
          errors,
          task.record.rowNumber,
          task.record.externalQuestionId,
          "warning",
          "translation_failed",
          `${language} translation failed. You can complete it manually later.`
        );

        if (task.type === "question") {
          task.record.questionTranslations[language] = {
            text: "",
            source: "machine"
          };
        } else {
          task.option.translations[language] = {
            text: "",
            source: "machine"
          };
        }
      }

      console.error(
        `Question import translation failed for ${language}:`,
        error.message
      );
    }
  }
}

function normalizeQuestion(row, index) {
  const externalQuestionId = clean(row.externalQuestionId);
  const questionEn = clean(row.questionEn);
  const difficulty = clean(row.difficulty).toLowerCase() || "normal";
  const hasImage = parseBoolean(row.hasImage, false);

  return {
    rowNumber: Number(row.rowNumber) || index + 2,
    externalQuestionId,
    topicSlug: clean(row.topicSlug),
    difficulty,
    hasImage,
    questionEn,
    explanationEn: clean(row.explanationEn),
    questionTranslations: {
      en: { text: questionEn, source: "manual" },
      "zh-CN": {
        text: clean(row.questionZhCn),
        source: "manual"
      },
      "zh-TW": {
        text: clean(row.questionZhTw),
        source: "manual"
      },
      fr: { text: clean(row.questionFr), source: "manual" }
    },
    explanationTranslations: {
      en: clean(row.explanationEn),
      "zh-CN": clean(row.explanationZhCn),
      "zh-TW": clean(row.explanationZhTw),
      fr: clean(row.explanationFr)
    },
    options: []
  };
}

function normalizeOption(row, index) {
  const sortOrder = Number(row.sortOrder);

  return {
    rowNumber: Number(row.rowNumber) || index + 2,
    externalQuestionId: clean(row.externalQuestionId),
    optionKey: clean(row.optionKey).toUpperCase(),
    sortOrder,
    isCorrect: parseBoolean(row.isCorrect),
    optionEn: clean(row.optionEn),
    translations: {
      en: { text: clean(row.optionEn), source: "manual" },
      "zh-CN": {
        text: clean(row.optionZhCn),
        source: "manual"
      },
      "zh-TW": {
        text: clean(row.optionZhTw),
        source: "manual"
      },
      fr: { text: clean(row.optionFr), source: "manual" }
    }
  };
}

async function importQuestions(request, env) {
  if (!(await isAdminAuthenticated(request, env))) {
    return json({ error: "Unauthorized." }, 401);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);

  if (contentLength > 2 * 1024 * 1024) {
    return json({ error: "Import data exceeds the 2MB limit." }, 413);
  }

  let body;

  try {
    const raw = await request.text();

    if (raw.length > 2 * 1024 * 1024) {
      return json({ error: "Import data exceeds the 2MB limit." }, 413);
    }

    body = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid JSON request body." }, 400);
  }

  const examSlug = clean(body.examSlug);
  const sourceFilename = clean(body.sourceFilename) || "uploaded.xlsx";
  const questionRows = body.questions;
  const optionRows = body.options;

  if (!examSlug) {
    return json({ error: "Exam URL Slug is required." }, 400);
  }

  if (!Array.isArray(questionRows) || !Array.isArray(optionRows)) {
    return json({
      error: "Questions and Options must both be arrays."
    }, 400);
  }

  if (!questionRows.length || questionRows.length > 500) {
    return json({
      error: "The workbook must contain between 1 and 500 question rows."
    }, 400);
  }

  if (optionRows.length > 4000) {
    return json({ error: "The workbook contains too many option rows." }, 400);
  }

  const db = env.DB;

  const exam = await db.prepare(`
    SELECT id, slug
    FROM exams
    WHERE slug = ?
    LIMIT 1
  `).bind(examSlug).first();

  if (!exam) {
    return json({
      error: `Exam "${examSlug}" was not found. No questions were imported.`
    }, 400);
  }

  const enabledLanguagesResult = await db.prepare(`
    SELECT l.code
    FROM languages l JOIN exam_languages el ON el.language_code = l.code
    WHERE l.is_enabled = 1 AND el.exam_id = ?
  `).bind(exam.id).all();

  const enabledLanguages = new Set(
    (enabledLanguagesResult.results || []).map((row) => row.code)
  );

  if (!enabledLanguages.has("en")) {
    return json({
      error: "English must be enabled globally and configured for this exam before importing."
    }, 400);
  }

  const errors = [];
  const records = [];
  const seenIds = new Set();

  // First occurrence wins when an ID appears more than once in the workbook.
  for (let i = 0; i < questionRows.length; i++) {
    const record = normalizeQuestion(questionRows[i], i);
    const id = record.externalQuestionId;

    if (!id) {
      addError(
        errors,
        record.rowNumber,
        "",
        "error",
        "missing_external_id",
        "External Question ID is required."
      );
      continue;
    }

    if (seenIds.has(id)) {
      addError(
        errors,
        record.rowNumber,
        id,
        "warning",
        "duplicate_in_workbook",
        "Duplicate ID in this workbook. The first occurrence was kept."
      );
      continue;
    }

    seenIds.add(id);

    if (!record.questionEn) {
      addError(
        errors,
        record.rowNumber,
        id,
        "error",
        "missing_english_question",
        "English question text is required."
      );
      continue;
    }

    if (!["easy", "normal", "hard"].includes(record.difficulty)) {
      addError(
        errors,
        record.rowNumber,
        id,
        "error",
        "invalid_difficulty",
        "Difficulty must be easy, normal or hard."
      );
      continue;
    }

    if (record.hasImage === null) {
      addError(
        errors,
        record.rowNumber,
        id,
        "error",
        "invalid_has_image",
        "Has Image must be TRUE/FALSE or 1/0."
      );
      continue;
    }

    records.push(record);
  }

  // Match option rows to their question IDs.
  const optionGroups = new Map();

  for (let i = 0; i < optionRows.length; i++) {
    const option = normalizeOption(optionRows[i], i);

    if (!option.externalQuestionId) {
      addError(
        errors,
        option.rowNumber,
        "",
        "error",
        "option_missing_question_id",
        "An option row is missing its External Question ID."
      );
      continue;
    }

    if (!optionGroups.has(option.externalQuestionId)) {
      optionGroups.set(option.externalQuestionId, []);
    }

    optionGroups.get(option.externalQuestionId).push(option);
  }

  const validRecords = [];

  for (const record of records) {
    const options = optionGroups.get(record.externalQuestionId) || [];
    let problem = "";

    if (options.length < 2 || options.length > 8) {
      problem = "Each question must have between 2 and 8 options.";
    } else if (options.some((option) => !/^[A-H]$/.test(option.optionKey))) {
      problem = "Option keys must be A through H.";
    } else if (options.some((option) => !option.optionEn)) {
      problem = "Every option must have English text.";
    } else if (options.some((option) => !Number.isInteger(option.sortOrder) || option.sortOrder < 1)) {
      problem = "Every option must have a positive integer sort order.";
    } else if (options.some((option) => option.isCorrect === null)) {
      problem = "Is Correct must be TRUE/FALSE or 1/0.";
    } else if (new Set(options.map((option) => option.optionKey)).size !== options.length) {
      problem = "Option keys must be unique within a question.";
    } else if (new Set(options.map((option) => option.sortOrder)).size !== options.length) {
      problem = "Option sort orders must be unique within a question.";
    } else if (options.filter((option) => option.isCorrect).length !== 1) {
      problem = "Each question must have exactly one correct answer.";
    }

    if (problem) {
      addError(
        errors,
        record.rowNumber,
        record.externalQuestionId,
        "error",
        "invalid_options",
        problem
      );
      continue;
    }

    record.options = options.sort((a, b) => a.sortOrder - b.sortOrder);
    validRecords.push(record);
  }

  // Options that do not belong to an accepted question are ignored.
  for (const [externalId, options] of optionGroups) {
    if (!seenIds.has(externalId)) {
      addError(
        errors,
        options[0]?.rowNumber,
        externalId,
        "warning",
        "orphan_options",
        "Options do not match a question in this workbook and were ignored."
      );
    }
  }

  // Resolve standard topics for this exam.
  const topicResult = await db.prepare(`
    SELECT id, slug
    FROM topics
    WHERE exam_id = ?
      AND topic_type = 'standard'
  `).bind(exam.id).all();

  const topicMap = new Map(
    (topicResult.results || []).map((topic) => [topic.slug, topic.id])
  );

  const topicValidRecords = [];

  for (const record of validRecords) {
    if (record.topicSlug && !topicMap.has(record.topicSlug)) {
      addError(
        errors,
        record.rowNumber,
        record.externalQuestionId,
        "error",
        "invalid_topic",
        `Topic "${record.topicSlug}" does not exist as a standard topic in this exam.`
      );
      continue;
    }

    record.topicId = record.topicSlug
      ? topicMap.get(record.topicSlug)
      : null;

    topicValidRecords.push(record);
  }

  // Check existing formal questions. Existing IDs are skipped, never overwritten.
  const existingResult = await db.prepare(`
    SELECT external_question_id
    FROM questions
    WHERE exam_id = ?
      AND external_question_id IS NOT NULL
  `).bind(exam.id).all();

  const existingIds = new Set(
    (existingResult.results || []).map((row) => row.external_question_id)
  );

  const newRecords = [];

  for (const record of topicValidRecords) {
    if (existingIds.has(record.externalQuestionId)) {
      addError(
        errors,
        record.rowNumber,
        record.externalQuestionId,
        "warning",
        "already_exists",
        "This External Question ID already exists for this exam. It was skipped."
      );
      continue;
    }

    newRecords.push(record);
  }

  // Only translate languages that are currently enabled.
  const translationRecords = newRecords.map((record) => ({
    ...record,
    questionTranslations: {
      ...record.questionTranslations
    }
  }));

  for (const record of translationRecords) {
    if (!enabledLanguages.has("zh-CN")) {
      record.questionTranslations["zh-CN"] = { text: "", source: "machine" };
      for (const option of record.options) {
        option.translations["zh-CN"] = { text: "", source: "machine" };
      }
    }

    if (!enabledLanguages.has("zh-TW")) {
      record.questionTranslations["zh-TW"] = { text: "", source: "machine" };
      for (const option of record.options) {
        option.translations["zh-TW"] = { text: "", source: "machine" };
      }
    }

    if (!enabledLanguages.has("fr")) {
      record.questionTranslations.fr = { text: "", source: "machine" };
      for (const option of record.options) {
        option.translations.fr = { text: "", source: "machine" };
      }
    }
  }

  if (body.autoTranslate === true) await translateRecords(
    translationRecords,
    env,
    errors,
    enabledLanguages
  );

  let batchId;

  try {
    const batchResult = await db.prepare(`
      INSERT INTO import_batches (
        exam_id,
        source_filename,
        status,
        total_rows
      )
      VALUES (?, ?, 'processing', ?)
    `).bind(
      exam.id,
      sourceFilename.slice(0, 255),
      questionRows.length
    ).run();

    batchId = batchResult.meta.last_row_id;

    let importedCount = 0;
    let skippedCount = questionRows.length - newRecords.length;

    for (const record of translationRecords) {
      try {
        const questionResult = await db.prepare(`
          INSERT INTO questions_staging (
            batch_id,
            external_question_id,
            topic_id,
            difficulty,
            has_image,
            status
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          batchId,
          record.externalQuestionId,
          record.topicId,
          record.difficulty,
          record.hasImage ? 1 : 0,
          record.hasImage ? "waiting_for_image" : "pending_review"
        ).run();

        const stagingQuestionId = questionResult.meta.last_row_id;

        const questionTranslationStatements = [];

        for (const language of ["en", "zh-CN", "zh-TW", "fr"]) {
          if (!enabledLanguages.has(language)) continue;

          const translation = record.questionTranslations[language];
          if (!translation.text.trim() && !record.explanationTranslations[language]) continue;

          questionTranslationStatements.push(
            db.prepare(`
              INSERT INTO question_translations_staging (
                staging_question_id,
                language_code,
                question_text,
                explanation,
                translation_source
              )
              VALUES (?, ?, ?, ?, ?)
            `).bind(
              stagingQuestionId,
              language,
              translation.text,
              record.explanationTranslations[language] || "",
              translation.source
            )
          );
        }

        if (questionTranslationStatements.length) {
          await db.batch(questionTranslationStatements);
        }

        for (const option of record.options) {
          const optionResult = await db.prepare(`
            INSERT INTO question_options_staging (
              staging_question_id,
              option_key,
              sort_order,
              is_correct
            )
            VALUES (?, ?, ?, ?)
          `).bind(
            stagingQuestionId,
            option.optionKey,
            option.sortOrder,
            option.isCorrect ? 1 : 0
          ).run();

          const stagingOptionId = optionResult.meta.last_row_id;
          const optionTranslationStatements = [];

          for (const language of ["en", "zh-CN", "zh-TW", "fr"]) {
            if (!enabledLanguages.has(language)) continue;

            const translation = option.translations[language];
            if (!translation.text.trim()) continue;

            optionTranslationStatements.push(
              db.prepare(`
                INSERT INTO option_translations_staging (
                  staging_option_id,
                  language_code,
                  option_text,
                  translation_source
                )
                VALUES (?, ?, ?, ?)
              `).bind(
                stagingOptionId,
                language,
                translation.text,
                translation.source
              )
            );
          }

          if (optionTranslationStatements.length) {
            await db.batch(optionTranslationStatements);
          }
        }

        importedCount++;
      } catch (error) {
        // Remove any incomplete staging question and its children.
        await db.prepare(`
          DELETE FROM questions_staging
          WHERE batch_id = ? AND external_question_id = ?
        `).bind(batchId, record.externalQuestionId).run();

        skippedCount++;

        addError(
          errors,
          record.rowNumber,
          record.externalQuestionId,
          "error",
          "staging_save_failed",
          "The question could not be saved to staging. Please check the import report."
        );

        console.error("Staging question save failed:", error.message);
      }
    }

    await saveErrors(db, batchId, errors);

    const errorCount = errors.filter((item) => item.severity === "error").length;

    await db.prepare(`
      UPDATE import_batches
      SET status = 'completed',
          imported_count = ?,
          skipped_count = ?,
          error_count = ?,
          completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      importedCount,
      skippedCount,
      errorCount,
      batchId
    ).run();

    return json({
      success: true,
      batchId,
      examSlug,
      totalRows: questionRows.length,
      importedCount,
      skippedCount,
      errorCount,
      warningCount: errors.filter((item) => item.severity === "warning").length,
      errors
    });
  } catch (error) {
    if (batchId) {
      await db.prepare(`
        UPDATE import_batches
        SET status = 'failed',
            completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(batchId).run();
    }

    console.error("Question import failed:", error.message);

    return json({
      error: "The import could not be completed. Please check the server logs.",
      batchId: batchId || null
    }, 500);
  }
}

export async function handleAdminImports(request, env) {
  const url = new URL(request.url);

  if (url.pathname !== "/api/admin/imports") {
    return json({ error: "Not found." }, 404);
  }

  if (request.method === "POST") {
    return importQuestions(request, env);
  }

  if (request.method === "GET") {
    if (!(await isAdminAuthenticated(request, env))) {
      return json({ error: "Unauthorized." }, 401);
    }

    const result = await env.DB.prepare(`
      SELECT
        e.slug,
        COALESCE(et.title, e.slug) AS title,
        e.status
      FROM exams e
      LEFT JOIN exam_translations et
        ON et.exam_id = e.id AND et.language_code = 'en'
      ORDER BY e.id DESC
    `).all();

    return json({ exams: result.results || [] });
  }

  return json({ error: "Method not allowed." }, 405);
}
