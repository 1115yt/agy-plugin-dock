import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const DEFAULT_SETTINGS = Object.freeze({
  displayMode: 'icon',
  showDivider: true,
  showSelf: false,
  hiddenIds: Object.freeze([]),
  order: Object.freeze([]),
  customDescriptions: Object.freeze({}),
});

function defaultSettingsPath(env = process.env) {
  if (env.ANTIGRAVITY_EXECUTABLE_DATA_DIR) {
    return join(env.ANTIGRAVITY_EXECUTABLE_DATA_DIR, 'settings.json');
  }
  return join(homedir(), '.gemini', 'antigravity', 'sidecar_data', 'agy-plugin-dock', 'agy_plugin_dock', 'settings.json');
}

export function sanitizeSettings(raw, fallback = DEFAULT_SETTINGS) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const displayMode = input.displayMode === 'pill' || input.displayMode === 'icon'
    ? input.displayMode
    : fallback.displayMode;
  const showDivider = typeof input.showDivider === 'boolean' ? input.showDivider : fallback.showDivider;
  const showSelf = typeof input.showSelf === 'boolean' ? input.showSelf : fallback.showSelf;
  const hiddenIds = Array.isArray(input.hiddenIds)
    ? [...new Set(input.hiddenIds.filter(id => typeof id === 'string' && id.trim().length > 0))]
    : [...fallback.hiddenIds];
  const order = Array.isArray(input.order)
    ? [...new Set(input.order.filter(id => typeof id === 'string' && id.trim().length > 0))]
    : [...fallback.order];
  const rawDescs = input.customDescriptions && typeof input.customDescriptions === 'object' && !Array.isArray(input.customDescriptions)
    ? input.customDescriptions
    : fallback.customDescriptions || {};
  const customDescriptions = {};
  for (const [k, v] of Object.entries(rawDescs)) {
    if (typeof k === 'string' && k.trim() && typeof v === 'string' && v.trim()) {
      customDescriptions[k.trim()] = v.trim().slice(0, 120);
    }
  }
  return { displayMode, showDivider, showSelf, hiddenIds, order, customDescriptions };
}

export function createSettingsStore(options = {}) {
  const filePath = options.filePath || defaultSettingsPath(options.env);
  let cached = null;

  const read = () => {
    if (cached) return cached;
    try {
      const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
      cached = sanitizeSettings(parsed);
    } catch {
      cached = sanitizeSettings(DEFAULT_SETTINGS);
    }
    return cached;
  };

  const write = next => {
    const clean = sanitizeSettings(next, read());
    mkdirSync(dirname(filePath), { recursive: true });
    const tmp = `${filePath}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(clean, null, 2) + '\n', 'utf8');
    renameSync(tmp, filePath);
    cached = clean;
    return clean;
  };

  const update = patch => {
    const current = read();
    return write({ ...current, ...(patch && typeof patch === 'object' ? patch : {}) });
  };

  return { filePath, read, update };
}

export function applySettingsToPlugins(plugins, settings) {
  const hidden = new Set(settings.hiddenIds || []);
  const orderIndex = new Map((settings.order || []).map((id, idx) => [id, idx]));
  const customDescs = settings.customDescriptions || {};
  const visible = plugins.filter(p => {
    if (p.isSelf && !settings.showSelf) return false;
    if (hidden.has(p.id)) return false;
    return true;
  }).map(p => (customDescs[p.id] ? { ...p, description: customDescs[p.id] } : p));
  return visible.sort((a, b) => {
    const ai = orderIndex.has(a.id) ? orderIndex.get(a.id) : Number.MAX_SAFE_INTEGER;
    const bi = orderIndex.has(b.id) ? orderIndex.get(b.id) : Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    return a.title.localeCompare(b.title);
  });
}
