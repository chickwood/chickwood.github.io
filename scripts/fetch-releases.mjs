// 读取 config/projects.json 里的项目列表，抓取每个项目的 release 数据，
// 写成 data/<project-key>.json。由 .github/workflows/update-releases.yml 调用。
// 依赖 Node 18+ 内置的 fetch，不需要额外安装依赖。

import { readFile, writeFile, mkdir } from 'fs/promises';

const projects = JSON.parse(await readFile('config/projects.json', 'utf-8'));

const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error('缺少 GITHUB_TOKEN，无法读取私有仓库的 release 数据');
  process.exit(1);
}

const headers = {
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
};
const outputFiles = new Map();
let hasErrors = false;

for (const project of projects) {
  const { key, owner, repo } = project;
  const url = `https://api.github.com/repos/${owner}/${repo}/releases`;

  try {
    const res = await fetch(url, { headers });

    if (!res.ok) {
      console.error(`[${key}] 请求失败：${owner}/${repo} → HTTP ${res.status}`);
      hasErrors = true;
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

    outputFiles.set(
      `data/${key}.json`,
      JSON.stringify({ updatedAt: new Date().toISOString(), releases: simplified }, null, 2)
    );

    console.log(`[${key}] 已获取 ${simplified.length} 个 release`);
  } catch (err) {
    console.error(`[${key}] 出错：${err.message}`);
    hasErrors = true;
  }
}

if (hasErrors) {
  console.error('部分项目抓取失败，已保留现有 data 文件');
  process.exitCode = 1;
} else {
  await mkdir('data', { recursive: true });
  for (const [file, content] of outputFiles) {
    await writeFile(file, content);
    console.log(`已写入 ${file}`);
  }
}
