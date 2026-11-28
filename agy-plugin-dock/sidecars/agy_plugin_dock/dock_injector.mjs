import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';

const INTERVAL_MS = 1200;
const INSTANCE_TS = Date.now();

export const PORT_FILE =
  process.platform === 'darwin'
    ? join(homedir(), 'Library', 'Application Support', 'Antigravity', 'DevToolsActivePort')
    : process.platform === 'win32'
      ? join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'Antigravity', 'DevToolsActivePort')
      : join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'Antigravity', 'DevToolsActivePort');


function isVisibleElement(el) {
  if (!el || !el.isConnected) return false;
  if (typeof el.checkVisibility === 'function') {
    if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
  }
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
}

function hasVerticalThreeDotsIcon(btn) {
  const svg = btn.querySelector('svg');
  if (!svg) return false;
  const cls = String(svg.getAttribute('class') || '');
  if (/ellipsis-vertical|more-vertical|more_vert/i.test(cls)) return true;
  const circles = [...svg.querySelectorAll('circle')];
  if (circles.length === 3) {
    const cxs = circles.map(c => Number(c.getAttribute('cx')));
    const cys = circles.map(c => Number(c.getAttribute('cy')));
    if (cxs.every(Number.isFinite) && cys.every(Number.isFinite)) {
      const sameX = Math.max(...cxs) - Math.min(...cxs) <= 1.5;
      const spreadY = Math.max(...cys) - Math.min(...cys) >= 4;
      if (sameX && spreadY) return true;
    }
  }
  return false;
}

function findHeaderMoreButtons() {
  const results = [];
  const excluded = '.agy-composer-footer, [data-side-panel-composer], [data-agy-plugin-dock-host], [role="menu"], [role="dialog"]';
  const buttons = document.querySelectorAll('button');
  for (const btn of buttons) {
    if (btn.closest(excluded)) continue;
    if (!isVisibleElement(btn)) continue;
    const r = btn.getBoundingClientRect();
    if (r.top < 0 || r.top > 72 || r.width > 48 || r.height > 48) continue;

    const label = [
      btn.getAttribute('aria-label'),
      btn.getAttribute('title'),
      btn.getAttribute('data-testid'),
    ].filter(Boolean).join(' ');
    const isMenuTrigger = btn.getAttribute('aria-haspopup') === 'menu';
    const isMoreLabel = /more|更多|menu|actions|options/i.test(label);
    const isThreeDots = hasVerticalThreeDotsIcon(btn);

    if (isThreeDots || (isMenuTrigger && isMoreLabel)) {
      const parent = btn.parentElement;
      if (!parent) continue;
      if (!results.some(item => item.container === parent)) {
        results.push({ button: btn, container: parent, rect: r });
      }
    }
  }
  return results;
}

function countAllSidePanelTabs() {
  const newTabBtn = document.querySelector('[data-testid="side-panel-new-tab-button"]');
  if (!newTabBtn || !isVisibleElement(newTabBtn)) return 0;
  const bar = newTabBtn.parentElement;
  if (!bar) return 0;
  const btnRect = newTabBtn.getBoundingClientRect();
  const matched = [];
  for (const el of bar.querySelectorAll('[role="tab"], button, div')) {
    if (el === newTabBtn || el.contains(newTabBtn) || newTabBtn.contains(el)) continue;
    if (!isVisibleElement(el) || el.closest('[data-agy-plugin-dock-host]')) continue;
    const r = el.getBoundingClientRect();
    if (Math.abs(r.top - btnRect.top) > 16 || r.height < 18 || r.height > 44 || r.width < 36 || r.width > 360) continue;
    const text = (el.textContent || '').trim();
    if (!text || text.length > 60) continue;
    const parentText = (el.parentElement?.textContent || '').trim();
    if (el.parentElement && el.parentElement !== bar && parentText === text) continue;
    if (matched.some(prev => prev.contains(el) || el.contains(prev))) continue;
    matched.push(el);
  }
  return matched.length;
}

function isAuxSidebarOpen(moreBtn) {
  const newTabBtn = document.querySelector('[data-testid="side-panel-new-tab-button"]');
  if (newTabBtn && isVisibleElement(newTabBtn)) return true;
  if (findVisibleSidecarFrame()) return true;
  const { btn: toggleBtn } = findSidebarToggleButton(moreBtn);
  if (toggleBtn && moreBtn && isVisibleElement(toggleBtn) && isVisibleElement(moreBtn)) {
    const tr = toggleBtn.getBoundingClientRect();
    const mr = moreBtn.getBoundingClientRect();
    if (tr.left - mr.right > 120) return true;
  }
  return false;
}

function findSidePanelTabs(plugins) {
  const newTabBtn = document.querySelector('[data-testid="side-panel-new-tab-button"]');
  const tabs = [];
  if (!newTabBtn || !isVisibleElement(newTabBtn)) return tabs;
  const bar = newTabBtn.parentElement;
  if (!bar) return tabs;
  const btnRect = newTabBtn.getBoundingClientRect();

  const matchedEls = [];
  for (const el of bar.querySelectorAll('[role="tab"], button, div')) {
    if (el === newTabBtn || el.contains(newTabBtn) || newTabBtn.contains(el)) continue;
    if (!isVisibleElement(el) || el.closest('[data-agy-plugin-dock-host]')) continue;
    const r = el.getBoundingClientRect();
    if (Math.abs(r.top - btnRect.top) > 16 || r.height < 18 || r.height > 44 || r.width < 24) continue;
    const text = (el.textContent || '').trim();
    if (!text || text.length > 60) continue;
    const lower = text.toLowerCase();
    const matchedPlugin = plugins.find(p => lower === p.title.toLowerCase());
    if (!matchedPlugin) continue;
    const parentText = (el.parentElement?.textContent || '').trim().toLowerCase();
    if (el.parentElement && el.parentElement !== bar && parentText === lower) continue;
    if (matchedEls.some(prev => prev.contains(el) || el.contains(prev))) continue;
    matchedEls.push(el);

    const bg = getComputedStyle(el).backgroundColor || '';
    const hasBg = bg !== '' && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)';
    const explicitActive = el.getAttribute('aria-selected') === 'true'
      || el.getAttribute('data-state') === 'active'
      || el.getAttribute('data-active') === 'true'
      || Boolean(el.querySelector('[aria-selected="true"], [data-state="active"], [data-active="true"]'));
    tabs.push({
      el,
      text,
      pluginId: matchedPlugin.id,
      active: explicitActive || hasBg,
    });
  }
  return tabs;
}

