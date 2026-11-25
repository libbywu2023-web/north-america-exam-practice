import { homeCopy, homeIconPaths, categoryDescriptions, labels, getCountryFlag, categoryDefinitions, matchesCategory, categoryCount } from '../public/js/home-shared.js';

// Same catalog and presentation classes as the interactive homepage.
export function renderHome(html, lang, exams, path, escape) {
  const copy = homeCopy[lang] || homeCopy.en;
  const icon = (name, cls) => `<span class="home-svg-icon ${cls}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" focusable="false">${homeIconPaths[name]}</svg></span>`;
  const link = e => `<a class="catalog-exam-link" href="${escape(path(lang, encodeURIComponent(e.slug)))}">${escape(e.title)}${Number(e.show_new_badge) === 1 ? '&nbsp;<span class="catalog-new-badge">NEW</span>' : ''}</a>`;
  const categories = categoryDefinitions.slice(1).map((c,i) => {
    const count = exams.filter(e => matchesCategory(e,c.slug)).length;
    return `<a class="category-filter" href="${path(lang,['driving-tests','citizenship-tests','professional-certification','other-exams'][i])}" data-category="${c.slug}">${icon(['car','id','briefcase','grid'][i],'category-symbol')}<span class="category-count">${escape(categoryCount(lang,count))}</span><strong class="category-name">${escape(copy[c.label])}</strong><span class="category-description">${escape(categoryDescriptions[lang][i])}</span><span class="category-action">${escape(copy.viewExams)}</span></a>`;
  }).join('');
  const countries = new Map();
  for (const e of exams) {
    if (!countries.has(e.country_code)) countries.set(e.country_code,{name:e.country_name,regions:new Map()});
    const c = countries.get(e.country_code);
    if (!c.regions.has(e.region_code)) c.regions.set(e.region_code,{name:e.region_name,exams:[]});
    c.regions.get(e.region_code).exams.push(e);
  }
  const catalog = [...countries].map(([code,c]) => `<section class="catalog-country"><h2 class="catalog-country-title">${getCountryFlag(code)} ${escape(c.name)}</h2>${[...c.regions].map(([region,r]) => `<div class="catalog-region-row">${icon(region==='ALL'?'landmark':'pin','region-svg')}<div class="catalog-region-name">${escape(region==='ALL'?({'zh-CN':'全国','zh-TW':'全國'}[lang]||'National'):r.name)}</div><div class="catalog-region-exams">${r.exams.map(e=>`<div class="catalog-exam-item">${link(e)}</div>`).join('')}</div></div>`).join('')}</section>`).join('') + (exams.length ? `<section class="catalog-country catalog-other-countries"><h2 class="catalog-country-title">🌎 ${escape(labels.otherCountries[lang])}</h2><p class="catalog-other-description">${escape(labels.otherCountriesDescription[lang])}</p></section>` : `<p class="catalog-empty">${escape(labels.noResults[lang])}</p>`);
  const preferred = ['canadian-citizenship','bc-class-7l','ontario-g1','california-cdl'];
  const rank = slug => {const i=preferred.findIndex(p=>slug.includes(p));return i<0?99:i;};
  const popular = exams.filter(e=>e.title&&e.slug).sort((a,b)=>rank(a.slug)-rank(b.slug)).slice(0,4).map(e=>{
    const citizenship=matchesCategory(e,'immigration-citizenship'), cdl=/(^|[-_])cdl($|[-_])|commercial/i.test(e.slug);
    return `<article class="popular-card"><span class="popular-icon ${citizenship?'popular-citizenship':cdl?'popular-cdl':'popular-driving'}">${citizenship&&e.country_code==='CA'?'🍁':icon(citizenship?'id':cdl?'truck':'car','popular-svg')}</span><div class="popular-content"><h3 class="popular-title">${link(e)}</h3><p class="popular-description">${escape(e.description||`${e.country_name} · ${e.region_name}`)}</p></div></article>`;
  }).join('');
  // Escape '<' so database text cannot terminate the inert JSON script.
  const snapshot = JSON.stringify({lang,exams}).replace(/</g,'\\u003c');
  return html.replace(/(<div id="category-filters"[^>]*>)[\s\S]*?<\/div>/,(_,open)=>open+categories+'</div>')
    .replace(/(<div id="catalog"[^>]*>)[\s\S]*?<\/div>/,(_,open)=>open+catalog+'</div>')
    .replace('<div id="popular-exams" class="popular-grid"></div>',()=>`<div id="popular-exams" class="popular-grid">${popular}</div>`)
    .replace(/(<([a-z][\w-]*)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>)[^<]*(<\/\2>)/g,(full,open,tag,key,close)=>copy[key]?open+escape(copy[key])+close:full)
    .replace(/(<[^>]*data-i18n-placeholder="([^"]+)"[^>]*>)/g,(full,tag,key)=>copy[key]?tag.replace(/placeholder="[^"]*"/,()=>`placeholder="${escape(copy[key])}"`):full)
    .replace('Global Exam Practice</span>',()=>escape(({en:'Global Exam Practice',fr:'Préparation aux examens','zh-CN':'全球考试练习平台','zh-TW':'全球考試練習平台'})[lang])+'</span>')
    .replace(`<option value="${lang}">`,`<option value="${lang}" selected>`)
    .replace('<section class="popular-section"', popular ? '<section class="popular-section"' : '<section hidden class="popular-section"')
    .replace('</body>',()=>`<script type="application/json" id="home-catalog-data">${snapshot}</script></body>`);
}
