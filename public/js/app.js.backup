
import { api, copy, getLanguage, setLanguageSelect } from "./common.js";

const lang = getLanguage();
const t = copy[lang];

setLanguageSelect(lang);
document.documentElement.lang = lang;

const isChinese = lang !== "en";

const labels = {
  allTopics: {
    en: "Practice all questions",
    "zh-CN": "练习全部题目",
    "zh-TW": "練習全部題目"
  },
  topics: {
    en: "Practice by topic",
    "zh-CN": "按知识点练习",
    "zh-TW": "按知識點練習"
  },
  mixed: {
    en: "Mixed Practice",
    "zh-CN": "混合练习",
    "zh-TW": "混合練習"
  },
  questionCount: {
    en: "sample questions",
    "zh-CN": "道示例题",
    "zh-TW": "道示例題"
  },
  loading: {
    en: "Loading...",
    "zh-CN": "正在加载...",
    "zh-TW": "正在載入..."
  }
};

document.querySelector("#page-title").textContent =
  lang === "zh-CN" ? "练习 BC 驾驶知识测试" :
  lang === "zh-TW" ? "練習 BC 駕駛知識測驗" :
  "Practice for your BC driving knowledge test";

document.querySelector("#intro").textContent =
  lang === "zh-CN" ? "选择学习模式，一题一题建立信心。" :
  lang === "zh-TW" ? "選擇學習模式，一題一題建立信心。" :
  "Choose a study mode and build confidence one question at a time.";

//document.querySelector("#mock-title").textContent = t.mock;
document.querySelector("#disclaimer").textContent = t.disclaimer;

const root = document.querySelector("#exam-card");

function createLink(text, href, className) {
  const link = document.createElement("a");
  link.className = className;
  link.href = href;
  link.textContent = text;
  return link;
}

try {
  const examList = await api(
    `/api/exams?lang=${encodeURIComponent(lang)}`
  );

  const exam = examList.exams.find(
    item => item.slug === "bc-class-7l"
  );

  if (!exam) {
    root.textContent = t.noQuestions;
  } else {
    const detail = await api(
      `/api/exams/${encodeURIComponent(exam.slug)}?lang=${encodeURIComponent(lang)}`
    );

    const topics = detail.topics || [];

    root.innerHTML = "";

    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent =
      `${exam.country_code || "CA"} · ${exam.region_code || "BC"} · ${(exam.category_slug || "driving").toUpperCase()}`;

    const heading = document.createElement("h2");
    heading.textContent = exam.title;

    const description = document.createElement("p");
    description.className = "muted";
    description.textContent = exam.description || "";

    const summary = document.createElement("p");
    summary.className = "small";
    summary.textContent =
      `${exam.question_count} ${labels.questionCount[lang]} · ${exam.time_limit_minutes || 30} min · ${exam.passing_score_percent}%`;

    const mainButtons = document.createElement("div");
    mainButtons.className = "button-row";

mainButtons.append(
  createLink(
    labels.allTopics[lang],
    `/practice.html?exam=${encodeURIComponent(exam.slug)}&lang=${encodeURIComponent(lang)}`,
    "primary"
  )
);

    const topicHeading = document.createElement("h3");
    topicHeading.textContent = labels.topics[lang];

    const topicList = document.createElement("div");
    topicList.className = "button-row";

    topics
      .sort((a, b) => a.sort_order - b.sort_order)
      .forEach(topic => {
        const topicName =
          topic.topic_type === "mixed"
            ? (topic.name || labels.mixed[lang])
            : topic.name;

        const link = createLink(
          topicName,
          `/practice.html?exam=${encodeURIComponent(exam.slug)}&topic=${encodeURIComponent(topic.slug)}&lang=${encodeURIComponent(lang)}`,
          topic.topic_type === "mixed" ? "primary" : "secondary"
        );

        topicList.append(link);
      });

    root.append(
      eyebrow,
      heading,
      description,
      summary,
      mainButtons,
      topicHeading,
      topicList
    );
  }
} catch (error) {
  root.textContent = error.message;
}
