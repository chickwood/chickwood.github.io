# 多项目 Release 发布站

纯静态站点，支持：
- 可配置多个项目的项目菜单
- 每个项目独立的 release 发布页
- 中(简)/日/英三语界面，根据浏览器语言自动切换，也可手动切换并记住选择
- release 数据由 **GitHub Actions 任务**抓取并写成静态 JSON，页面本身不直接调用 GitHub API

## 1. 配置项目

项目配置分成两类文件：

- `config/list.json` —— 项目**清单**，决定首页展示哪些项目以及它们的顺序（**数组顺序即展示顺序**）。每个条目只需 `key`、`name`、`description`：

```json
[
  {
    "key": "project-a",
    "name": { "zh-CN": "项目 A", "en": "Project A", "ja": "プロジェクト A" },
    "description": { "zh-CN": "...", "en": "...", "ja": "..." }
  }
]
```

- `config/config.<key>.json` —— 单个项目的详细配置，文件名里的 `<key>` 与清单中的 `key` 一致（如 `key: "project-a"` 对应 `config/config.project-a.json`）。内容为 `owner`、`repo`、`additionalDescription`、`gallery`，**不再写 `key`**（由文件名推导）：

```json
{
  "owner": "your-username",
  "repo": "your-repo-a",
  "additionalDescription": { "zh-CN": "", "en": "...", "ja": "" },
  "gallery": { "zh-CN": [], "en": [], "ja": [] }
}
```

- `key` 也要与 `data/` 目录下对应的数据文件名一致（比如 `key: "project-a"` 对应 `data/data.project-a.json`），该文件由更新任务自动生成
- 添加项目：在清单数组里增加一条（`key` / `name` / `description`），再新建对应的 `config/config.<key>.json`。首次成功运行更新任务后，会自动生成 `data/data.<key>.json`

## 2. 本地预览

**不能直接双击打开 `index.html`**：页面读取本地 `data/data.*.json` 和 `config/*.json` ，浏览器出于安全限制，不允许 `file://` 页面用 `fetch` 读取本地文件（会报 CORS 或跨域错误），必须启动一个本地HTTP服务器。

Python：

```bash
cd release-site
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

或者 Node：

```bash
npx serve .
```

或者其他 Nginx、Apache HTTPd 均可。

`data/` 目录保存最近一次任务生成的 release 数据（`data/data.<key>.json`），因此本地预览不需要直接访问 GitHub API。

## 3. 手动更新私有仓库的 release 数据

当前可以通过 release-site 仓库的 `workflow_dispatch` 手动更新所有项目。由于源项目是私有仓库，需要先配置一个只读的 Fine-grained personal access token。

### 3.1 在 GitHub 账户设置中创建 Token

1. 打开 GitHub 右上角头像 → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
2. `Repository access` 选择 **Only select repositories**
3. 勾选所有需要读取 release 的私有源项目仓库
4. 在 `Repository permissions` 中将 **Contents** 设置为 **Read-only**
5. 生成后立即复制 Token

Token name 只用于账户内识别，例如可填写 `release-site-read-releases`。

### 3.2 在 release-site 仓库中添加 Secret

1. 进入 release-site 仓库 → **Settings → Secrets and variables → Actions**
2. 在 `Repository secrets` 中选择 **New repository secret**
3. Name 填写 `RELEASES_READ_TOKEN`
4. Secret 粘贴上一步生成的 Token

设置完成后，进入 release-site 仓库的 **Actions → Update release data → Run workflow**，即可手动抓取数据。抓取步骤通过以下配置读取该 Secret：

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.RELEASES_READ_TOKEN }}
```

## 4. 让项目发布 release 时自动触发更新

`.github/workflows/update-releases.yml` 现在有多种触发方式：

- **定时触发**：`schedule` 默认已经注释，取消注释即可恢复
- **手动触发**：Actions 标签页点 "Run workflow"
- **被动触发**：收到 `repository_dispatch` 事件（`release-published`）时自动跑

要让源项目发布 release 时主动通知 release-site 更新，需要在**每个源项目仓库**里配置：

1. 把 `templates/notify-release-site.yml` 复制到项目仓库的 `.github/workflows/` 目录下
2. 文件里把 `REPO_OWNER/SITE_REPO` 换成发布页仓库的实际路径（比如 `your-username/release-site`）
3. 按文件末尾"关于 Token"的步骤，生成一个 Fine-grained token，加到项目仓库的 secret `SITE_DISPATCH_TOKEN` 里
4. 在其他源项目仓库中重复以上设置（token 可以复用）

配置完之后，任何一个项目发布新 release，都会自动触发发布页仓库重新抓取数据、更新页面，不用再手动点或者等定时任务。

## 5. 开启定时任务（可选，GitHub Actions）

定时任务当前默认关闭。需要启用时，取消 `.github/workflows/update-releases.yml` 中 `schedule` 部分的注释：

