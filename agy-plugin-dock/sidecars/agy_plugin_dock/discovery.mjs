import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { extname, join, resolve } from 'node:path';

export const SELF_PLUGIN_NAME = 'agy-plugin-dock';
export const SELF_SIDECAR_NAME = 'agy_plugin_dock';

const BUILTIN_ZH_DESCRIPTIONS = {
  'agy-capsule': '实时监控上下文窗口、Token 用量与模型配额',
  'agy-dart': '上下文压缩、KV 缓存保护与本地代码检索加速',
  swarm: '多智能体协作看板与任务调度视图',
  'agy-plugin-dock': '将三点菜单里的 UI 插件固定到顶栏',
};

function resolveLocalizedDescription(pluginName, pluginDirName, rawDescription) {
  const key = String(pluginName || pluginDirName || '').trim().toLowerCase();
  if (BUILTIN_ZH_DESCRIPTIONS[key]) return BUILTIN_ZH_DESCRIPTIONS[key];
  const dirKey = String(pluginDirName || '').trim().toLowerCase();
  if (BUILTIN_ZH_DESCRIPTIONS[dirKey]) return BUILTIN_ZH_DESCRIPTIONS[dirKey];
  const text = String(rawDescription || '').trim();
  return text.length > 60 ? `${text.slice(0, 59)}…` : text;
}

const MIME_BY_EXT = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

function stripJsonComments(text) {
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inString) {
      out += ch;
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i++;
      continue;
    }
    out += ch;
  }
  return out.replace(/,\s*([}\]])/g, '$1');
}

export function readJsonSafe(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf8');
    return JSON.parse(stripJsonComments(raw));
  } catch {
    return null;
  }
}

export function readLogoDataUri(pluginDir, logoRelPath) {
  if (!pluginDir || typeof logoRelPath !== 'string' || !logoRelPath.trim()) return '';
  if (/^https?:\/\//i.test(logoRelPath)) return '';
  const abs = resolve(pluginDir, logoRelPath);
  const root = resolve(pluginDir);
  if (!abs.startsWith(root)) return '';
  const ext = extname(abs).toLowerCase();
  const mime = MIME_BY_EXT[ext];
  if (!mime || !existsSync(abs)) return '';
  try {
    const bytes = readFileSync(abs);
    if (bytes.length > 256 * 1024) return '';
    return `data:${mime};base64,${bytes.toString('base64')}`;
  } catch {
    return '';
  }
}

function listSubdirs(dir) {
  if (!dir || !existsSync(dir)) return [];
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
  } catch {
    return [];
  }
}

function extractAuxPaneView(sidecarJson) {
  if (!sidecarJson || sidecarJson.has_web_ui !== true) return null;
  const views = sidecarJson.ui_config?.views;
  if (!Array.isArray(views)) return null;
  return views.find(v => v && v.entrypoint === 'SIDECAR_UI_ENTRYPOINT_AUX_PANE') || null;
}

export function defaultDiscoveryRoots(home = homedir()) {
  return {
    userPluginsDir: join(home, '.gemini', 'config', 'plugins'),
    userSidecarsDir: join(home, '.gemini', 'config', 'sidecars'),
    builtinPluginsDirs: [
      join(home, '.gemini', 'antigravity', 'builtin', 'plugins'),
      join(home, '.gemini', 'antigravity-ide', 'builtin', 'plugins'),
    ],
    builtinSidecarsDirs: [
      join(home, '.gemini', 'antigravity', 'builtin', 'sidecars'),
      join(home, '.gemini', 'antigravity-ide', 'builtin', 'sidecars'),
    ],
  };
}

