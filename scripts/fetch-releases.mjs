// 读取 config/projects.json 里的项目列表，抓取每个项目的 release 数据，
// 写成 data/<project-key>.json。由 .github/workflows/update-releases.yml 定时调用。
// 依赖 Node 18+ 内置的 fetch，不需要额外安装依赖。

import { readFile, writeFile, mkdir } from 'fs/promises';

const projects = JSON.parse(await readFile('config/projects.json', 'utf-8'));

await mkdir('data', { recursive: true });

const headers = { Accept: 'application/vnd.github+json' };
if (process.env.GITHUB_TOKEN) {
  headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}

for (const project of projects) {
  const { key, owner, repo } = project;
  const url = `https://api.github.com/repos/${owner}/${repo}/releases`;

  try {
    const res = await fetch(url, { headers });

    if (!res.ok) {
      console.error(`[${key}] 请求失败：${owner}/${repo} → HTTP ${res.status}`);
      await writeFile(
        `data/${key}.json`,
        JSON.stringify({ updatedAt: new Date().toISOString(), error: `HTTP ${res.status}`, releases: [] }, null, 2)
      );
      continue;
    }

    const releases = await res.json();

    const simplified = releases.map(r => ({
      tag: r.tag_name,
      name: r.name,
      body: r.body,
      published_at: r.published_at || r.created_at,
      html_url: r.html_url,
      assets: (r.assets || []).map(a => ({
        name: a.name,
        size: a.size,
        url: a.browser_download_url,
      })),
    }));

    await writeFile(
      `data/${key}.json`,
      JSON.stringify({ updatedAt: new Date().toISOString(), releases: simplified }, null, 2)
    );

    console.log(`[${key}] 已写入 data/${key}.json（${simplified.length} 个 release）`);
  } catch (err) {
    console.error(`[${key}] 出错：${err.message}`);
  }
}
