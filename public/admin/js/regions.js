
const API_URL = "/api/admin/regions";

let allRegions = [];
let allCountries = [];

const tableBody = document.getElementById("regions-table-body");
const message = document.getElementById("regions-message");
const countElement = document.getElementById("region-count");
const searchInput = document.getElementById("region-search");
const countryFilter = document.getElementById("region-country-filter");
const refreshButton = document.getElementById("refresh-regions-button");
const addButton = document.getElementById("add-region-button");

// Modal elements
const modal = document.getElementById("region-modal");
const modalTitle = document.getElementById("region-modal-title");
const closeModalButton = document.getElementById("close-region-modal");
const cancelButton = document.getElementById("cancel-region-button");
const form = document.getElementById("region-form");
const formMessage = document.getElementById("region-form-message");
const saveButton = document.getElementById("save-region-button");

const regionIdInput = document.getElementById("region-id");
const regionCountryInput = document.getElementById("region-country");
const regionCodeInput = document.getElementById("region-code");
const regionNameEnInput = document.getElementById("region-name-en");
const regionNameZhCnInput = document.getElementById("region-name-zh-cn");
const regionNameZhTwInput = document.getElementById("region-name-zh-tw");

// Escape HTML to prevent HTML injection
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function showMessage(text, type = "info") {
  message.textContent = text;
  message.className = `form-message ${type}`;
}

