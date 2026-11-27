import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverUiPluginsSync } from '../agy-plugin-dock/sidecars/agy_plugin_dock/discovery.mjs';
import { applySettingsToPlugins, createSettingsStore } from '../agy-plugin-dock/sidecars/agy_plugin_dock/settings.mjs';
import { buildDockRuntimeBundle } from '../agy-plugin-dock/sidecars/agy_plugin_dock/dock_injector.mjs';
import { createLogger } from '../agy-plugin-dock/sidecars/agy_plugin_dock/logger.mjs';

const TMP_ROOT = join(process.env.TEMP || process.env.TMP || tmpdir(), `agy-plugin-dock-test-${process.pid}`);

test('discoverUiPluginsSync finds AUX_PANE plugins, inlines logos, and skips disabled', () => {
  const root = join(TMP_ROOT, 'disc');
  rmSync(root, { recursive: true, force: true });

  const userPlugins = join(root, 'plugins');
  const p1 = join(userPlugins, 'alpha');
  mkdirSync(join(p1, 'sidecars', 'panel'), { recursive: true });
  writeFileSync(join(p1, 'plugin.json'), JSON.stringify({ name: 'alpha', logo: 'logo.svg' }));
  writeFileSync(join(p1, 'logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  writeFileSync(join(p1, 'sidecars', 'panel', 'sidecar.json'), JSON.stringify({
    has_web_ui: true,
    ui_config: { views: [{ entrypoint: 'SIDECAR_UI_ENTRYPOINT_AUX_PANE', path: '/', title: 'Alpha Panel' }] },
  }));

  const p2 = join(userPlugins, 'disabled-one');
  mkdirSync(join(p2, 'sidecars', 'panel'), { recursive: true });
  writeFileSync(join(p2, 'plugin.json'), JSON.stringify({ name: 'disabled-one', disabled: true }));
  writeFileSync(join(p2, 'sidecars', 'panel', 'sidecar.json'), JSON.stringify({
    has_web_ui: true,
    ui_config: { views: [{ entrypoint: 'SIDECAR_UI_ENTRYPOINT_AUX_PANE', path: '/', title: 'Disabled' }] },
  }));

  const selfDir = join(userPlugins, 'agy-plugin-dock');
  mkdirSync(join(selfDir, 'sidecars', 'agy_plugin_dock'), { recursive: true });
  writeFileSync(join(selfDir, 'plugin.json'), JSON.stringify({ name: 'agy-plugin-dock' }));
  writeFileSync(join(selfDir, 'sidecars', 'agy_plugin_dock', 'sidecar.json'), JSON.stringify({
    has_web_ui: true,
    ui_config: { views: [{ entrypoint: 'SIDECAR_UI_ENTRYPOINT_AUX_PANE', path: '/', title: 'Plugin Dock' }] },
  }));

  const found = discoverUiPluginsSync({
    roots: { userPluginsDir: userPlugins, userSidecarsDir: join(root, 'sidecars'), builtinPluginsDirs: [], builtinSidecarsDirs: [] },
  });

  assert.equal(found.length, 2);
  const alpha = found.find(x => x.id === 'alpha/panel');
  assert.ok(alpha);
  assert.equal(alpha.title, 'Alpha Panel');
  assert.ok(alpha.iconDataUri.startsWith('data:image/svg+xml;base64,'));
  assert.equal(alpha.isSelf, false);

  const selfItem = found.find(x => x.id === 'agy-plugin-dock/agy_plugin_dock');
  assert.ok(selfItem);
  assert.equal(selfItem.isSelf, true);

  rmSync(root, { recursive: true, force: true });
});

test('settings store persists and applies ordering, hiding, and self-exclusion', () => {
  const settingsFile = join(TMP_ROOT, 'settings', 'settings.json');
  rmSync(join(TMP_ROOT, 'settings'), { recursive: true, force: true });

  const store = createSettingsStore({ filePath: settingsFile });
  assert.equal(store.read().displayMode, 'icon');
  assert.equal(store.read().showSelf, false);

  store.update({ displayMode: 'pill', hiddenIds: ['b/s'], order: ['c/s', 'a/s'], customDescriptions: { 'a/s': '自定义中文简介' } });
  const reloaded = createSettingsStore({ filePath: settingsFile }).read();
  assert.equal(reloaded.displayMode, 'pill');
  assert.deepEqual(reloaded.order, ['c/s', 'a/s']);

  const plugins = [
    { id: 'a/s', title: 'Alpha', description: 'Original', isSelf: false },
    { id: 'b/s', title: 'Beta', description: 'Original', isSelf: false },
    { id: 'c/s', title: 'Gamma', description: 'Original', isSelf: false },
    { id: 'agy-plugin-dock/agy_plugin_dock', title: 'Plugin Dock', description: 'Self', isSelf: true },
  ];
  const visible = applySettingsToPlugins(plugins, reloaded);
  assert.deepEqual(visible.map(p => p.id), ['c/s', 'a/s']);
  assert.equal(visible.find(p => p.id === 'a/s').description, '自定义中文简介');

  rmSync(join(TMP_ROOT, 'settings'), { recursive: true, force: true });
});

test('buildDockRuntimeBundle compiles cleanly and is isolated from agy-capsule globals', () => {
  const bundle = buildDockRuntimeBundle(123456);
  assert.ok(bundle.hash.length === 16);
  assert.doesNotThrow(() => new Function(bundle.code));
  assert.ok(bundle.code.includes('__agyPluginDock'));
  assert.ok(!bundle.code.includes('__agyCapsuleDeck'));
  assert.ok(!bundle.code.includes('agy-capsule-host'));
});

test('logger caps file and ring buffer to 50 lines', () => {
  const logDir = join(TMP_ROOT, 'logs');
  const logFile = join(logDir, 'dock.log');
  rmSync(logDir, { recursive: true, force: true });

  const logger = createLogger({ filePath: logFile });
  for (let i = 0; i < 75; i++) logger.log('evt', { i });
  assert.equal(logger.recent(100).length, 50);
  assert.equal(logger.recent(1)[0].detail.i, 74);

  logger.clear();
  assert.equal(logger.recent(10).length, 0);
  rmSync(logDir, { recursive: true, force: true });
});

test('local discovery runs safely without throwing even on clean machines', () => {
  const found = discoverUiPluginsSync();
  assert.ok(Array.isArray(found));
});
