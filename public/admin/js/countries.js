
const tableBody = document.getElementById("countries-table-body");
const countryCount = document.getElementById("country-count");
const searchInput = document.getElementById("country-search");
const message = document.getElementById("countries-message");

const modal = document.getElementById("country-modal");
const form = document.getElementById("country-form");
const modalTitle = document.getElementById("country-modal-title");
const formError = document.getElementById("country-form-error");
const saveButton = document.getElementById("save-country-button");

let countries = [];
let editingCountryId = null;

async function loadCountries() {
  tableBody.innerHTML = `
    <tr><td colspan="6">Loading countries...</td></tr>
  `;

  try {
    const response = await fetch("/api/admin/countries");

    if (response.status === 401) {
      window.location.href = "/admin/";
      return;
    }

    if (!response.ok) {
      throw new Error("Unable to load countries.");
    }

    const data = await response.json();
    countries = data.countries || [];

    renderCountries();
  } catch (error) {
    tableBody.innerHTML = `
      <tr><td colspan="6">Failed to load countries.</td></tr>
    `;
    showMessage(error.message, true);
  }
}

function renderCountries() {
  const keyword = searchInput.value.trim().toLowerCase();

  const filtered = countries.filter(country => {
    const values = [
      country.code,
      ...Object.values(country.translations || {})
    ];

    return values.some(value =>
      String(value).toLowerCase().includes(keyword)
    );
  });

  countryCount.textContent =
    `${filtered.length} ${filtered.length === 1 ? "country" : "countries"}`;

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr><td colspan="6">No countries found.</td></tr>
    `;
    return;
  }

  tableBody.innerHTML = filtered.map(country => `
    <tr>
      <td>${country.id}</td>
      <td><strong>${escapeHTML(country.code)}</strong></td>
      <td>${escapeHTML(country.translations?.en || "")}</td>
      <td>${escapeHTML(country.translations?.["zh-CN"] || "")}</td>
      <td>${escapeHTML(country.translations?.["zh-TW"] || "")}</td>
    <td>
        <div class="country-actions">
    <button
      class="secondary-button edit-country-button"
      type="button"
      data-id="${country.id}"
    >
      Edit
    </button>

    <button
      class="delete-button delete-country-button"
      type="button"
      data-id="${country.id}"
    >
      Delete
    </button>
        </div>
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

function openModal(country = null) {
  editingCountryId = country ? country.id : null;

  form.reset();
  formError.textContent = "";

  if (country) {
    modalTitle.textContent = "Edit Country";
    saveButton.textContent = "Save Changes";

    document.getElementById("country-code").value = country.code || "";
    document.getElementById("country-name-en").value =
      country.translations?.en || "";
    document.getElementById("country-name-zh-cn").value =
      country.translations?.["zh-CN"] || "";
    document.getElementById("country-name-zh-tw").value =
      country.translations?.["zh-TW"] || "";
  } else {
    modalTitle.textContent = "Add Country";
    saveButton.textContent = "Save Country";
  }

  modal.hidden = false;
  document.getElementById("country-code").focus();
}

function closeModal() {
  modal.hidden = true;
  editingCountryId = null;
  form.reset();
  formError.textContent = "";
}

async function saveCountry(event) {
  event.preventDefault();

  formError.textContent = "";

  const formData = new FormData(form);

  const payload = {
    code: formData.get("code").trim().toUpperCase(),
    translations: {
      en: formData.get("en").trim(),
      "zh-CN": formData.get("zh-CN").trim(),
      "zh-TW": formData.get("zh-TW").trim()
    }
  };

  if (!/^[A-Z]{2,3}$/.test(payload.code)) {
    formError.textContent =
      "Country code must contain 2 or 3 uppercase letters.";
    return;
  }

  if (Object.values(payload.translations).some(value => !value)) {
    formError.textContent =
      "Please fill in all three language names.";
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = "Saving...";

  const isEditing = editingCountryId !== null;

  const endpoint = isEditing
    ? `/api/admin/countries/${editingCountryId}`
    : "/api/admin/countries";

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
      throw new Error(result.error || "Unable to save country.");
    }

    closeModal();

    showMessage(
      isEditing ? "Country updated successfully." :
        "Country created successfully."
    );

    await loadCountries();

  } catch (error) {
    formError.textContent = error.message;
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = isEditing
      ? "Save Changes"
      : "Save Country";
  }
}

document
  .getElementById("add-country-button")
  .addEventListener("click", () => openModal());

document
  .getElementById("close-country-modal")
  .addEventListener("click", closeModal);

document
  .getElementById("cancel-country-button")
  .addEventListener("click", closeModal);

document
  .getElementById("modal-backdrop")
  .addEventListener("click", closeModal);

document
  .getElementById("refresh-countries-button")
  .addEventListener("click", loadCountries);

document
  .getElementById("country-search")
  .addEventListener("input", renderCountries);

tableBody.addEventListener("click", event => {
  const button = event.target.closest(".edit-country-button");

  if (!button) return;

  const country = countries.find(
    item => item.id === Number(button.dataset.id)
  );

  if (country) {
    openModal(country);
  }
});

form.addEventListener("submit", saveCountry);
async function deleteCountry(countryId) {
  const country = countries.find(
    item => item.id === countryId
  );

  if (!country) return;

  const confirmed = window.confirm(
    `Are you sure you want to delete ${country.code} - ${country.translations?.en || country.name}?\n\nThis action cannot be undone.`
  );

  if (!confirmed) return;

  try {
    const response = await fetch(
      `/api/admin/countries/${countryId}`,
      {
        method: "DELETE"
      }
    );

    const result = await response.json();

    if (response.status === 401) {
      window.location.href = "/admin/";
      return;
    }

    if (!response.ok) {
      throw new Error(result.error || "Unable to delete country.");
    }

    showMessage("Country deleted successfully.");

    await loadCountries();

  } catch (error) {
    showMessage(error.message, true);
  }
}

tableBody.addEventListener("click", event => {
  const button = event.target.closest(".delete-country-button");

  if (!button) return;

  deleteCountry(Number(button.dataset.id));
});
loadCountries();