function detectActivePluginTitles(plugins) {
  const active = new Set();
  const sideTabs = findSidePanelTabs(plugins);
  for (const tab of sideTabs) {
    if (tab.active && tab.pluginId) active.add(tab.pluginId);
  }
  if (active.size > 0) return active;

  const frames = document.querySelectorAll('iframe');
  for (const frame of frames) {
    if (!isVisibleElement(frame)) continue;
    const hay = [
      frame.getAttribute('title'),
      frame.getAttribute('src'),
      frame.getAttribute('name'),
      frame.getAttribute('data-sidecar-id'),
    ].filter(Boolean).join(' ').toLowerCase();
    for (const p of plugins) {
      const scName = p.id.split('/').pop()?.toLowerCase() || '';
      if (
        hay.includes(p.id.toLowerCase()) ||
        hay.includes(p.title.toLowerCase()) ||
        (p.pluginName && hay.includes(p.pluginName.toLowerCase())) ||
        (scName && hay.includes(scName))
      ) {
        active.add(p.id);
      }
    }
  }
  return active;
}

function findVisibleSidecarFrame() {
  for (const frame of document.querySelectorAll('iframe')) {
    if (!isVisibleElement(frame)) continue;
    const r = frame.getBoundingClientRect();
    if (r.width >= 160 && r.height >= 160 && r.right >= window.innerWidth * 0.5) {
      return frame;
    }
  }
  return null;
}

function isWindowControlButton(btn) {
  const meta = [
    btn.getAttribute('aria-label'),
    btn.getAttribute('title'),
    btn.getAttribute('data-testid'),
    btn.className,
  ].filter(Boolean).join(' ');
  if (/window|minimize|maximize|restore|close|quit|exit|最小化|最大化|还原|关闭|退出|window-control/i.test(meta)) return true;
  const r = btn.getBoundingClientRect();
  if (r.top < 28) return true;
  return false;
}

function hasPanelRightSvg(btn) {
  const svg = btn.querySelector('svg');
  if (!svg) return false;
  const cls = String(svg.getAttribute('class') || '');
  if (/panel-right|sidebar-right/i.test(cls)) return true;
  const rects = svg.querySelectorAll('rect');
  const paths = svg.querySelectorAll('path');
  const lines = svg.querySelectorAll('line');
  if (rects.length === 1 && (paths.length + lines.length) === 1) {
    const line = lines[0];
    if (line) {
      const x1 = Number(line.getAttribute('x1'));
      const x2 = Number(line.getAttribute('x2'));
      const y1 = Number(line.getAttribute('y1'));
      const y2 = Number(line.getAttribute('y2'));
      if (Number.isFinite(x1) && Number.isFinite(x2) && Math.abs(x1 - x2) <= 1.5 && Math.abs(y2 - y1) >= 8) {
        return true;
      }
    }
    const path = paths[0];
    if (path) {
      const d = String(path.getAttribute('d') || '').trim();
      if (/^M\s*\d+(?:\.\d+)?[\s,]+\d+(?:\.\d+)?\s*[vV]\s*\d+/i.test(d)) return true;
      const m = /^M\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)\s*L\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)$/i.exec(d);
      if (m && Math.abs(Number(m[1]) - Number(m[3])) <= 1.5 && Math.abs(Number(m[4]) - Number(m[2])) >= 8) return true;
    }
  }
  return false;
}

function describeBtn(btn) {
  if (!btn) return null;
  const r = btn.getBoundingClientRect();
  return {
    label: btn.getAttribute('aria-label') || btn.getAttribute('title') || '',
    testid: btn.getAttribute('data-testid') || '',
    rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
  };
}

function findSidebarToggleButton(moreBtn) {
  if (!moreBtn) return { btn: null, scanned: [] };
  const direct = document.querySelector('button[data-testid="toggle-aux-sidebar"]');
  if (direct && isVisibleElement(direct) && !isWindowControlButton(direct)) {
    return { btn: direct, scanned: [{ ...describeBtn(direct), excluded: false, matched: true, direct: true }] };
  }

  const moreRect = moreBtn.getBoundingClientRect();
  const excludeMeta = /概览|overview|自定义|customize|layout|分区|add|new|plus|新建|添加|more|更多|close|关闭|quit|exit|退出|window|窗口/i;
  const matchMeta = /切换侧面板|侧面板|侧边栏|toggle.?side.?panel|side.?panel|side.?pane|aux.?pane|panel-right|sidebar/i;
  const scanned = [];

  for (const btn of document.querySelectorAll('button')) {
    if (btn === moreBtn || !isVisibleElement(btn) || btn.closest('[data-agy-plugin-dock-host]') || isWindowControlButton(btn)) continue;
    const r = btn.getBoundingClientRect();
    if (Math.abs(r.top - moreRect.top) > 14 || r.left <= moreRect.right || r.width > 48 || r.height > 48) continue;
    const meta = [
      btn.getAttribute('aria-label'),
      btn.getAttribute('title'),
      btn.getAttribute('data-testid'),
      btn.querySelector('svg')?.getAttribute('class'),
      btn.textContent,
    ].filter(Boolean).join(' ').trim();
    const isExcluded = excludeMeta.test(meta);
    const isMatch = !isExcluded && (matchMeta.test(meta) || hasPanelRightSvg(btn));
    scanned.push({ ...describeBtn(btn), excluded: isExcluded, matched: isMatch });
    if (isMatch) {
      return { btn, scanned };
    }
  }

  return { btn: null, scanned };
}

function waitForCondition(check, timeoutMs = 120) {
  if (check()) return Promise.resolve(true);
  return new Promise(resolve => {
    let settled = false;
    const done = ok => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timer);
      resolve(ok);
    };
    const observer = new MutationObserver(() => {
      if (check()) done(true);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    const timer = setTimeout(() => done(Boolean(check())), timeoutMs);
  });
}

