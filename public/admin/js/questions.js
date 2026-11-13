const API_URL = "/api/admin/questions";

const tableBody = document.getElementById("questions-table-body");
const message = document.getElementById("questions-message");
const searchInput = document.getElementById("question-search");
const examFilter = document.getElementById("exam-filter");
const statusFilter = document.getElementById("status-filter");
const modal = document.getElementById("question-modal");
const form = document.getElementById("question-form");
const formMessage = document.getElementById("question-form-message");

let questions = [];
let languages = [];
let exams = [];
let topics = [];

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function showMessage(text, type = "") {
  message.textContent = text;
  message.className = `form-message ${type}`;
}

function showFormMessage(text, type = "") {
  formMessage.textContent = text;
  formMessage.className = `admin-message ${type}`;
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (response.status === 401) {
    window.location.href = "/admin/login/";
    throw new Error("Please log in again.");
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || data.message || "Request failed.");
  }

  return data;
}

async function loadQuestions() {
  tableBody.innerHTML = '<tr><td colspan="8">Loading...</td></tr>';
  showMessage("");

  try {
    const data = await apiRequest(API_URL);

    questions = data.questions || [];
    languages = data.languages || [];
    exams = data.exams || [];
    topics = data.topics || [];

    populateExamFilter();
    renderQuestions();
  } catch (error) {
    tableBody.innerHTML =
      '<tr><td colspan="8">Unable to load questions.</td></tr>';
    showMessage(error.message, "error");
  }
}

function populateExamFilter() {
  const selected = examFilter.value;

  examFilter.innerHTML = `
    <option value="">All exams</option>
    ${exams.map(exam => `
      <option value="${escapeHTML(exam.id)}"
        ${String(exam.id) === selected ? "selected" : ""}>
        ${escapeHTML(exam.title || exam.slug)}
      </option>
    `).join("")}
  `;
}

