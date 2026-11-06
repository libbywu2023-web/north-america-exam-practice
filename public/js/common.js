export const copy = {
  en: {
    allExams: "All exams", practice: "Practice questions", mock: "Start mock test",
    question: "Question", choose: "Choose one answer", check: "Check answer", retry: "Retry", confirmRetry: "Restart this practice session? All answers will be cleared.",
    previous: "Previous", next: "Next", correct: "Correct!", incorrect: "Not quite.",
    correctAnswer: "Correct answer", loading: "Loading…", submit: "Submit test",
    passed: "You passed!", notPassed: "Not passed yet", score: "Your score",
    noQuestions: "No questions are available in this language yet.",
  },
  "zh-CN": {
    allExams: "所有考试", practice: "开始逐题练习", mock: "开始模拟考试",
    question: "题目", choose: "请选择一个答案", check: "检查答案", retry: "重新答题", confirmRetry: "确定要重新开始练习吗？所有答题记录都将清除。",
    previous: "上一题", next: "下一题", correct: "回答正确！", incorrect: "还不正确。",
    correctAnswer: "正确答案", loading: "正在加载…", submit: "提交考试",
    passed: "恭喜，通过！", notPassed: "尚未通过", score: "你的成绩",
    noQuestions: "目前没有此语言的题目。",
  },
  "zh-TW": {
    allExams: "所有考試", practice: "開始逐題練習", mock: "開始模擬考試",
    question: "題目", choose: "請選擇一個答案", check: "檢查答案", retry: "重新作答", confirmRetry: "確定要重新開始練習嗎？所有答題記錄都將清除。",
    previous: "上一題", next: "下一題", correct: "回答正確！", incorrect: "還不正確。",
    correctAnswer: "正確答案", loading: "正在載入…", submit: "提交考試",
    passed: "恭喜，通過！", notPassed: "尚未通過", score: "你的成績",
    noQuestions: "目前沒有此語言的題目。",
  }
};
export function getLanguage() {
  const params = new URLSearchParams(location.search);
  const queryLang = params.get("lang");
  const saved = localStorage.getItem("exam-language");
  return ["en","zh-CN","zh-TW"].includes(queryLang) ? queryLang :
    (["en","zh-CN","zh-TW"].includes(saved) ? saved : "en");
}
export function clientId() {
  let id = localStorage.getItem("exam-client-id");
  if (!id) {
    id = crypto.randomUUID().replaceAll("-", "");
    localStorage.setItem("exam-client-id", id);
  }
  return id;
}
export async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-client-id": clientId(),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
export function setLanguageSelect(lang) {
  const select = document.querySelector("#language");
  if (!select) return;
  select.value = lang;
  select.addEventListener("change", () => {
    localStorage.setItem("exam-language", select.value);
    const url = new URL(location.href);
    url.searchParams.set("lang", select.value);
    location.href = url.toString();
  });
}
