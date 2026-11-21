import { api, copy, getLanguage, setLanguageSelect, setHomeLinks } from "./common.js";

const lang = getLanguage();
const t = copy[lang];
const practiceLabels = {
  fr: { position: (n,total) => `Question ${n} sur ${total}`, perSet: n => `${n} questions par série` },
  en: { position: (n,total) => `Question ${n} of ${total}`, perSet: n => `${n} questions per set` },
  "zh-CN": { position: (n,total) => `第 ${n} / ${total} 题`, perSet: n => `每组 ${n} 题` },
  "zh-TW": { position: (n,total) => `第 ${n} / ${total} 題`, perSet: n => `每組 ${n} 題` }
}[lang];
let perSetCount = null;
function updatePerSet() {
  const label = document.querySelector("#practice-per-set");
  if (!label || topic || !questions.length) return;
  label.textContent = practiceLabels.perSet(perSetCount || questions.length);
  label.hidden = false;
}
function renderExamRegion(examInfo) {
  const subtitle = document.querySelector("#practice-heading-subtitle");
  if (!subtitle) return;
  const country = examInfo.country_name;
  const region = examInfo.region_name;
  if (!country && !region) { subtitle.hidden = true; return; }
  subtitle.replaceChildren();
  const countryCode = String(examInfo.country_code || "").toUpperCase();
  if (/^[A-Z]{2}$/.test(countryCode)) {
    const flag = String.fromCodePoint(...[...countryCode].map(c => c.charCodeAt(0) + 127397));
    const flagSpan = document.createElement("span");
    flagSpan.textContent = flag;
    flagSpan.setAttribute("aria-hidden", "true");
    subtitle.append(flagSpan);
  }
  if (country) {
    const countrySpan = document.createElement("span");
    countrySpan.textContent = country;
    subtitle.append(countrySpan);
  }
  if (country && region) {
    const separator = document.createElement("span");
    separator.textContent = "›";
    separator.setAttribute("aria-hidden", "true");
    separator.className = "practice-region-separator";
    subtitle.append(separator);
  }
  if (region) {
    const regionSpan = document.createElement("span");
    regionSpan.textContent = region;
    subtitle.append(regionSpan);
  }
  subtitle.hidden = false;
}

function updateSeo(examInfo) {
  const title = `${examInfo.title} | Exam Practice`;
  const description = examInfo.description ||
    `${examInfo.title} practice questions on Exam Practice.`;

  const canonicalPath =
    lang === "fr"
      ? `/fr/${encodeURIComponent(exam)}`
      : lang === "zh-CN"
      ? `/zh/${encodeURIComponent(exam)}`
      : lang === "zh-TW"
        ? `/zh-tw/${encodeURIComponent(exam)}`
        : `/${encodeURIComponent(exam)}`;

  const canonicalUrl = new URL(canonicalPath, location.origin);

  const localeMap = {
    en: "en_CA",
    fr: "fr_CA",
    "zh-CN": "zh_CN",
    "zh-TW": "zh_TW"
  };

  document.title = title;
  const examHeading = document.querySelector("#practice-exam-title");
  if (examHeading && examInfo.title) {
    examHeading.textContent = examInfo.title;
    examHeading.hidden = false;
  }
  renderExamRegion(examInfo);
  document.documentElement.lang = lang;

  document.querySelector('meta[name="description"]')
    ?.setAttribute("content", description);

  document.querySelector("#canonical-url")
    ?.setAttribute("href", canonicalUrl.href);

  document.querySelector('meta[property="og:title"]')
    ?.setAttribute("content", title);

  document.querySelector('meta[property="og:description"]')
    ?.setAttribute("content", description);

  document.querySelector('meta[property="og:url"]')
    ?.setAttribute("content", canonicalUrl.href);

  document.querySelector('meta[property="og:locale"]')
    ?.setAttribute("content", localeMap[lang] || "en_CA");
}

setLanguageSelect(lang);
setHomeLinks();
document.documentElement.lang = lang;

document.querySelector("#choose-label").textContent = t.choose;
document.querySelector("#question").textContent = t.loading;
document.querySelector("#retry-text").textContent = t.retry;
document.querySelector("#back-link").textContent = `← ${t.allExams}`;

document.querySelector("#previous-text").textContent = t.previous;
document.querySelector("#next-text").textContent = t.next;


// Read exam slug from clean URL or legacy query parameters.
const params = new URLSearchParams(location.search);
const pathname = location.pathname.toLowerCase();

let exam = null;

