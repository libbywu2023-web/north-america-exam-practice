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


// Homepage sections: translated content remains consistent with the language selector.
Object.assign(homeCopy["en"], {"categoryHeading": "Browse Free Practice Tests by Exam Category", "categoryIntro": "Explore driving knowledge tests, citizenship exams, professional certifications, and other standardized exams. Choose a category to filter the available practice tests by country and region.", "showAll": "Show all exam categories", "countryHeading": "Explore Practice Tests by Country", "countryIntro": "Find free practice tests organized by country, province and state. Select an exam to start preparing.", "popularHeading": "Popular Practice Tests", "popularIntro": "Start with a published practice test and review questions at your own pace.", "preparationHeading": "How to Prepare for Your Exam", "prep1Title": "Know the Exam Format", "prep1Text": "Check the official exam format, time limit, passing score and topics before you begin studying.", "prep2Title": "Practice with Questions", "prep2Text": "Use online practice questions to become familiar with the subject matter and test-style questions.", "prep3Title": "Review and Improve", "prep3Text": "Review answers and explanations, identify weak areas and repeat practice as needed.", "faqHeading": "Frequently Asked Questions", "faq1q": "Are the practice tests free?", "faq1a": "Yes. You can access the available online practice questions for free.", "faq2q": "Do I need to create an account?", "faq2a": "No account is required to start using the available practice tests.", "faq3q": "Are these official exam questions?", "faq3a": "No. These are independent study resources, not official examination questions. Always consult the relevant official exam authority for current requirements.", "faq4q": "Which exams can I practice?", "faq4a": "Browse the country directory above for currently available driving and citizenship practice tests. More exam categories will be added.", "faq5q": "Which languages are supported?", "faq5a": "The website supports English, French, Simplified Chinese and Traditional Chinese. Available languages can vary by exam."});
Object.assign(homeCopy["zh-CN"], {"categoryHeading": "按考试类别浏览免费练习题", "categoryIntro": "探索驾照理论考试、入籍考试、职业资格认证及其他标准化考试。选择类别，按国家和地区筛选已上线的练习题。", "showAll": "显示全部考试类别", "countryHeading": "按国家浏览考试练习", "countryIntro": "按照国家、省份和州查找免费练习题，选择考试开始备考。", "popularHeading": "热门考试练习", "popularIntro": "选择已发布的考试，按照自己的节奏进行练习。", "preparationHeading": "如何准备考试", "prep1Title": "了解考试形式", "prep1Text": "先查看官方考试题型、时间限制、及格分数和考试范围。", "prep2Title": "通过练习题备考", "prep2Text": "使用在线练习题熟悉知识点和考试题型。", "prep3Title": "复习并提高", "prep3Text": "查看答案和解析，找出薄弱知识点并重复练习。", "faqHeading": "常见问题", "faq1q": "练习题免费吗？", "faq1a": "是的，网站提供的在线练习题可以免费使用。", "faq2q": "需要注册账号吗？", "faq2a": "不需要注册账号即可开始练习。", "faq3q": "这些是官方考试原题吗？", "faq3a": "不是。这些是独立的学习资源，并非官方考试题目。最新考试要求请以主管机构公布的信息为准。", "faq4q": "目前可以练习哪些考试？", "faq4a": "请查看上方国家目录，了解已上线的驾考和入籍考试练习。其他类别将陆续增加。", "faq5q": "支持哪些语言？", "faq5a": "网站支持英语、法语、简体中文和繁体中文；具体考试可用语言可能不同。"});
Object.assign(homeCopy["zh-TW"], {"categoryHeading": "依考試類別瀏覽免費練習題", "categoryIntro": "探索駕照筆試、入籍考試、職業資格認證及其他標準化考試。選擇類別，依國家和地區篩選已上線的練習題。", "showAll": "顯示全部考試類別", "countryHeading": "依國家瀏覽考試練習", "countryIntro": "依國家、省份和州尋找免費練習題，選擇考試開始準備。", "popularHeading": "熱門考試練習", "popularIntro": "選擇已發布的考試，依照自己的步調練習。", "preparationHeading": "如何準備考試", "prep1Title": "了解考試形式", "prep1Text": "先查看官方考試題型、時間限制、及格分數和考試範圍。", "prep2Title": "透過練習題準備", "prep2Text": "使用線上練習題熟悉知識點和考試題型。", "prep3Title": "複習並進步", "prep3Text": "查看答案與解析，找出薄弱環節並重複練習。", "faqHeading": "常見問題", "faq1q": "練習題免費嗎？", "faq1a": "是的，網站提供的線上練習題可以免費使用。", "faq2q": "需要註冊帳號嗎？", "faq2a": "不需要註冊帳號即可開始練習。", "faq3q": "這些是官方考試原題嗎？", "faq3a": "不是。這些是獨立的學習資源，並非官方考試題目。最新考試要求請以主管機關公布的資訊為準。", "faq4q": "目前可以練習哪些考試？", "faq4a": "請查看上方國家目錄，了解已上線的駕考和入籍考試練習。其他類別將陸續增加。", "faq5q": "支援哪些語言？", "faq5a": "網站支援英語、法語、簡體中文和繁體中文；各考試可用語言可能不同。"});
Object.assign(homeCopy["fr"], {"categoryHeading": "Explorer les tests gratuits par catégorie", "categoryIntro": "Découvrez les examens de conduite, de citoyenneté, les certifications professionnelles et autres tests. Sélectionnez une catégorie pour filtrer les examens disponibles.", "showAll": "Afficher toutes les catégories", "countryHeading": "Explorer les examens par pays", "countryIntro": "Trouvez des tests gratuits par pays et région. Sélectionnez un examen pour commencer.", "popularHeading": "Tests populaires", "popularIntro": "Choisissez un test disponible et entraînez-vous à votre rythme.", "preparationHeading": "Comment préparer votre examen", "prep1Title": "Connaître le format", "prep1Text": "Consultez le format officiel, la durée, le seuil de réussite et les sujets abordés.", "prep2Title": "S’entraîner avec des questions", "prep2Text": "Utilisez des questions en ligne pour vous familiariser avec les sujets et les types de questions.", "prep3Title": "Réviser et progresser", "prep3Text": "Vérifiez les réponses et les explications, puis travaillez vos points faibles.", "faqHeading": "Questions fréquentes", "faq1q": "Les tests sont-ils gratuits ?", "faq1a": "Oui. Les questions d’entraînement disponibles sont gratuites.", "faq2q": "Dois-je créer un compte ?", "faq2a": "Non, aucun compte n’est nécessaire pour commencer.", "faq3q": "S’agit-il de questions officielles ?", "faq3a": "Non. Ce sont des ressources pédagogiques indépendantes et non des questions officielles. Consultez les autorités compétentes pour les exigences actuelles.", "faq4q": "Quels examens sont disponibles ?", "faq4a": "Consultez la liste par pays ci-dessus pour voir les tests de conduite et de citoyenneté disponibles.", "faq5q": "Quelles langues sont proposées ?", "faq5a": "Le site propose l’anglais, le français, le chinois simplifié et le chinois traditionnel. Les langues disponibles varient selon l’examen."});
const benefitCopy = {
  fr: ["Tests gratuits", "Sans inscription", "Plusieurs langues", "Anglais · Français · 中文", "Plusieurs types d’examens", "Conduite · Citoyenneté · Certifications", "Étudiez à tout moment", "Sur ordinateur, tablette ou mobile"],
  en: ["Free Practice Tests", "No registration required", "Multilingual Support", "English · Français · 中文", "Multiple Exam Types", "Driving · Citizenship · Certification", "Study Anytime", "On desktop, tablet or mobile"],
  "zh-CN": ["免费考试练习", "无需注册", "多语言支持", "英语 · 法语 · 简体中文 · 繁体中文", "多种考试类型", "驾考 · 入籍 · 职业认证", "随时学习", "支持电脑、平板和手机"],
  "zh-TW": ["免費考試練習", "無需註冊", "多語言支援", "英語 · 法語 · 簡體中文 · 繁體中文", "多種考試類型", "駕考 · 入籍 · 職業認證", "隨時學習", "支援電腦、平板和手機"]
};
for (const [language, values] of Object.entries(benefitCopy)) {
  Object.assign(homeCopy[language], Object.fromEntries(
    ["benefitFree", "benefitFreeSub", "benefitLanguage", "benefitLanguageSub", "benefitTypes", "benefitTypesSub", "benefitAnytime", "benefitAnytimeSub"].map((key, i) => [key, values[i]])
  ));
}

