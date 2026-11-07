import {
  api,
  getLanguage,
  setLanguageSelect
} from "./common.js";

const lang = getLanguage();

setLanguageSelect(lang);
document.documentElement.lang = lang;

const root = document.querySelector("#catalog");
const searchInput = document.querySelector("#catalog-search");

const labels = {
  loading: {
    en: "Loading exams...",
    "zh-CN": "正在加载考试目录...",
    "zh-TW": "正在載入考試目錄..."
  },
  noResults: {
    en: "No matching exams found.",
    "zh-CN": "没有找到匹配的考试。",
    "zh-TW": "沒有找到符合的考試。"
  },
  loadError: {
    en: "Unable to load the exam catalog. Please try again later.",
    "zh-CN": "暂时无法加载考试目录，请稍后再试。",
    "zh-TW": "暫時無法載入考試目錄，請稍後再試。"
  }
};

const countryFlags = {
  CA: "🇨🇦",
  US: "🇺🇸",
  MX: "🇲🇽"
};

let allExams = [];

function createElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text !== undefined) {
    element.textContent = text;
  }

  return element;
}

function createExamLink(exam) {
  const link = createElement("a", "catalog-exam-link", exam.title);

  link.href =
    `/practice.html?exam=${encodeURIComponent(exam.slug)}` +
    `&lang=${encodeURIComponent(lang)}`;

  return link;
}

function appendExamLinks(container, exams) {
  exams.forEach((exam, index) => {
    if (index > 0) {
      container.append(
        document.createTextNode(" · ")
      );
    }

    container.append(createExamLink(exam));
  });
}

function getSearchText(exam) {
  return [
    exam.title,
    exam.description,
    exam.country_name,
    exam.country_code,
    exam.region_name,
    exam.region_code,
    exam.category_name,
    exam.category_slug,
    exam.slug
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function renderCatalog(query = "") {
  root.innerHTML = "";

  const keyword = query.trim().toLowerCase();

  const filteredExams = keyword
    ? allExams.filter(exam =>
        getSearchText(exam).includes(keyword)
      )
    : allExams;

  if (filteredExams.length === 0) {
    root.append(
      createElement(
        "p",
        "catalog-empty",
        labels.noResults[lang]
      )
    );
    return;
  }

  const countries = new Map();

  filteredExams.forEach(exam => {
    if (!countries.has(exam.country_code)) {
      countries.set(exam.country_code, {
        code: exam.country_code,
        name: exam.country_name,
        regions: new Map()
      });
    }

    const country = countries.get(exam.country_code);

    if (!country.regions.has(exam.region_code)) {
      country.regions.set(exam.region_code, {
        code: exam.region_code,
        name: exam.region_name,
        exams: []
      });
    }

    country.regions.get(exam.region_code).exams.push(exam);
  });

  countries.forEach(country => {
    const section = createElement("section", "catalog-country");

    const heading = createElement("h2", "catalog-country-title");

    const flag = countryFlags[country.code] || "🌎";

    heading.textContent = `${flag} ${country.name}`;

    section.append(heading);

    const allRegion = country.regions.get("ALL");

    if (allRegion) {
      const allExamsContainer = createElement(
        "div",
        "catalog-all-exams"
      );

      appendExamLinks(allExamsContainer, allRegion.exams);

      section.append(allExamsContainer);
    }

    country.regions.forEach(region => {
      if (region.code === "ALL") {
        return;
      }

      const row = createElement("div", "catalog-region-row");

      const regionName = createElement(
        "div",
        "catalog-region-name",
        region.name
      );

      const examsContainer = createElement(
        "div",
        "catalog-region-exams"
      );

      appendExamLinks(examsContainer, region.exams);

      row.append(regionName, examsContainer);
      section.append(row);
    });

    root.append(section);
  });
}

async function init() {
  root.textContent = labels.loading[lang];

  try {
    const result = await api(
      `/api/catalog?lang=${encodeURIComponent(lang)}`
    );

    allExams = result.exams || [];

    renderCatalog();

    searchInput.addEventListener("input", () => {
      renderCatalog(searchInput.value);
    });
  } catch (error) {
    console.error("Catalog loading failed:", error);
    root.textContent = labels.loadError[lang];
  }
}

init();