// Clean URL path takes priority over legacy query parameters.
if (pathname.startsWith("/fr/")) {
  exam = pathname.slice("/fr/".length);
} else if (pathname.startsWith("/zh-tw/")) {
  exam = pathname.slice("/zh-tw/".length);
} else if (pathname.startsWith("/zh/")) {
  exam = pathname.slice("/zh/".length);
} else if (
  pathname !== "/practice.html" &&
  pathname !== "/practice" &&
  pathname !== "/" &&
  pathname !== "/zh" &&
  pathname !== "/zh-tw" &&
  pathname !== "/fr"
) {
  exam = pathname.replace(/^\/|\/$/g, "");
}

// Fall back to legacy query parameters.
exam = exam || params.get("exam") || "bc-class-7l";

const topic = params.get("topic");

let questions = [];
let setNumber = 1;
let usedQuestionIds = [];
let isLoadingSet = false;


const practiceStateKey = `practice-state:${exam}:${topic || "all"}`;

// Restore practice progress and answers across language changes.
function loadPracticeState() {
  try {
    const saved = JSON.parse(
      sessionStorage.getItem(practiceStateKey) || "{}"
    );

    return {
      index: Number.isInteger(saved.index) && saved.index >= 0
        ? saved.index
        : 0,
      answers: saved.answers && typeof saved.answers === "object"
        ? saved.answers
        : {},
      setNumber: Number.isInteger(saved.setNumber) && saved.setNumber > 0 ? saved.setNumber : 1,
      usedQuestionIds: Array.isArray(saved.usedQuestionIds) ? saved.usedQuestionIds.map(String) : [],
      questionIds: Array.isArray(saved.questionIds)
        ? saved.questionIds.map(String)
        : []
    };
  } catch {
    return { index: 0, answers: {}, questionIds: [] };
  }
}

const practiceState = loadPracticeState();
setNumber = practiceState.setNumber || 1;
usedQuestionIds = practiceState.usedQuestionIds || [];
let index = practiceState.index;

// Store each question's answer and feedback.
const answerResults = new Map(Object.entries(practiceState.answers));

function savePracticeState() {
  sessionStorage.setItem(
    practiceStateKey,
    JSON.stringify({
      index,
      setNumber,
      usedQuestionIds,
      answers: Object.fromEntries(answerResults),
      questionIds: questions.map(question => String(question.id))
    })
  );
}

