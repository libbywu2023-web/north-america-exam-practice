import {
  api,
  getLanguage,
  setLanguageSelect
} from "./common.js";

const lang = getLanguage();

setLanguageSelect(lang);
document.documentElement.lang = lang;
const homeCopy = {
  en: {
    heroTitle: "Free Online Practice Tests for Exams Worldwide",
    heroSlogan: "Practice. Prepare. Succeed.",
    heroDescription: "Prepare for your next exam with free online practice questions. Explore driving, licensing, and other exam preparation resources by country and region.",
    searchPlaceholder: "Search for exams...",
    searchAria: "Search exams",
    searchButton: "Search",
    footerDescription: "Free online exam practice resources for learners worldwide.",
    about: "About",
    privacy: "Privacy Policy",
    contact: "Contact",
    footerNav: "Information",
    disclaimer: "Global Exam Practice is an independent educational resource and is not affiliated with any government agency or examination authority.",
    copyright: "© 2026 Global Exam Practice. All rights reserved.",
    brandHome: "Global Exam Practice Home",
    pageTitle: "Global Exam Practice",
    metaDescription: "Free online practice tests for standardized exams worldwide. Explore exam preparation resources by country and region."
  },
  "zh-CN": {
    heroTitle: "全球免费在线考试练习",
    heroSlogan: "练习 · 准备 · 成功",
    heroDescription: "通过免费的在线练习题，为下一场考试做好准备。按照国家和地区，查找驾考、执照考试及其他考试备考资源。",
    searchPlaceholder: "搜索考试...",
    searchAria: "搜索考试",
    searchButton: "搜索",
    footerDescription: "为全球学习者提供免费的在线考试练习资源。",
    about: "关于我们",
    privacy: "隐私政策",
    contact: "联系我们",
    footerNav: "信息",
    disclaimer: "Global Exam Practice 是一个独立的教育资源平台，与任何政府机构或考试管理机构均无关联。",
    copyright: "© 2026 Global Exam Practice。保留所有权利。",
    brandHome: "Global Exam Practice 首页",
    pageTitle: "Global Exam Practice - 全球免费在线考试练习",
    metaDescription: "为全球标准化考试提供免费在线练习题。按照国家和地区查找考试备考资源。"
  },
  "zh-TW": {
    heroTitle: "全球免費線上考試練習",
    heroSlogan: "練習 · 準備 · 成功",
    heroDescription: "透過免費的線上練習題，為下一場考試做好準備。依照國家和地區，查找駕駛、執照及其他考試的備考資源。",
    searchPlaceholder: "搜尋考試...",
    searchAria: "搜尋考試",
    searchButton: "搜尋",
    footerDescription: "為全球學習者提供免費的線上考試練習資源。",
    about: "關於我們",
    privacy: "隱私權政策",
    contact: "聯絡我們",
    footerNav: "資訊",
    disclaimer: "Global Exam Practice 是獨立的教育資源平台，與任何政府機關或考試管理機構均無關聯。",
    copyright: "© 2026 Global Exam Practice。保留所有權利。",
    brandHome: "Global Exam Practice 首頁",
    pageTitle: "Global Exam Practice - 全球免費線上考試練習",
    metaDescription: "為全球標準化考試提供免費線上練習題。依照國家和地區查找考試備考資源。"
  }
};

function applyHomeTranslations() {
  const translations = homeCopy[lang] || homeCopy.en;

  document.querySelectorAll("[data-i18n]").forEach(element => {
    const key = element.dataset.i18n;
    if (translations[key]) {
      element.textContent = translations[key];
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach(element => {
    const key = element.dataset.i18nPlaceholder;
    if (translations[key]) {
      element.placeholder = translations[key];
    }
  });

  document.querySelectorAll("[data-i18n-aria]").forEach(element => {
    const key = element.dataset.i18nAria;
    if (translations[key]) {
      element.setAttribute("aria-label", translations[key]);
    }
  });

  document.title = translations.pageTitle;

  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) {
    metaDescription.content = translations.metaDescription;
  }
}

applyHomeTranslations();

const root = document.querySelector("#catalog");
const searchInput = document.querySelector("#catalog-search");
const searchForm = document.querySelector("#catalog-search-form");

if (searchForm) {
  searchForm.addEventListener("submit", event => {
    event.preventDefault();
    renderCatalog(searchInput.value);
  });
}

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
  },
    viewMore: {
    en: "View more exams",
    "zh-CN": "查看更多考试",
    "zh-TW": "查看更多考試"
  },
  viewLess: {
    en: "View fewer exams",
    "zh-CN": "收起考试",
    "zh-TW": "收起考試"
  },
  otherCountries: {
    en: "Other Countries",
    "zh-CN": "其他国家",
    "zh-TW": "其他國家"
  },
  otherCountriesDescription: {
    en: "More countries and exam resources will be added.",
    "zh-CN": "我们将陆续添加更多国家和考试资源。",
    "zh-TW": "我們將陸續新增更多國家和考試資源。"
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


function renderExamPreview(container, exams, expanded = false) {
  container.innerHTML = "";

  const visibleExams = expanded ? exams : exams.slice(0, 2);

  appendExamLinks(container, visibleExams);

  if (exams.length > 2) {
    const toggle = createElement(
      "button",
      "catalog-view-more",
      expanded ? labels.viewLess[lang] : labels.viewMore[lang]
    );

    toggle.type = "button";

    toggle.addEventListener("click", () => {
      renderExamPreview(container, exams, !expanded);
    });

    container.append(toggle);
  }
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

    country.regions.forEach(region => {
      const row = createElement("div", "catalog-region-row");

      const regionName = createElement(
        "div",
        "catalog-region-name",
        region.code === "ALL" ? "" : region.name
      );

      const examsContainer = createElement(
        "div",
        region.code === "ALL"
          ? "catalog-all-exams"
          : "catalog-region-exams"
      );

      renderExamPreview(
        examsContainer,
        region.exams,
        Boolean(keyword)
      );

      row.append(regionName, examsContainer);
      section.append(row);
    });

    root.append(section);
  });

  if (!keyword) {
    const otherCard = createElement(
      "section",
      "catalog-country catalog-other-countries"
    );

    const otherTitle = createElement(
      "h2",
      "catalog-country-title",
      `🌎 ${labels.otherCountries[lang]}`
    );

    const description = createElement(
      "p",
      "catalog-other-description",
      labels.otherCountriesDescription[lang]
    );

    otherCard.append(otherTitle, description);
    root.append(otherCard);
  }
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