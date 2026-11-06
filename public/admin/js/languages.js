
const tableBody = document.getElementById("languages-table-body");
const languageCount = document.getElementById("language-count");
const searchInput = document.getElementById("language-search");
const message = document.getElementById("languages-message");

const modal = document.getElementById("language-modal");
const form = document.getElementById("language-form");
const modalTitle = document.getElementById("language-modal-title");
const formError = document.getElementById("language-form-error");
const saveButton = document.getElementById("save-language-button");

let languages = [];
let editingLanguageCode = null;

async function loadLanguages() {
  tableBody.innerHTML = `
    <tr><td colspan="6">Loading languages...</td></tr>
  `;

  try {
    const response = await fetch("/api/admin/languages");

    if (response.status === 401) {
      window.location.href = "/admin/";
      return;
    }

    if (!response.ok) {
      throw new Error("Unable to load languages.");
    }

    const data = await response.json();
    languages = data.languages || [];

    renderLanguages();

  } catch (error) {
    tableBody.innerHTML = `
      <tr><td colspan="6">Failed to load languages.</td></tr>
    `;
    showMessage(error.message, true);
  }
}

function renderLanguages() {
  const keyword = searchInput.value.trim().toLowerCase();

  const filtered = languages.filter(language => {
    return [
      language.code,
      language.name,
      language.native_name
    ].some(value =>
      String(value || "").toLowerCase().includes(keyword)
    );
  });

  languageCount.textContent =
    `${filtered.length} ${filtered.length === 1 ? "language" : "languages"}`;

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr><td colspan="6">No languages found.</td></tr>
    `;
    return;
  }

  tableBody.innerHTML = filtered.map(language => `
    <tr>
      <td><strong>${escapeHTML(language.code)}</strong></td>
      <td>${escapeHTML(language.name)}</td>
      <td>${escapeHTML(language.native_name)}</td>
      <td>
        ${Number(language.is_enabled) === 1
          ? '<span class="status-enabled">Enabled</span>'
          : '<span class="status-disabled">Disabled</span>'}
      </td>
      <td>${Number(language.sort_order)}</td>
      <td>
        <button
          class="secondary-button edit-language-button"
          type="button"
          data-code="${escapeHTML(language.code)}"
        >Edit</button>
      </td>
    </tr>
  `).join("");
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function showMessage(text, isError = false) {
  message.textContent = text;
  message.className = isError
    ? "form-message error"
    : "form-message success";
}

function openModal(language = null) {
  editingLanguageCode = language ? language.code : null;

  form.reset();
  formError.textContent = "";

  const codeInput = document.getElementById("language-code");

  if (language) {
    modalTitle.textContent = "Edit Language";
    saveButton.textContent = "Save Changes";

    codeInput.value = language.code || "";
    codeInput.readOnly = true;

    document.getElementById("language-name").value =
      language.name || "";

    document.getElementById("language-native-name").value =
      language.native_name || "";

    document.getElementById("language-sort-order").value =
      language.sort_order ?? 0;

    document.getElementById("language-enabled").checked =
      Number(language.is_enabled) === 1;

  } else {
    modalTitle.textContent = "Add Language";
    saveButton.textContent = "Save Language";

    codeInput.readOnly = false;
    document.getElementById("language-sort-order").value = 0;
    document.getElementById("language-enabled").checked = true;
  }

  modal.hidden = false;
  codeInput.focus();
}

function closeModal() {
  modal.hidden = true;
  editingLanguageCode = null;
  form.reset();
  formError.textContent = "";
}

async function saveLanguage(event) {
  event.preventDefault();
  formError.textContent = "";

  const formData = new FormData(form);

  const payload = {
    code: String(formData.get("code") || "").trim(),
    name: String(formData.get("name") || "").trim(),
    native_name: String(formData.get("native_name") || "").trim(),
    sort_order: Number(formData.get("sort_order")),
    is_enabled: document.getElementById("language-enabled").checked ? 1 : 0
  };

  if (!/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(payload.code)) {
    formError.textContent =
      "Invalid language code. Example: en, fr or zh-CN.";
    return;
  }

  if (!payload.name || payload.name.length > 100) {
    formError.textContent = "Please enter a valid language name.";
    return;
  }

  if (!payload.native_name || payload.native_name.length > 100) {
    formError.textContent = "Please enter a valid native name.";
    return;
  }

  if (
    !Number.isInteger(payload.sort_order) ||
    payload.sort_order < 0 ||
    payload.sort_order > 10000
  ) {
    formError.textContent =
      "Sort order must be an integer between 0 and 10000.";
    return;
  }

  const isEditing = editingLanguageCode !== null;

  const endpoint = isEditing
    ? `/api/admin/languages/${encodeURIComponent(editingLanguageCode)}`
    : "/api/admin/languages";

  saveButton.disabled = true;
  saveButton.textContent = "Saving...";

  try {
    const response = await fetch(endpoint, {
      method: isEditing ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (response.status === 401) {
      window.location.href = "/admin/";
      return;
    }

    if (!response.ok) {
      throw new Error(result.error || "Unable to save language.");
    }

    closeModal();

    showMessage(
      isEditing
        ? "Language updated successfully."
        : "Language created successfully."
    );

    await loadLanguages();

  } catch (error) {
    formError.textContent = error.message;

  } finally {
    saveButton.disabled = false;
    saveButton.textContent = isEditing
      ? "Save Changes"
      : "Save Language";
  }
}

document
  .getElementById("add-language-button")
  .addEventListener("click", () => openModal());

document
  .getElementById("close-language-modal")
  .addEventListener("click", closeModal);

document
  .getElementById("cancel-language-button")
  .addEventListener("click", closeModal);

document
  .getElementById("language-modal-backdrop")
  .addEventListener("click", closeModal);

document
  .getElementById("refresh-languages-button")
  .addEventListener("click", loadLanguages);

searchInput.addEventListener("input", renderLanguages);

tableBody.addEventListener("click", event => {
  const button = event.target.closest(".edit-language-button");

  if (!button) return;

  const language = languages.find(
    item => item.code === button.dataset.code
  );

  if (language) {
    openModal(language);
  }
});

form.addEventListener("submit", saveLanguage);

loadLanguages();
