# agy-plugin-dock

**English** | [简体中文](./README.zh-CN.md)

A lightweight, zero-dependency plugin for **Google Antigravity** that surfaces UI plugins hidden inside the top-right `⋮ → Plugins` menu (such as `agy-capsule`, `agy-dart Context`, `Swarm`, etc.) directly onto the top toolbar next to `⋮` for one-click access.

## Features

- **One-Click Open, Instant Switch & Toggle Close**
  - Click a closed plugin icon: silently opens its side panel with zero menu flicker.
  - Click an already-open, unfocused plugin icon: switches straight to its tab in the right pane.
  - Click the currently active plugin icon again: closes **only that single tab** when multiple tabs are open, or collapses the side panel when it is the last tab.
- **Drag-and-Drop Reordering**
  - Drag icons directly on the top toolbar to reorder them; the new order is persisted automatically.
- **Compact Hover Card**
  - Theme-aware Shadow DOM hover tooltip (auto-clamped to viewport edges) with concise descriptions and per-plugin custom description overrides in settings.
- **Auto Discovery & Hot Reload**
  - Automatically scans user and built-in `SIDECAR_UI_ENTRYPOINT_AUX_PANE` plugins, skips disabled plugins, and inlines plugin icons.
  - Watches sidecar files for automatic hot reload on updates.
- **Zero-Conflict Isolation**
  - Uses an isolated global namespace (`globalThis.__agyPluginDock`) and Shadow DOM host (`[data-agy-plugin-dock-host]`) mounted solely in the top-right header next to `⋮`.
  - Coexists cleanly with `agy-capsule`, `agy-dart`, localization plugins, and other Antigravity plugins via concurrent Chromium CDP connections.
- **Bounded Operation Log**
  - Keeps only the latest 50 log entries (in both disk log and the in-panel log viewer) with one-click clear.

## Requirements & Compatibility

- **Verified Version**: Google Antigravity `v2.34.0` (tested on Windows; macOS / Linux install scripts included, untested).
- **Runtime**: Node.js 20+.
- **CDP Endpoint**: Requires Antigravity's local CDP port (`DevToolsActivePort`). If you already run `agy-capsule` or similar CDP plugins, no extra setup is needed.
- **Client Updates**: Because this plugin does not patch `app.asar`, routine minor Antigravity updates should not break it. Major UI changes to the header menu, right-pane tab bar (`toggle-aux-sidebar` / `side-panel-new-tab-button`), or local CDP debugging policy may require an update.

## Installation

### Windows (PowerShell)

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

### macOS / Linux

```bash
chmod +x ./install.sh && ./install.sh
```

After installation, confirm **Plugin Dock** is enabled in Antigravity's Plugins page (restart Antigravity once if icons do not appear immediately).

## Uninstall

### Windows (PowerShell)

```powershell
powershell -ExecutionPolicy Bypass -File .\uninstall.ps1
```

### macOS / Linux

```bash
chmod +x ./uninstall.sh && ./uninstall.sh
```

## Settings

Open `⋮ → Plugins → Plugin Dock` to configure:
- Button style: **Icon only (compact)** or **Icon + Label**
- Toggle the divider next to `⋮`
- Toggle whether `Plugin Dock` itself appears on the top bar
- Show/hide individual plugins, reorder icons, and set custom hover descriptions
- Inspect or clear the latest 50 operation log entries

## Development & Tests

```bash
node --test test/plugin-dock.test.mjs
```

## License

[MIT](./LICENSE)
