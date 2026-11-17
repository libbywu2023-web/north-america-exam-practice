const examSelect = document.getElementById("exam-select");
const examInfo = document.getElementById("exam-info");
const fileInput = document.getElementById("excel-file");
const fileInfo = document.getElementById("file-info");
const previewButton = document.getElementById("preview-button");
const importButton = document.getElementById("import-button");
const previewMessage = document.getElementById("preview-message");

let parsedWorkbook = null;
let selectedFile = null;

const QUESTION_COLUMNS = [
  "external_question_id",
  "topic_slug",
  "difficulty",
  "has_image",
  "question_en",
  "explanation_en",
  "question_zh_cn",
  "explanation_zh_cn",
  "question_zh_tw",
  "explanation_zh_tw"
];

const OPTION_COLUMNS = [
  "external_question_id",
  "option_key",
  "sort_order",
  "is_correct",
  "option_en",
  "option_zh_cn",
  "option_zh_tw"
];

function showMessage(element, message, type = "") {
  element.textContent = message;
  element.className = `import-status ${type}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

async function loadExams() {
  try {
    const response = await fetch("/api/admin/imports", {
      credentials: "same-origin"
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not load exams.");
    }

    examSelect.innerHTML = '<option value="">Select an exam...</option>';

    for (const exam of data.exams || []) {
      const option = document.createElement("option");
      option.value = exam.slug;
      option.textContent = `${exam.title} (${exam.slug}) — ${exam.status}`;
      option.dataset.status = exam.status;
      examSelect.appendChild(option);
    }

    if (!data.exams?.length) {
      examSelect.innerHTML = '<option value="">No exams found</option>';
    }
  } catch (error) {
    examSelect.innerHTML = '<option value="">Failed to load exams</option>';
    showMessage(previewMessage, error.message, "error");
  }
}

examSelect.addEventListener("change", () => {
  const selected = examSelect.selectedOptions[0];

  examInfo.textContent = selected?.value
    ? `URL Slug: ${selected.value} | Status: ${selected.dataset.status}`
    : "";
});

function downloadTemplate() {
  if (!window.XLSX) {
    showMessage(previewMessage, "Excel library failed to load.", "error");
    return;
  }

  const workbook = XLSX.utils.book_new();

  const questionsSheet = XLSX.utils.aoa_to_sheet([QUESTION_COLUMNS]);
  const optionsSheet = XLSX.utils.aoa_to_sheet([OPTION_COLUMNS]);

  questionsSheet["!cols"] = QUESTION_COLUMNS.map(() => ({ wch: 24 }));
  optionsSheet["!cols"] = OPTION_COLUMNS.map(() => ({ wch: 24 }));

  XLSX.utils.book_append_sheet(workbook, questionsSheet, "Questions");
  XLSX.utils.book_append_sheet(workbook, optionsSheet, "Options");

  XLSX.writeFile(workbook, "question-import-template.xlsx");
}

document.getElementById("download-template")
  .addEventListener("click", downloadTemplate);

function readSheet(workbook, sheetName, requiredColumns) {
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    throw new Error(`Missing worksheet: ${sheetName}`);
  }

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: true,
    blankrows: false
  });

  if (!rows.length) {
    throw new Error(`${sheetName} worksheet is empty.`);
  }

  const headers = rows[0].map((value) =>
    String(value ?? "").trim().toLowerCase()
  );

  const missing = requiredColumns.filter(
    (column) => !headers.includes(column)
  );

  if (missing.length) {
    throw new Error(
      `${sheetName} is missing columns: ${missing.join(", ")}`
    );
  }

  const columnIndexes = {};
  headers.forEach((header, index) => {
    columnIndexes[header] = index;
  });

  const records = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    if (!row.some((value) => String(value ?? "").trim() !== "")) {
      continue;
    }

    const record = { rowNumber: i + 1 };

    for (const column of requiredColumns) {
      record[column] = row[columnIndexes[column]] ?? "";
    }

    records.push(record);
  }

  return records;
}

function mapQuestion(row) {
  return {
    rowNumber: row.rowNumber,
    externalQuestionId: row.external_question_id,
    topicSlug: row.topic_slug,
    difficulty: row.difficulty,
    hasImage: row.has_image,
    questionEn: row.question_en,
    explanationEn: row.explanation_en,
    questionZhCn: row.question_zh_cn,
    explanationZhCn: row.explanation_zh_cn,
    questionZhTw: row.question_zh_tw,
    explanationZhTw: row.explanation_zh_tw
  };
}

function mapOption(row) {
  return {
    rowNumber: row.rowNumber,
    externalQuestionId: row.external_question_id,
    optionKey: row.option_key,
    sortOrder: row.sort_order,
    isCorrect: row.is_correct,
    optionEn: row.option_en,
    optionZhCn: row.option_zh_cn,
    optionZhTw: row.option_zh_tw
  };
}

function formatSize(bytes) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(2)} MB`
    : `${(bytes / 1024).toFixed(1)} KB`;
}

function getRequestPayload() {
  return {
    examSlug: examSelect.value,
    sourceFilename: selectedFile.name,
    questions: parsedWorkbook.questions,
    options: parsedWorkbook.options
  };
}

