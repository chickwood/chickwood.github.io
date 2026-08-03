/* 简单的三语支持：中(简) / 日 / 英
   - 自动根据浏览器语言选择
   - 支持手动切换，选择会记住（localStorage）
   - 只翻译界面文案；release 的更新说明正文不翻译 */

const LOCALES = [
  { code: 'zh-CN', short: '汉', full: '简体中文' },
  { code: 'ja', short: 'あ', full: '日本語' },
  { code: 'en', short: 'Aa', full: 'English' },
];

function detectLocale() {
  const stored = localStorage.getItem('site-locale');
  if (stored && LOCALES.some(l => l.code === stored)) return stored;

  const nav = (navigator.language || 'en').toLowerCase();
  if (nav.startsWith('zh-cn') || nav.startsWith('zh-hans')) return 'zh-CN';
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

function closeLangMenu() {
  const mount = document.getElementById('langSwitcher');
  if (!mount) return;
  const menu = mount.querySelector('.lang-menu');
  const trigger = mount.querySelector('.lang-trigger');
  if (menu) menu.hidden = true;
  if (trigger) {
    trigger.setAttribute('aria-expanded', 'false');
    const arrow = trigger.querySelector('.lang-trigger-arrow');
    if (arrow) arrow.textContent = '▾';
  }
}

let _langOutsideClickBound = false;

function renderLangSwitcher() {
  const mount = document.getElementById('langSwitcher');
  if (!mount) return;

  const order = [
    ...LOCALES.filter(l => l.code === currentLocale),
    ...LOCALES.filter(l => l.code !== currentLocale),
  ];

  mount.innerHTML = `
    <button class="lang-trigger" type="button" aria-expanded="false">
      <img src="https://api.iconify.design/mdi/language.svg?color=%236B7076" width="16" height="16" alt="">
      <span class="lang-trigger-arrow">▾</span>
    </button>
    <ul class="lang-menu" hidden>
      ${order.map(l => `<li><button class="lang-option ${l.code === currentLocale ? 'active' : ''}" type="button" data-locale="${l.code}">${l.full}</button></li>`).join('')}
    </ul>
  `;

  const trigger = mount.querySelector('.lang-trigger');
  const menu = mount.querySelector('.lang-menu');

  trigger.addEventListener('click', e => {
    e.stopPropagation();
    if (menu.hidden) {
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      trigger.querySelector('.lang-trigger-arrow').textContent = '▴';
    } else {
      closeLangMenu();
    }
  });

  mount.querySelectorAll('.lang-option').forEach(btn => {
    btn.addEventListener('click', async () => {
      const loc = btn.getAttribute('data-locale');
      closeLangMenu();
      if (loc === currentLocale) return;
      currentLocale = loc;
      localStorage.setItem('site-locale', currentLocale);
      await loadStrings();
      applyI18n();
      if (typeof onLocaleChange === 'function') onLocaleChange();
    });
  });

  if (!_langOutsideClickBound) {
    document.addEventListener('click', e => {
      const m = document.getElementById('langSwitcher');
      if (m && !m.contains(e.target)) closeLangMenu();
    });
    _langOutsideClickBound = true;
  }
}

// 页面初始化：加载字典 + 应用文案。返回 currentLocale 供页面自身逻辑使用。
async function initI18n() {
  await loadStrings();
  applyI18n();
  return currentLocale;
}
