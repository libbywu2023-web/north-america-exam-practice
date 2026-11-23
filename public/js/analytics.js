/* ExamHere analytics: opt-in only, no analytics cookies before consent. */
(() => {
  'use strict';
  const MEASUREMENT_ID = 'G-Q934DZDFSF';
  const STORAGE_KEY = 'examhere.analytics.consent.v2';
  const REGION_KEY = 'examhere.analytics.region.v1';
  const labels = {
    en: { message: 'May we use Google Analytics cookies to understand visits and improve ExamHere?', accept: 'Accept analytics', reject: 'Reject', settings: 'Cookie settings', policy: 'Privacy Policy' },
    fr: { message: 'Autorisez-vous les cookies Google Analytics pour améliorer ExamHere ?', accept: 'Accepter', reject: 'Refuser', settings: 'Paramètres des cookies', policy: 'Confidentialité' },
    'zh-CN': { message: '是否允许使用 Google Analytics Cookie 统计访问情况，以帮助改进 ExamHere？', accept: '同意统计', reject: '拒绝', settings: 'Cookie 设置', policy: '隐私政策' },
    'zh-TW': { message: '是否允許使用 Google Analytics Cookie 統計造訪情況，以協助改善 ExamHere？', accept: '同意統計', reject: '拒絕', settings: 'Cookie 設定', policy: '隱私政策' }
  };
  function language() {
    const path = location.pathname.toLowerCase();
    if (path === '/fr' || path.startsWith('/fr/')) return 'fr';
    if (path === '/zh' || path.startsWith('/zh/')) return 'zh-CN';
    if (path === '/zh-tw' || path.startsWith('/zh-tw/')) return 'zh-TW';
    const select = document.querySelector('#language');
    return labels[select?.value] ? select.value : 'en';
  }
  function readConsent() {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  }
  function writeConsent(value) {
    try { localStorage.setItem(STORAGE_KEY, value); } catch { /* unavailable storage: consent lasts for this page only */ }
  }
  let loaded = false;
  function loadAnalytics() {
    if (loaded) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    // No automatic page view: record the actual URL once per full document load.
    window.gtag('config', MEASUREMENT_ID, { send_page_view: false });
    window.gtag('event', 'page_view', {
      page_location: location.href,
      page_title: document.title,
      page_path: location.pathname + location.search
    });
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(MEASUREMENT_ID);
    document.head.appendChild(script);
  }
  async function getRegion() {
    try {
      const cached = sessionStorage.getItem(REGION_KEY);
      if (cached === 'opt-in' || cached === 'notice' || cached === 'unknown') return cached;
    } catch { /* storage unavailable */ }
    try {
      const response = await fetch('/api/privacy-region', { credentials: 'same-origin' });
      if (!response.ok) return 'unknown';
      const data = await response.json();
      const region = ['opt-in', 'notice'].includes(data.region) ? data.region : 'unknown';
      try { sessionStorage.setItem(REGION_KEY, region); } catch { /* unavailable */ }
      return region;
    } catch { return 'unknown'; }
  }
  async function render() {
    const region = await getRegion();
    const mustOptIn = region !== 'notice';
    const initialChoice = readConsent();
    const l = labels[language()];
    const settings = document.createElement('button');
    settings.type = 'button';
    settings.textContent = l.settings;
    settings.className = 'examhere-cookie-settings';
    settings.addEventListener('click', () => { banner.hidden = false; });
    const banner = document.createElement('div');
    banner.className = 'examhere-cookie-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', l.settings);
    const message = document.createElement('p');
    message.textContent = l.message + ' ';
    const policy = document.createElement('a');
    policy.href = '/privacy';
    policy.textContent = l.policy;
    message.appendChild(policy);
    const actions = document.createElement('div');
    actions.className = 'examhere-cookie-actions';
    for (const [value, text] of [['rejected', l.reject], ['accepted', l.accept]]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = text;
      button.addEventListener('click', () => {
        writeConsent(value);
        banner.hidden = true;
        if (value === 'accepted') loadAnalytics();
        else if (loaded) location.reload(); // stop further GA4 collection after withdrawal
      });
      actions.appendChild(button);
    }
    banner.append(message, actions);
    document.body.append(settings, banner);
    banner.hidden = !mustOptIn || initialChoice === 'accepted' || initialChoice === 'rejected';
    // In notice regions, GA4 is enabled unless the visitor opted out.
    // Unknown locations are treated conservatively as opt-in.
    if (initialChoice === 'accepted' || (!mustOptIn && initialChoice !== 'rejected')) loadAnalytics();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, { once: true });
  else render();
})();
