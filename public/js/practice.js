import { api, copy, getLanguage, setLanguageSelect } from "./common.js";

const lang = getLanguage();
const t = copy[lang];
function updateSeo(examInfo) {
  const title = `${examInfo.title} | Exam Practice`;
  const description = examInfo.description ||
    `${examInfo.title} practice questions on Exam Practice.`;

  const canonicalUrl = new URL(
  "/practice.html",
  "https://north-america-exam-practice.libbywu2023.workers.dev"
);
  canonicalUrl.searchParams.set("exam", exam);

  const localeMap = {
    en: "en_CA",
    "zh-CN": "zh_CN",
    "zh-TW": "zh_TW"
  };

  document.title = title;
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
document.documentElement.lang = lang;

document.querySelector("#choose-label").textContent = t.choose;
document.querySelector("#question").textContent = t.loading;
document.querySelector("#retry").textContent = t.retry;
document.querySelector("#back-link").textContent = `← ${t.allExams}`;

document.querySelector("#previous").textContent = t.previous;
document.querySelector("#next").textContent = t.next;

// Read URL parameters
const params = new URLSearchParams(location.search);
const exam = params.get("exam") || "bc-class-7l";
const topic = params.get("topic");

let questions = [];


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
        : {}
    };
  } catch {
    return { index: 0, answers: {} };
  }
}

const practiceState = loadPracticeState();
let index = practiceState.index;

// Store each question's answer and feedback.
const answerResults = new Map(Object.entries(practiceState.answers));

function savePracticeState() {
  sessionStorage.setItem(
    practiceStateKey,
    JSON.stringify({
      index,
      answers: Object.fromEntries(answerResults)
    })
  );
}

let submitting = false;

// Question navigator state.
let navStart = 0;
const navContainer = document.querySelector("#question-navigator");
const rootOptions = document.querySelector("#options");

// Build API URL
const apiParams = new URLSearchParams({ lang });

if (topic) {
  apiParams.set("topic", topic);
}

try {
  const data = await api(
    `/api/exams/${encodeURIComponent(exam)}/questions?${apiParams.toString()}`
  );

  questions = data.questions || [];
  // Load exam information for SEO.
try {
  const examData = await api(
    `/api/exams/${encodeURIComponent(exam)}?lang=${encodeURIComponent(lang)}`
  );

  if (examData.exam) {
    updateSeo(examData.exam);
  }
} catch (seoError) {
  console.warn("Failed to load exam SEO information:", seoError);
}

 if (!questions.length) {
  throw new Error(t.noQuestions);
}

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

sessionStorage.removeItem(practiceStateKey);

render();
});