function shuffleQuestions(items, ensureDifferent = false) {
  const shuffled = [...items];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  if (
    ensureDifferent &&
    shuffled.length > 1 &&
    shuffled.every((question, index) =>
      String(question.id) === String(items[index].id)
    )
  ) {
    [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
  }

  return shuffled;
}

function restoreQuestionOrder(items, savedIds) {
  if (!savedIds.length) {
    return shuffleQuestions(items);
  }

  const questionsById = new Map(
    items.map(question => [String(question.id), question])
  );
  const ordered = [];

  savedIds.forEach(id => {
    const question = questionsById.get(id);
    if (question) {
      ordered.push(question);
      questionsById.delete(id);
    }
  });

  // Retry/restore must not silently append newly published questions.
  return ordered;
}


let submitting = false;

// Question navigator state.
let navStart = 0;
const navContainer = document.querySelector("#question-navigator");
const rootOptions = document.querySelector("#options");

// Fetch only the current practice set. Topic practice retains its own selection rules.
async function loadSet({ newSet = false } = {}) {
  const apiParams = new URLSearchParams({ lang });
  if (topic) apiParams.set("topic", topic);
  if (!topic && !newSet && practiceState.questionIds.length) {
    apiParams.set("ids", practiceState.questionIds.join(","));
  }
  if (!topic && newSet && usedQuestionIds.length) {
    apiParams.set("exclude", usedQuestionIds.join(","));
  }
  const data = await api(`/api/exams/${encodeURIComponent(exam)}/questions?${apiParams}`);
  if (!topic) {
    if (Number.isFinite(Number(data.question_count))) perSetCount = Number(data.question_count);
  }
  return data.questions || [];
}

try {
  // Load exam policy before requesting questions. The server also enforces it.
  const examMetadata = await api(`/api/exams/${encodeURIComponent(exam)}?lang=${encodeURIComponent(lang)}`);
  const allowedLanguages = examMetadata.supported_languages || [];
  const languageSelect = document.querySelector('#language');
  if (languageSelect) {
    for (const option of [...languageSelect.options]) {
      if (!allowedLanguages.includes(option.value)) option.remove();
    }
  }
  questions = await loadSet();
  if (!questions.length) throw new Error(t.noQuestions);
  if (!topic && !practiceState.questionIds.length) {
    usedQuestionIds = [...new Set([...usedQuestionIds, ...questions.map(q => String(q.id))])];
  }
  index = Math.min(index, questions.length - 1);
  savePracticeState();

  // SEO is non-critical: never hold up the first question waiting for it.
  if (examMetadata.exam) updateSeo(examMetadata.exam);

  // Restore submitted answers using the current language.
  await Promise.allSettled(
    questions.map(async q => {
      const savedResult = answerResults.get(String(q.id));

      if (!savedResult?.submitted) return;

      const result = await api(
        `/api/questions/${q.id}/answer?lang=${encodeURIComponent(lang)}`,
        {
          method: "POST",
          body: JSON.stringify({
            option_id: Number(savedResult.selectedOptionId)
          })
        }
      );

      const correctOption = q.options.find(
        option => String(option.id) === String(result.correct_option_id)
      );

      answerResults.set(String(q.id), {
        selectedOptionId: Number(savedResult.selectedOptionId),
        correctOptionId: result.correct_option_id,
        submitted: true,
        correct: result.correct,
        correctOptionText: correctOption?.option_text || "",
        explanation: result.explanation || ""
      });
    })
  );

  render();

} catch (error) {
  document.querySelector("#question").textContent = error.message;
  document.querySelector("#answer-form").hidden = true;
  document.querySelector("#counter").textContent = "";
  navContainer.replaceChildren();
}

function renderQuestionImages(images = []) {
  const container = document.querySelector("#question-images");
  container.replaceChildren();

  const visibleImages = Array.isArray(images) ? images.slice(0, 8) : [];
  container.hidden = visibleImages.length === 0;

  visibleImages.forEach((image, imageIndex) => {
    const rawUrl = image.url || image.image_url;
    if (!rawUrl) return;

    let imageUrl;
    try {
      imageUrl = new URL(rawUrl, location.href);
      if (
        imageUrl.protocol !== "https:" &&
        imageUrl.origin !== location.origin
      ) return;
    } catch {
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "question-image-button";
    button.setAttribute("aria-label", `View question image ${imageIndex + 1}`);

    const img = document.createElement("img");
    img.src = imageUrl.href;
    img.alt = image.alt || image.alt_text || `Question image ${imageIndex + 1}`;
    img.loading = "lazy";

    button.append(img);
    button.addEventListener("click", () => {
      const dialog = document.querySelector("#image-preview");
      const preview = document.querySelector("#image-preview-img");
      preview.src = imageUrl.href;
      preview.alt = img.alt;
      dialog.showModal();
    });

    container.append(button);
  });

  container.hidden = container.children.length === 0;
}

function renderQuestionNavigator(followCurrent = true) {
  const completedCount = questions.filter(q => {
    const result = answerResults.get(String(q.id))
      || answerResults.get(q.id);
    return result?.submitted === true;
  }).length;

  document.querySelector("#counter").textContent =
    `${t.completed} ${completedCount}/${questions.length}`;
  const position = document.querySelector("#practice-question-position");
  if (position) position.textContent = practiceLabels.position(index + 1, questions.length);
  const fill = document.querySelector("#practice-progress-fill");
  if (fill) fill.style.width = `${questions.length ? completedCount / questions.length * 100 : 0}%`;
  const track = document.querySelector(".practice-progress-track");
  if (track) track.setAttribute("aria-valuenow", String(questions.length ? Math.round(completedCount / questions.length * 100) : 0));
  updatePerSet();

  navContainer.replaceChildren();

  if (!questions.length) return;

  const isMobile = window.matchMedia("(max-width: 600px)").matches;
  const availableWidth =
    navContainer.clientWidth || navContainer.parentElement.clientWidth || 360;

  const visibleCount = isMobile
    ? 11
    : Math.max(11, Math.floor((availableWidth - 76) / 33));

  const maxStart = Math.max(0, questions.length - visibleCount);

  // Keep the current question visible when navigating questions.
  if (followCurrent) {
    if (index < navStart) {
      navStart = index;
    } else if (index >= navStart + visibleCount) {
      navStart = index - visibleCount + 1;
    }
  }

  navStart = Math.min(navStart, maxStart);

  const previousButton = document.createElement("button");
  previousButton.type = "button";
  previousButton.className = "question-nav-arrow";
  previousButton.textContent = "‹";
  previousButton.setAttribute("aria-label", "Previous questions");
  previousButton.disabled = navStart === 0;
  previousButton.addEventListener("click", () => {
    navStart = Math.max(0, navStart - visibleCount);
    renderQuestionNavigator(false);
  });

  const windowElement = document.createElement("div");
  windowElement.className = "question-nav-window";

  const end = Math.min(questions.length, navStart + visibleCount);

  for (let i = navStart; i < end; i++) {
    const q = questions[i];
    const result = answerResults.get(String(q.id))
      || answerResults.get(q.id);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "question-nav-item";
    button.textContent = String(i + 1);

    if (result?.submitted) {
      button.classList.add(
        result.correct ? "is-correct" : "is-incorrect"
      );
    }

    if (i === index) {
      button.classList.add("is-current");
      button.setAttribute("aria-current", "step");
    }

    button.setAttribute("aria-label", `Question ${i + 1}`);
    button.addEventListener("click", () => {
      index = i;
      render();
    });

    windowElement.append(button);
  }

  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.className = "question-nav-arrow";
  nextButton.textContent = "›";
  nextButton.setAttribute("aria-label", "Next questions");
  nextButton.disabled = navStart >= maxStart;
  nextButton.addEventListener("click", () => {
    navStart = Math.min(maxStart, navStart + visibleCount);
    renderQuestionNavigator(false);
  });

  navContainer.append(previousButton, windowElement, nextButton);
}

function render() {
  if (index >= questions.length) {
    index = Math.max(0, questions.length - 1);
  }

  const q = questions[index];
  const savedResult = answerResults.get(String(q.id))
    || answerResults.get(q.id);
  const savedAnswer = savedResult?.selectedOptionId;

  renderQuestionNavigator();
  const another = document.querySelector("#another-set");
  const setActions = document.querySelector("#practice-set-actions");
  if (setActions) setActions.hidden = Boolean(topic) || !questions.length;
  if (another) {
    const complete = questions.length > 0 && questions.every(q =>
      (answerResults.get(String(q.id)) || answerResults.get(q.id))?.submitted);
    another.disabled = isLoadingSet || !complete;
  }
  const setLabel = document.querySelector("#set-label");
  if (setLabel) setLabel.textContent = topic ? "" :
    ({fr:`Série ${setNumber}`,en:`Set ${setNumber}`,"zh-CN":`第 ${setNumber} 组`,"zh-TW":`第 ${setNumber} 組`}[lang]);

  renderQuestionImages(q.images || []);

  document.querySelector("#question").textContent = q.question;

  rootOptions.querySelectorAll(".option").forEach(x => x.remove());

  q.options.forEach(option => {
    const label = document.createElement("label");
    label.className = "option";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "answer";
    input.value = option.id;

    input.disabled = false;

    if (savedAnswer === option.id) {
      input.checked = true;

      if (savedResult.submitted) {
        if (savedResult.correct) {
          label.classList.add("answer-correct");
        } else {
          label.classList.add("answer-incorrect");
        }
      }
    }


    const span = document.createElement("span");
    span.textContent = `${option.option_key}. ${option.option_text}`;

    label.append(input, span);
    rootOptions.append(label);
  });

  const feedback = document.querySelector("#feedback");
  feedback.hidden = !savedResult?.submitted;
  feedback.innerHTML = "";

  if (savedResult) {
    feedback.className =
      `feedback ${savedResult.correct ? "correct" : "incorrect"}`;

    const heading = document.createElement("strong");
    heading.textContent = savedResult.correct ? t.correct : t.incorrect;

    const explanation = document.createElement("p");
    explanation.textContent =
      `${t.correctAnswer}: ${savedResult.correctOptionText}. ${savedResult.explanation || ""}`;

    feedback.append(heading, explanation);
  }

  document.querySelector("#previous").disabled = index === 0;
  document.querySelector("#next").disabled = index >= questions.length - 1;

  savePracticeState();
  submitting = false;
}




rootOptions.addEventListener("change", async event => {
  const selected = event.target;

  if (
    !selected.matches('input[name="answer"]') ||
    submitting
  ) return;
  const q = questions[index];
  const previousResult = answerResults.get(String(q.id))
    || answerResults.get(q.id);
  submitting = true;

  answerResults.set(String(q.id), {
    selectedOptionId: Number(selected.value),
    submitted: false
  });

  savePracticeState();

  rootOptions.querySelectorAll("input").forEach(input => {
    input.disabled = true;
  });

  try {
    const result = await api(
      `/api/questions/${q.id}/answer?lang=${encodeURIComponent(lang)}`,
      {
        method: "POST",
        body: JSON.stringify({
          option_id: Number(selected.value)
        })
      }
    );

    const correctOption = q.options.find(
      option => option.id === result.correct_option_id
    );

    answerResults.set(String(q.id), {
      selectedOptionId: Number(selected.value),
      correctOptionId: result.correct_option_id,
      submitted: true,
      correct: result.correct,
      correctOptionText: correctOption?.option_text || "",
      explanation: result.explanation || ""
    });

    savePracticeState();

    render();

  } catch (error) {

    if (previousResult) {
      answerResults.set(String(q.id), previousResult);
    } else {
      answerResults.delete(String(q.id));
    }

    savePracticeState();
    render();

    alert(error.message);
  }
});


document.querySelector("#next").addEventListener("click", () => {
  if (index >= questions.length - 1) return;

  index++;
  render();
});

document.querySelector("#previous").addEventListener("click", () => {
  if (index > 0) {
    index--;
    render();
  }
});

// Close the enlarged image preview.
document.querySelector("#image-preview-close").addEventListener("click", () => {
  document.querySelector("#image-preview").close();
});

// Clicking the dark backdrop also closes the preview.
document.querySelector("#image-preview").addEventListener("click", event => {
  if (event.target === event.currentTarget) {
    event.currentTarget.close();
  }
});
// Retry the entire quiz.
document.querySelector("#retry").addEventListener("click", () => {
  const confirmed = confirm(t.confirmRetry);

  if (!confirmed) return;

  answerResults.clear();
  index = 0;
  navStart = 0;

  // Retry preserves the exact question IDs and their order.

  savePracticeState();
  render();
});
// A new set is available only after every question has been answered.
const anotherSetButton = document.querySelector("#another-set");
if (anotherSetButton) document.querySelector("#another-set-label").textContent = ({
  fr: "Essayer une autre série", en: "Try Another Set", "zh-CN": "再做一组新题", "zh-TW": "再做一組新題"
})[lang];
const setInfo = document.querySelector("#set-info");
const setHelp = document.querySelector("#set-info-text");
if (setHelp) setHelp.textContent = ({
  en: "Answer every question in this set to unlock the next set. Correct answers are not required. Each new set is randomly selected, so some questions may repeat.",
  fr: "Terminez toutes les questions de cette série pour débloquer la suivante, que vos réponses soient correctes ou non. Certaines questions peuvent se répéter.",
  "zh-CN": "完成当前组的全部题目后即可解锁下一组，无论答对或答错。每组随机抽题，因此可能有少量题目重复。",
  "zh-TW": "完成目前組的全部題目後即可解鎖下一組，無論答對或答錯。每組隨機抽題，因此可能有少量題目重複。"
})[lang];
if (setInfo) setInfo.setAttribute("aria-label", ({
  fr: "À propos des séries", en: "About practice sets", "zh-CN": "关于练习题组", "zh-TW": "關於練習題組"
})[lang]);
setInfo?.addEventListener("click", () => {
  if (!setHelp) return;
  setHelp.hidden = !setHelp.hidden;
  setInfo.setAttribute("aria-expanded", String(!setHelp.hidden));
});
anotherSetButton?.addEventListener("click", async () => {
  if (isLoadingSet || topic || !questions.length ||
      !questions.every(q => (answerResults.get(String(q.id)) || answerResults.get(q.id))?.submitted)) return;
  const message = ({en:"Start another random set? Some questions may repeat.",
    fr:"Commencer une nouvelle série de questions aléatoires? Certaines questions peuvent se répéter.",
    "zh-CN":"开始另一组随机题目？部分题目可能重复。",
    "zh-TW":"開始另一組隨機題目？部分題目可能重複。"})[lang];
  if (!confirm(message)) return;
  isLoadingSet = true;
  anotherSetButton.disabled = true;
  try {
    // Include the current set when prioritizing questions not previously seen.
    usedQuestionIds = [...new Set([...usedQuestionIds,...questions.map(q=>String(q.id))])];
    const next = await loadSet({newSet:true});
    if (!next.length) throw new Error(t.noQuestions);
    questions = next;
    setNumber++;
    index = 0;
    navStart = 0;
    answerResults.clear();
    usedQuestionIds = [...new Set([...usedQuestionIds,...next.map(q=>String(q.id))])];
    savePracticeState();
    render();
    window.scrollTo({top:0,behavior:"smooth"});
  } catch(error) {
    alert(error.message);
  } finally {
    isLoadingSet = false;
    render();
  }
});