```yaml
schedule:
  - cron: '0 */6 * * *'   # 每 6 小时；改成 '0 0 * * *' 就是每天一次（UTC 时间）
```

cron 使用 UTC 时间。启用并推送后，任务才会按配置的时间运行；在此之前只会响应手动触发或 `repository_dispatch`。

仓库的 **Settings → Actions → General → Workflow permissions** 需要允许工作流写入仓库，否则任务无法提交更新后的 `data/`。

## 6. 部署到 GitHub Pages

仓库 **Settings → Pages**，选择对应分支/目录作为发布源即可。访问地址形如：

```
https://<你的用户名>.github.io/<仓库名>/
```

## TODO

- 按项目增量更新：收到 `repository_dispatch` 后，根据 `client_payload.source_repo` 找到对应的 `config/config.<key>.json`，只抓取并改写对应的 `data/data.<key>.json`；手动执行 `workflow_dispatch` 时仍保留全量更新。由于所有任务最终都会向同一仓库分支提交，需要使用全局 `concurrency` 让更新任务串行执行，避免并发 push 冲突。
- 限制历史版本数量：不再依赖 GitHub API 默认的第一页数量，而是明确只获取最新 5 个或 10 个 release（具体数量待定）；如果存在更早版本，在发布页底部显示一个 `View on GitHub` 链接，引导用户前往 GitHub 查看完整历史。

## 关于翻译范围

- 按你的要求，**只有界面文案（按钮、标签、提示语等）是三语的**，字典在 `i18n/i18n.json` 里，要加新文案就在这个文件里加一个 key，三种语言都填上，然后在 HTML 里给元素加 `data-i18n="你的key"`
- `config/config.<key>.json` 里的 `gallery` 字段是每个项目的截图画廊：**按语言分数组**，每种语言下是一个图片对象数组，每个对象包含 `src`（图片路径）和 `caption`（说明文字）。格式：

  ```json
  "gallery": {
    "zh-CN": [
      { "src": "images/example-project/1-zh-CN.png", "caption": "主界面" },
      { "src": "images/example-project/2-zh-CN.png", "caption": "设置" }
    ],
    "en": [
      { "src": "images/example-project/1-en.png", "caption": "Dashboard" },
      { "src": "images/example-project/2-en.png", "caption": "Settings" }
    ],
    "ja": [
      { "src": "images/example-project/1-ja.png", "caption": "ダッシュボード" },
      { "src": "images/example-project/2-ja.png", "caption": "設定" }
    ]
  }
  ```

  用户切换语言时，图片和说明文字会一起换成对应语言的版本。页面渲染时会取 `gallery[当前语言]`，如果当前语言没有对应数组，则回退到 `gallery.en`。不同语言的截图数量可以不同（例如某功能在某语言下不需要展示）。每个项目的图片建议放在独立的 `images/<project-key>/` 目录中，文件名可以自行确定，只需让 `src` 与实际路径一致。想加减截图数量，直接在对应语言的数组里加减条目（建议 2~7 张）。

  `gallery` 是**可空**的：整个字段不写，或某种语言的数组为空，页面都不会报错——没有图片时整个截图区块会自动隐藏（整体缺失时按 `en` 回退，仍为空则隐藏）。

- `config/config.<key>.json` 里的 `additionalDescription` 字段是项目简介下方的补充说明（例如"车站名称仅提供日文"）：同样**按语言分字段**，但渲染时**只取当前语言、不回退到英文**，因此可以按语言留空。格式：

  ```json
  "additionalDescription": {
    "zh-CN": "",
    "ja": "",
    "en": "Station names are available in Japanese only."
  }
  ```

  `additionalDescription` 也是**可空**的：整个字段不写，或当前语言为空字符串，该行都会自动隐藏。

- **release 的更新说明正文不做翻译**，原样显示 GitHub Release 里写的内容
- 项目名称、项目简介（`config/list.json` 清单里的 `name` / `description`）也是按语言分字段的，需要手动维护三份

## 目录说明

```
release-site/
├── index.html                      # 项目菜单
├── release.html                    # 单个项目的发布页（?project=key）
├── config/list.json                 # 项目清单（key / name / description，数组顺序即展示顺序）
├── config/config.<key>.json         # 单个项目的详细配置（owner / repo / additionalDescription / gallery）
├── data/data.<key>.json             # release 数据（由 Action 自动生成，不用手动改）
├── i18n/i18n.json                  # 三语界面文案字典
├── assets/style.css                # 共享样式
├── assets/i18n.js                  # 语言检测 / 切换逻辑
├── assets/render.js                # 发布页渲染逻辑
├── scripts/fetch-releases.mjs      # 任务实际跑的抓取脚本
├── templates/notify-release-site.yml   # 复制到各项目仓库，让它们发布 release 时通知网页更新
└── .github/workflows/update-releases.yml   # 更新数据的 workflow（可选定时 / 手动 / 被通知）
```