async function tryCloseSingleTab(tabEl) {
  if (!tabEl || !tabEl.isConnected) return false;
  const newTabBtn = document.querySelector('[data-testid="side-panel-new-tab-button"]');
  const bar = newTabBtn?.parentElement || null;
  const scopes = [tabEl];
  if (tabEl.parentElement && tabEl.parentElement !== bar && (!newTabBtn || !tabEl.parentElement.contains(newTabBtn))) {
    const pr = tabEl.parentElement.getBoundingClientRect();
    if (pr.width > 0 && pr.width <= 380 && pr.height <= 48) scopes.push(tabEl.parentElement);
  }

  for (const scope of scopes) {
    const btns = [...scope.querySelectorAll('button')].filter(btn => {
      if (btn === newTabBtn) return false;
      const r = btn.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.width <= 28 && r.height <= 28;
    });
    for (const btn of btns) {
      dispatchPointer(btn, 'pointerdown');
      dispatchPointer(btn, 'mousedown');
      dispatchPointer(btn, 'pointerup');
      dispatchPointer(btn, 'mouseup');
      btn.click();
      const gone = await waitForCondition(() => !tabEl.isConnected || !isVisibleElement(tabEl), 120);
      if (gone) return true;
    }
  }

  const r = tabEl.getBoundingClientRect();
  const opts = { bubbles: true, cancelable: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 1, buttons: 4 };
  tabEl.dispatchEvent(new MouseEvent('mousedown', opts));
  tabEl.dispatchEvent(new MouseEvent('mouseup', opts));
  tabEl.dispatchEvent(new MouseEvent('auxclick', opts));
  return waitForCondition(() => !tabEl.isConnected || !isVisibleElement(tabEl), 120);
}

async function closeActivePluginPanel(moreBtn, plugin, plugins) {
  const sideTabs = findSidePanelTabs(plugins || []);
  const totalTabs = Math.max(sideTabs.length, countAllSidePanelTabs());
  const activeTab = sideTabs.find(t => t.pluginId === plugin?.id && t.active) || sideTabs.find(t => t.pluginId === plugin?.id);
  if (activeTab) {
    const api = globalThis.__agyPluginDock;
    const shouldKeepOpen = totalTabs <= 1 && Boolean(api?.auxOpenBeforePlugin);
    const closedTab = await tryCloseSingleTab(activeTab.el);
    api?.pushLog?.('close-tab', {
      pluginId: plugin?.id,
      tabCount: totalTabs,
      closedTab,
    });
    if (closedTab) {
      if (totalTabs > 1) return true;
      if (shouldKeepOpen) {
        const collapsed = await waitForCondition(() => !isAuxSidebarOpen(moreBtn), 150);
        if (collapsed) {
          const { btn: toggleBtn } = findSidebarToggleButton(moreBtn);
          if (toggleBtn) {
            toggleBtn.click();
            await new Promise(r => setTimeout(r, 80));
            api?.pushLog?.('restore-aux-sidebar', { trigger: 'dock-toggle', restored: true });
          }
        }
        if (api) api.auxOpenBeforePlugin = false;
      } else {
        await new Promise(r => setTimeout(r, 60));
        if (isAuxSidebarOpen(moreBtn)) {
          const { btn: toggleBtn } = findSidebarToggleButton(moreBtn);
          if (toggleBtn) {
            toggleBtn.click();
            await new Promise(r => setTimeout(r, 80));
          }
        }
      }
      return true;
    }
  }

  const { btn: toggleBtn, scanned } = findSidebarToggleButton(moreBtn);
  globalThis.__agyPluginDock?.pushLog?.('close-lookup', {
    found: Boolean(toggleBtn),
    target: describeBtn(toggleBtn),
    scanned,
  });
  if (toggleBtn) {
    toggleBtn.click();
    await new Promise(r => setTimeout(r, 80));
    return true;
  }
  return false;
}

function waitForElement(finder, timeoutMs = 450) {
  const immediate = finder();
  if (immediate) return Promise.resolve(immediate);
  return new Promise(resolve => {
    let settled = false;
    const done = val => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timer);
      resolve(val);
    };
    const observer = new MutationObserver(() => {
      const found = finder();
      if (found) done(found);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    const timer = setTimeout(() => done(finder() || null), timeoutMs);
  });
}