export async function fetchDisabledPluginDirs(env = process.env, fetchImpl = globalThis.fetch) {
  const lsAddr = env.ANTIGRAVITY_LS_ADDRESS;
  const csrf = env.ANTIGRAVITY_CSRF_TOKEN;
  if (!lsAddr || !csrf || typeof fetchImpl !== 'function') return new Set();
  try {
    const res = await fetchImpl(`http://${lsAddr}/exa.language_server_pb.LanguageServerService/GetAllPlugins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-codeium-csrf-token': csrf,
      },
      body: '{}',
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return new Set();
    const data = await res.json();
    const disabled = new Set();
    for (const p of data?.plugins || []) {
      if (p?.disabled === true) {
        if (typeof p.name === 'string' && p.name) disabled.add(p.name.toLowerCase());
        if (typeof p.path === 'string' && p.path) {
          const dir = p.path.replace(/\\/g, '/').split('/').filter(Boolean).pop();
          if (dir) disabled.add(dir.toLowerCase());
        }
      }
    }
    return disabled;
  } catch {
    return new Set();
  }
}

export function discoverUiPluginsSync(options = {}) {
  const roots = options.roots || defaultDiscoveryRoots(options.home);
  const disabledSet = options.disabledSet || new Set();
  const seen = new Map();

  const addCandidate = ({ id, pluginDirName, pluginName, title, description, viewPath, iconDataUri, source, isSelf }) => {
    if (!id || seen.has(id)) return;
    seen.set(id, {
      id,
      pluginDirName: pluginDirName || '',
      pluginName: pluginName || '',
      title: String(title || id).trim(),
      description: String(description || '').trim(),
      viewPath: typeof viewPath === 'string' && viewPath ? viewPath : '/',
      iconDataUri: iconDataUri || '',
      source,
      isSelf: Boolean(isSelf),
    });
  };

  const scanPluginRoot = (pluginsDir, source) => {
    for (const pluginDirName of listSubdirs(pluginsDir)) {
      const pluginDir = join(pluginsDir, pluginDirName);
      const pluginJson = readJsonSafe(join(pluginDir, 'plugin.json')) || {};
      const pluginName = pluginJson.name || pluginDirName;
      const isDisabled = pluginJson.disabled === true
        || disabledSet.has(pluginDirName.toLowerCase())
        || disabledSet.has(String(pluginName).toLowerCase());
      if (isDisabled) continue;

      const iconDataUri = readLogoDataUri(pluginDir, pluginJson.logo);
      const sidecarsDir = join(pluginDir, 'sidecars');
      const sidecarFolders = [];

      for (const scName of listSubdirs(sidecarsDir)) {
        sidecarFolders.push({ name: scName, dir: join(sidecarsDir, scName) });
      }

      const sidecarsJson = readJsonSafe(join(pluginDir, 'sidecars.json'));
      if (sidecarsJson && typeof sidecarsJson === 'object') {
        const list = Array.isArray(sidecarsJson) ? sidecarsJson : Object.entries(sidecarsJson).map(([k, v]) => ({ name: k, ...(typeof v === 'object' ? v : { path: v }) }));
        for (const entry of list) {
          const rel = entry?.path || entry?.dir;
          if (typeof rel !== 'string') continue;
          const abs = resolve(pluginDir, rel);
          const name = entry.name || rel.split(/[\\/]/).filter(Boolean).pop();
          if (name && !sidecarFolders.some(s => s.dir === abs)) {
            sidecarFolders.push({ name, dir: abs });
          }
        }
      }

      for (const sc of sidecarFolders) {
        const scJson = readJsonSafe(join(sc.dir, 'sidecar.json'));
        const auxView = extractAuxPaneView(scJson);
        if (!auxView) continue;
        const id = `${pluginDirName}/${sc.name}`;
        const title = auxView.title || scJson.ui_config?.display_name || scJson.display_name || pluginJson.displayName || pluginName;
        const isSelf = pluginDirName === SELF_PLUGIN_NAME || pluginName === SELF_PLUGIN_NAME || sc.name === SELF_SIDECAR_NAME;
        addCandidate({
          id,
          pluginDirName,
          pluginName,
          title,
          description: resolveLocalizedDescription(pluginName, pluginDirName, scJson.description || pluginJson.description || ''),
          viewPath: auxView.path || '/',
          iconDataUri,
          source,
          isSelf,
        });
      }
    }
  };

  const scanStandaloneSidecars = (sidecarsDir, source) => {
    for (const scName of listSubdirs(sidecarsDir)) {
      const scJson = readJsonSafe(join(sidecarsDir, scName, 'sidecar.json'));
      const auxView = extractAuxPaneView(scJson);
      if (!auxView) continue;
      const title = auxView.title || scJson.ui_config?.display_name || scJson.display_name || scName;
      addCandidate({
        id: scName,
        pluginDirName: '',
        pluginName: scName,
        title,
        description: scJson.description || '',
        viewPath: auxView.path || '/',
        iconDataUri: '',
        source,
        isSelf: scName === SELF_SIDECAR_NAME,
      });
    }
  };

  scanPluginRoot(roots.userPluginsDir, 'user-plugin');
  scanStandaloneSidecars(roots.userSidecarsDir, 'user-sidecar');
  for (const dir of roots.builtinPluginsDirs || []) scanPluginRoot(dir, 'builtin-plugin');
  for (const dir of roots.builtinSidecarsDirs || []) scanStandaloneSidecars(dir, 'builtin-sidecar');

  return [...seen.values()];
}

export async function discoverUiPlugins(options = {}) {
  const disabledSet = options.disabledSet || await fetchDisabledPluginDirs(options.env, options.fetchImpl);
  return discoverUiPluginsSync({ ...options, disabledSet });
}
