export const PANEL_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Plugin Dock</title>
<style>
  :root {
    --bg: #ffffff;
    --card: #f8fafc;
    --border: rgba(15, 23, 42, 0.1);
    --fg: #0f172a;
    --muted: #64748b;
    --accent: #3b82f6;
    --ok: #16a34a;
    --warn: #d97706;
    --err: #dc2626;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #111318;
      --card: #181b22;
      --border: rgba(255, 255, 255, 0.1);
      --fg: #f1f5f9;
      --muted: #94a3b8;
      --accent: #60a5fa;
      --ok: #4ade80;
      --warn: #fbbf24;
      --err: #f87171;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 14px;
    background: var(--bg);
    color: var(--fg);
    font: 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei UI", sans-serif;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  .title { font-size: 15px; font-weight: 600; margin: 0; }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    padding: 3px 8px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--muted);
  }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--muted); }
  .dot.ok { background: var(--ok); }
  .dot.warn { background: var(--warn); }
  .dot.err { background: var(--err); }
  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px;
    margin-bottom: 10px;
  }
  .section-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
    margin: 0 0 10px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 6px 0;
  }
  .row + .row { border-top: 1px solid var(--border); }
  select, button {
    font: inherit;
    color: var(--fg);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 7px;
    padding: 4px 8px;
    cursor: pointer;
  }
  button:hover { border-color: var(--accent); }
  .plugin-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 0;
  }
  .plugin-top {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .desc-input {
    width: 100%;
    font: inherit;
    font-size: 12px;
    color: var(--fg);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 4px 8px;
  }
  .desc-input:focus { outline: none; border-color: var(--accent); }
  .plugin-item + .plugin-item { border-top: 1px solid var(--border); }
  .plugin-icon {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    flex-shrink: 0;
    object-fit: contain;
  }
  .plugin-meta { flex: 1; min-width: 0; }
  .plugin-name { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .plugin-id { font-size: 11px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .actions { display: inline-flex; align-items: center; gap: 4px; }
  .mini-btn { padding: 2px 6px; font-size: 11px; }
  .hint { font-size: 12px; color: var(--muted); margin: 6px 0 0; }
  .log-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .log-box {
    max-height: 180px;
    overflow: auto;
    font: 11px/1.45 ui-monospace, SFMono-Regular, Consolas, monospace;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px;
    white-space: pre-wrap;
    word-break: break-all;
    color: var(--muted);
  }
</style>
</head>
<body>
  <div class="header">
    <h1 class="title">Plugin Dock</h1>
    <span class="badge"><span id="cdp-dot" class="dot"></span><span id="cdp-text">检测中...</span></span>
  </div>

  <div class="card">
    <div class="section-title">顶栏显示样式</div>
    <div class="row">
      <span>按钮样式</span>
      <select id="display-mode">
        <option value="icon">仅图标（紧凑）</option>
        <option value="pill">图标 + 名称</option>
      </select>
    </div>
    <div class="row">
      <span>在 ⋮ 左侧显示分隔线</span>
      <input id="show-divider" type="checkbox" />
    </div>
    <div class="row">
      <span>在顶栏显示 Plugin Dock 自身</span>
      <input id="show-self" type="checkbox" />
    </div>
  </div>

  <div class="card">
    <div class="section-title">已发现的 UI 插件</div>
    <div id="plugin-list">加载中...</div>
    <p class="hint">勾选即固定到右上角顶栏（⋮ 左侧）；也可直接在顶栏拖拽图标排序。</p>
  </div>

  <div class="card">
    <div class="log-head">
      <div class="section-title" style="margin:0">操作日志</div>
      <button id="clear-logs" class="mini-btn">清空</button>
    </div>
    <div id="log-box" class="log-box">暂无日志</div>
    <p id="log-path" class="hint"></p>
  </div>

  <script>
    const cdpLabels = {
      ok: ['ok', '顶栏已挂载'],
      missing: ['warn', '未检测到 CDP 端口'],
      unreachable: ['err', 'CDP 无法连接'],
      unverified: ['warn', '等待宿主会话'],
      'no-anchor': ['warn', '未找到顶栏锚点'],
      'inject-failed': ['err', '注入失败'],
      unknown: ['warn', '初始化中...'],
    };

    let state = { plugins: [], settings: { displayMode: 'icon', showDivider: true, showSelf: false, hiddenIds: [], order: [] }, cdpStatus: 'unknown' };

    async function api(path, body) {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
      return res.json();
    }

    function orderedPlugins() {
      const idx = new Map((state.settings.order || []).map((id, i) => [id, i]));
      return [...state.plugins].sort((a, b) => {
        const ai = idx.has(a.id) ? idx.get(a.id) : Number.MAX_SAFE_INTEGER;
        const bi = idx.has(b.id) ? idx.get(b.id) : Number.MAX_SAFE_INTEGER;
        return ai !== bi ? ai - bi : a.title.localeCompare(b.title);
      });
    }

    async function savePatch(patch) {
      state.settings = await api('/api/settings', patch);
      render();
    }

    function render() {
      const [cls, text] = cdpLabels[state.cdpStatus] || cdpLabels.unknown;
      document.getElementById('cdp-dot').className = 'dot ' + cls;
      document.getElementById('cdp-text').textContent = text;
      document.getElementById('display-mode').value = state.settings.displayMode || 'icon';
      document.getElementById('show-divider').checked = state.settings.showDivider !== false;
      document.getElementById('show-self').checked = state.settings.showSelf === true;

      const listEl = document.getElementById('plugin-list');
      const items = orderedPlugins().filter(p => !p.isSelf || state.settings.showSelf);
      if (!items.length) {
        listEl.innerHTML = '<div class="hint">暂无其他可固定的 UI 插件</div>';
        return;
      }
      const hidden = new Set(state.settings.hiddenIds || []);
      const customDescs = state.settings.customDescriptions || {};
      listEl.textContent = '';

      items.forEach((p, index) => {
        const row = document.createElement('div');
        row.className = 'plugin-item';
        const top = document.createElement('div');
        top.className = 'plugin-top';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !hidden.has(p.id);
        cb.addEventListener('change', () => {
          const next = new Set(state.settings.hiddenIds || []);
          if (cb.checked) next.delete(p.id); else next.add(p.id);
          savePatch({ hiddenIds: [...next] });
        });

        const icon = document.createElement('img');
        icon.className = 'plugin-icon';
        if (p.iconDataUri) icon.src = p.iconDataUri;
        else icon.style.display = 'none';

        const meta = document.createElement('div');
        meta.className = 'plugin-meta';
        meta.innerHTML = '<div class="plugin-name"></div><div class="plugin-id"></div>';
        meta.querySelector('.plugin-name').textContent = p.title;
        meta.querySelector('.plugin-id').textContent = p.id;

        const actions = document.createElement('div');
        actions.className = 'actions';
        const up = document.createElement('button');
        up.className = 'mini-btn';
        up.textContent = '↑';
        up.disabled = index === 0;
        up.onclick = () => {
          const ids = items.map(x => x.id);
          [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
          savePatch({ order: ids });
        };
        const down = document.createElement('button');
        down.className = 'mini-btn';
        down.textContent = '↓';
        down.disabled = index === items.length - 1;
        down.onclick = () => {
          const ids = items.map(x => x.id);
          [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
          savePatch({ order: ids });
        };
        actions.append(up, down);

        const descInput = document.createElement('input');
        descInput.type = 'text';
        descInput.className = 'desc-input';
        descInput.placeholder = p.description || '输入简短中文简介（留空使用默认）';
        descInput.value = customDescs[p.id] || '';
        descInput.addEventListener('change', () => {
          const next = { ...(state.settings.customDescriptions || {}) };
          const val = descInput.value.trim();
          if (val) next[p.id] = val; else delete next[p.id];
          savePatch({ customDescriptions: next });
        });

        top.append(cb, icon, meta, actions);
        row.append(top, descInput);
        listEl.appendChild(row);
      });

      const logBox = document.getElementById('log-box');
      const logPathEl = document.getElementById('log-path');
      if (logPathEl && state.logPath) logPathEl.textContent = '日志文件：' + state.logPath;
      if (logBox) {
        const logs = Array.isArray(state.logs) ? state.logs : [];
        logBox.textContent = logs.length
          ? logs.map(l => (l.ts || '').slice(11, 19) + ' [' + l.event + '] ' + JSON.stringify(l.detail || {})).join('\\n')
          : '暂无日志';
        logBox.scrollTop = logBox.scrollHeight;
      }
    }

    document.getElementById('display-mode').addEventListener('change', e => savePatch({ displayMode: e.target.value }));
    document.getElementById('show-divider').addEventListener('change', e => savePatch({ showDivider: e.target.checked }));
    document.getElementById('show-self').addEventListener('change', e => savePatch({ showSelf: e.target.checked }));
    document.getElementById('clear-logs').addEventListener('click', async () => {
      await api('/api/logs/clear', {});
      refresh();
    });

    async function refresh() {
      if (document.activeElement?.classList?.contains('desc-input')) return;
      try {
        state = await api('/api/state', {});
        render();
      } catch {}
    }
    refresh();
    setInterval(refresh, 3000);
  </script>
</body>
</html>`;
