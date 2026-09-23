# AGENTS.md

本文件面向在本仓库中工作的 AI 编码助手与贡献者。

## ⚠️ 这是公开仓库

本仓库在 GitHub 上公开：<https://github.com/realbuilding/obsidian-home>。所有提交、Issue、Release 说明都对任何人可见，推送后即使删除也可能已被缓存或索引。

提交前必须确认：

- **不要提交任何隐私或敏感信息**：个人邮箱、手机号、真实姓名等身份信息、本机绝对路径（如 `/Users/<name>/...`）、token / API Key / 密码。
- **不要提交任何 vault 内容**：笔记正文、笔记文件名、`data.json`（其中含用户的置顶笔记路径）、截图中可见的私人笔记。
- **提交作者邮箱必须使用 GitHub noreply 地址**（形如 `<id>+<user>@users.noreply.github.com`），本仓库已在 repo 级 `git config` 中设置，不要改回个人邮箱。
- 示例、测试数据、文档中如需举例，使用虚构的笔记名和路径（如 `示例/笔记.md`）。
- `main.js` 是构建产物，已被 `.gitignore` 忽略，只作为 Release 附件发布，不要提交进仓库。

## 项目概述

ObsidianHome 是一个 Obsidian 插件，用卡片式主页**完全替换**新标签页：

- 置顶笔记（设置页搜索添加，或卡片菜单中置顶/取消置顶）
- 最近文件，按创建时间或修改时间排序，数量与预览行数可配置
- 卡片展示标题、正文预览、时间戳与所在文件夹
- 右下角悬浮按钮新建笔记，遵循 Obsidian「新建文件默认位置」设置
- 桌面端与移动端通用

## 目录结构

| 文件 | 职责 |
|---|---|
| `main.ts` | 插件生命周期；把内置 `"empty"` 视图转换为 `obsidian-home-view`；vault 事件防抖刷新 |
| `homeView.ts` | `ItemView` 实现：排序切换、卡片渲染、右键菜单、新建笔记 |
| `settingsTab.ts` | 设置面板与置顶笔记搜索（`AbstractInputSuggest`） |
| `previewUtils.ts` | 正文预览提取与时间格式化（纯函数为主） |
| `types.ts` | 设置类型、默认值、视图类型常量 |
| `styles.css` | 样式，类名统一使用 `oh-` 前缀 |
| `manifest.json` | Obsidian 插件清单，`version` 决定 Release tag |
| `esbuild.config.mjs` | 构建配置，入口 `main.ts`，输出 `main.js` |

## 开发约束

- **只使用 Obsidian 公共 API**，不得引入 Electron / Node 专属能力（`fs`、`path`、`child_process` 等），否则移动端不可用。`manifest.json` 中 `isDesktopOnly` 必须保持 `false`。
- **性能优先**：预览只对当前显示的文件调用 `vault.cachedRead()`，不做全库内容扫描；vault 事件刷新保持防抖（`REFRESH_DEBOUNCE_MS`）。
- **样式跟随主题**：只使用 Obsidian CSS 变量（`--interactive-accent`、`--text-normal`、`--background-*` 等），不要写死颜色。
- **代码风格**：TypeScript，Tab 缩进，与现有代码保持一致；代码注释用英文，界面文案用简体中文。
- 修改设置项时同步更新 `types.ts` 中的 `ObsidianHomeSettings` 与 `DEFAULT_SETTINGS`，并调用 `plugin.saveSettings()` 与 `plugin.refreshAllHomeViews()`。

## 构建

```bash
npm install
npm run dev     # 监听模式，带 inline sourcemap
npm run build   # 生产构建，发布前必须用这个
```

## 发布流程（BRAT）

用户通过 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 安装，填入 `realbuilding/obsidian-home`。BRAT 从 GitHub Release 读取文件，因此：

1. 同步修改 `manifest.json` 与 `package.json` 的 `version`（如 `2.0.1`）。
2. `npm run build` 生成生产版 `main.js`。
3. 提交并推送源码改动。
4. 创建 Release，**tag 必须与 `manifest.json` 的 `version` 完全一致，不加 `v` 前缀**，并附带三个文件：

   ```bash
   gh release create 2.0.1 main.js manifest.json styles.css --title "2.0.1" --notes "<更新说明>"
   ```

5. Release 说明中不要包含隐私信息（见上文）。

未经维护者明确要求，不要执行 `git commit`、`git push` 或 `gh release create`。
