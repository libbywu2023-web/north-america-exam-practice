import { handleAdminAuth } from "./admin-auth.js";
import { handleAdminLanguages } from "./admin-languages.js";
import { handleAdminCountries } from "./admin-countries.js";
import { handleAdminRegions } from "./admin-regions.js";
import { handleAdminCategories } from "./admin-categories.js";
import { handleAdminExams } from "./admin-exams.js";
import { handleAdminTopics } from "./admin-topics.js";
import { handleAdminQuestions } from "./admin-questions.js";
import { handleAdminImages, handlePublicImage } from "./admin-images.js";
import { handleAdminImports } from "./admin-imports.js";
import { handleAdminReview } from "./admin-review.js";


const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function getClientId(request) {
  const value = request.headers.get("x-client-id") || "";
  return /^[a-zA-Z0-9_-]{12,80}$/.test(value) ? value : null;
}

function languageOrDefault(value) {
  return ["en", "fr", "zh-CN", "zh-TW"].includes(value) ? value : "en";
}

// A missing association or a Preparing language must never be served publicly.
async function examLanguagePolicy(db, slug) {
  const exam = await db.prepare(`
    SELECT id, default_language FROM exams
    WHERE slug = ? AND status = 'published'
  `).bind(slug).first();
  if (!exam) return null;
  const result = await db.prepare(`
    SELECT el.language_code FROM exam_languages el
    JOIN languages l ON l.code = el.language_code
    WHERE el.exam_id = ? AND el.is_enabled = 1 AND l.is_enabled = 1
    ORDER BY l.sort_order, l.code
  `).bind(exam.id).all();
  const supported = (result.results || []).map(row => row.language_code);
  const fallback = supported.includes(exam.default_language)
    ? exam.default_language : supported.includes('en') ? 'en' : supported[0];
  return { ...exam, supported, fallback };
}

