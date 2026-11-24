import { homeCopy, homeIconPaths, categoryDescriptions, labels, getCountryFlag, categoryDefinitions, matchesCategory } from "./home-shared.js";
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

let allExams = [];
let activeCategory = "all";
const categoryRoot = document.querySelector("#category-filters");
function renderCategories() {
  if (!categoryRoot) return;
  categoryRoot.replaceChildren();
  const copy = homeCopy[lang] || homeCopy.en;
  const descriptions = categoryDescriptions[lang] || categoryDescriptions.en;
  categoryDefinitions.slice(1).forEach((category, index) => {
    const count = allExams.filter(exam => matchesCategory(exam, category.slug)).length;
    const button = createElement("a", "category-filter");
    const prefix = { en: "", fr: "/fr", "zh-CN": "/zh", "zh-TW": "/zh-tw" }[lang] || "";
    button.href = `${prefix}/${["driving-tests", "citizenship-tests", "professional-certification", "other-exams"][index]}`;
    button.dataset.category = category.slug;
    const symbol = homeIcon(["car", "id", "briefcase", "grid"][index], "category-symbol");
    const heading = createElement("strong", "category-name", copy[category.label]);
    const description = createElement("span", "category-description", descriptions[index]);
    const action = createElement("span", "category-action", count ? `${copy[category.label]} (${count}) →` : `${copy[category.label]} →`);
    button.append(symbol, heading, description, action);
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
  document.querySelector("#country-heading")?.focus({ preventScroll: true });
  countryBrowser?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
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

  if (lang === 'fr') link.href = `/fr/${slug}`;
  else if (lang === 'zh-CN') link.href = `/zh/${slug}`;
  else if (lang === 'zh-TW') link.href = `/zh-tw/${slug}`;
  else link.href = `/${slug}`;

  // NEW is controlled manually in the exam admin settings.
  if (Number(exam.show_new_badge) === 1) {
    const badge = createElement("span", "catalog-new-badge", "NEW");
    link.append(document.createTextNode("\u00a0"), badge);
  }
  return link;
}

function appendExamLinks(container, exams) {
  exams.forEach(exam => {
    const item = createElement("div", "catalog-exam-item");
    item.append(createExamLink(exam));
    container.append(item);
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
    const flag = getCountryFlag(country.code);

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
  try {
    const snapshot = document.querySelector("#home-catalog-data");
    const data = snapshot ? JSON.parse(snapshot.textContent) : null;
    const result = data?.lang === lang && Array.isArray(data.exams)
      ? data : await api(`/api/catalog?lang=${encodeURIComponent(lang)}`);
    allExams = result.exams || [];
    renderCategories();
    renderCatalog(searchInput.value);
    renderPopular();
    searchInput.addEventListener("input", () => renderCatalog(searchInput.value));
  } catch (error) {
    console.error("Catalog loading failed:", error);
    if (!root.querySelector(".catalog-country")) root.textContent = labels.loadError[lang];
  }
}

init();
