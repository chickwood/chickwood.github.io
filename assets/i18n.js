/* 简单的三语支持：中(简) / 日 / 英
   - 自动根据浏览器语言选择
   - 支持手动切换，选择会记住（localStorage）
   - 只翻译界面文案；release 的更新说明正文不翻译 */

const SUPPORTED_LOCALES = ['zh-CN', 'ja', 'en'];
const LOCALE_LABELS = { 'zh-CN': '中文', 'ja': '日本語', 'en': 'English' };

function detectLocale() {
  const stored = localStorage.getItem('site-locale');
  if (stored && SUPPORTED_LOCALES.includes(stored)) return stored;

  const nav = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
  if (nav.startsWith('zh')) return 'zh-CN';
  if (nav.startsWith('ja')) return 'ja';
  return 'en';
}

let currentLocale = detectLocale();
let strings = {};

async function loadStrings() {
  const res = await fetch('i18n/strings.json');
  const all = await res.json();
  strings = {};
  for (const key in all) {
    strings[key] = all[key][currentLocale] || all[key]['en'] || key;
  }
}

function t(key) {
  return strings[key] || key;
}

// 从多语字段对象里取当前语言（用于 projects.json 里的 name/description）
function tField(field) {
  if (!field) return '';
  return field[currentLocale] || field['en'] || Object.values(field)[0] || '';
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.documentElement.lang = currentLocale;
  renderLangSwitcher();
}

function renderLangSwitcher() {
  const mount = document.getElementById('langSwitcher');
  if (!mount) return;
  mount.innerHTML = SUPPORTED_LOCALES.map(loc =>
    `<button class="lang-btn ${loc === currentLocale ? 'active' : ''}" data-locale="${loc}">${LOCALE_LABELS[loc]}</button>`
  ).join('');
  mount.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      currentLocale = btn.getAttribute('data-locale');
      localStorage.setItem('site-locale', currentLocale);
      await loadStrings();
      applyI18n();
      if (typeof onLocaleChange === 'function') onLocaleChange();
    });
  });
}

// 页面初始化：加载字典 + 应用文案。返回 currentLocale 供页面自身逻辑使用。
async function initI18n() {
  await loadStrings();
  applyI18n();
  return currentLocale;
}