function languagePath(lang, slug) {
  const prefix = lang === 'zh-CN' ? '/zh' : lang === 'zh-TW' ? '/zh-tw' : lang === 'fr' ? '/fr' : '';
  return `${prefix}/${slug}`;
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function getPublishedExam(db) {
  return db.prepare(`
    SELECT e.*, et.title, et.description, r.code AS region_code,
           c.code AS country_code, COALESCE(ct.name, c.name) AS country_name,
           COALESCE(rt.name, r.name) AS region_name
    FROM exams e
    JOIN exam_translations et ON et.exam_id = e.id AND et.language_code = ?
    LEFT JOIN regions r ON r.id = e.region_id
    LEFT JOIN countries c ON c.id = r.country_id
    LEFT JOIN country_translations ct ON ct.country_id = c.id AND ct.language_code = ?
    LEFT JOIN region_translations rt ON rt.region_id = r.id AND rt.language_code = ?
    WHERE e.slug = ? AND e.status = 'published'
  `);
}

async function listExams(db, lang) {
  const result = await db.prepare(`
    SELECT e.slug, e.question_count, e.time_limit_minutes,
           e.passing_score_percent, et.title, et.description,
           c.code AS country_code, r.code AS region_code,
           cat.slug AS category_slug
    FROM exams e
    JOIN exam_categories cat ON cat.id = e.category_id
    LEFT JOIN regions r ON r.id = e.region_id
    LEFT JOIN countries c ON c.id = r.country_id
    JOIN exam_translations et ON et.exam_id = e.id AND et.language_code = ?
    WHERE e.status = 'published'
    ORDER BY e.id
  `).bind(lang).all();
  return result.results || [];
}
async function listCatalogExams(db, lang) {
  const result = await db.prepare(`
    SELECT
      c.id AS country_id,
      c.code AS country_code,
      COALESCE(ct.name, c.name) AS country_name,

      r.id AS region_id,
      r.code AS region_code,
      COALESCE(rt.name, r.name) AS region_name,

      cat.slug AS category_slug,
      COALESCE(cat_t.name, cat.name) AS category_name,

      e.slug,
      COALESCE(et.title, et_en.title) AS title,
      COALESCE(et.description, et_en.description, '') AS description,

      e.question_count,
      e.time_limit_minutes,
      e.passing_score_percent,
      e.show_new_badge,
      (SELECT GROUP_CONCAT(el.language_code, ',') FROM exam_languages el
       JOIN languages l ON l.code = el.language_code
       WHERE el.exam_id = e.id AND el.is_enabled = 1 AND l.is_enabled = 1) AS supported_languages,
      e.default_language

    FROM exams e

    JOIN regions r
      ON r.id = e.region_id

    JOIN countries c
      ON c.id = r.country_id

    JOIN exam_categories cat
      ON cat.id = e.category_id

    LEFT JOIN country_translations ct
      ON ct.country_id = c.id
      AND ct.language_code = ?

    LEFT JOIN region_translations rt
      ON rt.region_id = r.id
      AND rt.language_code = ?

    LEFT JOIN exam_category_translations cat_t
      ON cat_t.category_id = cat.id
      AND cat_t.language_code = ?

    LEFT JOIN exam_translations et
      ON et.exam_id = e.id
      AND et.language_code = ?

    LEFT JOIN exam_translations et_en
      ON et_en.exam_id = e.id
      AND et_en.language_code = 'en'

    WHERE e.status = 'published'
      AND EXISTS (SELECT 1 FROM exam_languages el WHERE el.exam_id=e.id AND el.is_enabled=1)
      AND COALESCE(et.title, et_en.title) IS NOT NULL

    ORDER BY
      c.id,
      CASE WHEN r.code = 'ALL' THEN 0 ELSE 1 END,
      r.name,
      cat.name,
      e.id
  `).bind(lang, lang, lang, lang).all();

  return result.results || [];
}

async function getQuestionRows(db, examId, lang, topicSlug = null) {
  let topicCondition = "";
  let orderClause = "ORDER BY q.id";
  let limitClause = "";
  const values = [lang, lang, examId];

  // If a topic slug is provided, determine whether it is
  // a standard topic or the exam's mixed-practice topic.
  if (topicSlug) {
    const topic = await db.prepare(`
      SELECT id, topic_type, selection_mode, random_question_count
      FROM topics
      WHERE exam_id = ? AND slug = ?
    `).bind(examId, topicSlug).first();

    // Unknown topic: return no questions.
    if (!topic) {
      return [];
    }

    if (topic.topic_type === "mixed") {
      // Mixed Practice includes questions from all standard topics.
      topicCondition = "AND t.topic_type = 'standard'";

      if (topic.selection_mode === "random") {
        const count = Number(topic.random_question_count);

        if (!Number.isInteger(count) || count < 1) {
          return [];
        }

        orderClause = "ORDER BY RANDOM()";
        limitClause = "LIMIT ?";
        values.push(count);
      }
    } else {
      // Standard topic: only return its own questions.
      topicCondition = "AND t.slug = ?";
      values.push(topicSlug);
    }
  }

  const result = await db.prepare(`
    SELECT
      q.id,
      q.difficulty,
      q.topic_id,
      COALESCE(tt.name, 'General') AS topic_name,
      qt.question_text,
      qt.explanation
    FROM questions q
    JOIN question_translations qt
      ON qt.question_id = q.id
      AND qt.language_code = ?
    LEFT JOIN topics t
      ON t.id = q.topic_id
    LEFT JOIN topic_translations tt
      ON tt.topic_id = t.id
      AND tt.language_code = ?
    WHERE q.exam_id = ?
      AND q.status = 'published'
      ${topicCondition}
    ${orderClause}
    ${limitClause}
  `).bind(...values).all();

  return result.results || [];
}

async function questionOptions(db, questionId, lang) {
  const result = await db.prepare(`
    SELECT qo.id, qo.option_key, qo.sort_order, ot.option_text
    FROM question_options qo
    JOIN option_translations ot
      ON ot.option_id = qo.id AND ot.language_code = ?
    WHERE qo.question_id = ?
    ORDER BY qo.sort_order
  `).bind(lang, questionId).all();
  return result.results || [];
}

// Load all images for an exam in one query and group them by question.
async function getExamQuestionImages(db, examId) {
  const result = await db.prepare(`
    SELECT
      qi.question_id,
      qi.image_url,
      qi.alt_text,
      qi.sort_order
    FROM question_images qi
    JOIN questions q ON q.id = qi.question_id
    WHERE q.exam_id = ?
      AND q.status = 'published'
    ORDER BY qi.question_id, qi.sort_order
  `).bind(examId).all();

  const imagesByQuestion = new Map();

  for (const row of result.results || []) {
    if (!imagesByQuestion.has(row.question_id)) {
      imagesByQuestion.set(row.question_id, []);
    }

    imagesByQuestion.get(row.question_id).push({
      url: row.image_url,
      alt: row.alt_text,
      sort_order: row.sort_order
    });
  }

  return imagesByQuestion;
}

// Load images belonging to a specific mock exam attempt.
async function getAttemptQuestionImages(db, attemptId) {
  const result = await db.prepare(`
    SELECT
      aq.question_id,
      qi.image_url,
      qi.alt_text,
      qi.sort_order
    FROM attempt_questions aq
    JOIN question_images qi ON qi.question_id = aq.question_id
    WHERE aq.attempt_id = ?
    ORDER BY aq.sort_order, qi.sort_order
  `).bind(attemptId).all();

  const imagesByQuestion = new Map();

  for (const row of result.results || []) {
    if (!imagesByQuestion.has(row.question_id)) {
      imagesByQuestion.set(row.question_id, []);
    }

    imagesByQuestion.get(row.question_id).push({
      url: row.image_url,
      alt: row.alt_text,
      sort_order: row.sort_order
    });
  }

  return imagesByQuestion;
}

async function api(request, env) {
  if (!env.DB) return json({ error: "D1 binding DB is not configured." }, 500);
  const url = new URL(request.url);
  const path = url.pathname;
  const lang = languageOrDefault(url.searchParams.get("lang") || "en");

  if (request.method === "GET" && path === "/api/health") {
    await env.DB.prepare("SELECT 1").first();
    return json({ ok: true, service: "exam-practice-api" });
  }

  if (request.method === "GET" && path === "/api/exams") {
    return json({ exams: await listExams(env.DB, lang) });
  }
  if (request.method === "GET" && path === "/api/catalog") {
    return json({
      exams: await listCatalogExams(env.DB, lang)
    });
  }

  const examMatch = path.match(/^\/api\/exams\/([a-z0-9-]+)$/);
  if (request.method === "GET" && examMatch) {
    const policy = await examLanguagePolicy(env.DB, examMatch[1]);
    if (!policy) return json({ error: 'Exam not found' }, 404);
    if (!policy.supported.includes(lang)) return json({ error: 'Language not available for this exam', fallback_language: policy.fallback }, 409);
    const exam = await getPublishedExam(env.DB)
      .bind(lang, lang, lang, examMatch[1])
      .first();
    if (!exam) return json({ error: "Exam not found" }, 404);
    const topics = await env.DB.prepare(`
  SELECT
    t.id,
    t.slug,
    COALESCE(tt.name, t.slug) AS name,
    t.sort_order,
    t.topic_type,
    t.selection_mode,
    t.random_question_count,
    (
      SELECT COUNT(*)
      FROM questions q
      JOIN question_translations qt
        ON qt.question_id = q.id
        AND qt.language_code = ?
      WHERE q.exam_id = t.exam_id
        AND q.topic_id = t.id
        AND q.status = 'published'
    ) AS question_count
  FROM topics t
  LEFT JOIN topic_translations tt
    ON tt.topic_id = t.id
    AND tt.language_code = ?
  WHERE t.exam_id = ?
  ORDER BY t.sort_order
`).bind(lang, lang, exam.id).all();

    return json({ exam, topics: topics.results || [], supported_languages: policy.supported, default_language: policy.fallback });
  }

  const questionsMatch = path.match(/^\/api\/exams\/([a-z0-9-]+)\/questions$/);
  if (request.method === "GET" && questionsMatch) {
    const policy = await examLanguagePolicy(env.DB, questionsMatch[1]);
    if (!policy) return json({ error: 'Exam not found' }, 404);
    if (!policy.supported.includes(lang)) return json({ error: 'Language not available for this exam', fallback_language: policy.fallback }, 409);
    const exam = await env.DB.prepare(
      "SELECT id, question_count FROM exams WHERE slug = ? AND status = 'published'"
    ).bind(questionsMatch[1]).first();
    if (!exam) return json({ error: "Exam not found" }, 404);
    const topicSlug = url.searchParams.get("topic");
    const perSet = Math.max(1, Math.min(1000, Number(exam.question_count) || 20));
    const savedIds = (url.searchParams.get("ids") || "").split(",")
      .filter(id => /^\d+$/.test(id)).slice(0, perSet);
    const exclude = new Set((url.searchParams.get("exclude") || "").split(","));
    let rows;
    if (!topicSlug) {
      let ids;
      if (savedIds.length) {
        ids = [...new Set(savedIds)];
      } else {
        const available = await env.DB.prepare(`
          SELECT q.id FROM questions q
          JOIN question_translations qt ON qt.question_id=q.id AND qt.language_code=?
          WHERE q.exam_id=? AND q.status='published' ORDER BY q.id
        `).bind(lang, exam.id).all();
        const all = (available.results || []).map(q => q.id);
        ids = shuffle(all.filter(id => !exclude.has(String(id))))
          .concat(shuffle(all.filter(id => exclude.has(String(id)))))
          .slice(0, perSet);
      }
      if (!ids.length) return json({ questions: [], question_count: perSet });
      const placeholders = ids.map(() => "?").join(",");
      const result = await env.DB.prepare(`
        SELECT q.id, q.difficulty, COALESCE(tt.name,'General') AS topic_name,
               qt.question_text FROM questions q
        JOIN question_translations qt ON qt.question_id=q.id AND qt.language_code=?
        LEFT JOIN topics t ON t.id=q.topic_id
        LEFT JOIN topic_translations tt ON tt.topic_id=t.id AND tt.language_code=?
        WHERE q.exam_id=? AND q.status='published' AND q.id IN (${placeholders})
      `).bind(lang,lang,exam.id,...ids).all();
      const byId = new Map((result.results || []).map(q => [String(q.id),q]));
      rows = ids.map(id => byId.get(String(id))).filter(Boolean);
    } else {
      rows = await getQuestionRows(env.DB, exam.id, lang, topicSlug);
    }
    if (!rows.length) return json({ questions: [], question_count: perSet });
    const ids = rows.map(q => q.id);
    const placeholders = ids.map(() => "?").join(",");
    const [optionResult,imageResult] = await Promise.all([
      env.DB.prepare(`
        SELECT qo.question_id,qo.id,qo.option_key,qo.sort_order,ot.option_text
        FROM question_options qo JOIN option_translations ot
          ON ot.option_id=qo.id AND ot.language_code=?
        WHERE qo.question_id IN (${placeholders})
        ORDER BY qo.question_id,qo.sort_order
      `).bind(lang,...ids).all(),
      env.DB.prepare(`
        SELECT question_id,image_url,alt_text,sort_order FROM question_images
        WHERE question_id IN (${placeholders}) ORDER BY question_id,sort_order
      `).bind(...ids).all()
    ]);
    const options=new Map(),images=new Map();
    for(const o of optionResult.results || []) {
      if(!options.has(o.question_id)) options.set(o.question_id,[]);
      options.get(o.question_id).push({id:o.id,option_key:o.option_key,
        sort_order:o.sort_order,option_text:o.option_text});
    }
    for(const img of imageResult.results || []) {
      if(!images.has(img.question_id)) images.set(img.question_id,[]);
      images.get(img.question_id).push({url:img.image_url,alt:img.alt_text,
        sort_order:img.sort_order});
    }
    const questions=rows.map(q=>({id:q.id,difficulty:q.difficulty,
      topic:q.topic_name,question:q.question_text,images:images.get(q.id)||[],
      options:options.get(q.id)||[]}));
    return json({ questions, question_count: perSet });
  }

  const answerMatch = path.match(/^\/api\/questions\/(\d+)\/answer$/);
  if (request.method === "POST" && answerMatch) {
    const clientId = getClientId(request);
    if (!clientId) return json({ error: "A valid x-client-id header is required." }, 400);
    const body = await request.json().catch(() => null);
    if (!body || !Number.isInteger(body.option_id)) return json({ error: "option_id is required." }, 400);
    const questionId = Number(answerMatch[1]);
    const row = await env.DB.prepare(`
      SELECT q.id, qo.id AS selected_id, qo.is_correct,
             qt.explanation,
             (SELECT id FROM question_options WHERE question_id = q.id AND is_correct = 1 LIMIT 1) AS correct_option_id
      FROM questions q
      JOIN question_options qo ON qo.question_id = q.id AND qo.id = ?
      JOIN question_translations qt ON qt.question_id = q.id AND qt.language_code = ?
      WHERE q.id = ? AND q.status = 'published'
    `).bind(body.option_id, lang, questionId).first();
    if (!row) return json({ error: "Question or option not found." }, 404);
    const policy = await env.DB.prepare(`
      SELECT e.slug FROM questions q JOIN exams e ON e.id = q.exam_id
      WHERE q.id = ? AND e.status = 'published'
    `).bind(questionId).first();
    if (!policy || !(await examLanguagePolicy(env.DB, policy.slug))?.supported.includes(lang)) {
      return json({ error: 'Language not available for this exam' }, 409);
    }
    return json({
      correct: row.is_correct === 1,
      correct_option_id: row.correct_option_id,
      explanation: row.explanation
    });
  }

  if (request.method === "POST" && path === "/api/mock/start") {
    const clientId = getClientId(request);
    if (!clientId) {
      return json({ error: "A valid x-client-id header is required." }, 400);
    }

    const body = await request.json().catch(() => ({}));
    const slug = typeof body.exam_slug === "string"
      ? body.exam_slug
      : "bc-class-7l";

    const exam = await env.DB.prepare(
      "SELECT id, question_count FROM exams WHERE slug = ? AND status = 'published'"
    ).bind(slug).first();

    if (!exam) return json({ error: "Exam not found." }, 404);
    const policy = await examLanguagePolicy(env.DB, slug);
    if (!policy.supported.includes(lang)) return json({ error: 'Language not available for this exam', fallback_language: policy.fallback }, 409);

    // Randomly select questions.
    const selected = await env.DB.prepare(`
    SELECT id
    FROM questions
    WHERE exam_id = ? AND status = 'published'
    ORDER BY RANDOM()
    LIMIT ?
  `).bind(exam.id, exam.question_count).all();

    const ids = (selected.results || []).map(x => x.id);

    if (!ids.length) {
      return json({ error: "No published questions available." }, 400);
    }

    const attemptId = crypto.randomUUID();

    await env.DB.prepare(`
    INSERT INTO exam_attempts
      (id, exam_id, client_id, mode, language_code, total_questions)
    VALUES (?, ?, ?, 'mock', ?, ?)
  `).bind(attemptId, exam.id, clientId, lang, ids.length).run();

    // Save the question order.
    const statements = ids.map((id, index) =>
      env.DB.prepare(`
      INSERT INTO attempt_questions (attempt_id, question_id, sort_order)
      VALUES (?, ?, ?)
    `).bind(attemptId, id, index + 1)
    );

    await env.DB.batch(statements);

    // Fetch all question text and options in one query.
    const result = await env.DB.prepare(`
    SELECT
      q.id,
      qt.question_text,
      qo.id AS option_id,
      qo.option_key,
      qo.sort_order,
      ot.option_text
    FROM attempt_questions aq
    JOIN questions q ON q.id = aq.question_id
    JOIN question_translations qt
      ON qt.question_id = q.id
      AND qt.language_code = ?
    JOIN question_options qo ON qo.question_id = q.id
    JOIN option_translations ot
      ON ot.option_id = qo.id
      AND ot.language_code = ?
    WHERE aq.attempt_id = ?
    ORDER BY aq.sort_order, qo.sort_order
  `).bind(lang, lang, attemptId).all();

    // Group options under their questions.
    const questionMap = new Map();

    for (const row of result.results || []) {
      if (!questionMap.has(row.id)) {
        questionMap.set(row.id, {
          id: row.id,
          question: row.question_text,
          images: [],
          options: []
        });
      }

      questionMap.get(row.id).options.push({
        id: row.option_id,
        option_key: row.option_key,
        sort_order: row.sort_order,
        option_text: row.option_text
      });
    }

    // Load all images for this attempt in one query.
    const imagesByQuestion = await getAttemptQuestionImages(env.DB, attemptId);

    for (const [questionId, images] of imagesByQuestion) {
      const question = questionMap.get(questionId);
      if (question) question.images = images;
    }

    return json({
      attempt_id: attemptId,
      questions: ids
        .map(id => questionMap.get(id))
        .filter(Boolean)
    });
  }

  const mockSubmitMatch = path.match(/^\/api\/mock\/([0-9a-f-]+)\/submit$/);
  if (request.method === "POST" && mockSubmitMatch) {
    const clientId = getClientId(request);
    if (!clientId) return json({ error: "A valid x-client-id header is required." }, 400);
    const attemptId = mockSubmitMatch[1];
    const attempt = await env.DB.prepare(`
      SELECT a.*, e.passing_score_percent
      FROM exam_attempts a JOIN exams e ON e.id = a.exam_id
      WHERE a.id = ? AND a.client_id = ? AND a.mode = 'mock'
    `).bind(attemptId, clientId).first();
    if (!attempt) return json({ error: "Attempt not found." }, 404);
    if (attempt.status === "completed") return json({ error: "Attempt already submitted." }, 409);

    const body = await request.json().catch(() => ({}));
    const answers = Array.isArray(body.answers) ? body.answers : [];
    const valid = await env.DB.prepare(`
      SELECT aq.question_id, qo.id AS option_id, qo.is_correct
      FROM attempt_questions aq
      JOIN question_options qo ON qo.question_id = aq.question_id
      WHERE aq.attempt_id = ?
    `).bind(attemptId).all();

    const answerMap = new Map(answers.map(a => [Number(a.question_id), Number(a.option_id)]));
    let correct = 0;
    const statements = [];
    for (const row of (valid.results || []).filter((r, i, arr) => arr.findIndex(x => x.question_id === r.question_id) === i)) {
      const selectedId = answerMap.get(row.question_id) || null;
      const selected = selectedId ? (valid.results || []).find(
        x => x.question_id === row.question_id && x.option_id === selectedId
      ) : null;
      const correctRow = (valid.results || []).find(
        x => x.question_id === row.question_id && x.is_correct === 1
      );
      const isCorrect = !!selected && selected.is_correct === 1;
      if (isCorrect) correct++;
      statements.push(env.DB.prepare(`
        UPDATE attempt_questions
        SET selected_option_id = ?, is_correct = ?, answered_at = CURRENT_TIMESTAMP
        WHERE attempt_id = ? AND question_id = ?
      `).bind(selected ? selectedId : null, isCorrect ? 1 : 0, attemptId, row.question_id));
    }
    const total = attempt.total_questions;
    const score = total ? Math.round((correct / total) * 100) : 0;
    const passed = score >= attempt.passing_score_percent ? 1 : 0;
    statements.push(env.DB.prepare(`
      UPDATE exam_attempts
      SET status = 'completed', correct_count = ?, score_percent = ?,
          passed = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(correct, score, passed, attemptId));
    await env.DB.batch(statements);
    return json({
      total_questions: total,
      correct_count: correct,
      score_percent: score,
      passing_score_percent: attempt.passing_score_percent,
      passed: passed === 1
    });
  }

  if (request.method === "GET" && path === "/api/history") {
    const clientId = getClientId(request);
    if (!clientId) return json({ error: "A valid x-client-id header is required." }, 400);
    const result = await env.DB.prepare(`
      SELECT a.id, e.slug AS exam_slug, et.title, a.mode, a.total_questions,
             a.correct_count, a.score_percent, a.passed, a.started_at, a.completed_at
      FROM exam_attempts a
      JOIN exams e ON e.id = a.exam_id
      JOIN exam_translations et
        ON et.exam_id = e.id AND et.language_code = a.language_code
      WHERE a.client_id = ?
      ORDER BY a.started_at DESC LIMIT 50
    `).bind(clientId).all();
    return json({ attempts: result.results || [] });
  }

  return json({ error: "API route not found." }, 404);
}

// Public sitemap: only published exams with enabled languages and a real title.
const SITEMAP_ORIGIN = "https://examhere.com";
const SITEMAP_LANGS = [
  { code: "en", prefix: "" },
  { code: "fr", prefix: "/fr" },
  { code: "zh-CN", prefix: "/zh" },
  { code: "zh-TW", prefix: "/zh-tw" }
];

function xmlEscape(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&apos;"
  })[char]);
}

async function sitemapResponse(db) {
  const result = await db.prepare(`
    SELECT e.slug, el.language_code
    FROM exams e
    JOIN exam_languages el ON el.exam_id = e.id AND el.is_enabled = 1
    JOIN languages l ON l.code = el.language_code AND l.is_enabled = 1
    JOIN exam_translations et ON et.exam_id = e.id
      AND et.language_code = el.language_code
      AND TRIM(et.title) <> ''
    WHERE e.status = 'published'
    ORDER BY e.slug, el.language_code
  `).all();

  const urls = SITEMAP_LANGS.map(lang => `${SITEMAP_ORIGIN}${lang.prefix || "/"}`);
  for (const row of result.results || []) {
    const lang = SITEMAP_LANGS.find(item => item.code === row.language_code);
    if (lang && /^[a-z0-9-]+$/.test(row.slug)) {
      urls.push(`${SITEMAP_ORIGIN}${lang.prefix}/${row.slug}`);
    }
  }
  const unique = [...new Set(urls)];
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    unique.map(url => `  <url><loc>${xmlEscape(url)}</loc></url>`).join('\n') +
    '\n</urlset>\n';
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=300"
    }
  });
}


// Render SEO metadata in the initial HTML response, before browser JavaScript runs.
const SEO_ORIGIN = "https://examhere.com";
const SEO_LANGS = [
  { code: "en", prefix: "", hreflang: "en" },
  { code: "fr", prefix: "/fr", hreflang: "fr" },
  { code: "zh-CN", prefix: "/zh", hreflang: "zh-CN" },
  { code: "zh-TW", prefix: "/zh-tw", hreflang: "zh-TW" }
];
const SEO_HOME = {
  en: ["ExamHere – Free Online Practice Tests Worldwide", "Prepare for your next exam with free online practice questions. Explore driver’s license, citizenship, professional certification and other exams by country and region."],
  fr: ["ExamHere – Tests pratiques gratuits en ligne", "Préparez votre examen avec des questions gratuites : permis de conduire, citoyenneté, certifications professionnelles et autres examens, par pays et région."],
  "zh-CN": ["ExamHere – 全球免费在线考试练习", "通过免费在线练习题准备驾照笔试、入籍考试、职业资格及其他考试，按国家和地区查找备考资源。"],
  "zh-TW": ["ExamHere – 全球免費線上考試練習", "透過免費線上練習題準備駕照筆試、入籍考試、職業資格及其他考試，依國家和地區查找備考資源。"]
};
function seoEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);
}
function seoPath(code, slug = "") {
  const entry = SEO_LANGS.find(lang => lang.code === code);
  return `${entry?.prefix || ""}/${slug}` || "/";
}
function seoHead({ lang, title, description, canonical, alternates }) {
  const links = [
    `<link id="canonical-url" rel="canonical" href="${seoEscape(canonical)}">`,
    ...alternates.map(item =>
      `<link rel="alternate" hreflang="${seoEscape(item.code)}" href="${seoEscape(item.url)}">`
    )
  ];
  return { links: links.join("\n"), title: seoEscape(title), description: seoEscape(description), lang };
}
async function seoHtmlResponse(response, metadata, examTitle = "", examDescription = "") {
  if (!response.ok) return response;
  const type = response.headers.get("content-type") || "";
  if (!type.includes("text/html")) return response;
  let html = await response.text();
  html = html.replace(/<html lang="[^"]*">/, `<html lang="${seoEscape(metadata.lang)}">`);
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${metadata.title}</title>`);
  html = html.replace(/<meta name="description" content="[^"]*">/i,
    `<meta name="description" content="${metadata.description}">`);
  html = html.replace(/<link id="canonical-url" rel="canonical" href="[^"]*">/i, "");
  html = html.replace(/<meta property="og:url" content="[^"]*">/i, "");
  html = html.replace(/<meta property="og:title" content="[^"]*">/i, "");
  html = html.replace(/<meta property="og:description" content="[^"]*">/i, "");
  html = html.replace(/<meta property="og:site_name" content="[^"]*">/i, "");
  const websiteSchema = metadata.canonical === SEO_ORIGIN + "/"
    ? `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "WebSite", name: "ExamHere", alternateName: "Global Exam Practice", url: SEO_ORIGIN + "/" })}</script>` : "";
  html = html.replace("</head>", `${metadata.links}
<meta property="og:site_name" content="ExamHere">
${websiteSchema}
<meta property="og:title" content="${metadata.title}">
<meta property="og:description" content="${metadata.description}">
<meta property="og:url" content="${seoEscape(metadata.canonical)}">
</head>`);
  if (examTitle) {
    html = html.replace('<h1 id="practice-exam-title" class="practice-exam-title" hidden></h1>',
      `<h1 id="practice-exam-title" class="practice-exam-title">${seoEscape(examTitle)}</h1>`);
    if (examDescription && String(examDescription).trim()) {
      html = html.replace('<p id="practice-seo-description" class="practice-seo-description" hidden></p>',
        `<p id="practice-seo-description" class="practice-seo-description">${seoEscape(examDescription)}</p>`);
    }
  }
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "public, max-age=300");
  return new Response(html, { status: response.status, headers });
}
async function seoExamAlternates(db, examId, slug) {
  const result = await db.prepare(`
    SELECT el.language_code FROM exam_languages el
    JOIN languages l ON l.code = el.language_code AND l.is_enabled = 1
    JOIN exam_translations et ON et.exam_id = el.exam_id
      AND et.language_code = el.language_code AND TRIM(et.title) <> ''
    WHERE el.exam_id = ? AND el.is_enabled = 1
  `).bind(examId).all();
  return (result.results || []).filter(row =>
    SEO_LANGS.some(lang => lang.code === row.language_code)
  ).map(row => ({
    code: row.language_code,
    url: SEO_ORIGIN + seoPath(row.language_code, slug)
  }));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method === "GET" && url.pathname === "/sitemap.xml") {
        if (!env.DB) return new Response("Database unavailable", { status: 503 });
        return sitemapResponse(env.DB);
      }
      // Country-level routing for analytics consent; no IP or identifiers returned.
      if (request.method === "GET" && url.pathname === "/api/privacy-region") {
        const country = request.cf?.country || "";
        const consentCountries = new Set([
          "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR",
          "HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK",
          "SI","ES","SE","IS","LI","NO","GB","CH"
        ]);
        const region = !country || country === "XX" || country === "T1"
          ? "unknown" : consentCountries.has(country) ? "opt-in" : "notice";
        return new Response(JSON.stringify({ region }), {
          headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" }
        });
      }
      if (url.pathname.startsWith("/api/admin/languages")) {
        return await handleAdminLanguages(request, env);
      }
      // Admin authentication routes
      if (url.pathname.startsWith("/api/admin/countries")) {
        return await handleAdminCountries(request, env);
      }

      if (url.pathname.startsWith("/api/admin/regions")) {
        return await handleAdminRegions(request, env);
      }
      if (url.pathname.startsWith("/api/admin/categories")) {
        return await handleAdminCategories(request, env);
      }
      if (url.pathname.startsWith("/api/admin/exams")) {
        return await handleAdminExams(request, env);
      }
      if (url.pathname.startsWith("/api/admin/topics")) {
        return await handleAdminTopics(request, env);
      }
      if (url.pathname.startsWith("/api/admin/questions")) {
        return await handleAdminQuestions(request, env);
      }
      if (url.pathname === "/api/admin/images") {
        return await handleAdminImages(request, env);
      }

      if (url.pathname === "/api/admin/imports") {
        return await handleAdminImports(request, env);
      }
      if (url.pathname === "/api/admin/review" ||
          url.pathname.startsWith("/api/admin/review/")) {
        return await handleAdminReview(request, env);
      }
      if (url.pathname.startsWith("/api/admin/")) {
        return await handleAdminAuth(request, env);
      }
      if (url.pathname.startsWith("/api/")) {
        if (request.method === "OPTIONS") {
          return new Response(null, {
            status: 204,
            headers: {
              "access-control-allow-origin": url.origin,
              "access-control-allow-methods": "GET,POST,OPTIONS",
              "access-control-allow-headers": "content-type,x-client-id",
              "access-control-max-age": "86400"
            }
          });
        }
        return await api(request, env);
      }

      if (url.pathname.startsWith("/images/questions/")) {
        return await handlePublicImage(request, env);
      }

      // Handle localized homepage URLs.
      if (
        request.method === "GET" &&
        (url.pathname === "/fr" ||
          url.pathname === "/fr/" ||
          url.pathname === "/zh" ||
          url.pathname === "/zh/" ||
          url.pathname === "/zh-tw" ||
          url.pathname === "/zh-tw/")
      ) {
        const assetUrl = new URL(request.url);
        assetUrl.pathname = "/";

        const lang = url.pathname.startsWith("/fr") ? "fr" :
          url.pathname.startsWith("/zh-tw") ? "zh-TW" : "zh-CN";
        const [title, description] = SEO_HOME[lang];
        const metadata = seoHead({
          lang, title, description,
          canonical: SEO_ORIGIN + seoPath(lang),
          alternates: SEO_LANGS.map(item => ({
            code: item.hreflang, url: SEO_ORIGIN + seoPath(item.code)
          }))
        });
        metadata.canonical = SEO_ORIGIN + seoPath(lang);
        return seoHtmlResponse(
          await env.ASSETS.fetch(new Request(assetUrl.toString(), request)),
          metadata
        );
      }

      // Handle clean exam URLs.
      if (request.method === "GET") {
        let examSlug = null;
        let routeLang = "en";

        const frenchMatch = url.pathname.match(/^\/fr\/([a-z0-9-]+)\/?$/);

        const simplifiedMatch = url.pathname.match(
          /^\/zh\/([a-z0-9-]+)\/?$/
        );

        const traditionalMatch = url.pathname.match(
          /^\/zh-tw\/([a-z0-9-]+)\/?$/
        );

        const englishMatch = url.pathname.match(
          /^\/([a-z0-9-]+)\/?$/
        );

        if (frenchMatch) {
          examSlug = frenchMatch[1];
          routeLang = "fr";
        } else if (simplifiedMatch) {
          examSlug = simplifiedMatch[1];
          routeLang = "zh-CN";
        } else if (traditionalMatch) {
          examSlug = traditionalMatch[1];
          routeLang = "zh-TW";
        } else if (englishMatch) {
          examSlug = englishMatch[1];
        }

        if (examSlug) {
          const policy = await examLanguagePolicy(env.DB, examSlug);
          if (policy && !policy.supported.includes(routeLang)) {
            if (!policy.fallback) return json({ error: 'No public languages available' }, 404);
            const target = new URL(request.url);
            target.pathname = languagePath(policy.fallback, examSlug);
            target.searchParams.delete('lang');
            return Response.redirect(target.toString(), 302);
          }
          const exam = await getPublishedExam(env.DB)
            .bind(routeLang, routeLang, routeLang, examSlug)
            .first();

          if (exam) {
            const assetUrl = new URL(request.url);
            assetUrl.pathname = "/practice";

            const alternates = await seoExamAlternates(env.DB, exam.id, examSlug);
            const canonical = SEO_ORIGIN + seoPath(routeLang, examSlug);
            const metadata = seoHead({
              lang: routeLang,
              title: `${exam.title} | ExamHere`,
              description: exam.description || `${exam.title} practice questions on ExamHere.`,
              canonical,
              alternates: alternates.map(item => ({ ...item, code: item.code }))
            });
            metadata.canonical = canonical;
            return seoHtmlResponse(
              await env.ASSETS.fetch(new Request(assetUrl.toString(), request)),
              metadata, exam.title, exam.description
            );
          }
        }
      }

      if (request.method === "GET" && url.pathname === "/") {
        const [title, description] = SEO_HOME.en;
        const metadata = seoHead({
          lang: "en", title, description, canonical: SEO_ORIGIN + "/",
          alternates: SEO_LANGS.map(item => ({
            code: item.hreflang, url: SEO_ORIGIN + seoPath(item.code)
          }))
        });
        metadata.canonical = SEO_ORIGIN + "/";
        return seoHtmlResponse(await env.ASSETS.fetch(request), metadata);
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error("Request failed", error);
      return json({ error: "Internal server error." }, 500);
    }
  }
};