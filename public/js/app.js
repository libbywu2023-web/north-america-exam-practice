import { api, copy, getLanguage, setLanguageSelect } from "./common.js";

const lang = getLanguage();
const t = copy[lang];
setLanguageSelect(lang);
document.documentElement.lang = lang;
document.querySelector("#page-title").textContent =
  lang === "zh-CN" ? "练习 BC 驾驶知识测试" :
  lang === "zh-TW" ? "練習 BC 駕駛知識測驗" :
  "Practice for your BC driving knowledge test";
document.querySelector("#intro").textContent =
  lang === "zh-CN" ? "选择学习模式，一题一题建立信心。" :
  lang === "zh-TW" ? "選擇學習模式，一題一題建立信心。" :
  "Choose a study mode and build confidence one question at a time.";
document.querySelector("#practice-title").textContent = t.practice;
document.querySelector("#mock-title").textContent = t.mock;
document.querySelector("#disclaimer").textContent = t.disclaimer;

try {
  const data = await api(`/api/exams?lang=${encodeURIComponent(lang)}`);
  const exam = data.exams.find(x => x.slug === "bc-class-7l");
  const root = document.querySelector("#exam-card");
  if (!exam) {
    root.textContent = t.noQuestions;
  } else {
    root.innerHTML = `
      <p class="eyebrow">${exam.country_code || "CA"} · ${exam.region_code || "BC"} · ${(exam.category_slug || "driving").toUpperCase()}</p>
      <h2></h2><p class="muted"></p>
      <p class="small">${exam.question_count} sample questions · ${exam.time_limit_minutes || 30} min · ${exam.passing_score_percent}% pass mark</p>
      <div class="button-row">
        <a class="primary" href="/practice.html?exam=${encodeURIComponent(exam.slug)}&lang=${encodeURIComponent(lang)}">${t.practice}</a>
        <a class="secondary" href="/mock.html?exam=${encodeURIComponent(exam.slug)}&lang=${encodeURIComponent(lang)}">${t.mock}</a>
      </div>`;
    root.querySelector("h2").textContent = exam.title;
    root.querySelector("p.muted").textContent = exam.description;
    root.querySelector(".small").textContent =
      `${exam.question_count} ${lang === "en" ? "sample questions" : "道示例题"} · ${exam.time_limit_minutes || 30} min · ${exam.passing_score_percent}%`;
  }
} catch (error) {
  document.querySelector("#exam-card").textContent = error.message;
}
