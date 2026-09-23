# ObsidianHome

用卡片式主页**完全替换**Obsidian 的新标签页（不再保留原生“创建新文件/打开文件/关闭标签页”按钮）：
- **置顶笔记**：在设置页搜索添加，或在卡片右键菜单里随时置顶/取消置顶
- **最近文件**：默认按**创建时间**排序，可在页面顶部或插件设置里切换为**修改时间**；展示数量、预览行数均可在设置中调整（默认 20 条、2 行预览）
- 每张卡片展示标题、正文预览、时间戳，点击卡片主体在当前标签页打开该文件
- 右下角悬浮按钮新建笔记，遵循 Obsidian「新建文件默认位置」设置
- 全部样式基于 Obsidian 主题 CSS 变量（`--interactive-accent`、`--text-normal` 等），自动跟随你当前的强调色和明暗主题，无需单独配置
- 桌面端 / 移动端通用（仅调用 Obsidian 公共 API，未使用任何 Electron/Node 专属能力）

## 技术说明

- 通过监听工作区叶子、把 Obsidian 内置的 `"empty"`（新标签页）视图转换成插件自己注册的 `ItemView`（`obsidian-home-view`）来接管整个新标签页，原生按钮不再渲染
- 正文预览使用 `vault.cachedRead()`，只读取当前显示的笔记数量，优先走内存缓存，不做全库扫描或 Dataview 式的查询解析，避免 Dataview 在移动端常见的卡顿问题；文件增删改会做 800ms 防抖后才刷新
- 代码按职责拆分：`main.ts`（生命周期与叶子转换）、`homeView.ts`（卡片渲染与交互）、`settingsTab.ts`（设置面板与置顶笔记搜索）、`previewUtils.ts`（预览文本提取，纯函数）

## 安装

### 通过 BRAT 安装（推荐，桌面端 / 移动端通用）

1. 在 Obsidian 社区插件中安装并启用 [BRAT](https://github.com/TfTHacker/obsidian42-brat)
2. BRAT 设置 → **Add Beta plugin** → 填入 `realbuilding/obsidian-home`
3. 在第三方插件列表中启用 “ObsidianHome”

### 手动安装

1. 构建：
   ```bash
   npm install
   npm run build
   ```
2. 将 `manifest.json`、`main.js`、`styles.css` 三个文件复制到 vault 的
   `<你的 vault>/.obsidian/plugins/obsidian-home/` 目录下（没有则新建）。
3. 桌面端：Obsidian 设置 → 第三方插件 → 刷新 → 启用 “ObsidianHome”。
4. 移动端：只需通过你现有的同步方式（iCloud / 坚果云 / Obsidian Sync 等）把上面那个插件目录同步到手机的 vault 里，无需额外打包，然后在手机端设置里启用即可——因为 Obsidian 移动端和桌面端共用同一套插件机制。

## 开发

```bash
npm install
npm run dev   # 监听模式，改动 main.ts 后自动重新编译
```
