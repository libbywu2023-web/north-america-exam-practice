import {
  api,
  getLanguage,
  setLanguageSelect
} from "./common.js";

const lang = getLanguage();
// Visiting a localized homepage explicitly establishes the site preference.
localStorage.setItem("exam-language", lang);

setLanguageSelect(lang);
document.documentElement.lang = lang;
const homeCopy = {
  fr: {
    heroTitle: "Tests de préparation gratuits aux examens du monde entier",
    heroSlogan: "Pratiquez. Préparez-vous. Réussissez.",
    heroDescription: "Préparez votre prochain examen grâce à des questions d’entraînement gratuites. Explorez les examens de conduite, les permis et d’autres ressources par pays et par région.",
    searchPlaceholder: "Rechercher un examen...", searchAria: "Rechercher des examens", searchButton: "Rechercher",
    categoryHeading: "Explorer par catégorie", categoryAll: "Tous les examens", categoryDriving: "Examens de conduite", categoryImmigration: "Immigration et citoyenneté", categoryProfessional: "Certifications professionnelles", categoryOther: "Autres examens",
    footerDescription: "Des ressources gratuites de préparation aux examens pour les apprenants du monde entier.",
    about: "À propos", privacy: "Politique de confidentialité", contact: "Contact", footerNav: "Informations",
    disclaimer: "Global Exam Practice est une ressource éducative indépendante, sans affiliation avec un gouvernement ou un organisme d’examen.",
    copyright: "© 2026 Global Exam Practice. Tous droits réservés.",
    brandHome: "Accueil de Global Exam Practice", pageTitle: "Global Exam Practice — Préparation gratuite aux examens",
    metaDescription: "Tests de préparation gratuits aux examens standardisés du monde entier. Trouvez des ressources par pays et région."
  },
  en: {
    heroTitle: "Free Online Practice Tests for Exams Worldwide",
    heroSlogan: "Practice. Prepare. Succeed.",
    heroDescription: "Prepare for your next exam with free online practice questions. Explore driving, licensing, and other exam preparation resources by country and region.",
    searchPlaceholder: "Search for exams...",
    searchAria: "Search exams",
    searchButton: "Search",
    categoryHeading: "Browse by Exam Category", categoryAll: "All Exams", categoryDriving: "Driving Tests", categoryImmigration: "Immigration & Citizenship", categoryProfessional: "Professional Certification", categoryOther: "Other Exams",
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
    categoryHeading: "按考试类别浏览", categoryAll: "全部考试", categoryDriving: "驾驶考试", categoryImmigration: "移民与入籍", categoryProfessional: "职业资格认证", categoryOther: "其他考试",
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
    categoryHeading: "依考試類別瀏覽", categoryAll: "全部考試", categoryDriving: "駕駛考試", categoryImmigration: "移民與入籍", categoryProfessional: "職業資格認證", categoryOther: "其他考試",
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
    fr: "Chargement des examens...",
    en: "Loading exams...",
    "zh-CN": "正在加载考试目录...",
    "zh-TW": "正在載入考試目錄..."
  },
  noResults: {
    fr: "Aucun examen correspondant.",
    en: "No matching exams found.",
    "zh-CN": "没有找到匹配的考试。",
    "zh-TW": "沒有找到符合的考試。"
  },
  loadError: {
    fr: "Impossible de charger les examens. Veuillez réessayer.",
    en: "Unable to load the exam catalog. Please try again later.",
    "zh-CN": "暂时无法加载考试目录，请稍后再试。",
    "zh-TW": "暫時無法載入考試目錄，請稍後再試。"
  },
    viewMore: {
    fr: "Voir plus d’examens",
    en: "View more exams",
    "zh-CN": "查看更多考试",
    "zh-TW": "查看更多考試"
  },
  viewLess: {
    fr: "Voir moins d’examens",
    en: "View fewer exams",
    "zh-CN": "收起考试",
    "zh-TW": "收起考試"
  },
  otherCountries: {
    fr: "Autres pays",
    en: "Other Countries",
    "zh-CN": "其他国家",
    "zh-TW": "其他國家"
  },
  otherCountriesDescription: {
    fr: "D’autres pays et ressources seront ajoutés.",
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
let activeCategory = "all";
const categoryDefinitions = [
  { slug: "all", label: "categoryAll", icon: "🌐" },
  { slug: "driving", label: "categoryDriving", icon: "🚗" },
  { slug: "immigration-citizenship", label: "categoryImmigration", icon: "🏛️" },
  { slug: "professional-certification", label: "categoryProfessional", icon: "💼" },
  { slug: "other", label: "categoryOther", icon: "📚" }
];
const knownCategorySlugs = new Set(categoryDefinitions.map(item => item.slug));
function matchesCategory(exam, slug) {
  if (slug === "all") return true;
  if (slug === "other") return !knownCategorySlugs.has(exam.category_slug) || exam.category_slug === "other";
  // Backwards compatibility for catalogs still carrying the legacy slug.
  if (slug === "driving") return ["driving", "car-driving", "motorcycle", "truck-driving"].includes(exam.category_slug);
  return exam.category_slug === slug;
}
const categoryRoot = document.querySelector("#category-filters");
function renderCategories() {
  if (!categoryRoot) return;
  categoryRoot.replaceChildren();
  const copy = homeCopy[lang] || homeCopy.en;
  for (const category of categoryDefinitions) {
    const count = allExams.filter(exam => matchesCategory(exam, category.slug)).length;
    const button = createElement("button", "category-filter", `${category.icon}  ${copy[category.label]} (${count})`);
    button.type = "button";
    button.dataset.category = category.slug;
    button.setAttribute("aria-pressed", String(activeCategory === category.slug));
    button.addEventListener("click", () => {
      activeCategory = category.slug;
      renderCategories();
      renderCatalog(searchInput?.value || "");
    });
    categoryRoot.append(button);
  }
}

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

  const slug = encodeURIComponent(exam.slug);

  const supported = String(exam.supported_languages || '').split(',');
  const effective = supported.includes(lang) ? lang :
    supported.includes(exam.default_language) ? exam.default_language :
    supported.includes('en') ? 'en' : supported[0];
  if (effective === 'fr') link.href = `/fr/${slug}`;
  else if (effective === 'zh-CN') link.href = `/zh/${slug}`;
  else if (effective === 'zh-TW') link.href = `/zh-tw/${slug}`;
  else link.href = `/${slug}`;

  // NEW is controlled manually in the exam admin settings.
  if (Number(exam.show_new_badge) === 1) {
    const badge = createElement("span", "catalog-new-badge", "NEW");
    link.append(document.createTextNode(" "), badge);
  }
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

  const filteredExams = allExams.filter(exam =>
    matchesCategory(exam, activeCategory) &&
    (!keyword || getSearchText(exam).includes(keyword))
  );

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
        region.code === "ALL" ? (lang === "en" ? "National" : lang === "fr" ? "National" : lang === "zh-CN" ? "全国" : "全國") : region.name
      );

      const examsContainer = createElement(
        "div",
        "catalog-region-exams"
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

  if (!keyword && activeCategory === "all") {
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

    renderCategories();
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