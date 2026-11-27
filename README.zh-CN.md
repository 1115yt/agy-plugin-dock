# agy-plugin-dock

[English](./README.md) | **简体中文**

轻量级、零依赖的 **Google Antigravity** 独立插件：将隐藏在右上角 `⋮ → 插件` 子菜单里的 UI 插件（如 `agy-capsule`、`agy-dart Context`、`Swarm` 等）直接平铺到顶栏 `⋮` 左侧，实现一键展开、瞬切与单标签关闭。

## 功能特性

- **一键展开 / 瞬切 / 再次点击关闭**
  - 点击未打开的插件图标：静默展开对应侧边栏（无菜单闪烁）；
  - 点击已打开但未聚焦的插件图标：直接点击右侧对应标签页瞬间切换；
  - 再次点击当前激活插件的图标：多标签时**优先只关闭当前单个标签页**（保留其他已开插件），仅剩最后一个标签时自动收起侧边栏。
- **顶栏直接拖拽排序**
  - 按住顶栏图标左右拖拽即可调整顺序，松手立即生效并持久化保存到本地配置。
- **紧凑中文悬浮卡片**
  - 内置 Shadow DOM 悬浮卡片（适配明暗主题、自动贴边防溢出），内置常见插件简短中文简介，并支持在设置面板中为任意插件自定义简介。
- **自动发现与热重载**
  - 自动扫描用户插件目录与内置插件目录中的 `SIDECAR_UI_ENTRYPOINT_AUX_PANE` 插件，同步跳过已禁用插件，并自动内联图标；
  - 支持文件监听自动热重载。
- **零冲突隔离架构**
  - 独立命名空间 `globalThis.__agyPluginDock` 与 Shadow DOM 容器 `[data-agy-plugin-dock-host]`，样式与 DOM 完全隔离；
  - 仅挂载于右上角顶栏 `⋮` 左侧，基于 Chromium CDP 多客户端并发连接，与 `agy-capsule`、`agy-dart`、汉化插件等现有插件完全兼容。
- **轻量操作日志**
  - 默认严格仅保留最近 50 条操作记录，可在 `⋮ → 插件 → Plugin Dock` 面板底部实时查看或一键清空。

## 环境要求与版本兼容

- **已验证版本**：Google Antigravity `v2.34.0`（Windows 实测通过；macOS / Linux 已提供安装脚本，理论兼容但未实测）
- **运行环境**：Node.js 20+
- **CDP 端口**：Google Antigravity 需开启本地 CDP 调试端口（`DevToolsActivePort`；若你已在使用 `agy-capsule` 等同类插件则已就绪，无需额外配置）
- **关于客户端更新**：本插件不修改 `app.asar`，常规小版本更新通常不会失效；但若 Antigravity 后续大版本改动了顶栏三点菜单结构、右侧面板标签栏（`toggle-aux-sidebar` / `side-panel-new-tab-button`）或本地 CDP 调试策略，可能需要跟进适配。

## 安装

### Windows (PowerShell)

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

### macOS / Linux

```bash
chmod +x ./install.sh && ./install.sh
```

安装完成后，在 Antigravity 插件管理页确认启用 **Plugin Dock**（首次安装如未立刻显示图标，重启一次 Antigravity 即可）。

## 卸载

### Windows (PowerShell)

```powershell
powershell -ExecutionPolicy Bypass -File .\uninstall.ps1
```

### macOS / Linux

```bash
chmod +x ./uninstall.sh && ./uninstall.sh
```

## 自定义设置

在右上角 `⋮ → 插件 → Plugin Dock` 打开设置面板，可配置：
- 按钮样式：**仅图标（紧凑）** / **图标 + 名称**
- 是否在 `⋮` 左侧显示分隔线
- 是否在顶栏显示 `Plugin Dock` 自身
- 勾选显示/隐藏各插件、调整顺序、为任意插件填写自定义中文简介
- 查看或清空最近 50 条操作日志

## 开发与测试

```bash
node --test test/plugin-dock.test.mjs
```

## License

[MIT](./LICENSE)
