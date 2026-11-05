
const API_URL = "/api/admin/categories";

const tableBody = document.getElementById("categories-table-body");
const message = document.getElementById("categories-message");
const searchInput = document.getElementById("category-search");

const modal = document.getElementById("category-modal");
const form = document.getElementById("category-form");
const formMessage = document.getElementById("category-form-message");

let categories = [];
let languages = [];

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
  formMessage.className = `form-message ${type}`;
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

async function loadCategories() {
  tableBody.innerHTML = `
    <tr><td colspan="7">Loading...</td></tr>
  `;

  showMessage("");

  try {
    const data = await apiRequest(API_URL);

    categories = data.categories || [];
    languages = data.languages || [];

    renderCategories();
  } catch (error) {
    tableBody.innerHTML = `
      <tr><td colspan="7">Unable to load categories.</td></tr>
    `;
    showMessage(error.message, "error");
  }
}

function renderCategories() {
  const keyword = searchInput.value.trim().toLowerCase();

  const filtered = categories.filter((category) => {
    const searchable = [
      category.id,
      category.slug,
      category.name,
      category.translations?.en,
      category.translations?.["zh-CN"],
      category.translations?.["zh-TW"]
    ].join(" ").toLowerCase();

    return searchable.includes(keyword);
  });
document.getElementById("category-count").textContent =
  `${filtered.length} categories`;

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr><td colspan="7">No categories found.</td></tr>
    `;
    return;
  }

  tableBody.innerHTML = filtered.map((category) => `
    <tr>
      <td>${category.id}</td>
      <td><code>${escapeHTML(category.slug)}</code></td>
      <td>${escapeHTML(category.translations?.en || category.name)}</td>
      <td>${escapeHTML(category.translations?.["zh-CN"] || "")}</td>
      <td>${escapeHTML(category.translations?.["zh-TW"] || "")}</td>
      <td>${Number(category.exam_count) || 0}</td>
      <td>
        <div class="table-actions">
          <button
            type="button"
            class="button button-small"
            data-action="edit"
            data-id="${category.id}"
          >Edit</button>
          <button
            type="button"
            class="button button-small button-danger"
            data-action="delete"
            data-id="${category.id}"
            ${Number(category.exam_count) > 0 ? "disabled" : ""}
          >Delete</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function openModal(category = null) {
  form.reset();
  showFormMessage("");

  document.getElementById("category-id").value = category?.id || "";
  document.getElementById("category-slug").value = category?.slug || "";
  document.getElementById("category-name-en").value =
    category?.translations?.en || category?.name || "";
  document.getElementById("category-name-zh-cn").value =
    category?.translations?.["zh-CN"] || "";
  document.getElementById("category-name-zh-tw").value =
    category?.translations?.["zh-TW"] || "";

  document.getElementById("category-modal-title").textContent =
    category ? "Edit Category" : "Add Category";

  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
  form.reset();
  showFormMessage("");
}

async function saveCategory(event) {
  event.preventDefault();

  const id = document.getElementById("category-id").value;

  const payload = {
    slug: document.getElementById("category-slug").value.trim(),
    translations: {
      en: document.getElementById("category-name-en").value.trim(),
      "zh-CN": document.getElementById("category-name-zh-cn").value.trim(),
      "zh-TW": document.getElementById("category-name-zh-tw").value.trim()
    }
  };

  const saveButton = document.getElementById("save-category-button");
  saveButton.disabled = true;
  saveButton.textContent = "Saving...";

  try {
    await apiRequest(id ? `${API_URL}/${id}` : API_URL, {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });

    closeModal();
    await loadCategories();
    showMessage("Category saved successfully.", "success");
  } catch (error) {
    showFormMessage(error.message, "error");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Save Category";
  }
}

async function deleteCategory(id) {
  const category = categories.find((item) => item.id === Number(id));

  if (!category) return;

  if (Number(category.exam_count) > 0) {
    showMessage(
      "This category is in use by one or more exams and cannot be deleted.",
      "error"
    );
    return;
  }

  const name = category.translations?.en || category.name;

  if (!confirm(`Delete category "${name}"? This cannot be undone.`)) {
    return;
  }

  try {
    await apiRequest(`${API_URL}/${id}`, {
      method: "DELETE"
    });

    await loadCategories();
    showMessage("Category deleted successfully.", "success");
  } catch (error) {
    showMessage(error.message, "error");
  }
}

// Event listeners

document.getElementById("add-category-button")
  .addEventListener("click", () => openModal());

document.getElementById("close-category-modal")
  .addEventListener("click", closeModal);

document.getElementById("cancel-category-button")
  .addEventListener("click", closeModal);

document.getElementById("category-modal")
  .addEventListener("click", (event) => {
    if (event.target.id === "category-modal") {
      closeModal();
    }
  });

document.getElementById("refresh-categories-button")
  .addEventListener("click", loadCategories);

searchInput.addEventListener("input", renderCategories);

form.addEventListener("submit", saveCategory);

tableBody.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");

  if (!button) return;

  const { action, id } = button.dataset;

  if (action === "edit") {
    const category = categories.find(
      (item) => item.id === Number(id)
    );

    if (category) openModal(category);
  }

  if (action === "delete") {
    deleteCategory(id);
  }
});

// Initial load
loadCategories();