async function previewFile() {
  parsedWorkbook = null;
  importButton.disabled = true;
  document.getElementById("preview-card").hidden = true;
  document.getElementById("result-card").hidden = true;

  if (!examSelect.value) {
    showMessage(previewMessage, "Please select an exam first.", "error");
    return;
  }

  if (!selectedFile) {
    showMessage(previewMessage, "Please select an Excel file.", "error");
    return;
  }

  try {
    if (!window.XLSX) {
      throw new Error("Excel library failed to load. Please refresh the page.");
    }

    const buffer = await selectedFile.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });

    const questionRows = readSheet(
      workbook,
      "Questions",
      QUESTION_COLUMNS
    );

    const optionRows = readSheet(
      workbook,
      "Options",
      OPTION_COLUMNS
    );

    if (!questionRows.length) {
      throw new Error("No question data found in the Questions worksheet.");
    }

    if (questionRows.length > 500) {
      throw new Error("Maximum 500 question rows per import.");
    }

    if (optionRows.length > 4000) {
      throw new Error("Maximum 4,000 option rows per import.");
    }

    parsedWorkbook = {
      questions: questionRows.map(mapQuestion),
      options: optionRows.map(mapOption)
    };

    const payload = getRequestPayload();
    const jsonSize = new TextEncoder().encode(
      JSON.stringify(payload)
    ).length;

    document.getElementById("preview-questions").textContent =
      questionRows.length;

    document.getElementById("preview-options").textContent =
      optionRows.length;

    document.getElementById("preview-images").textContent =
      questionRows.filter((row) =>
        ["true", "1", "yes", "y"].includes(
          String(row.has_image).trim().toLowerCase()
        )
      ).length;

    document.getElementById("preview-size").textContent =
      formatSize(jsonSize);

    document.getElementById("preview-summary").textContent =
      `Selected exam: ${examSelect.value}. ` +
      `Workbook: ${selectedFile.name}. ` +
      `The original Excel file remains in your browser.`;

    document.getElementById("preview-card").hidden = false;

    if (jsonSize > 2 * 1024 * 1024) {
      throw new Error(
        `The prepared JSON is ${formatSize(jsonSize)}. ` +
        "The server limit is 2 MB. Please split this workbook into smaller batches."
      );
    }

    importButton.disabled = false;
    showMessage(
      previewMessage,
      "Workbook structure checked. You can now import these questions.",
      "success"
    );
  } catch (error) {
    parsedWorkbook = null;
    importButton.disabled = true;
    showMessage(previewMessage, error.message, "error");
  }
}

fileInput.addEventListener("change", () => {
  selectedFile = fileInput.files?.[0] || null;
  parsedWorkbook = null;
  importButton.disabled = true;
  document.getElementById("preview-card").hidden = true;
  document.getElementById("result-card").hidden = true;

  fileInfo.textContent = selectedFile
    ? `${selectedFile.name} (${formatSize(selectedFile.size)})`
    : "No file selected.";

  showMessage(previewMessage, "");
});

previewButton.addEventListener("click", previewFile);

async function submitImport() {
  if (!parsedWorkbook || !selectedFile || !examSelect.value) {
    showMessage(previewMessage, "Please select an exam and check a workbook first.", "error");
    return;
  }

  const confirmed = window.confirm(
    `Import ${parsedWorkbook.questions.length} questions into ${examSelect.value}?\n\n` +
    "Existing External Question IDs will be skipped, not overwritten."
  );

  if (!confirmed) return;

  importButton.disabled = true;
  previewButton.disabled = true;

  showMessage(
    previewMessage,
    "Importing questions. Please keep this page open...",
    ""
  );

  try {
    const payload = getRequestPayload();

    const response = await fetch("/api/admin/imports", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Import failed.");
    }

    document.getElementById("result-imported").textContent =
      data.importedCount ?? 0;

    document.getElementById("result-skipped").textContent =
      data.skippedCount ?? 0;

    document.getElementById("result-errors").textContent =
      data.errorCount ?? 0;

    document.getElementById("result-warnings").textContent =
      data.warningCount ?? 0;

    document.getElementById("result-summary").textContent =
      `Batch ID: ${data.batchId} | Exam: ${data.examSlug} | ` +
      `Total question rows: ${data.totalRows}`;

    const errorBody = document.getElementById("result-errors-body");
    errorBody.innerHTML = "";

    for (const item of data.errors || []) {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(item.severity)}</td>
        <td>${escapeHtml(item.rowNumber ?? "")}</td>
        <td>${escapeHtml(item.externalQuestionId ?? "")}</td>
        <td>${escapeHtml(item.message ?? item.code ?? "")}</td>
      `;
      errorBody.appendChild(row);
    }

    document.getElementById("result-card").hidden = false;

    showMessage(
      previewMessage,
      "Import completed. Review the results below.",
      "success"
    );

    document.getElementById("result-card").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  } catch (error) {
    showMessage(previewMessage, error.message, "error");
  } finally {
    previewButton.disabled = false;
    importButton.disabled = !parsedWorkbook;
  }
}

importButton.addEventListener("click", submitImport);

loadExams();