// Shared, lightweight SVG icons for the homepage (no external icon library).
const homeIconPaths = {
  graduation: '<path d="m2 9 10-5 10 5-10 5L2 9Z"/><path d="M6 11v6c3 3 9 3 12 0v-6"/><path d="M22 9v7"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18"/>',
  star: '<path d="m12 2 3.1 6.5 7.2 1-5.2 5.1 1.2 7.2-6.3-3.4-6.3 3.4 1.2-7.2L1.7 9.5l7.2-1L12 2Z"/>',
  book: '<path d="M12 6c-3-2-7-2-10-1v14c3-1 7-1 10 1 3-2 7-2 10-1V5c-3-1-7-1-10 1ZM12 6v14"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.4 9a2.7 2.7 0 1 1 4.8 1.7c-.7.9-2.2 1.2-2.2 3.3M12 17.5h.01"/>',
  car: '<path d="m5 11 1.6-5h10.8L19 11M5 11H3v7h18v-7h-2M5 11h14M7 18v2M17 18v2"/><circle cx="7" cy="15" r="1"/><circle cx="17" cy="15" r="1"/>',
  id: '<rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="8" cy="10" r="2"/><path d="M4.5 16c.7-2.5 6.3-2.5 7 0M14 9h5M14 13h5M14 17h4"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M8 7V4h8v3M2 13c6 4 14 4 20 0M12 12v5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  landmark: '<path d="m2 9 10-6 10 6H2ZM4 21h16M6 11v8M11 11v8M16 11v8M21 11v8"/>',
  pin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  truck: '<path d="M2 6h12v12H2zM14 10h4l4 4v4h-8"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/><path d="m12 12 8-8"/>',
  file: '<path d="M5 2h9l5 5v15H5zM14 2v5h5M8 12h8M8 16h8"/>',
  chart: '<path d="M4 20V4M4 20h17M8 17v-5M13 17V8M18 17V5"/>',
};
function homeIcon(name, className = "") {
  const holder = document.createElement("span");
  holder.className = `home-svg-icon ${className}`.trim();
  holder.setAttribute("aria-hidden", "true");
  holder.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" focusable="false">${homeIconPaths[name] || homeIconPaths.grid}</svg>`;
  return holder;
}
function decorateStaticHomeIcons() {
  document.querySelectorAll("[data-heading-icon]").forEach(heading => {
    heading.prepend(homeIcon(heading.dataset.headingIcon, "heading-svg"));
  });
  document.querySelectorAll("[data-prep-icon]").forEach(holder => {
    holder.append(homeIcon(holder.dataset.prepIcon, "prep-svg"));
  });
}
decorateStaticHomeIcons();

