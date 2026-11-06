import { handleAdminAuth } from "./admin-auth.js";
import { handleAdminLanguages } from "./admin-languages.js";
import { handleAdminCountries } from "./admin-countries.js";
import { handleAdminRegions } from "./admin-regions.js";
import { handleAdminCategories } from "./admin-categories.js";
import { handleAdminExams } from "./admin-exams.js";
import { handleAdminTopics } from "./admin-topics.js";
import { handleAdminQuestions } from "./admin-questions.js";
import { handleAdminImages, handlePublicImage } from "./admin-images.js";


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
  return ["en", "zh-CN", "zh-TW"].includes(value) ? value : "en";
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
           c.code AS country_code, c.name AS country_name
    FROM exams e
    JOIN exam_translations et ON et.exam_id = e.id AND et.language_code = ?
    LEFT JOIN regions r ON r.id = e.region_id
    LEFT JOIN countries c ON c.id = r.country_id
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

  const examMatch = path.match(/^\/api\/exams\/([a-z0-9-]+)$/);
  if (request.method === "GET" && examMatch) {
    const exam = await getPublishedExam(env.DB)
  .bind(lang, examMatch[1])
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

return json({ exam, topics: topics.results || [] });
  }

  const questionsMatch = path.match(/^\/api\/exams\/([a-z0-9-]+)\/questions$/);
  if (request.method === "GET" && questionsMatch) {
    const exam = await env.DB.prepare(
      "SELECT id FROM exams WHERE slug = ? AND status = 'published'"
    ).bind(questionsMatch[1]).first();
    if (!exam) return json({ error: "Exam not found" }, 404);
    const rows = await getQuestionRows(
      env.DB, exam.id, lang, url.searchParams.get("topic")
    );
    const imagesByQuestion = await getExamQuestionImages(env.DB, exam.id);

    const questions = [];
    for (const row of rows) {
      questions.push({
        id: row.id,
        difficulty: row.difficulty,
        topic: row.topic_name,
        question: row.question_text,
        images: imagesByQuestion.get(row.id) || [],
        options: await questionOptions(env.DB, row.id, lang)
      });
    }
    return json({ questions });
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
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
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error("Request failed", error);
      return json({ error: "Internal server error." }, 500);
    }
  }
};