function dispatchPointer(el, type) {
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const common = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0 };
  if (type.startsWith('pointer') && typeof PointerEvent === 'function') {
    el.dispatchEvent(new PointerEvent(type, { ...common, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
  } else {
    el.dispatchEvent(new MouseEvent(type, common));
  }
}

async function openPluginViaNativeMenu(moreBtn, plugin) {
  if (!moreBtn || !moreBtn.isConnected) return false;
  const cloakId = 'agy-plugin-dock-cloak-style';
  let cloak = document.getElementById(cloakId);
  if (!cloak) {
    cloak = document.createElement('style');
    cloak.id = cloakId;
    cloak.textContent = '[data-radix-popper-content-wrapper], [role="menu"] { opacity: 0 !important; transition: none !important; animation: none !important; }';
    document.head.appendChild(cloak);
  }
  const cleanup = (pressEscape = false) => {
    cloak?.remove();
    if (pressEscape) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
    }
  };
  try {
    dispatchPointer(moreBtn, 'pointerdown');
    dispatchPointer(moreBtn, 'mousedown');
    dispatchPointer(moreBtn, 'pointerup');
    dispatchPointer(moreBtn, 'mouseup');
    moreBtn.click();

    const findPluginsEntry = () => {
      const items = document.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"], [data-radix-collection-item]');
      for (const item of items) {
        if (item.closest('[data-agy-plugin-dock-host]')) continue;
        const txt = (item.textContent || '').trim();
        if (/^(插件|Plugins|UI Plugins|Extensions)$/i.test(txt)) return item;
      }
      return null;
    };

    const pluginsEntry = await waitForElement(findPluginsEntry, 500);
    if (!pluginsEntry) { cleanup(true); return false; }

    dispatchPointer(pluginsEntry, 'pointerover');
    dispatchPointer(pluginsEntry, 'pointerenter');
    dispatchPointer(pluginsEntry, 'mouseover');
    dispatchPointer(pluginsEntry, 'mouseenter');
    dispatchPointer(pluginsEntry, 'pointermove');
    dispatchPointer(pluginsEntry, 'mousemove');

    const targetLower = plugin.title.trim().toLowerCase();
    const findPluginItem = () => {
      const items = document.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"], [data-radix-collection-item]');
      let fuzzy = null;
      for (const item of items) {
        if (item === pluginsEntry || item.closest('[data-agy-plugin-dock-host]')) continue;
        const txt = (item.textContent || '').trim().toLowerCase();
        if (!txt) continue;
        if (txt === targetLower) return item;
        if (!fuzzy && (txt.includes(targetLower) || targetLower.includes(txt))) fuzzy = item;
      }
      return fuzzy;
    };

    let targetItem = await waitForElement(findPluginItem, 220);
    if (!targetItem) {
      pluginsEntry.focus?.();
      pluginsEntry.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', bubbles: true, cancelable: true }));
      pluginsEntry.click();
      targetItem = await waitForElement(findPluginItem, 350);
    }

    if (!targetItem) { cleanup(true); return false; }

    dispatchPointer(targetItem, 'pointerdown');
    dispatchPointer(targetItem, 'mousedown');
    dispatchPointer(targetItem, 'pointerup');
    dispatchPointer(targetItem, 'mouseup');
    targetItem.click();

    await new Promise(r => setTimeout(r, 40));
    cleanup(false);
    return true;
  } catch {
    cleanup(true);
    return false;
  }
}

const PUZZLE_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.077.877.528 1.073 1.01a2.5 2.5 0 1 0 3.259-3.259c-.482-.196-.933-.558-1.01-1.073-.05-.336.062-.676.303-.917l1.525-1.525A2.402 2.402 0 0 1 12 1.998c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z"/></svg>';

function renderDockIntoContainer(anchor, payload, puzzleSvg) {
  const { button: moreBtn, container } = anchor;
  let host = container.querySelector(':scope > [data-agy-plugin-dock-host]');
  if (!payload.plugins || payload.plugins.length === 0) {
    host?.remove();
    return;
  }
  if (!host) {
    host = document.createElement('div');
    host.setAttribute('data-agy-plugin-dock-host', '1');
    host.setAttribute('translate', 'no');
    host.style.cssText = 'display:inline-flex;align-items:center;flex-shrink:0;margin-right:2px;';
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: inline-flex;
        align-items: center;
        flex-shrink: 0;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei UI", sans-serif;
      }
      .dock {
        display: inline-flex;
        align-items: center;
        gap: 2px;
      }
      .dock-btn {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        height: 28px;
        min-width: 28px;
        padding: 0 6px;
        border: 1px solid transparent;
        border-radius: 7px;
        background: transparent;
        color: var(--muted-foreground, var(--foreground, #52525b));
        cursor: pointer;
        font: inherit;
        font-size: 12px;
        font-weight: 500;
        line-height: 1;
        transition: background-color 120ms ease, color 120ms ease, border-color 120ms ease, transform 80ms ease;
        user-select: none;
        -webkit-app-region: no-drag;
      }
      .dock-btn.icon-only {
        width: 28px;
        padding: 0;
      }
      .dock-btn:hover {
        background: var(--secondary, rgba(128, 128, 128, 0.14));
        color: var(--foreground, inherit);
      }
      .dock-btn:active {
        transform: scale(0.95);
      }
      .dock-btn.active {
        background: var(--secondary, rgba(59, 130, 246, 0.14));
        border-color: color-mix(in srgb, var(--foreground, #3b82f6) 14%, transparent);
        color: var(--foreground, inherit);
      }
      .dock-btn.busy {
        opacity: 0.6;
        pointer-events: none;
      }
      .dock-btn.dragging {
        opacity: 0.35;
      }
      .dock-btn.drop-before::before,
      .dock-btn.drop-after::after {
        content: "";
        position: absolute;
        top: 4px;
        bottom: 4px;
        width: 2px;
        border-radius: 2px;
        background: var(--ring, #3b82f6);
        pointer-events: none;
      }
      .dock-btn.drop-before::before { left: -2px; }
      .dock-btn.drop-after::after { right: -2px; }
      .dock-icon {
        width: 16px;
        height: 16px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .dock-icon img {
        width: 16px;
        height: 16px;
        border-radius: 4px;
        object-fit: contain;
        display: block;
      }
      .dock-label {
        max-width: 112px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .dock-divider {
        width: 1px;
        height: 14px;
        margin: 0 3px 0 4px;
        background: var(--border, rgba(128, 128, 128, 0.28));
        flex-shrink: 0;
      }
      .dock-tip {
        position: fixed;
        z-index: 2147483647;
        pointer-events: none;
        max-width: 228px;
        padding: 7px 10px;
        border-radius: 9px;
        border: 1px solid color-mix(in srgb, var(--foreground, #18181b) 12%, transparent);
        background: var(--popover, var(--card, #ffffff));
        color: var(--popover-foreground, var(--foreground, #18181b));
        box-shadow: 0 8px 24px -6px rgba(0, 0, 0, 0.18), 0 2px 6px -1px rgba(0, 0, 0, 0.1);
        opacity: 0;
        transform: translateY(-2px);
        transition: opacity 110ms ease, transform 110ms ease;
        white-space: normal;
        word-break: break-word;
      }
      .dock-tip.show {
        opacity: 1;
        transform: translateY(0);
      }
      .dock-tip-title {
        font-size: 12px;
        font-weight: 600;
        line-height: 1.35;
      }
      .dock-tip-desc {
        margin-top: 2px;
        font-size: 11px;
        line-height: 1.4;
        color: var(--muted-foreground, #64748b);
      }
    `;
    const bar = document.createElement('div');
    bar.className = 'dock';
    const tip = document.createElement('div');
    tip.className = 'dock-tip';
    tip.innerHTML = '<div class="dock-tip-title"></div><div class="dock-tip-desc"></div>';
    shadow.append(style, bar, tip);
    container.insertBefore(host, moreBtn);
  } else if (host.nextElementSibling !== moreBtn) {
    container.insertBefore(host, moreBtn);
  }

  const activeIds = detectActivePluginTitles(payload.plugins);
  const hasFrame = Boolean(findVisibleSidecarFrame());
  if (!hasFrame && activeIds.size === 0) host._lastOpenedId = null;
  else if (activeIds.size === 0 && host._lastOpenedId) activeIds.add(host._lastOpenedId);

  const bar = host.shadowRoot.querySelector('.dock');
  const syncActiveClasses = () => {
    for (const el of bar.querySelectorAll('.dock-btn')) {
      el.classList.toggle('active', activeIds.has(el.dataset.pluginId));
    }
  };

  const structSignature = JSON.stringify({
    mode: payload.displayMode,
    div: payload.showDivider,
    items: payload.plugins.map(p => [p.id, p.title, p.description || '', p.iconDataUri ? p.iconDataUri.length : 0]),
  });
  if (host._isDragging || host._dockSignature === structSignature) {
    syncActiveClasses();
    return;
  }
  host._dockSignature = structSignature;

  const tip = host.shadowRoot.querySelector('.dock-tip');
  const tipTitle = tip?.querySelector('.dock-tip-title');
  const tipDesc = tip?.querySelector('.dock-tip-desc');
  const hideTip = () => tip?.classList.remove('show');
  const showTip = (btnEl, plugin) => {
    if (!tip || !tipTitle || !tipDesc) return;
    tipTitle.textContent = plugin.title;
    tipDesc.textContent = plugin.description || '';
    tipDesc.style.display = plugin.description ? '' : 'none';
    tip.classList.add('show');
    const br = btnEl.getBoundingClientRect();
    const tr = tip.getBoundingClientRect();
    const left = Math.max(8, Math.min(window.innerWidth - tr.width - 8, br.left + br.width / 2 - tr.width / 2));
    const top = Math.min(window.innerHeight - tr.height - 8, br.bottom + 8);
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
  };
  hideTip();
  bar.textContent = '';

  const clearDropMarks = () => {
    for (const el of bar.querySelectorAll('.dock-btn')) {
      el.classList.remove('dragging', 'drop-before', 'drop-after');
    }
  };
  let dragId = null;

  for (const plugin of payload.plugins) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.draggable = true;
    btn.className = 'dock-btn'
      + (payload.displayMode === 'icon' ? ' icon-only' : '')
      + (activeIds.has(plugin.id) ? ' active' : '');
    btn.setAttribute('aria-label', plugin.title);
    btn.dataset.pluginId = plugin.id;

    const iconWrap = document.createElement('span');
    iconWrap.className = 'dock-icon';
    if (plugin.iconDataUri) {
      const img = document.createElement('img');
      img.src = plugin.iconDataUri;
      img.alt = '';
      img.draggable = false;
      iconWrap.appendChild(img);
    } else {
      iconWrap.innerHTML = puzzleSvg;
    }
    btn.appendChild(iconWrap);

    if (payload.displayMode === 'pill') {
      const label = document.createElement('span');
      label.className = 'dock-label';
      label.textContent = plugin.title;
      btn.appendChild(label);
    }

    btn.addEventListener('pointerenter', () => { if (!dragId) showTip(btn, plugin); });
    btn.addEventListener('pointerleave', hideTip);
    btn.addEventListener('focus', () => { if (!dragId) showTip(btn, plugin); });
    btn.addEventListener('blur', hideTip);

    btn.addEventListener('dragstart', ev => {
      dragId = plugin.id;
      host._isDragging = true;
      hideTip();
      btn.classList.add('dragging');
      if (ev.dataTransfer) {
        ev.dataTransfer.effectAllowed = 'move';
        ev.dataTransfer.setData('text/plain', plugin.id);
      }
    });

    btn.addEventListener('dragover', ev => {
      if (!dragId || dragId === plugin.id) return;
      ev.preventDefault();
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
      const r = btn.getBoundingClientRect();
      const before = ev.clientX < r.left + r.width / 2;
      btn.classList.toggle('drop-before', before);
      btn.classList.toggle('drop-after', !before);
    });

    btn.addEventListener('dragleave', () => {
      btn.classList.remove('drop-before', 'drop-after');
    });

    btn.addEventListener('drop', ev => {
      if (!dragId || dragId === plugin.id) return;
      ev.preventDefault();
      ev.stopPropagation();
      const r = btn.getBoundingClientRect();
      const before = ev.clientX < r.left + r.width / 2;
      const currentIds = [...bar.querySelectorAll('.dock-btn')].map(el => el.dataset.pluginId).filter(Boolean);
      const fromIdx = currentIds.indexOf(dragId);
      if (fromIdx === -1) { clearDropMarks(); dragId = null; return; }
      currentIds.splice(fromIdx, 1);
      let toIdx = currentIds.indexOf(plugin.id);
      if (toIdx === -1) { clearDropMarks(); dragId = null; return; }
      if (!before) toIdx += 1;
      currentIds.splice(toIdx, 0, dragId);

      const divider = bar.querySelector('.dock-divider');
      const btnMap = new Map([...bar.querySelectorAll('.dock-btn')].map(el => [el.dataset.pluginId, el]));
      for (const id of currentIds) {
        const el = btnMap.get(id);
        if (el) bar.insertBefore(el, divider || null);
      }
      host._dockSignature = '';
      host._isDragging = false;
      host._lastDragAt = Date.now();
      globalThis.__agyPluginDock?.queueOrderSync?.(currentIds);
      clearDropMarks();
      dragId = null;
    });

    btn.addEventListener('dragend', () => {
      clearDropMarks();
      dragId = null;
      host._isDragging = false;
      host._lastDragAt = Date.now();
    });

    btn.addEventListener('click', async ev => {
      ev.preventDefault();
      ev.stopPropagation();
      if (host._lastDragAt && Date.now() - host._lastDragAt < 250) return;
      hideTip();
      if (host._dockBusy) return;
      host._dockBusy = true;
      btn.classList.add('busy');
      try {
        const sideTabs = findSidePanelTabs(payload.plugins);
        const currentActive = detectActivePluginTitles(payload.plugins);
        const sidecarOpen = sideTabs.length > 0 || Boolean(findVisibleSidecarFrame()) || currentActive.size > 0;
        const isSamePluginOpen = currentActive.has(plugin.id) || (
          sidecarOpen &&
          sideTabs.length === 0 &&
          currentActive.size === 0 &&
          host._lastOpenedId === plugin.id
        );
        globalThis.__agyPluginDock?.pushLog?.('dock-click', {
          pluginId: plugin.id,
          title: plugin.title,
          sidecarOpen,
          tabs: sideTabs.map(t => ({ id: t.pluginId || t.text, active: t.active })),
          activeIds: [...currentActive],
          lastOpenedId: host._lastOpenedId || null,
          isSamePluginOpen,
        });
        if (isSamePluginOpen) {
          const closed = await closeActivePluginPanel(moreBtn, plugin, payload.plugins);
          if (closed) {
            const nextActive = detectActivePluginTitles(payload.plugins);
            host._lastOpenedId = [...nextActive][0] || null;
            for (const el of bar.querySelectorAll('.dock-btn')) {
              el.classList.toggle('active', nextActive.has(el.dataset.pluginId));
            }
            return;
          }
        }
        const existingTab = sideTabs.find(t => t.pluginId === plugin.id);
        if (existingTab && !existingTab.active) {
          const clickTarget = existingTab.el.matches('button, [role="tab"]')
            ? existingTab.el
            : (existingTab.el.querySelector('button, [role="tab"]') || existingTab.el);
          dispatchPointer(clickTarget, 'pointerdown');
          dispatchPointer(clickTarget, 'mousedown');
          dispatchPointer(clickTarget, 'pointerup');
          dispatchPointer(clickTarget, 'mouseup');
          clickTarget.click();
          await new Promise(r => setTimeout(r, 50));
          const switched = detectActivePluginTitles(payload.plugins).has(plugin.id);
          globalThis.__agyPluginDock?.pushLog?.('dock-switch-tab', { pluginId: plugin.id, switched });
          if (switched) {
            host._lastOpenedId = plugin.id;
            for (const el of bar.querySelectorAll('.dock-btn')) {
              el.classList.toggle('active', el.dataset.pluginId === plugin.id);
            }
            return;
          }
        }
        const totalTabsBefore = Math.max(sideTabs.length, countAllSidePanelTabs());
        const auxOpenBefore = isAuxSidebarOpen(moreBtn);
        if (totalTabsBefore === 0 && !sidecarOpen && globalThis.__agyPluginDock) {
          globalThis.__agyPluginDock.auxOpenBeforePlugin = auxOpenBefore;
        }
        const opened = await openPluginViaNativeMenu(moreBtn, plugin);
        globalThis.__agyPluginDock?.pushLog?.('dock-open', { pluginId: plugin.id, opened, auxOpenBefore });
        if (opened) {
          host._lastOpenedId = plugin.id;
          for (const el of bar.querySelectorAll('.dock-btn')) {
            el.classList.toggle('active', el.dataset.pluginId === plugin.id);
          }
        }
      } finally {
        btn.classList.remove('busy');
        host._dockBusy = false;
      }
    });

    bar.appendChild(btn);
  }

  if (payload.showDivider) {
    const divider = document.createElement('span');
    divider.className = 'dock-divider';
    divider.setAttribute('aria-hidden', 'true');
    bar.appendChild(divider);
  }
}

function installDockRuntime(owner, hash, puzzleSvg) {
  const existing = globalThis.__agyPluginDock;
  if (existing && existing.owner > owner) return 'superseded';
  existing?.dispose?.();

  let orderRev = 0;
  let pendingOrder = null;
  let logSeq = 0;
  const logQueue = [];

  const api = {
    owner,
    hash,
    auxOpenBeforePlugin: false,
    pushLog(event, detail) {
      logQueue.push({ seq: ++logSeq, event, detail: { ...(detail && typeof detail === 'object' ? detail : { value: detail }), at: new Date().toISOString().slice(11, 23) } });
      if (logQueue.length > 40) logQueue.shift();
    },
    ackLogs(expectedOwner, seq) {
      if (api.owner !== expectedOwner) return 'superseded';
      while (logQueue.length && logQueue[0].seq <= seq) logQueue.shift();
      return true;
    },
    queueOrderSync(order) {
      if (!Array.isArray(order) || !order.length) return;
      pendingOrder = { rev: ++orderRev, order: [...order] };
      api.pushLog('dock-reorder', { order: [...order] });
    },
    ackOrderSync(expectedOwner, rev) {
      if (api.owner !== expectedOwner) return 'superseded';
      if (pendingOrder && pendingOrder.rev === rev) pendingOrder = null;
      return true;
    },
    readState(expectedOwner) {
      if (api.owner !== expectedOwner) return 'superseded';
      const anchors = findHeaderMoreButtons();
      return {
        owner: api.owner,
        hash: api.hash,
        anchorCount: anchors.length,
        mountedCount: document.querySelectorAll('[data-agy-plugin-dock-host]').length,
        orderSync: pendingOrder,
        logs: logQueue.slice(),
      };
    },
    apply(payload, expectedOwner) {
      if (api.owner !== expectedOwner) return 'superseded';
      const anchors = findHeaderMoreButtons();
      const validContainers = new Set(anchors.map(a => a.container));
      for (const stale of document.querySelectorAll('[data-agy-plugin-dock-host]')) {
        if (!validContainers.has(stale.parentElement)) stale.remove();
      }
      for (const anchor of anchors) {
        renderDockIntoContainer(anchor, payload, puzzleSvg);
      }
      return anchors.length > 0;
    },
    dispose() {
      document.removeEventListener('click', onDocClick, true);
      for (const host of document.querySelectorAll('[data-agy-plugin-dock-host]')) host.remove();
      document.getElementById('agy-plugin-dock-cloak-style')?.remove();
      if (globalThis.__agyPluginDock === api) delete globalThis.__agyPluginDock;
    },
  };

  const onDocClick = ev => {
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target) return;
    if (target.closest('button[data-testid="toggle-aux-sidebar"]')) {
      const anyBusy = [...document.querySelectorAll('[data-agy-plugin-dock-host]')].some(h => h._dockBusy);
      if (!anyBusy) api.auxOpenBeforePlugin = false;
      return;
    }
    if (!api.auxOpenBeforePlugin) return;
    if ([...document.querySelectorAll('[data-agy-plugin-dock-host]')].some(h => h._dockBusy)) return;
    const newTabBtn = document.querySelector('[data-testid="side-panel-new-tab-button"]');
    if (!newTabBtn || !isVisibleElement(newTabBtn)) return;
    const bar = newTabBtn.parentElement;
    if (!bar || !bar.contains(target) || newTabBtn.contains(target)) return;
    const closeBtn = target.closest('button');
    if (!closeBtn || closeBtn === newTabBtn) return;
    const cr = closeBtn.getBoundingClientRect();
    if (cr.width > 28 || cr.height > 28) return;
    if (countAllSidePanelTabs() > 1) return;

    api.auxOpenBeforePlugin = false;
    (async () => {
      const anchors = findHeaderMoreButtons();
      const moreBtn = anchors[0]?.button || null;
      if (!moreBtn) return;
      const collapsed = await waitForCondition(() => !isAuxSidebarOpen(moreBtn), 150);
      if (collapsed) {
        const { btn: toggleBtn } = findSidebarToggleButton(moreBtn);
        if (toggleBtn) {
          toggleBtn.click();
          api.pushLog('restore-aux-sidebar', { trigger: 'tab-close-x', restored: true });
        }
      }
    })();
  };
  document.addEventListener('click', onDocClick, true);

  globalThis.__agyPluginDock = api;
  return true;
}

export function buildDockRuntimeBundle(owner = INSTANCE_TS) {
  const fns = [
    isVisibleElement,
    hasVerticalThreeDotsIcon,
    findHeaderMoreButtons,
    countAllSidePanelTabs,
    isAuxSidebarOpen,
    findSidePanelTabs,
    detectActivePluginTitles,
    findVisibleSidecarFrame,
    isWindowControlButton,
    hasPanelRightSvg,
    describeBtn,
    findSidebarToggleButton,
    waitForCondition,
    tryCloseSingleTab,
    closeActivePluginPanel,
    waitForElement,
    dispatchPointer,
    openPluginViaNativeMenu,
    renderDockIntoContainer,
    installDockRuntime,
  ].map(fn => fn.toString()).join('\n');
  const source = `${fns}\nconst PUZZLE_SVG=${JSON.stringify(PUZZLE_SVG)};`;
  const hash = createHash('sha256').update(source).digest('hex').slice(0, 16);
  const code = `(()=>{const OWNER=${Number(owner)};if(globalThis.__agyPluginDock?.owner>OWNER)return 'superseded';${source}\nreturn installDockRuntime(OWNER,${JSON.stringify(hash)},PUZZLE_SVG);})()`;
  return { code, hash };
}

export function createComposerOriginResolver(productRoots = [], env = process.env, now = Date.now) {
  let session = null;
  return async function composerOrigin() {
    const address = env.ANTIGRAVITY_LS_ADDRESS;
    const token = env.ANTIGRAVITY_CSRF_TOKEN;
    const match = /^(127\.0\.0\.1|localhost):([1-9]\d{0,4})$/.exec(address || '');
    if (!match || +match[2] > 65535 || !token) { session = null; return null; }
    for (const root of productRoots) {
      let hub;
      try { hub = JSON.parse(readFileSync(join(root, 'daemon', `hub_${match[2]}.json`), 'utf8')); }
      catch { continue; }
      if (hub?.httpPort !== +match[2] || !Number.isInteger(hub.httpsPort) || hub.httpsPort < 1 || hub.httpsPort > 65535) continue;
      const origin = new URL(`https://127.0.0.1:${hub.httpsPort}`).origin;
      if (!session || session.address !== address || session.token !== token || session.origin !== origin || session.pid !== hub.pid) {
        session = { address, token, origin, pid: hub.pid, verified: false, retryAt: 0, delay: 4000 };
      }
      if (session.verified) return origin;
      if (now() < session.retryAt) return null;
      try {
        const res = await fetch(`http://${match[1]}:${match[2]}/exa.language_server_pb.LanguageServerService/GetAllPlugins`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-codeium-csrf-token': token },
          body: '{}',
          redirect: 'error',
          signal: AbortSignal.timeout(3000),
        });
        await res.body?.cancel();
        if (res.ok) { session.verified = true; return origin; }
      } catch {}
      session.retryAt = now() + session.delay;
      session.delay = Math.min(60_000, session.delay * 2);
      return null;
    }
    session = null;
    return null;
  };
}

export function startDockInjector(getPayload, options = {}) {
  const owner = options.instanceTs ?? INSTANCE_TS;
  const bundle = buildDockRuntimeBundle(owner);
  const sockets = new Map();
  let cachedPages = [];
  let lastListAt = 0;
  let lastErr = '';
  let stopped = false;
  let busy = false;
  let cdpState = 'unknown';
  let discovery = 'unknown';
  let noAnchorSince = null;
  let failedRounds = 0;

  const now = options.now || Date.now;
  const composerOrigin = createComposerOriginResolver(options.productRoots || [], options.env, now);

  const logOnce = msg => {
    if (lastErr !== msg) {
      lastErr = msg;
      console.error('[agy-plugin-dock]', msg);
    }
  };

  const retire = (entry, id) => {
    if (entry.closed) return;
    entry.closed = true;
    for (const cb of entry.pending.values()) cb(undefined);
    entry.pending.clear();
    try { entry.ws.close(); } catch {}
    if (sockets.get(id) === entry) sockets.delete(id);
  };

  const command = (entry, method, params) => new Promise(resolve => {
    if (entry.ws.readyState !== 1) return resolve(undefined);
    const id = entry.nextId++;
    const timer = setTimeout(() => { entry.pending.delete(id); resolve(undefined); }, 3000);
    entry.pending.set(id, msg => { clearTimeout(timer); resolve(msg?.result); });
    try { entry.ws.send(JSON.stringify({ id, method, params })); }
    catch { clearTimeout(timer); entry.pending.delete(id); resolve(undefined); }
  });

  const evaluate = async (entry, context, expression) => {
    if (!context || context !== entry.context) return undefined;
    return (await command(entry, 'Runtime.evaluate', { uniqueContextId: context, expression, returnByValue: true }))?.result?.value;
  };

  const connect = async target => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    const entry = { ws, pending: new Map(), nextId: 1, origin: new URL(target.url).origin, context: null, frameId: null, closed: false };
    await new Promise((resolve, reject) => {
      const fail = msg => { clearTimeout(timer); retire(entry, target.id); reject(new Error(msg)); };
      const timer = setTimeout(() => fail('ws timeout'), 3000);
      ws.onopen = () => { clearTimeout(timer); resolve(); };
      ws.onerror = () => fail('ws error');
    });
    if (stopped) { retire(entry, target.id); throw new Error('injector stopped'); }
    ws.onmessage = event => {
      try {
        const message = JSON.parse(event.data);
        if (message.method === 'Runtime.executionContextCreated') {
          const ctx = message.params.context;
          if (ctx.auxData?.isDefault && ctx.auxData.frameId === entry.frameId) {
            entry.context = ctx.origin === entry.origin ? ctx.uniqueId : null;
          }
        } else if (message.method === 'Runtime.executionContextsCleared' ||
                   (message.method === 'Runtime.executionContextDestroyed' && message.params.executionContextUniqueId === entry.context)) {
          entry.context = null;
        }
        const cb = entry.pending.get(message.id);
        if (cb) { entry.pending.delete(message.id); cb(message); }
      } catch {}
    };
    ws.onerror = ws.onclose = () => retire(entry, target.id);
    sockets.set(target.id, entry);
    const tree = await command(entry, 'Page.getFrameTree', {});
    entry.frameId = tree?.frameTree?.frame?.id;
    if (!entry.frameId || !await command(entry, 'Runtime.enable', {})) {
      retire(entry, target.id);
      throw new Error('could not identify composer document');
    }
    return entry;
  };

  const pages = async () => {
    if (lastListAt && now() - lastListAt < 4000) return cachedPages;
    let port;
    try { port = readFileSync(options.portFile || PORT_FILE, 'utf8').split(/\r?\n/)[0].trim(); }
    catch { discovery = 'missing'; logOnce('DevToolsActivePort not found'); return []; }
    try {
      if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error('invalid CDP port');
      const res = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(3000), redirect: 'error' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const targets = await res.json();
      const origin = await composerOrigin();
      const wsOrigin = new URL(`ws://127.0.0.1:${Number(port)}`).origin;
      cachedPages = targets.filter(t => {
        if (!origin || t?.type !== 'page' || typeof t.id !== 'string' || !t.id || !URL.canParse(t.url) || new URL(t.url).origin !== origin || !URL.canParse(t.webSocketDebuggerUrl)) return false;
        const ws = new URL(t.webSocketDebuggerUrl);
        return ws.origin === wsOrigin && ws.pathname === `/devtools/page/${t.id}` && !ws.username && !ws.password && !ws.search && !ws.hash;
      });
      lastListAt = now();
      discovery = origin ? 'ok' : 'unverified';
      const ids = new Set(cachedPages.map(t => t.id));
      for (const [id, entry] of sockets) if (!ids.has(id) || entry.origin !== origin) retire(entry, id);
      return cachedPages;
    } catch (err) {
      discovery = 'unreachable';
      logOnce(`CDP list failed: ${err.message}`);
      return [];
    }
  };

  const stop = async () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    await Promise.all([...sockets].map(async ([id, entry]) => {
      try { await evaluate(entry, entry.context, `globalThis.__agyPluginDock?.owner===${owner}&&globalThis.__agyPluginDock.dispose()`); }
      finally { retire(entry, id); }
    }));
  };

  const supersede = async () => {
    await stop();
    (options.onSuperseded || (() => process.exit(0)))();
  };

  const tick = async () => {
    if (busy || stopped) return;
    busy = true;
    try {
      const list = await pages();
      const payload = await Promise.resolve().then(() => getPayload()).catch(() => null);
      let noAnchor = 0;
      let failed = 0;

      for (const target of list) {
        if (stopped) break;
        try {
          const entry = sockets.get(target.id) || await connect(target);
          const ctx = entry.context;
          const run = expr => evaluate(entry, ctx, expr);
          let state = await run(`globalThis.__agyPluginDock?.readState(${owner})??null`);
          if (state === undefined || stopped) { failed++; continue; }
          if (state === 'superseded') return await supersede();
          if (state?.owner !== owner || state.hash !== bundle.hash) {
            const installed = await run(bundle.code);
            if (installed === 'superseded') return await supersede();
            if (!installed || stopped) { failed++; continue; }
            state = await run(`globalThis.__agyPluginDock?.readState(${owner})??null`);
          }
          if (state === 'superseded') return await supersede();
          if (state?.owner !== owner) { failed++; continue; }
          if (state.orderSync && Array.isArray(state.orderSync.order)) {
            try { options.onOrderChange?.(state.orderSync.order); } catch {}
            const acked = await run(`globalThis.__agyPluginDock?.ackOrderSync(${owner},${Number(state.orderSync.rev) || 0})??false`);
            if (acked === 'superseded') return await supersede();
            if (stopped) break;
          }
          if (Array.isArray(state.logs) && state.logs.length > 0) {
            let maxSeq = 0;
            for (const item of state.logs) {
              if (Number(item?.seq) > maxSeq) maxSeq = Number(item.seq);
              try { options.onLog?.(item.event, item.detail); } catch {}
            }
            if (maxSeq > 0) {
              const acked = await run(`globalThis.__agyPluginDock?.ackLogs(${owner},${maxSeq})??false`);
              if (acked === 'superseded') return await supersede();
              if (stopped) break;
            }
          }
          const latestPayload = state.orderSync ? await Promise.resolve().then(() => getPayload()).catch(() => payload) : payload;
          if (latestPayload) {
            const applied = await run(`globalThis.__agyPluginDock?.apply(${JSON.stringify(latestPayload)},${owner})??false`);
            if (applied === 'superseded') return await supersede();
            if (!applied) noAnchor++;
          }
          lastErr = '';
        } catch (err) {
          if (stopped) return;
          failed++;
          const entry = sockets.get(target.id);
          if (entry) retire(entry, target.id);
          logOnce(`page ${target.id}: ${err.message}`);
        }
      }

      if (stopped) return;
      noAnchorSince = list.length && noAnchor === list.length ? (noAnchorSince ?? now()) : null;
      failedRounds = list.length && failed === list.length ? failedRounds + 1 : 0;
      cdpState = discovery !== 'ok' ? discovery
        : failedRounds >= 3 ? 'inject-failed'
        : noAnchorSince !== null && now() - noAnchorSince >= 15_000 ? 'no-anchor'
        : 'ok';
      options.onStatus?.(cdpState);
    } finally {
      busy = false;
    }
  };

  const timer = setInterval(tick, INTERVAL_MS);
  void tick();
  return { tick, stop, status: () => cdpState };
}