const categoryDescriptions = {
  en: ["Prepare for learner’s permit, G1, Class 7L and CDL knowledge tests. Study road signs, traffic rules and safe driving.","Study citizenship knowledge, including history, government, civic rights and responsibilities.","Explore licensing, workplace safety and professional qualification exam preparation.","Discover food safety, health-related and other knowledge-based exam resources."],
  fr: ["Préparez les examens du permis de conduire, G1, Class 7L et CDL : panneaux, circulation et sécurité.","Révisez l’histoire, le gouvernement, les droits et les responsabilités civiques.","Explorez les examens de certification, de sécurité au travail et de qualification professionnelle.","Découvrez les examens de sécurité alimentaire, de santé et d’autres domaines."],
  "zh-CN": ["准备学习驾照、G1、Class 7L 和 CDL 理论考试，练习交通标志、道路规则与安全驾驶。","学习入籍考试中的历史、政府、公民权利和责任等知识。","探索职业执照、工作场所安全及职业资格认证考试。","查找食品安全、健康及其他知识类考试资源。"],
  "zh-TW": ["準備學習駕照、G1、Class 7L 和 CDL 筆試，練習交通標誌、道路規則與安全駕駛。","學習入籍考試中的歷史、政府、公民權利和責任等知識。","探索職業執照、工作場所安全及職業資格認證考試。","尋找食品安全、健康及其他知識類考試資源。"]
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
    revealFilteredCatalog();
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
  const descriptions = categoryDescriptions[lang] || categoryDescriptions.en;
  categoryDefinitions.slice(1).forEach((category, index) => {
    const count = allExams.filter(exam => matchesCategory(exam, category.slug)).length;
    const button = createElement("button", "category-filter");
    button.type = "button";
    button.dataset.category = category.slug;
    button.setAttribute("aria-pressed", String(activeCategory === category.slug));
    const symbol = homeIcon(["car", "id", "briefcase", "grid"][index], "category-symbol");
    const heading = createElement("strong", "category-name", copy[category.label]);
    const description = createElement("span", "category-description", descriptions[index]);
    const action = createElement("span", "category-action", count ? `${copy[category.label]} (${count}) →` : `${copy[category.label]} →`);
    button.append(symbol, heading, description, action);
    if (activeCategory === category.slug) {
      const check = createElement("span", "category-selected-check", "✓");
      check.setAttribute("aria-hidden", "true");
      button.append(check);
    }
    button.addEventListener("click", () => {
      activeCategory = activeCategory === category.slug ? "all" : category.slug;
      renderCategories();
      renderCatalog(searchInput?.value || "");
      revealFilteredCatalog();
    });
    categoryRoot.append(button);
  });
}
const filterStatus = document.querySelector("#catalog-filter-status");
const filterName = document.querySelector("#catalog-filter-name");
const filterCount = document.querySelector("#catalog-filter-count");
const filterPrefix = document.querySelector("#catalog-filter-prefix");
const clearFilterButton = document.querySelector("#catalog-clear-filter");
const countryBrowser = document.querySelector(".country-browser");
const filterCopy = {
  en: { showing: "Showing:", exams: "exams", oneExam: "exam", clear: "Clear filter", search: "Search results" },
  fr: { showing: "Affichage :", exams: "examens", oneExam: "examen", clear: "Effacer le filtre", search: "Résultats de recherche" },
  "zh-CN": { showing: "当前筛选：", exams: "项考试", oneExam: "项考试", clear: "清除筛选", search: "搜索结果" },
  "zh-TW": { showing: "目前篩選：", exams: "項考試", oneExam: "項考試", clear: "清除篩選", search: "搜尋結果" }
};
function updateCatalogFilterStatus(count, keyword) {
  if (!filterStatus) return;
  const isFiltered = activeCategory !== "all" || Boolean(keyword);
  filterStatus.hidden = !isFiltered;
  if (!isFiltered) return;
  const copy = filterCopy[lang] || filterCopy.en;
  const category = categoryDefinitions.find(item => item.slug === activeCategory);
  const label = activeCategory === "all" ? copy.search : (homeCopy[lang] || homeCopy.en)[category?.label] || copy.search;
  filterPrefix.textContent = copy.showing;
  filterName.textContent = label;
  filterCount.textContent = `${count} ${count === 1 ? copy.oneExam : copy.exams}`;
  clearFilterButton.textContent = copy.clear;
}
function clearCatalogFilters() {
  activeCategory = "all";
  if (searchInput) searchInput.value = "";
  renderCategories();
  renderCatalog();
}
function revealFilteredCatalog() {
  if (!countryBrowser) return;
  const bounds = countryBrowser.getBoundingClientRect();
  if (bounds.top < 0 || bounds.top > window.innerHeight - 110) {
    countryBrowser.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }
}
clearFilterButton?.addEventListener("click", clearCatalogFilters);
const showAllButton = document.querySelector("#show-all-exams");
showAllButton?.addEventListener("click", () => {
  clearCatalogFilters();
});

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
  updateCatalogFilterStatus(filteredExams.length, keyword);

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

      const regionIcon = homeIcon(region.code === "ALL" ? "landmark" : "pin", "region-svg");
      row.append(regionIcon, regionName, examsContainer);
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



