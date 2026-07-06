/* 读取 data/<project>.json（由 GitHub Action 定时生成），渲染发布页
   依赖 assets/i18n.js 提供的 t() 函数 */

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 10);
}

function fmtSize(bytes) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? mb.toFixed(1) + ' MB' : (bytes / 1024).toFixed(0) + ' KB';
}

function escapeHtml(str) {
  return (str || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function renderAssetsList(assets, htmlUrl) {
  if (!assets || assets.length === 0) {
    return `<div class="assets"><a href="${htmlUrl}" target="_blank" rel="noopener">${t('view_on_github')} →</a></div>`;
  }
  return `<div class="assets">${assets.map(a =>
    `<div><a href="${a.url}" target="_blank" rel="noopener">${escapeHtml(a.name)}</a> — ${fmtSize(a.size)}</div>`
  ).join('')}</div>`;
}

function renderHero(release) {
  const tag = escapeHtml(release.tag || release.name || '');
  const title = release.name && release.name !== release.tag ? escapeHtml(release.name) : '';
  const date = fmtDate(release.published_at);
  const primaryAsset = release.assets && release.assets[0];
  const downloadHref = primaryAsset ? primaryAsset.url : release.html_url;
  const body = release.body ? escapeHtml(release.body) : t('no_changelog');

  return `
    <p class="eyebrow">${t('latest_release')}</p>
    <h1 class="hero-version">${tag}</h1>
    ${title ? `<p class="hero-title">${title}</p>` : ''}
    <p class="hero-meta">${t('released_on')} ${date}</p>
    <div class="btn-row">
      <a class="btn btn-primary" href="${downloadHref}" target="_blank" rel="noopener">${primaryAsset ? t('download') : t('download_page')}</a>
      <a class="btn btn-ghost" href="${release.html_url}" target="_blank" rel="noopener">${t('view_changelog')}</a>
    </div>
    ${renderAssetsList(release.assets, release.html_url)}
    <div class="body-md">${body}</div>
  `;
}

function renderTimeline(releases) {
  const items = releases.map((r, i) => {
    const tag = escapeHtml(r.tag || r.name || '');
    const title = r.name && r.name !== r.tag ? escapeHtml(r.name) : '';
    const date = fmtDate(r.published_at);
    const body = r.body ? escapeHtml(r.body) : t('no_changelog');
    return `
      <div class="tl-item">
        <div class="tl-row" data-idx="${i}">
          <span class="tl-tag">${tag}</span>
          <span class="tl-date">${date}</span>
          <span class="tl-toggle">${t('expand')}</span>
          ${title ? `<span class="tl-title">${title}</span>` : ''}
        </div>
        <div class="tl-body" id="tl-body-${i}">
          ${body}
          <div class="tl-assets">${(r.assets || []).map(a =>
            `<div><a href="${a.url}" target="_blank" rel="noopener">${escapeHtml(a.name)}</a> — ${fmtSize(a.size)}</div>`
          ).join('') || `<a href="${r.html_url}" target="_blank" rel="noopener">${t('view_on_github')} →</a>`}</div>
        </div>
      </div>
    `;
  }).join('');

  return `<p class="section-label">${t('previous_releases')}</p><div class="timeline">${items}</div>`;
}

function bindToggles() {
  document.querySelectorAll('.tl-row').forEach(row => {
    row.addEventListener('click', () => {
      const idx = row.getAttribute('data-idx');
      const body = document.getElementById(`tl-body-${idx}`);
      const toggle = row.querySelector('.tl-toggle');
      const isOpen = body.classList.toggle('open');
      toggle.textContent = isOpen ? t('collapse') : t('expand');
    });
  });
}

// 加载并渲染指定项目的发布数据
async function loadAndRenderProject(projectKey) {
  const contentEl = document.getElementById('content');
  const updatedEl = document.getElementById('updatedAt');
  contentEl.innerHTML = `<div class="state">${t('loading')}</div>`;

  try {
    const res = await fetch(`data/${projectKey}.json`, { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();

    if (updatedEl && data.updatedAt) {
      updatedEl.textContent = `${t('updated_at')} ${fmtDate(data.updatedAt)}`;
    }

    if (!data.releases || data.releases.length === 0) {
      contentEl.innerHTML = `<div class="state">${t('no_releases')}</div>`;
      return;
    }

    const [latest, ...rest] = data.releases;
    contentEl.innerHTML = renderHero(latest) + (rest.length ? renderTimeline(rest) : '');
    bindToggles();
  } catch (err) {
    contentEl.innerHTML = `<div class="state error">${t('load_error')}</div>`;
  }
}
