
const API_URL = "/api/admin/exams";

const tableBody = document.getElementById("exams-table-body");
const message = document.getElementById("exams-message");
const searchInput = document.getElementById("exam-search");
const modal = document.getElementById("exam-modal");
const form = document.getElementById("exam-form");
const formMessage = document.getElementById("exam-form-message");

let exams = [];
let languages = [];
let countries = [];
let regions = [];
let categories = [];

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

async function loadExams() {
  tableBody.innerHTML = `
    <tr><td colspan="10">Loading...</td></tr>
  `;
  showMessage("");

  try {
    const data = await apiRequest(API_URL);

    exams = data.exams || [];
    languages = data.languages || [];
    countries = data.countries || [];
    regions = data.regions || [];
    categories = data.categories || [];

    renderExams();
  } catch (error) {
    tableBody.innerHTML = `
      <tr><td colspan="10">Unable to load exams.</td></tr>
    `;
    showMessage(error.message, "error");
  }
}

function renderExams() {
  const keyword = searchInput.value.trim().toLowerCase();

  const filtered = exams.filter((exam) => {
    const translationText = Object.values(exam.translations || {})
      .map((item) => `${item.title || ""} ${item.description || ""}`)
      .join(" ");

    const searchable = [
      exam.id,
      exam.slug,
      exam.region_name,
      exam.country_name,
      exam.category_name,
      translationText
    ].join(" ").toLowerCase();

    return searchable.includes(keyword);
  });

  document.getElementById("exam-count").textContent =
    `${filtered.length} exams`;

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr><td colspan="10">No exams found.</td></tr>
    `;
    return;
  }

  tableBody.innerHTML = filtered.map((exam) => {
    const title = exam.translations?.en?.title || exam.slug;
    const statusLabel = {
      draft: "Draft",
      published: "Published",
      archived: "Archived"
    }[exam.status] || exam.status;

    return `
      <tr>
        <td>${exam.id}</td>
        <td>
          <strong>${escapeHTML(title)}</strong><br>
          <code>${escapeHTML(exam.slug)}</code>
        </td>
        <td>
          ${escapeHTML(exam.country_name || "")}<br>
          <span class="muted-text">${escapeHTML(exam.region_name || "—")}</span>
        </td>
        <td>${escapeHTML(exam.category_name || "—")}</td>
        <td>${escapeHTML(statusLabel)}</td>
        <td>${Number(exam.question_count) || 0}</td>
        <td>${Number(exam.bank_question_count) || 0}</td>
        <td>${exam.time_limit_minutes ? `${exam.time_limit_minutes} min` : "—"}</td>
        <td>${Number(exam.passing_score_percent) || 0}%</td>
        <td>
          <div class="table-actions">
            <button
              type="button"
              class="button button-small"
              data-action="edit"
              data-id="${exam.id}"
            >Edit</button>
            <button
              type="button"
              class="button button-small button-danger"
              data-action="delete"
              data-id="${exam.id}"
            >Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function populateSelect(select, items, valueField, labelFunction, selectedValue) {
  select.innerHTML = items.map((item) => `
    <option value="${escapeHTML(item[valueField])}"
      ${String(item[valueField]) === String(selectedValue) ? "selected" : ""}>
      ${escapeHTML(labelFunction(item))}
    </option>
  `).join("");
}

function updateRegionOptions(selectedRegionId = "") {
  const countryId = Number(document.getElementById("exam-country").value);

  const filteredRegions = regions.filter(
    (region) => Number(region.country_id) === countryId
  );

  populateSelect(
    document.getElementById("exam-region"),
    filteredRegions,
    "id",
    (region) => `${region.name} (${region.code})`,
    selectedRegionId
  );
}

function renderTranslationFields(translations = {}) {
  const container = document.getElementById("exam-translations");

  container.innerHTML = languages.map((language) => {
    const existing = translations[language.code] || {};
    const code = escapeHTML(language.code);
    const name = escapeHTML(language.native_name || language.name);

    return `
      <section class="exam-language-section">
        <h4>${name} <span class="muted-text">(${code})</span></h4>

        <label for="translation-title-${code}">Exam Title</label>
        <input
          id="translation-title-${code}"
          type="text"
          maxlength="200"
          value="${escapeHTML(existing.title || "")}"
          required
        >

        <label for="translation-description-${code}">Description</label>
        <textarea
          id="translation-description-${code}"
          rows="3"
          maxlength="2000"
        >${escapeHTML(existing.description || "")}</textarea>
      </section>
    `;
  }).join("");
}

function openModal(exam = null) {
  form.reset();
  showFormMessage("");

  document.getElementById("exam-id").value = exam?.id || "";
  document.getElementById("exam-slug").value = exam?.slug || "";
  document.getElementById("exam-status").value = exam?.status || "draft";
  document.getElementById("exam-question-count").value =
    exam?.question_count ?? 50;
  document.getElementById("exam-time-limit").value =
    exam?.time_limit_minutes ?? "";
  document.getElementById("exam-passing-score").value =
    exam?.passing_score_percent ?? 80;

  const countryId = exam?.country_id || countries[0]?.id || "";
  populateSelect(
    document.getElementById("exam-country"),
    countries,
    "id",
    (country) => `${country.name} (${country.code})`,
    countryId
  );

  updateRegionOptions(exam?.region_id || "");

  populateSelect(
    document.getElementById("exam-category"),
    categories,
    "id",
    (category) => category.name,
    exam?.category_id || categories[0]?.id || ""
  );

  populateSelect(
    document.getElementById("exam-default-language"),
    languages,
    "code",
    (language) => language.native_name || language.name,
    exam?.default_language || languages[0]?.code || ""
  );

  renderTranslationFields(exam?.translations || {});

  document.getElementById("exam-modal-title").textContent =
    exam ? "Edit Exam" : "Add Exam";

  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
  form.reset();
  showFormMessage("");
}

async function saveExam(event) {
  event.preventDefault();

  const id = document.getElementById("exam-id").value;
  const translations = {};

  for (const language of languages) {
    const code = language.code;

    translations[code] = {
      title: document.getElementById(`translation-title-${code}`).value.trim(),
      description: document.getElementById(`translation-description-${code}`).value.trim()
    };
  }

  const timeValue = document.getElementById("exam-time-limit").value;

  const payload = {
    region_id: Number(document.getElementById("exam-region").value),
    category_id: Number(document.getElementById("exam-category").value),
    slug: document.getElementById("exam-slug").value.trim(),
    status: document.getElementById("exam-status").value,
    default_language: document.getElementById("exam-default-language").value,
    question_count: Number(document.getElementById("exam-question-count").value),
    time_limit_minutes: timeValue === "" ? null : Number(timeValue),
    passing_score_percent: Number(document.getElementById("exam-passing-score").value),
    translations
  };

  const saveButton = document.getElementById("save-exam-button");
  saveButton.disabled = true;
  saveButton.textContent = "Saving...";

  try {
    await apiRequest(id ? `${API_URL}/${id}` : API_URL, {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });

    closeModal();
    await loadExams();
    showMessage("Exam saved successfully.", "success");
  } catch (error) {
    showFormMessage(error.message, "error");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Save Exam";
  }
}

async function deleteExam(id) {
  const exam = exams.find((item) => item.id === Number(id));
  if (!exam) return;

  const title = exam.translations?.en?.title || exam.slug;

  if (!confirm(
    `Delete exam "${title}"?\n\nExams with topics, questions or attempt records cannot be deleted.`
  )) {
    return;
  }

  try {
    await apiRequest(`${API_URL}/${id}`, {
      method: "DELETE"
    });

    await loadExams();
    showMessage("Exam deleted successfully.", "success");
  } catch (error) {
    showMessage(error.message, "error");
  }
}

// Event listeners

document.getElementById("add-exam-button")
  .addEventListener("click", () => openModal());

document.getElementById("close-exam-modal")
  .addEventListener("click", closeModal);

document.getElementById("cancel-exam-button")
  .addEventListener("click", closeModal);

document.getElementById("exam-modal")
  .addEventListener("click", (event) => {
    if (event.target.id === "exam-modal") closeModal();
  });

document.getElementById("refresh-exams-button")
  .addEventListener("click", loadExams);

document.getElementById("exam-country")
  .addEventListener("change", () => updateRegionOptions());

searchInput.addEventListener("input", renderExams);
form.addEventListener("submit", saveExam);

tableBody.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;

  if (action === "edit") {
    const exam = exams.find((item) => item.id === Number(id));
    if (exam) openModal(exam);
  }

  if (action === "delete") {
    deleteExam(id);
  }
});

// Initial load
loadExams();