function renderPopular() {
  const container = document.querySelector("#popular-exams");
  if (!container) return;
  container.replaceChildren();
  // Published, localized exams only; no invented test entries or counts.
  const preferred = ["canadian-citizenship", "bc-class-7l", "ontario-g1", "california-cdl"];
  const available = allExams.filter(exam => exam.title && exam.slug);
  available.sort((a, b) => {
    const rank = slug => { const i = preferred.findIndex(part => slug.includes(part)); return i < 0 ? 99 : i; };
    return rank(a.slug) - rank(b.slug);
  });
  for (const exam of available.slice(0, 4)) {
    const card = createElement("article", "popular-card");
    const icon = createElement("span", "popular-icon");
    const isCitizenship = matchesCategory(exam, "immigration-citizenship");
    const isCDL = /(^|[-_])cdl($|[-_])|commercial/i.test(exam.slug);
    icon.classList.add(isCitizenship ? "popular-citizenship" : isCDL ? "popular-cdl" : "popular-driving");
    if (isCitizenship && exam.country_code === "CA") {
      icon.textContent = "🍁";
    } else {
      icon.append(homeIcon(isCitizenship ? "id" : isCDL ? "truck" : "car", "popular-svg"));
    }
    const content = createElement("div", "popular-content");
    const title = createElement("h3", "popular-title");
    title.append(createExamLink(exam));
    const description = createElement("p", "popular-description", exam.description || `${exam.country_name} · ${exam.region_name}`);
    content.append(title, description);
    card.append(icon, content);
    container.append(card);
  }
  document.querySelector(".popular-section").hidden = !available.length;
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
    renderPopular();

    searchInput.addEventListener("input", () => {
      renderCatalog(searchInput.value);
    });
  } catch (error) {
    console.error("Catalog loading failed:", error);
    root.textContent = labels.loadError[lang];
  }
}

init();