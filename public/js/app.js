
import { api, copy, getLanguage, setLanguageSelect } from "./common.js";

const lang = getLanguage();
const t = copy[lang];

setLanguageSelect(lang);
document.documentElement.lang = lang;

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
  questionCount: {
    en: "questions",
    "zh-CN": "道题",
    "zh-TW": "道題"
  }
};


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

    const standardTopics = topics
      .filter(topic => topic.topic_type !== "mixed")
      .sort((a, b) => a.sort_order - b.sort_order);

    const totalQuestionCount = standardTopics.reduce(
      (total, topic) => total + Number(topic.question_count || 0),
      0
    );

    root.innerHTML = "";

    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow exam-location";
    eyebrow.textContent =
      lang === "zh-CN"
        ? "🇨🇦 CA  ›  不列颠哥伦比亚省  ›  🚗 驾驶"
        : lang === "zh-TW"
        ? "🇨🇦 CA  ›  不列顛哥倫比亞省  ›  🚗 駕駛"
        : "🇨🇦 CA  ›  BRITISH COLUMBIA  ›  🚗 DRIVING";

    const heading = document.createElement("h2");
    heading.textContent = exam.title;

    const description = document.createElement("p");
    description.className = "muted";
    description.textContent = exam.description || "";

    const mainButtons = document.createElement("div");
    mainButtons.className = "button-row main-action-row";

    const allQuestionsLink = createLink(
      `${labels.allTopics[lang]} (${totalQuestionCount} ${labels.questionCount[lang]})`,
      `/practice.html?exam=${encodeURIComponent(exam.slug)}&lang=${encodeURIComponent(lang)}`,
      "primary"
    );

    mainButtons.append(allQuestionsLink);

    const topicHeading = document.createElement("h3");
    topicHeading.textContent = labels.topics[lang];

    const topicList = document.createElement("div");
    topicList.className = "button-row topic-button-list";

    standardTopics.forEach(topic => {
      const count = Number(topic.question_count || 0);

      const link = createLink(
        `${topic.name} (${count})`,
        `/practice.html?exam=${encodeURIComponent(exam.slug)}&topic=${encodeURIComponent(topic.slug)}&lang=${encodeURIComponent(lang)}`,
        "secondary topic-button"
      );

      topicList.append(link);
    });

    root.append(
      eyebrow,
      heading,
      description,
      mainButtons,
      topicHeading,
      topicList
    );
  }
} catch (error) {
  root.textContent = error.message;
}