function showFormMessage(text, type = "info") {
  formMessage.textContent = text;
  formMessage.className = `admin-message ${type}`;
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.headers || {})
    }
  });

  if (response.status === 401) {
    window.location.href = "/admin/";
    throw new Error("Your session has expired. Please sign in again.");
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

// Load regions and countries
async function loadRegions() {
  showMessage("Loading regions...");

  try {
    const data = await apiRequest(API_URL);

    allRegions = data.regions || [];
    allCountries = data.countries || [];

    renderCountryFilter();
    renderRegionCountryOptions();
    renderRegions();

    showMessage("");
  } catch (error) {
    console.error(error);
    showMessage(error.message || "Unable to load regions.", "error");
  }
}

// Country filter above the table
function renderCountryFilter() {
  const previousValue = countryFilter.value;

  countryFilter.innerHTML = `
    <option value="">All countries</option>
    ${allCountries.map(country => `
      <option value="${country.id}">
        ${escapeHTML(country.name)} (${escapeHTML(country.code)})
      </option>
    `).join("")}
  `;

  if (allCountries.some(country => String(country.id) === previousValue)) {
    countryFilter.value = previousValue;
  }
}

// Country dropdown inside Add/Edit form
function renderRegionCountryOptions() {
  const previousValue = regionCountryInput.value;

  regionCountryInput.innerHTML = allCountries.map(country => `
    <option value="${country.id}">
      ${escapeHTML(country.name)} (${escapeHTML(country.code)})
    </option>
  `).join("");

  if (allCountries.some(country => String(country.id) === previousValue)) {
    regionCountryInput.value = previousValue;
  }
}

// Render region table
function renderRegions() {
  const keyword = searchInput.value.trim().toLowerCase();
  const selectedCountry = countryFilter.value;

  const filtered = allRegions.filter(region => {
    const matchesCountry =
      !selectedCountry || String(region.country_id) === selectedCountry;

    const searchableText = [
      region.country_name,
      region.country_code,
      region.code,
      region.name,
      region.translations?.en,
      region.translations?.["zh-CN"],
      region.translations?.["zh-TW"]
    ].join(" ").toLowerCase();

    return matchesCountry && searchableText.includes(keyword);
  });

  countElement.textContent = `${filtered.length} regions`;

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          No regions found.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = filtered.map(region => `
    <tr>
      <td>${region.id}</td>
      <td>
        ${escapeHTML(region.country_name)}
        <span class="muted-text">(${escapeHTML(region.country_code)})</span>
      </td>
      <td>${escapeHTML(region.code)}</td>
      <td>${escapeHTML(region.translations?.en || "")}</td>
      <td>${escapeHTML(region.translations?.["zh-CN"] || "")}</td>
      <td>${escapeHTML(region.translations?.["zh-TW"] || "")}</td>
      <td class="country-actions">
<div class="country-actions">
  <button
    type="button"
    class="secondary-button"
    data-action="edit"
    data-id="${region.id}"
  >
    Edit
  </button>

  <button
    type="button"
    class="delete-button"
    data-action="delete"
    data-id="${region.id}"
  >
    Delete
  </button>
</div>
      </td>
    </tr>
  `).join("");
}

// Open Add Region modal
function openAddModal() {
  form.reset();
  regionIdInput.value = "";
  modalTitle.textContent = "Add Region";
  saveButton.textContent = "Save Region";

  renderRegionCountryOptions();

  if (allCountries.length > 0) {
    regionCountryInput.value = String(allCountries[0].id);
  }

  showFormMessage("");
  modal.classList.remove("hidden");
}

// Open Edit Region modal
function openEditModal(region) {
  form.reset();

  regionIdInput.value = region.id;
  regionCountryInput.value = String(region.country_id);
  regionCodeInput.value = region.code || "";
  regionNameEnInput.value = region.translations?.en || "";
  regionNameZhCnInput.value = region.translations?.["zh-CN"] || "";
  regionNameZhTwInput.value = region.translations?.["zh-TW"] || "";

  modalTitle.textContent = "Edit Region";
  saveButton.textContent = "Update Region";

  showFormMessage("");
  modal.classList.remove("hidden");
}

// Close modal
function closeModal() {
  modal.classList.add("hidden");
  form.reset();
  regionIdInput.value = "";
  showFormMessage("");
}

// Save region
async function saveRegion(event) {
  event.preventDefault();

  const id = regionIdInput.value;

  const payload = {
    country_id: Number(regionCountryInput.value),
    code: regionCodeInput.value.trim().toUpperCase(),
    translations: {
      en: regionNameEnInput.value.trim(),
      "zh-CN": regionNameZhCnInput.value.trim(),
      "zh-TW": regionNameZhTwInput.value.trim()
    }
  };

  if (
    !payload.country_id ||
    !payload.code ||
    !payload.translations.en ||
    !payload.translations["zh-CN"] ||
    !payload.translations["zh-TW"]
  ) {
    showFormMessage("Please complete all required fields.", "error");
    return;
  }

  const isEditing = Boolean(id);
  const url = isEditing ? `${API_URL}/${id}` : API_URL;
  const method = isEditing ? "PUT" : "POST";

  saveButton.disabled = true;
  saveButton.textContent = isEditing ? "Updating..." : "Saving...";
  showFormMessage("Saving region...");

  try {
    await apiRequest(url, {
      method,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    closeModal();
    await loadRegions();

    showMessage(
      isEditing ? "Region updated successfully." : "Region created successfully.",
      "success"
    );
  } catch (error) {
    console.error(error);
    showFormMessage(error.message || "Unable to save region.", "error");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = isEditing ? "Update Region" : "Save Region";
  }
}


async function deleteRegion(id) {
  const region = allRegions.find(item => item.id === id);

  if (!region) return;

  const confirmed = window.confirm(
    `Are you sure you want to delete ${region.translations?.en || region.code}?\n\nThis action cannot be undone.`
  );

  if (!confirmed) return;

  try {
    await apiRequest(`${API_URL}/${id}`, {
      method: "DELETE"
    });

    await loadRegions();

    showMessage("Region deleted successfully.", "success");
  } catch (error) {
    console.error(error);
    showMessage(error.message || "Unable to delete region.", "error");
  }
}

// Event listeners
searchInput.addEventListener("input", renderRegions);
countryFilter.addEventListener("change", renderRegions);
refreshButton.addEventListener("click", loadRegions);

addButton.addEventListener("click", openAddModal);

closeModalButton.addEventListener("click", closeModal);
cancelButton.addEventListener("click", closeModal);

modal.addEventListener("click", event => {
  if (event.target === modal) {
    closeModal();
  }
});

form.addEventListener("submit", saveRegion);

// Handle Edit button clicks

// Handle Edit and Delete button clicks
tableBody.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");

  if (!button) return;

  const id = Number(button.dataset.id);
  const action = button.dataset.action;

  if (action === "edit") {
    const region = allRegions.find(item => item.id === id);

    if (region) {
      openEditModal(region);
    }
  }

  if (action === "delete") {
    deleteRegion(id);
  }
});


// Initial load
loadRegions();
