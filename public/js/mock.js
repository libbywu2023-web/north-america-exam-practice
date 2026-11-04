import { api, copy, getLanguage, setLanguageSelect } from "./common.js";
const lang = getLanguage(), t = copy[lang];
setLanguageSelect(lang);
document.documentElement.lang = lang;
document.querySelector("#mock-heading").textContent = t.mock;
document.querySelector("#submit-mock").textContent = t.submit;
let attemptId = null, questions = [];
const exam = new URLSearchParams(location.search).get("exam") || "bc-class-7l";
const status = document.querySelector("#mock-status");
const loading = document.querySelector("#mock-loading");
try {
  const data = await api("/api/mock/start?lang=" + encodeURIComponent(lang), {
    method: "POST", body: JSON.stringify({ exam_slug: exam })
  });
  attemptId = data.attempt_id;
  questions = data.questions;
  if (!questions.length) throw new Error(t.noQuestions);
  status.textContent = `${questions.length} questions`;
  loading.hidden = true;
  const root = document.querySelector("#mock-questions");
  questions.forEach((q, index) => {
    const section = document.createElement("section");
    section.className = "question-block";
    const heading = document.createElement("h3");
    heading.textContent = `${index + 1}. ${q.question}`;
    section.append(heading);
    q.options.forEach(option => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio"; input.name = `q-${q.id}`; input.value = option.id;
      const text = document.createElement("span");
      text.textContent = `${option.option_key}. ${option.option_text}`;
      label.append(input, text); section.append(label);
    });
    root.append(section);
  });
  document.querySelector("#submit-mock").hidden = false;
} catch (error) {
  loading.hidden = true;
  status.textContent = error.message;
}

document.querySelector("#submit-mock").addEventListener("click", async () => {
  if (!attemptId) return;
  const answers = questions.map(q => {
    const selected = document.querySelector(`input[name="q-${q.id}"]:checked`);
    return selected ? { question_id: q.id, option_id: Number(selected.value) } : null;
  }).filter(Boolean);
  const button = document.querySelector("#submit-mock");
  button.disabled = true;
  try {
    const result = await api(`/api/mock/${attemptId}/submit`, {
      method: "POST", body: JSON.stringify({ answers })
    });
    const box = document.querySelector("#mock-result");
    box.className = `feedback ${result.passed ? "correct" : "incorrect"}`;
    box.textContent = `${result.passed ? t.passed : t.notPassed} — ${t.score}: ${result.score_percent}% (${result.correct_count}/${result.total_questions}).`;
    box.hidden = false;
    status.textContent = "";
    button.hidden = true;
  } catch (error) {
    button.disabled = false;
    alert(error.message);
  }
});