function renderQuestions() {
  const keyword = searchInput.value.trim().toLowerCase();
  const selectedExam = examFilter.value;
  const selectedStatus = statusFilter.value;

  const filtered = questions.filter(question => {
    if (selectedExam &&
      String(question.exam_id) !== selectedExam) return false;

    if (selectedStatus && question.status !== selectedStatus) return false;

    const translationText = Object.values(question.translations || {})
      .map(item => `${item.question_text || ""} ${item.explanation || ""}`)
      .join(" ");

    const searchable = [
      question.id,
      question.exam_title,
      question.exam_slug,
      question.topic_name,
      question.topic_slug,
      translationText
    ].join(" ").toLowerCase();

    return searchable.includes(keyword);
  });

  document.getElementById("question-count").textContent =
    `${filtered.length} questions`;

  if (!filtered.length) {
    tableBody.innerHTML =
      '<tr><td colspan="8">No questions found.</td></tr>';
    return;
  }

  tableBody.innerHTML = filtered.map(question => {
    const english = question.translations?.en?.question_text;
    const firstTranslation = Object.values(question.translations || {})[0];
    const questionText = english || firstTranslation?.question_text || "(No text)";

    return `
      <tr>
        <td>${Number(question.id)}</td>
        <td>
          <strong>${escapeHTML(questionText)}</strong>
        </td>
        <td>${escapeHTML(question.exam_title || question.exam_slug)}</td>
        <td>${escapeHTML(question.topic_name || question.topic_slug || "-")}</td>
        <td>${escapeHTML(question.difficulty)}</td>
        <td>${Number(question.image_count) || 0}</td>
        <td>${escapeHTML(question.status)}</td>
        <td>
          <div class="table-actions">
            <button type="button" class="button button-small"
              data-action="edit" data-id="${Number(question.id)}">
              Edit
            </button>
            <button type="button"
              class="button button-small button-danger"
              data-action="delete" data-id="${Number(question.id)}">
              Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function populateSelect(select, items, valueField, labelFunction, selectedValue) {
  select.innerHTML = items.map(item => `
    <option value="${escapeHTML(item[valueField])}"
      ${String(item[valueField]) === String(selectedValue) ? "selected" : ""}>
      ${escapeHTML(labelFunction(item))}
    </option>
  `).join("");
}

function populateQuestionTopics(selectedTopicId = "") {
  const examId = document.getElementById("question-exam").value;
  const select = document.getElementById("question-topic");

  const filtered = topics.filter(topic =>
    String(topic.exam_id) === String(examId)
  );

  select.innerHTML = `
    <option value="">No topic</option>
    ${filtered.map(topic => `
      <option value="${escapeHTML(topic.id)}"
        ${String(topic.id) === String(selectedTopicId) ? "selected" : ""}>
        ${escapeHTML(topic.slug)}
      </option>
    `).join("")}
  `;
}


function renderQuestionTranslations(translations = {}) {
  const container = document.getElementById("question-translations");

  container.innerHTML = languages.map(language => {
    const code = escapeHTML(language.code);
    const name = escapeHTML(language.native_name || language.name);
    const existing = translations[language.code] || {};
    const isEnglish = language.code === "en";
    const questionSource = existing.question_text_source || "manual";

    return `
      <details class="exam-language-section"
        ${isEnglish ? "open" : ""}>
        <summary>
          ${name} <span class="muted-text">(${code})</span>
        </summary>

        <label for="question-text-${code}">
          Question
          <span class="muted-text">
            (${isEnglish ? "Required" : "Optional"})
          </span>
          <span class="muted-text">· ${escapeHTML(questionSource)}</span>
        </label>

        <textarea id="question-text-${code}" rows="3"
          ${isEnglish ? "required" : ""}>${escapeHTML(existing.question_text || "")}</textarea>
      </details>
    `;
  }).join("");
}


function renderOptions(options = []) {
  const container = document.getElementById("question-options");

  container.innerHTML = options.map((option, index) =>
    createOptionHTML(option, index)
  ).join("");

  updateOptionControls();
}


function createOptionHTML(option = {}, index = 0) {
  const key = option.option_key || String.fromCharCode(65 + index);

  const english = languages.find(language => language.code === "en");
  const otherLanguages = languages.filter(language => language.code !== "en");

  const renderLanguageInput = (language, required = false) => {
    const code = escapeHTML(language.code);
    const name = escapeHTML(language.native_name || language.name);
    const translation = option.translations?.[language.code] || {};
    const value = translation.option_text || "";
    const source = translation.translation_source || "manual";

    return `
      <label>
        Option text - ${name} (${code})
        <span class="muted-text">
          ${required ? "Required" : "Optional"}
        </span>
        <span class="muted-text">· ${escapeHTML(source)}</span>
      </label>
      <input type="text" class="option-translation"
        data-language="${code}"
        value="${escapeHTML(value)}"
        ${required ? "required" : ""}>
    `;
  };

  return `
    <section class="exam-language-section question-option"
      data-option-index="${index}">
      <div class="table-heading">
        <h4>Option ${escapeHTML(key)}</h4>
        <button type="button"
          class="button button-small button-danger"
          data-action="remove-option">Remove</button>
      </div>

      <input type="hidden" class="option-key" value="${escapeHTML(key)}">

      <label>
        <input type="radio" name="correct-option"
          class="option-correct"
          ${option.is_correct ? "checked" : ""}>
        Correct answer
      </label>

      ${english ? renderLanguageInput(english, true) : ""}

      ${otherLanguages.length ? `
        <details class="option-other-languages">
          <summary>Other languages (${otherLanguages.length})</summary>
          ${otherLanguages.map(language =>
            renderLanguageInput(language)
          ).join("")}
        </details>
      ` : ""}
    </section>
  `;
}


function updateOptionControls() {
  const container = document.getElementById("question-options");
  const sections = [...container.querySelectorAll(".question-option")];

  sections.forEach((section, index) => {
    const key = String.fromCharCode(65 + index);
    section.querySelector(".option-key").value = key;
    section.querySelector("h4").textContent = `Option ${key}`;
    section.dataset.optionIndex = index;
    section.querySelector('[data-action="remove-option"]').disabled =
      sections.length <= 2;
  });

  document.getElementById("add-option-button").disabled =
    sections.length >= 8;
}

function addOption() {
  const container = document.getElementById("question-options");
  const sections = container.querySelectorAll(".question-option");

  if (sections.length >= 8) return;

  const index = sections.length;
  container.insertAdjacentHTML("beforeend", createOptionHTML({}, index));
  updateOptionControls();
}


function renderImages(images = []) {
  const container = document.getElementById("question-images");

  container.innerHTML = images.map(image => createImageHTML(image)).join("");
}

function createImageHTML(image = {}) {
  const url = image.url || "";

  return `
    <section class="exam-language-section question-image">
      <input type="hidden" class="image-url"
        value="${escapeHTML(url)}">

      ${url ? `
        <img
          src="${escapeHTML(url)}"
          alt="${escapeHTML(image.alt || "")}"
          class="question-image-preview"
          style="display:block;max-width:240px;max-height:180px;object-fit:contain;margin:10px 0;"
        >
      ` : ""}

      <label>Alt text</label>
      <input type="text" class="image-alt"
        placeholder="Describe the image"
        value="${escapeHTML(image.alt || "")}">

      <button type="button"
        class="button button-small button-danger"
        data-action="remove-image">Remove Image</button>
    </section>
  `;
}

async function uploadQuestionImage(file) {
  const message = document.getElementById("image-upload-message");
  const formData = new FormData();

  formData.append("file", file);

  message.textContent = "Uploading image to Cloudflare R2...";
  message.className = "admin-message";

  const response = await fetch("/api/admin/images", {
    method: "POST",
    credentials: "same-origin",
    body: formData
  });

  if (response.status === 401) {
    window.location.href = "/admin/login/";
    throw new Error("Please log in again.");
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Image upload failed.");
  }

  message.textContent = "Image uploaded successfully.";
  message.className = "admin-message success";

  return data;
}

function addImage(image) {
  const container = document.getElementById("question-images");

  if (container.querySelectorAll(".question-image").length >= 8) {
    showFormMessage("A question can have at most 8 images.", "error");
    return;
  }

  container.insertAdjacentHTML("beforeend", createImageHTML(image));
}

function openModal(question = null) {
  form.reset();
  showFormMessage("");

  document.getElementById("question-id").value = question?.id || "";

  populateSelect(
    document.getElementById("question-exam"),
    exams,
    "id",
    exam => `${exam.title || exam.slug} (${exam.slug})`,
    question?.exam_id || exams[0]?.id || ""
  );

  populateQuestionTopics(question?.topic_id || "");

// Difficulty 固定为 normal，Status 固定为 published。
// Explanation Source URL 不再由后台表单录入。

  renderQuestionTranslations(question?.translations || {});
  renderOptions(question?.options || [
    { option_key: "A", translations: {} },
    { option_key: "B", translations: {} }
  ]);
  renderImages(question?.images || []);

  document.getElementById("question-modal-title").textContent =
    question ? `Edit Question #${question.id}` : "Add Question";

  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
  form.reset();
  showFormMessage("");
}

async function saveQuestion(event) {
  event.preventDefault();

  const id = document.getElementById("question-id").value;

const translations = {};
for (const language of languages) {
  translations[language.code] = {
    question_text: document
      .getElementById(`question-text-${language.code}`).value.trim()
  };
}

  const optionSections = [
    ...document.querySelectorAll("#question-options .question-option")
  ];

  const options = optionSections.map((section, index) => {
    const optionTranslations = {};

    section.querySelectorAll(".option-translation").forEach(input => {
      optionTranslations[input.dataset.language] = input.value.trim();
    });

    return {
      option_key: String.fromCharCode(65 + index),
      is_correct: section.querySelector(".option-correct").checked,
      translations: optionTranslations
    };
  });

  const images = [
    ...document.querySelectorAll("#question-images .question-image")
  ].map(section => ({
    url: section.querySelector(".image-url").value.trim(),
    alt: section.querySelector(".image-alt").value.trim()
  })).filter(image => image.url);

const payload = {
  exam_id: Number(document.getElementById("question-exam").value),
  topic_id: document.getElementById("question-topic").value,
  difficulty: "normal",
  status: "published",
  explanation_source_url: "",
  translations,
  options,
  images
};

  const saveButton = document.getElementById("save-question-button");
  saveButton.disabled = true;
  saveButton.textContent = "Saving...";

  try {
    await apiRequest(id ? `${API_URL}/${id}` : API_URL, {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });

    closeModal();
    await loadQuestions();
    showMessage("Question saved successfully.", "success");
  } catch (error) {
    showFormMessage(error.message, "error");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Save Question";
  }
}

async function deleteQuestion(id) {
  const question = questions.find(item => item.id === Number(id));
  if (!question) return;

  const title = question.translations?.en?.question_text || `Question #${id}`;

  if (!confirm(`Delete this question?\n\n${title}`)) return;

  try {
    await apiRequest(`${API_URL}/${id}`, { method: "DELETE" });
    await loadQuestions();
    showMessage("Question deleted successfully.", "success");
  } catch (error) {
    showMessage(error.message, "error");
  }
}

// Event listeners

document.getElementById("add-question-button")
  .addEventListener("click", () => {
    if (!exams.length) {
      showMessage("Please create an exam first.", "error");
      return;
    }
    openModal();
  });

document.getElementById("close-question-modal")
  .addEventListener("click", closeModal);

document.getElementById("cancel-question-button")
  .addEventListener("click", closeModal);

modal.addEventListener("click", event => {
  if (event.target.id === "question-modal") closeModal();
});

document.getElementById("refresh-questions-button")
  .addEventListener("click", loadQuestions);

document.getElementById("question-exam")
  .addEventListener("change", () => populateQuestionTopics());

document.getElementById("add-option-button")
  .addEventListener("click", addOption);

const imageFileInput = document.getElementById("question-image-file");

document.getElementById("add-image-button")
  .addEventListener("click", () => {
    const count = document.querySelectorAll(
      "#question-images .question-image"
    ).length;

    if (count >= 8) {
      showFormMessage("A question can have at most 8 images.", "error");
      return;
    }

    imageFileInput.click();
  });

imageFileInput.addEventListener("change", async () => {
  const file = imageFileInput.files[0];

  if (!file) return;

  try {
    const data = await uploadQuestionImage(file);

    addImage({
      url: data.url,
      alt: ""
    });
  } catch (error) {
    const message = document.getElementById("image-upload-message");
    message.textContent = error.message;
    message.className = "admin-message error";
  } finally {
    imageFileInput.value = "";
  }
});

document.getElementById("question-options")
  .addEventListener("click", event => {
    const button = event.target.closest('[data-action="remove-option"]');
    if (!button) return;

    const container = document.getElementById("question-options");
    if (container.querySelectorAll(".question-option").length <= 2) return;

    button.closest(".question-option").remove();
    updateOptionControls();
  });

document.getElementById("question-images")
  .addEventListener("click", event => {
    const button = event.target.closest('[data-action="remove-image"]');
    if (button) button.closest(".question-image").remove();
  });

examFilter.addEventListener("change", renderQuestions);
statusFilter.addEventListener("change", renderQuestions);
searchInput.addEventListener("input", renderQuestions);
form.addEventListener("submit", saveQuestion);

tableBody.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;

  if (action === "edit") {
    const question = questions.find(item => item.id === Number(id));
    if (question) openModal(question);
  }

  if (action === "delete") deleteQuestion(id);
});

// Initial load
loadQuestions();
