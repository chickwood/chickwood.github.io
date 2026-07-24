# 多项目 Release 发布站

纯静态站点，支持：
- 项目菜单（当前配了占位项目，可以加更多）
- 每个项目独立的 release 发布页
- 中(简)/日/英三语界面，根据浏览器语言自动切换，也可手动切换并记住选择
- release 数据由 **GitHub Actions 任务**抓取并写成静态 JSON，页面本身不直接调用 GitHub API

## 1. 配置项目

打开 `config/projects.json`，把占位项目改成自己的：

- `key`：内部标识，需要与 `data/` 中的文件名对应
- `owner`：GitHub 用户名或组织名
- `repo`：GitHub 仓库名

```json
{
  "key": "project-a",
  "owner": "your-username",
  "repo": "your-repo-a",
  "name": { "zh-CN": "项目 A", "en": "Project A", "ja": "プロジェクト A" },
  "description": { "zh-CN": "...", "en": "...", "ja": "..." }
}
```

- `key` 要和 `data/` 目录下对应的 JSON 文件名一致（比如 `key: "project-a"` 对应 `data/project-a.json`）
- 如果要加第三个、第四个项目，在数组里多加一项，`data/` 里对应加一个空的占位 JSON 就行（格式参考已有文件），第一次跑完 Action 后会自动填上真实数据

## 2. 本地预览

**不能直接双击打开 `index.html`**：页面读取本地 `data/*.json` ，浏览器出于安全限制，不允许 `file://` 页面用 `fetch` 读取本地文件（会报 CORS 或跨域错误），必须启动一个本地HTTP服务器。

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

`data/` 目录里已经放了示例数据，本地打开就能直接看到效果，正式跑起任务后会被真实数据覆盖。

## 3. 让项目发布 release 时自动触发更新

`.github/workflows/update-releases.yml` 现在有多种触发方式：

- **定时触发**：`schedule` 默认已经注释，取消注释即可恢复
- **手动触发**：Actions 标签页点 "Run workflow"
- **被动触发**：收到 `repository_dispatch` 事件（`release-published`）时自动跑

要让 project-a、project-b 发布 release 时"喊一声"通知这边更新，需要在**每个项目仓库**里配置：

1. 把 `templates/notify-release-site.yml` 复制到项目仓库的 `.github/workflows/` 目录下
2. 文件里把 `REPO_OWNER/SITE_REPO` 换成发布页仓库的实际路径（比如 `your-username/release-site`）
3. 按文件末尾"关于 Token"的步骤，生成一个 Fine-grained token，加到项目仓库的 secret `SITE_DISPATCH_TOKEN` 里
4. project-a、project-b 都各自加一遍（token 可以复用同一个）

配置完之后，任何一个项目发布新 release，都会自动触发发布页仓库重新抓取数据、更新页面，不用再手动点或者等定时任务。

## 4. 开启定时任务（可选，GitHub Actions）

1. 把整个 `release-site` 目录内容推到你的 GitHub Pages 仓库
2. 进入仓库 **Settings → Actions → General → Workflow permissions**，选择 **Read and write permissions**（否则 Action 无法把抓到的数据提交回仓库）
3. 推送后，Action 会按 `.github/workflows/update-releases.yml` 里配置的时间自动跑（默认每 6 小时一次），也可以在 **Actions** 标签页手动点 **Run workflow** 立即触发
4. 想改频率，改这个文件里的 cron 表达式：

   ```yaml
   schedule:
     - cron: '0 */6 * * *'   # 每 6 小时；改成 '0 0 * * *' 就是每天一次（UTC 时间）
   ```

## 5. 部署到 GitHub Pages

仓库 **Settings → Pages**，选择对应分支/目录作为发布源即可。访问地址形如：

```
https://<你的用户名>.github.io/<仓库名>/
```

## TODO

- 按项目增量更新：收到 `repository_dispatch` 后，根据 `client_payload.source_repo` 只抓取并改写对应的 `data/<key>.json`；手动执行 `workflow_dispatch` 时仍保留全量更新。由于所有任务最终都会向同一仓库分支提交，需要使用全局 `concurrency` 让更新任务串行执行，避免并发 push 冲突。
- 限制历史版本数量：不再依赖 GitHub API 默认的第一页数量，而是明确只获取最新 5 个或 10 个 release（具体数量待定）；如果存在更早版本，在发布页底部显示一个 `View on GitHub` 链接，引导用户前往 GitHub 查看完整历史。

## 关于翻译范围

- 按你的要求，**只有界面文案（按钮、标签、提示语等）是三语的**，字典在 `i18n/strings.json` 里，要加新文案就在这个文件里加一个 key，三种语言都填上，然后在 HTML 里给元素加 `data-i18n="你的key"`
- `config/projects.json` 里的 `gallery` 字段是每个项目的截图画廊：每张图的**图片本身和说明文字都是按语言分的**，格式：

  ```json
  {
    "src": { "zh-CN": "images/project-a/1-zh-CN.svg", "en": "images/project-a/1-en.svg", "ja": "images/project-a/1-ja.svg" },
    "caption": { "zh-CN": "主界面", "en": "Dashboard", "ja": "ダッシュボード" }
  }
  ```

  用户切换语言时，图片和说明文字会一起换成对应语言的版本。把 `images/project-a/`、`images/project-b/` 里的占位 SVG 换成真实的三语截图即可，文件名可以自己定，改好路径对应上 `src` 就行。想加减截图数量，直接在 `gallery` 数组里加减条目（建议 2~5 张）。

- **release 的更新说明正文不做翻译**，原样显示 GitHub Release 里写的内容
- 项目名称、项目简介（`config/projects.json` 里的 `name` / `description`）也是按语言分字段的，需要手动维护三份

## 目录说明

```
release-site/
├── index.html                      # 项目菜单
├── release.html                    # 单个项目的发布页（?project=key）
├── config/projects.json            # 项目列表配置
├── data/*.json                     # release 数据（由 Action 自动生成，不用手动改）
├── i18n/strings.json               # 三语界面文案字典
├── assets/style.css                # 共享样式
├── assets/i18n.js                  # 语言检测 / 切换逻辑
├── assets/render.js                # 发布页渲染逻辑
├── scripts/fetch-releases.mjs      # 任务实际跑的抓取脚本
├── templates/notify-release-site.yml   # 复制到各项目仓库，让它们发布 release 时通知网页更新
└── .github/workflows/update-releases.yml   # 更新数据的 workflow（可选定时 / 手动 / 被通知）
```
