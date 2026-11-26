(() => {
  "use strict";

  const API_URL = "/api/admin/review";
  const TOPICS_URL = "/api/admin/topics";

  const $ = (id) => document.getElementById(id);

  const state = {
    questions: [],
    topics: [],
    current: null,
    activeLanguage: "en",
    languages: [],
    saving: false,
    selectedIds: new Set(),
    listRequestId: 0, page: 1, size: 50, total: 0
  };

  const languageNames = {
    en: "English",
    "zh-CN": "简体中文",
    "zh-TW": "繁體中文"
  };

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });

    if (response.status === 401) {
      window.location.href = "/admin/login/";
      throw new Error("Please sign in again.");
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Request failed (${response.status}).`);
    }

    return data;
  }

  function showMessage(element, message, type = "") {
    element.textContent = message || "";
    element.className = `review-message ${type}`.trim();
  }

  function statusLabel(status) {
    return ({
      pending_review: "Pending Review",
      waiting_for_image: "Waiting for Image",
      approved: "Approved",
      rejected: "Rejected",
      published: "Published"
    })[status] || status || "Unknown";
  }

  function getQuestionText(question) {
    return question.question_en ||
      question.translations?.en?.questionText ||
      question.external_question_id ||
      "(No English question)";
  }

  function getImageCount(question) {
    return Number(question.image_count ?? question.imageCount ?? 0);
  }

  function getOptionCount(question) {
    return Number(question.option_count ?? question.optionCount ?? 0);
  }

  function renderList() {
    const filtered = state.questions;
    $("review-question-count").textContent = `${state.total} questions`;
    $("review-page-label").textContent = `Page ${state.page} / ${Math.max(1, Math.ceil(state.total / state.size))}`;
    $("review-prev").disabled = state.page <= 1;
    $("review-next").disabled = state.page * state.size >= state.total;

    if (!filtered.length) {
      $("review-table-body").innerHTML = `
        <tr><td colspan="8" class="review-empty">
          No questions found for the selected filters.
        </td></tr>`;
      $("review-select-all").checked = false;
      $("review-select-all").indeterminate = false;
      updateSelectionUI();
      return;
    }

    $("review-table-body").innerHTML = filtered.map(question => `
      <tr>
        <td>
          <input type="checkbox"
            class="review-question-checkbox"
            data-select-review-id="${Number(question.id)}"
            aria-label="Select question ${Number(question.id)}"
            ${state.selectedIds.has(Number(question.id)) ? "checked" : ""}>
        </td>
        <td class="review-id">
          ${escapeHTML(question.external_question_id || `#${question.id}`)}
        </td>
        <td class="review-question-cell">
          ${escapeHTML(getQuestionText(question))}
        </td>
        <td>${escapeHTML(question.exam_title || question.exam_slug || "")}</td>
        <td>${getOptionCount(question)}</td>
        <td>
          ${getImageCount(question)} / ${question.has_image ? "Required" : "Optional"}
        </td>
        <td>
          <span class="review-status ${escapeHTML(question.status)}">
            ${escapeHTML(statusLabel(question.status))}
          </span>
        </td>
        <td class="review-action">
          <button type="button" class="secondary-button"
            data-review-id="${Number(question.id)}">
            Review
          </button>
        </td>
      </tr>
    `).join("");
    updateSelectionUI();
  }

  function updateSelectionUI() {
    const visibleCheckboxes = Array.from(
      document.querySelectorAll(".review-question-checkbox")
    );
    const selectedVisible = visibleCheckboxes.filter(
      checkbox => checkbox.checked
    ).length;
    const selectAll = $("review-select-all");

    selectAll.checked = visibleCheckboxes.length > 0 &&
      selectedVisible === visibleCheckboxes.length;
    selectAll.indeterminate = selectedVisible > 0 &&
      selectedVisible < visibleCheckboxes.length;

    $("review-selected-count").textContent =
      `Selected: ${state.selectedIds.size}`;
    $("bulk-approve-button").disabled = state.selectedIds.size === 0;
    $("bulk-reject-button").disabled = state.selectedIds.size === 0;
    $("bulk-publish-button").disabled = state.selectedIds.size === 0;
    $("bulk-publish-button").disabled = state.selectedIds.size === 0;
  }

  function listParams() {
    const params = new URLSearchParams({page: state.page, size: state.size});
    for (const key of ["exam", "status", "image", "translation", "batch"]) {
      const value = $(`review-${key}-filter`).value;
      if (value) params.set(key, value);
    }
    return params;
  }

  async function loadList(preserveSelection = false) {
    const requestId = ++state.listRequestId;
    const selectedExam = $("review-exam-filter").value;
    const selectedBatch = $("review-batch-filter").value;
    const params = listParams();
    state.questions = [];
    if (preserveSelection !== true) state.selectedIds.clear();
    updateSelectionUI();
    showMessage($("review-list-message"), "");
    $("review-table-body").innerHTML = `
      <tr><td colspan="8" class="review-empty">Loading questions...</td></tr>`;

    try {
      const data = await apiRequest(`${API_URL}?${params}`);
      if (requestId !== state.listRequestId) return;
      state.questions = data.questions || [];
      state.total = data.total;
      state.page = data.page;
      $("review-batch-filter").innerHTML = '<option value="">All batches</option>' + (data.batches || []).map(b => `<option value="${Number(b.id)}">#${Number(b.id)} ${escapeHTML(b.source_filename)}</option>`).join("");
      $("review-batch-filter").value = selectedBatch;
      if (!$("review-batch-filter").value) $("review-batch-filter").value = "";

      const exams = data.exams || [];

      $("review-exam-filter").innerHTML = `
        <option value="">All exams</option>
        ${exams.map(exam => `
          <option value="${escapeHTML(exam.slug)}">
            ${escapeHTML(exam.title || exam.slug)}
          </option>
        `).join("")}
      `;
      $("review-exam-filter").value = selectedExam;

      renderList();
    } catch (error) {
      if (requestId !== state.listRequestId) return;
      $("review-table-body").innerHTML = `
        <tr><td colspan="8" class="review-empty">
          Unable to load questions.
        </td></tr>`;
      showMessage($("review-list-message"), error.message, "error");
    }
  }

  async function loadTopics() {
    const data = await apiRequest(TOPICS_URL);
    state.topics = data.topics || [];
  }

  function renderTopicSelect() {
    const select = $("review-topic");
    const current = state.current;
    const examId = Number(current.exam_id);

    const topics = state.topics.filter(topic =>
      Number(topic.exam_id) === examId &&
      topic.topic_type !== "mixed"
    );

    select.innerHTML = `
      <option value="">No topic</option>
      ${topics.map(topic => {
        const name = topic.translations?.en ||
          topic.translations?.[state.activeLanguage] ||
          topic.slug;
        return `<option value="${Number(topic.id)}">
          ${escapeHTML(name)} (${escapeHTML(topic.slug)})
        </option>`;
      }).join("")}
    `;

    select.value = current.topic_id ? String(current.topic_id) : "";
  }

  function renderLanguageTabs() {
    $("review-language-tabs").innerHTML = state.languages.map(language => `
      <button type="button"
        class="review-language-tab ${language === state.activeLanguage ? "active" : ""}"
        data-language="${escapeHTML(language)}">
        ${escapeHTML(languageNames[language] || language)}
      </button>
    `).join("");
  }

  function ensureTranslation(language) {
    const current = state.current;

    if (!current.translations[language]) {
      current.translations[language] = {
        questionText: "",
        explanation: "",
        translationSource: "manual"
      };
    }

    for (const option of current.options) {
      if (!option.translations[language]) {
        option.translations[language] = {
          text: "",
          translationSource: "manual"
        };
      }
    }
  }

  function renderQuestionTranslation() {
    const language = state.activeLanguage;
    ensureTranslation(language);

    const translation = state.current.translations[language];

    $("review-question-translation").innerHTML = `
      <div class="review-form-field">
        <label for="review-question-text">
          Question (${escapeHTML(languageNames[language] || language)})
        </label>
        <textarea id="review-question-text">${escapeHTML(translation.questionText)}</textarea>
        <small>Translation source: ${escapeHTML(translation.translationSource || "unknown")}</small>
      </div>
      <div class="review-form-field">
        <label for="review-explanation">Explanation</label>
        <textarea id="review-explanation">${escapeHTML(translation.explanation || "")}</textarea>
      </div>
    `;

    $("review-question-text").addEventListener("input", event => {
      translation.questionText = event.target.value;
    });

    $("review-explanation").addEventListener("input", event => {
      translation.explanation = event.target.value;
    });
  }

  function renderOptions() {
    const language = state.activeLanguage;

    state.current.options.forEach(option => ensureTranslation(language));

    $("review-options").innerHTML = state.current.options.map((option, index) => `
      <div class="review-option" data-option-index="${index}">
        <div class="review-option-key">${escapeHTML(option.optionKey)}</div>
        <div class="review-form-field">
          <label for="review-option-text-${index}">
            Option ${escapeHTML(option.optionKey)}
          </label>
          <textarea id="review-option-text-${index}">${escapeHTML(
            option.translations[language]?.text || ""
          )}</textarea>
          <small>Translation source:
            ${escapeHTML(option.translations[language]?.translationSource || "unknown")}
          </small>
          <div class="review-form-field" style="margin-top:10px;margin-bottom:0">
            <label for="review-option-order-${index}">Display order</label>
            <input id="review-option-order-${index}" type="number" min="1"
              step="1" value="${Number(option.sortOrder) || index + 1}">
          </div>
        </div>
        <div class="review-option-correct">
          <label>
            <input type="radio" name="review-correct-option"
              value="${index}" ${option.isCorrect ? "checked" : ""}>
            Correct
          </label>
          <button type="button" class="secondary-button"
            data-remove-option="${index}" style="margin-top:12px">
            Remove
          </button>
        </div>
      </div>
    `).join("");

    state.current.options.forEach((option, index) => {
      $(`review-option-text-${index}`).addEventListener("input", event => {
        option.translations[language].text = event.target.value;
      });

      $(`review-option-order-${index}`).addEventListener("input", event => {
        option.sortOrder = Number(event.target.value);
      });
    });
  }

  function renderImages() {
    const current = state.current;
    const images = current.images || [];
    const readOnly = current.status === "published";

    $("review-image-status").textContent = current.hasImage
      ? (images.length
          ? `${images.length}/8 image(s) attached.`
          : "An image is required, but none is attached. This question cannot be approved yet.")
      : (images.length ? `${images.length}/8 image(s) attached.` : "No image required.");

    $("review-image-upload").disabled = readOnly || images.length >= 8;
    $("review-image-file").disabled = readOnly || images.length >= 8;
    $("review-image-file").value = "";

    $("review-images").innerHTML = images.length
      ? images.map(image => `
          <div class="review-image-item">
            <a href="${escapeHTML(image.url)}" target="_blank" rel="noopener">
              <img src="${escapeHTML(image.url)}"
                alt="${escapeHTML(image.alt_text || image.original_filename || "Question image")}">
            </a>
            <p>${escapeHTML(image.original_filename || image.r2_key)}</p>
            <p>Order: ${Number(image.sort_order)}</p>
            ${readOnly ? "" : `<button type="button" class="secondary-button review-image-delete" data-image-key="${escapeHTML(image.r2_key)}">Delete</button>`}
          </div>
        `).join("")
      : `<p class="muted-text">No images attached.</p>`;
  }

  async function refreshCurrentQuestion() {
    if (!state.current) return;
    const data = await apiRequest(`${API_URL}/${state.current.id}`);
    state.current = data.question;
    state.languages = data.question.enabledLanguages || state.languages;
    renderDetail();
    await loadList();
  }

  async function uploadQuestionImages() {
    const current = state.current;
    const input = $("review-image-file");
    const files = [...(input.files || [])];
    if (!current || !files.length) return;
    if (current.status === "published") return;
    if ((current.images || []).length + files.length > 8) {
      alert("A question can have at most 8 images.");
      input.value = "";
      return;
    }

    $("review-image-upload").disabled = true;
    showMessage($("review-save-message"), "Uploading image(s)...");
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("staging_question_id", String(current.id));
        const response = await fetch("/api/admin/images", {
          method: "POST",
          credentials: "same-origin",
          body: formData
        });
        if (response.status === 401) {
          window.location.href = "/admin/login/";
          throw new Error("Please sign in again.");
        }
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Upload failed (${response.status}).`);
      }
      await refreshCurrentQuestion();
      showMessage($("review-save-message"), "Image(s) uploaded successfully.", "success");
    } catch (error) {
      await refreshCurrentQuestion().catch(() => {});
      showMessage($("review-save-message"), error.message, "error");
    } finally {
      $("review-image-upload").disabled = state.current?.status === "published" || (state.current?.images || []).length >= 8;
      input.value = "";
    }
  }

  async function deleteQuestionImage(key) {
    const current = state.current;
    if (!current || current.status === "published") return;
    if (!confirm("Delete this image from the staging question?")) return;

    try {
      const data = await apiRequest("/api/admin/images", {
        method: "DELETE",
        body: JSON.stringify({ key, staging_question_id: current.id })
      });
      await refreshCurrentQuestion();
      showMessage($("review-save-message"), data.message || "Image deleted.", "success");
    } catch (error) {
      showMessage($("review-save-message"), error.message, "error");
    }
  }

  function renderDetail() {
    const current = state.current;
    if (!current) return;

    $("review-detail").classList.remove("hidden");
    document.body.classList.add("review-modal-open");
    $("review-detail-title").textContent =
      `Review ${current.external_question_id || `#${current.id}`}`;

    $("review-detail-subtitle").textContent =
      `${current.exam_title || current.exam_slug || ""} · ${statusLabel(current.status)}`;

    $("review-difficulty").value = current.difficulty || "normal";

    renderTopicSelect();
    renderLanguageTabs();
    renderQuestionTranslation();
    renderOptions();
    renderImages();

    const readOnly = current.status === "published";

    $("review-topic").disabled = readOnly;
    $("review-difficulty").disabled = readOnly;
    $("review-add-option").disabled = readOnly;
    $("review-save").disabled = readOnly;
    $("review-reject").disabled = readOnly;
    $("review-approve").disabled = readOnly;

    $("review-save").textContent = readOnly ? "Published (Read Only)" : "Save Changes";

    if (readOnly) {
      $("review-save-message").textContent =
        "Published questions are read-only in the Review Center.";
    } else {
      showMessage($("review-save-message"), "");
    }


  }

  async function openQuestion(id) {
    showMessage($("review-list-message"), "Loading question details...");

    try {
      const data = await apiRequest(`${API_URL}/${id}`);
      state.current = data.question;

      state.languages = data.question.enabledLanguages || ["en"];
      state.activeLanguage = state.languages.includes("en")
        ? "en"
        : state.languages[0];

      for (const language of state.languages) {
        ensureTranslation(language);
      }

      renderDetail();
      showMessage($("review-list-message"), "");
    } catch (error) {
      showMessage($("review-list-message"), error.message, "error");
    }
  }

  function addOption() {
    if (!state.current || state.current.options.length >= 8) {
      alert("A question can have a maximum of 8 options.");
      return;
    }

    const used = new Set(state.current.options.map(option => option.optionKey));
    const key = "ABCDEFGH".split("").find(letter => !used.has(letter));

    if (!key) return;

    const nextOrder = Math.max(
      0,
      ...state.current.options.map(option => Number(option.sortOrder) || 0)
    ) + 1;

    const translations = {};
    for (const language of state.languages) {
      translations[language] = {
        text: "",
        translationSource: "manual"
      };
    }

    state.current.options.push({
      id: null,
      optionKey: key,
      sortOrder: nextOrder,
      isCorrect: false,
      translations
    });

    renderOptions();
  }

  function removeOption(index) {
    if (!state.current || state.current.options.length <= 2) {
      alert("A question must have at least 2 options.");
      return;
    }

    state.current.options.splice(index, 1);
    renderOptions();
  }

  function selectCorrectOption(index) {
    state.current.options.forEach((option, optionIndex) => {
      option.isCorrect = optionIndex === index;
    });
  }

  async function saveQuestion() {
    const current = state.current;
    if (!current || state.saving) return;

    const correctInputs = [
      ...document.querySelectorAll('input[name="review-correct-option"]')
    ];
    const selectedCorrect = correctInputs.find(input => input.checked);

    if (!selectedCorrect) {
      showMessage($("review-save-message"), "Please select one correct answer.", "error");
      return;
    }

    selectCorrectOption(Number(selectedCorrect.value));

    const payload = {
      topicId: $("review-topic").value
        ? Number($("review-topic").value)
        : null,
      difficulty: $("review-difficulty").value,
      translations: {},
      options: current.options.map(option => ({
        optionKey: option.optionKey,
        sortOrder: Number(option.sortOrder),
        isCorrect: Boolean(option.isCorrect),
        translations: {}
      }))
    };

    for (const language of state.languages) {
      const translation = current.translations[language] || {};

      payload.translations[language] = {
        questionText: translation.questionText || "",
        explanation: translation.explanation || ""
      };

      current.options.forEach((option, index) => {
        payload.options[index].translations[language] = {
          text: option.translations?.[language]?.text || ""
        };
      });
    }

    state.saving = true;
    $("review-save").disabled = true;
    showMessage($("review-save-message"), "Saving changes...");

    try {
      const data = await apiRequest(`${API_URL}/${current.id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });

      state.current = data.question;
      state.languages = data.question.enabledLanguages || state.languages;

      renderDetail();
      await loadList();

      showMessage($("review-save-message"), "Changes saved successfully.", "success");
    } catch (error) {
      showMessage($("review-save-message"), error.message, "error");
    } finally {
      state.saving = false;
      if (state.current?.status !== "published") {
        $("review-save").disabled = false;
      }
    }
  }

  async function reviewCurrentQuestion(action) {
    const current = state.current;

    if (!current || current.status === "published") return;
    if (action !== "approve" && action !== "reject") return;

    const actionLabel = action === "approve" ? "approve" : "reject";

    if (!confirm(`Are you sure you want to ${actionLabel} this question?`)) {
      return;
    }

    const approveButton = $("review-approve");
    const rejectButton = $("review-reject");

    approveButton.disabled = true;
    rejectButton.disabled = true;

    showMessage($("review-save-message"), `Processing ${actionLabel}...`);

    try {
      const data = await apiRequest(`${API_URL}/bulk`, {
        method: "POST",
        body: JSON.stringify({
          action,
          ids: [Number(current.id)]
        })
      });

      const result = data.results?.find(
        item => Number(item.id) === Number(current.id)
      );

      if (!result || !result.success) {
        throw new Error(result?.reason || "The review action was not completed.");
      }

      await refreshCurrentQuestion();

      showMessage(
        $("review-save-message"),
        `Question ${action === "approve" ? "approved" : "rejected"} successfully.`,
        "success"
      );

    } catch (error) {
      showMessage($("review-save-message"), error.message, "error");
    } finally {
      if (state.current?.status !== "published") {
        approveButton.disabled = false;
        rejectButton.disabled = false;
      }
    }
  }

  async function bulkReview(action) {
    const ids = [...state.selectedIds];

    if (ids.length === 0) return;
    if (ids.length > 500) { alert("Select at most 500 questions."); return; }

    const actionLabel = action === "approve" ? "approve" : "reject";

    if (!confirm(
      `Are you sure you want to ${actionLabel} ${ids.length} selected question(s)?`
    )) {
      return;
    }

    const approveButton = $("bulk-approve-button");
    const rejectButton = $("bulk-reject-button");

    approveButton.disabled = true;
    rejectButton.disabled = true;

    showMessage($("review-list-message"), "Processing selected questions...");

    try {
      const data = await apiRequest(`${API_URL}/bulk`, {
        method: "POST",
        body: JSON.stringify({
          action,
          ids
        })
      });

      const skippedResults = data.results.filter(item => !item.success);

      let message =
        `Completed: ${data.succeeded} successful, ${data.skipped} skipped.`;

      if (skippedResults.length > 0) {
        message += "\n\nSkipped questions:\n";
        message += skippedResults
          .slice(0, 15)
          .map(item => `ID ${item.id}: ${item.reason}`)
          .join("\n");

        if (skippedResults.length > 15) {
          message += `\n...and ${skippedResults.length - 15} more.`;
        }
      }

      alert(message);

      state.selectedIds.clear();
      await loadList();

      showMessage(
        $("review-list-message"),
        `Bulk ${action} completed: ${data.succeeded} successful, ${data.skipped} skipped.`,
        "success"
      );

    } catch (error) {
      showMessage($("review-list-message"), error.message, "error");
    } finally {
      updateSelectionUI();
    }
  }


  async function bulkPublish() {
    const ids = [...state.selectedIds];

    if (ids.length === 0) return;
    if (ids.length > 500) { alert("Select at most 500 questions."); return; }

    if (!confirm(
      `Are you sure you want to publish ${ids.length} selected question(s)? Only approved questions can be published.`
    )) {
      return;
    }

    const buttons = [
      $("bulk-approve-button"),
      $("bulk-reject-button"),
      $("bulk-publish-button")
    ];

    buttons.forEach(button => {
      button.disabled = true;
    });

    showMessage($("review-list-message"), "Publishing selected questions...");

    try {
      const data = await apiRequest(`${API_URL}/publish`, {
        method: "POST",
        body: JSON.stringify({ ids })
      });

      const skippedResults = (data.results || []).filter(item => !item.success);

      let message =
        `Publishing completed: ${data.succeeded} successful, ${data.skipped} skipped.`;

      if (skippedResults.length > 0) {
        message += "\n\nSkipped questions:\n";
        message += skippedResults
          .slice(0, 15)
          .map(item => `ID ${item.id}: ${item.reason}`)
          .join("\n");

        if (skippedResults.length > 15) {
          message += `\n...and ${skippedResults.length - 15} more.`;
        }
      }

      alert(message);

      state.selectedIds.clear();
      await loadList();

      showMessage(
        $("review-list-message"),
        `Publish completed: ${data.succeeded} successful, ${data.skipped} skipped.`,
        data.skipped === 0 ? "success" : "error"
      );

    } catch (error) {
      showMessage($("review-list-message"), error.message, "error");
    } finally {
      updateSelectionUI();
    }
  }

  function bindEvents() {
    $("refresh-review-button").addEventListener("click", loadList);
        $("bulk-approve-button").addEventListener("click", () => {
      bulkReview("approve");
    });

    $("bulk-reject-button").addEventListener("click", () => {
      bulkReview("reject");
    });

    $("bulk-publish-button").addEventListener("click", bulkPublish);
    const handleFilterChange = () => { state.page = 1; loadList(); };
    $("review-exam-filter").addEventListener("change", () => { $("review-batch-filter").value = ""; handleFilterChange(); });
    for (const key of ["status", "image", "translation", "batch"]) $( `review-${key}-filter`).addEventListener("change", handleFilterChange);
    $("review-size").addEventListener("change", () => { state.size = Number($("review-size").value); state.page = 1; loadList(true); });
    $("review-prev").addEventListener("click", () => { if (state.page > 1) { state.page--; loadList(true); } });
    $("review-next").addEventListener("click", () => { if (state.page * state.size < state.total) { state.page++; loadList(true); } });
    $("review-select-filtered").addEventListener("click", async () => {
      const requestId = state.listRequestId;
      const params = listParams(); params.set("ids", "1");
      try {
        const data = await apiRequest(`${API_URL}?${params}`);
        if (requestId !== state.listRequestId) return;
        if (data.truncated) { alert("More than 500 matching questions. Narrow your filters before selecting all."); return; }
        state.selectedIds = new Set(data.ids.map(Number)); renderList();
      } catch (error) { showMessage($("review-list-message"), error.message, "error"); }
    });
    $("review-clear-selection").addEventListener("click", () => { state.selectedIds.clear(); renderList(); });

    $("review-select-all").addEventListener("change", event => {
      document.querySelectorAll(".review-question-checkbox").forEach(checkbox => {
        const id = Number(checkbox.dataset.selectReviewId);
        checkbox.checked = event.target.checked;
        if (event.target.checked) state.selectedIds.add(id);
        else state.selectedIds.delete(id);
      });
      updateSelectionUI();
    });

    $("review-table-body").addEventListener("change", event => {
      const checkbox = event.target.closest(".review-question-checkbox");
      if (!checkbox) return;

      const id = Number(checkbox.dataset.selectReviewId);
      if (checkbox.checked) state.selectedIds.add(id);
      else state.selectedIds.delete(id);
      updateSelectionUI();
    });

    $("review-table-body").addEventListener("click", event => {
      const button = event.target.closest("[data-review-id]");
      if (button) openQuestion(button.dataset.reviewId);
    });

    $("review-language-tabs").addEventListener("click", event => {
      const button = event.target.closest("[data-language]");
      if (!button || !state.current) return;

      state.activeLanguage = button.dataset.language;
      renderLanguageTabs();
      renderQuestionTranslation();
      renderOptions();
    });

    $("review-options").addEventListener("change", event => {
      if (event.target.name === "review-correct-option") {
        selectCorrectOption(Number(event.target.value));
      }
    });

    $("review-options").addEventListener("click", event => {
      const button = event.target.closest("[data-remove-option]");
      if (button) removeOption(Number(button.dataset.removeOption));
    });

    $("review-add-option").addEventListener("click", addOption);
    $("review-save").addEventListener("click", saveQuestion);
    $("review-image-upload").addEventListener("click", uploadQuestionImages);
    $("review-images").addEventListener("click", event => {
      const button = event.target.closest("[data-image-key]");
      if (button) deleteQuestionImage(button.dataset.imageKey);
    });

    function closeReviewDetail() {
      $("review-detail").classList.add("hidden");
      document.body.classList.remove("review-modal-open");
      state.current = null;
    }

    $("close-review-detail").addEventListener("click", closeReviewDetail);

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" &&
          !$("review-detail").classList.contains("hidden")) {
        closeReviewDetail();
      }
    });

    $("review-approve").addEventListener("click", () => {
      reviewCurrentQuestion("approve");
    });

    $("review-reject").addEventListener("click", () => {
      reviewCurrentQuestion("reject");
    });
  }

  async function initialize() {
    bindEvents();

    try {
      await Promise.all([
        loadTopics(),
        loadList()
      ]);
    } catch (error) {
      showMessage($("review-list-message"), error.message, "error");
    }
  }

  initialize();
})();
