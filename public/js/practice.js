import { api, copy, getLanguage, setLanguageSelect } from "./common.js";

const lang = getLanguage();
const t = copy[lang];

setLanguageSelect(lang);
document.documentElement.lang = lang;

document.querySelector("#choose-label").textContent = t.choose;
document.querySelector("#check-button").textContent = t.check;
document.querySelector("#previous").textContent = t.previous;
document.querySelector("#next").textContent = t.next;
document.querySelector("#disclaimer").textContent = t.disclaimer;

// Read URL parameters
const params = new URLSearchParams(location.search);
const exam = params.get("exam") || "bc-class-7l";
const topic = params.get("topic");

let questions = [];
let index = 0;
let answered = new Set();

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

  if (!questions.length) {
    throw new Error(t.noQuestions);
  }

  render();

} catch (error) {
  document.querySelector("#question").textContent = error.message;
  document.querySelector("#answer-form").hidden = true;
  document.querySelector("#counter").textContent = "";
  document.querySelector("#topic").textContent = "";
  document.querySelector("#progress-fill").style.width = "0%";
}

function render() {
  const q = questions[index];

  document.querySelector("#counter").textContent =
    `${t.question} ${index + 1} / ${questions.length}`;

  document.querySelector("#topic").textContent = q.topic;

  document.querySelector("#progress-fill").style.width =
    `${((index + 1) / questions.length) * 100}%`;

  document.querySelector("#question").textContent = q.question;

  rootOptions.querySelectorAll(".option").forEach(x => x.remove());

  q.options.forEach(option => {
    const label = document.createElement("label");
    label.className = "option";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "answer";
    input.value = option.id;
    input.disabled = answered.has(q.id);

    const span = document.createElement("span");
    span.textContent = `${option.option_key}. ${option.option_text}`;

    label.append(input, span);
    rootOptions.append(label);
  });

  const feedback = document.querySelector("#feedback");
  feedback.hidden = true;
  feedback.innerHTML = "";

  document.querySelector("#next").disabled = !answered.has(q.id);
  document.querySelector("#previous").disabled = index === 0;
  document.querySelector("#check-button").disabled = answered.has(q.id);

  if (answered.has(q.id)) {
    feedback.hidden = false;
  }
}

document.querySelector("#answer-form").addEventListener("submit", async event => {
  event.preventDefault();

  const q = questions[index];

  const selected = rootOptions.querySelector(
    'input[name="answer"]:checked'
  );

  if (!selected) return;

  const button = document.querySelector("#check-button");
  button.disabled = true;

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

    answered.add(q.id);

    rootOptions.querySelectorAll("input").forEach(input => {
      input.disabled = true;
    });

    const correctOption = q.options.find(
      option => option.id === result.correct_option_id
    );

    const feedback = document.querySelector("#feedback");

    feedback.className =
      `feedback ${result.correct ? "correct" : "incorrect"}`;

    feedback.innerHTML = "";

    const heading = document.createElement("strong");
    heading.textContent = result.correct ? t.correct : t.incorrect;

    const explanation = document.createElement("p");
    explanation.textContent =
      `${t.correctAnswer}: ${correctOption?.option_text || ""}. ${result.explanation || ""}`;

    feedback.append(heading, explanation);
    feedback.hidden = false;

    document.querySelector("#next").disabled = false;

  } catch (error) {
    button.disabled = false;
    alert(error.message);
  }
});

document.querySelector("#next").addEventListener("click", () => {
  if (index < questions.length - 1) {
    index++;
    render();
  } else {
    location.href = "/";
  }
});

document.querySelector("#previous").addEventListener("click", () => {
  if (index > 0) {
    index--;
    render();
  }
});