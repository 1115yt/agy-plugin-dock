import { realpathSync, watch } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverUiPlugins } from './discovery.mjs';
import { startDockInjector } from './dock_injector.mjs';
import { createLogger } from './logger.mjs';
import { applySettingsToPlugins, createSettingsStore } from './settings.mjs';
import { PANEL_HTML } from './ui.mjs';

const DISCOVERY_TTL_MS = 5000;

function installEpipeGuard(proc = process) {
  const isEpipe = err => err?.code === 'EPIPE';
  for (const stream of [proc.stdout, proc.stderr]) {
    stream?.on?.('error', err => { if (!isEpipe(err)) throw err; });
  }
  const fatal = err => {
    if (isEpipe(err)) return;
    try { console.error('[agy-plugin-dock] fatal:', err); } catch {}
    proc.exit(1);
  };
  proc.on('uncaughtException', fatal);
  proc.on('unhandledRejection', fatal);
}

function resolveProductRoots(dataDir) {
  if (dataDir) {
    const root = resolve(dataDir);
    for (let dir = root; dir !== dirname(dir); dir = dirname(dir)) {
      if (basename(dir) === 'sidecar_data') return [dirname(dir)];
    }
    return [root];
  }
  return ['antigravity', 'antigravity-ide', 'antigravity-cli'].map(product =>
    join(homedir(), '.gemini', product));
}

const settingsStore = createSettingsStore();
const logger = createLogger();
let cachedPlugins = [];
let lastDiscoverMs = 0;
let dockInjector = null;
let lastCdpStatus = 'unknown';

async function getDiscoveredPlugins(force = false) {
  const now = Date.now();
  if (!force && lastDiscoverMs && now - lastDiscoverMs < DISCOVERY_TTL_MS) {
    return cachedPlugins;
  }
  cachedPlugins = await discoverUiPlugins();
  lastDiscoverMs = Date.now();
  return cachedPlugins;
}

async function buildDockPayload() {
  const all = await getDiscoveredPlugins();
  const settings = settingsStore.read();
  const plugins = applySettingsToPlugins(all, settings);
  return {
    displayMode: settings.displayMode,
    showDivider: settings.showDivider,
    plugins,
  };
}

export async function startPanel(loadSdk = () => import('sidecar_sdk'), env = process.env) {
  if (!env.ANTIGRAVITY_SIDECAR_UI_TOKEN?.trim()) {
    console.error('[agy-plugin-dock] sidebar disabled: host did not supply a UI token');
    return null;
  }
  const { SidecarApp } = await loadSdk();
  const app = new SidecarApp();
  app.page('/', () => PANEL_HTML);
  app.api('/api/state', async () => ({
    plugins: await getDiscoveredPlugins(true),
    settings: settingsStore.read(),
    cdpStatus: dockInjector?.status?.() ?? 'unknown',
    logPath: logger.filePath,
    logs: logger.recent(50),
  }), 'POST');
  app.api('/api/settings', data => {
    const updated = settingsStore.update(data);
    logger.log('settings-update', data);
    void dockInjector?.tick?.();
    return updated;
  }, 'POST');
  app.api('/api/logs/clear', () => {
    logger.clear();
    return { ok: true };
  }, 'POST');
  await app.run();
  return app;
}

const isMain = (() => {
  try {
    return Boolean(process.argv[1]) && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

function startSelfReloadWatcher(dir, onChange) {
  let timer = null;
  let watcher = null;
  try {
    watcher = watch(dir, (_event, filename) => {
      if (filename && !/\.(mjs|json)$/i.test(String(filename))) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => onChange(String(filename || '')), 300);
    });
    watcher.on('error', () => {});
  } catch {}
  return () => {
    if (timer) clearTimeout(timer);
    try { watcher?.close(); } catch {}
  };
}

if (isMain) {
  installEpipeGuard();
  if (process.env.ANTIGRAVITY_LS_ADDRESS || process.env.ANTIGRAVITY_SIDECAR_WEB_PORT) {
    logger.log('sidecar-start', { pid: process.pid });
    dockInjector = startDockInjector(buildDockPayload, {
      productRoots: resolveProductRoots(process.env.ANTIGRAVITY_EXECUTABLE_DATA_DIR),
      onOrderChange: order => {
        settingsStore.update({ order });
        logger.log('order-saved', { order });
      },
      onStatus: status => {
        if (status !== lastCdpStatus) {
          lastCdpStatus = status;
          logger.log('cdp-status', { status });
        }
      },
      onLog: (event, detail) => logger.log(event, detail),
    });

    let stopping = false;
    const shutdown = async reason => {
      if (stopping) return;
      stopping = true;
      stopWatching();
      logger.log('sidecar-stop', { reason });
      console.log('[agy-plugin-dock] stopping:', reason);
      try { await dockInjector?.stop?.(); }
      finally { process.exit(0); }
    };
    const stopWatching = startSelfReloadWatcher(dirname(fileURLToPath(import.meta.url)), () => void shutdown('plugin files changed'));
    for (const sig of ['SIGTERM', 'SIGINT']) {
      process.once(sig, () => void shutdown(sig));
    }
    if (process.env.ANTIGRAVITY_SIDECAR_WEB_PORT) {
      await startPanel();
    }
  }
}
