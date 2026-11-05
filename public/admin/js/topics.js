
const API_URL = "/api/admin/topics";

const tableBody = document.getElementById("topics-table-body");
const message = document.getElementById("topics-message");
const searchInput = document.getElementById("topic-search");
const examFilter = document.getElementById("exam-filter");
const modal = document.getElementById("topic-modal");
const form = document.getElementById("topic-form");
const formMessage = document.getElementById("topic-form-message");

let topics = [];
let languages = [];
let exams = [];

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
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

async function loadTopics() {
  tableBody.innerHTML = `
    <tr><td colspan="8">Loading...</td></tr>
  `;

  showMessage("");

  try {
    const data = await apiRequest(API_URL);

    topics = data.topics || [];
    languages = data.languages || [];
    exams = data.exams || [];

    populateExamFilter();
    renderTopics();
  } catch (error) {
    tableBody.innerHTML = `
      <tr><td colspan="8">Unable to load topics.</td></tr>
    `;
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
        ${escapeHTML(exam.title)} (${escapeHTML(exam.slug)})
      </option>
    `).join("")}
  `;
}

function renderTopics() {
  const keyword = searchInput.value.trim().toLowerCase();
  const selectedExam = examFilter.value;

  const filtered = topics.filter(topic => {
    if (
      selectedExam &&
      String(topic.exam_id) !== selectedExam
    ) {
      return false;
    }

    const translationText = Object.values(topic.translations || {}).join(" ");

    const searchable = [
      topic.id,
      topic.slug,
      topic.exam_title,
      topic.exam_slug,
      translationText,
      topic.topic_type
    ].join(" ").toLowerCase();

    return searchable.includes(keyword);
  });

  document.getElementById("topic-count").textContent =
    `${filtered.length} topics`;

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr><td colspan="8">No topics found.</td></tr>
    `;
    return;
  }

  tableBody.innerHTML = filtered.map(topic => {
    const name = topic.translations?.en || topic.slug;

    const typeLabel = topic.topic_type === "mixed"
      ? "Mixed Practice"
      : "Standard";

    const selectionLabel = topic.topic_type === "mixed"
      ? topic.selection_mode === "random"
        ? `Random ${Number(topic.random_question_count)}`
        : "All questions"
      : "All";

    return `
      <tr>
        <td>${Number(topic.id)}</td>
        <td>
          <strong>${escapeHTML(name)}</strong><br>
          <code>${escapeHTML(topic.slug)}</code>
        </td>
        <td>
          ${escapeHTML(topic.exam_title || topic.exam_slug)}
          <br>
          <span class="muted-text">${escapeHTML(topic.exam_slug)}</span>
        </td>
        <td>${escapeHTML(typeLabel)}</td>
        <td>${escapeHTML(selectionLabel)}</td>
        <td>${Number(topic.question_count) || 0}</td>
        <td>${Number(topic.sort_order) || 0}</td>
        <td>
          <div class="table-actions">
            <button
              type="button"
              class="button button-small"
              data-action="edit"
              data-id="${Number(topic.id)}"
            >Edit</button>
            <button
              type="button"
              class="button button-small button-danger"
              data-action="delete"
              data-id="${Number(topic.id)}"
            >Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function populateSelect(
  select,
  items,
  valueField,
  labelFunction,
  selectedValue
) {
  select.innerHTML = items.map(item => `
    <option
      value="${escapeHTML(item[valueField])}"
      ${String(item[valueField]) === String(selectedValue) ? "selected" : ""}
    >
      ${escapeHTML(labelFunction(item))}
    </option>
  `).join("");
}

function renderTranslationFields(translations = {}) {
  const container = document.getElementById("topic-translations");

  container.innerHTML = languages.map(language => {
    const code = escapeHTML(language.code);
    const name = escapeHTML(language.native_name || language.name);
    const existing = translations[language.code] || "";

    return `
      <section class="exam-language-section">
        <h4>${name} <span class="muted-text">(${code})</span></h4>

        <label for="topic-translation-${code}">Topic Name</label>
        <input
          id="topic-translation-${code}"
          type="text"
          maxlength="150"
          value="${escapeHTML(existing)}"
          required
        >
      </section>
    `;
  }).join("");
}

function updateMixedSettings() {
  const isMixed =
    document.getElementById("topic-type").value === "mixed";

  const mixedSettings = document.getElementById("mixed-settings");
  mixedSettings.classList.toggle("hidden", !isMixed);

  updateRandomCountVisibility();
}

function updateRandomCountVisibility() {
  const isRandom =
    document.getElementById("topic-selection-mode").value === "random";

  document.getElementById("random-count-field")
    .classList.toggle("hidden", !isRandom);
}

function openModal(topic = null) {
  form.reset();
  showFormMessage("");

  document.getElementById("topic-id").value = topic?.id || "";

  populateSelect(
    document.getElementById("topic-exam"),
    exams,
    "id",
    exam => `${exam.title} (${exam.slug})`,
    topic?.exam_id || exams[0]?.id || ""
  );

  document.getElementById("topic-type").value =
    topic?.topic_type || "standard";

  document.getElementById("topic-slug").value =
    topic?.slug || "";

  document.getElementById("topic-sort-order").value =
    topic?.sort_order ?? (topics.length + 1);

  document.getElementById("topic-selection-mode").value =
    topic?.selection_mode || "all";

  document.getElementById("topic-random-count").value =
    topic?.random_question_count ?? 20;

  // Existing topic type is fixed after creation.
  document.getElementById("topic-type").disabled = Boolean(topic);

  renderTranslationFields(topic?.translations || {});
  updateMixedSettings();

  document.getElementById("topic-modal-title").textContent =
    topic ? "Edit Topic" : "Add Topic";

  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
  form.reset();
  document.getElementById("topic-type").disabled = false;
  showFormMessage("");
}

async function saveTopic(event) {
  event.preventDefault();

  const id = document.getElementById("topic-id").value;
  const topicType = document.getElementById("topic-type").value;
  const selectionMode =
    document.getElementById("topic-selection-mode").value;

  const translations = {};

  for (const language of languages) {
    translations[language.code] = document
      .getElementById(`topic-translation-${language.code}`)
      .value.trim();
  }

  const payload = {
    exam_id: Number(document.getElementById("topic-exam").value),
    topic_type: topicType,
    slug: document.getElementById("topic-slug").value.trim(),
    sort_order: Number(document.getElementById("topic-sort-order").value),
    selection_mode: topicType === "mixed" ? selectionMode : "all",
    random_question_count:
      topicType === "mixed" && selectionMode === "random"
        ? Number(document.getElementById("topic-random-count").value)
        : null,
    translations
  };

  const saveButton = document.getElementById("save-topic-button");

  saveButton.disabled = true;
  saveButton.textContent = "Saving...";

  try {
    await apiRequest(id ? `${API_URL}/${id}` : API_URL, {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });

    closeModal();
    await loadTopics();
    showMessage("Topic saved successfully.", "success");
  } catch (error) {
    showFormMessage(error.message, "error");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Save Topic";
  }
}

async function deleteTopic(id) {
  const topic = topics.find(item => item.id === Number(id));

  if (!topic) return;

  const name = topic.translations?.en || topic.slug;

  if (!confirm(
    `Delete topic "${name}"?\n\nTopics with assigned questions cannot be deleted.`
  )) {
    return;
  }

  try {
    await apiRequest(`${API_URL}/${id}`, {
      method: "DELETE"
    });

    await loadTopics();
    showMessage("Topic deleted successfully.", "success");
  } catch (error) {
    showMessage(error.message, "error");
  }
}

// Event listeners

document.getElementById("add-topic-button")
  .addEventListener("click", () => {
    if (exams.length === 0) {
      showMessage("Please create an exam first.", "error");
      return;
    }

    openModal();
  });

document.getElementById("close-topic-modal")
  .addEventListener("click", closeModal);

document.getElementById("cancel-topic-button")
  .addEventListener("click", closeModal);

modal.addEventListener("click", event => {
  if (event.target.id === "topic-modal") {
    closeModal();
  }
});

document.getElementById("refresh-topics-button")
  .addEventListener("click", loadTopics);

document.getElementById("topic-type")
  .addEventListener("change", updateMixedSettings);

document.getElementById("topic-selection-mode")
  .addEventListener("change", updateRandomCountVisibility);

examFilter.addEventListener("change", renderTopics);
searchInput.addEventListener("input", renderTopics);
form.addEventListener("submit", saveTopic);

tableBody.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");

  if (!button) return;

  const { action, id } = button.dataset;

  if (action === "edit") {
    const topic = topics.find(item => item.id === Number(id));

    if (topic) openModal(topic);
  }

  if (action === "delete") {
    deleteTopic(id);
  }
});

// Initial load
loadTopics();
