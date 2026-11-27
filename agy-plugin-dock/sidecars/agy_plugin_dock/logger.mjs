import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const MAX_LOG_LINES = 50;
const MAX_LINE_CHARS = 1024;

function defaultLogPath(env = process.env) {
  if (env.AGY_PLUGIN_DOCK_LOG) return env.AGY_PLUGIN_DOCK_LOG;
  if (process.platform === 'win32' && existsSync('E:\\BuildCache')) {
    return join('E:\\BuildCache', 'agy-plugin-dock', 'dock.log');
  }
  if (env.ANTIGRAVITY_EXECUTABLE_DATA_DIR) {
    return join(env.ANTIGRAVITY_EXECUTABLE_DATA_DIR, 'dock.log');
  }
  return join(tmpdir(), 'agy-plugin-dock', 'dock.log');
}

export function createLogger(options = {}) {
  const filePath = options.filePath || defaultLogPath(options.env);
  const ring = [];

  const ensureDir = () => {
    try { mkdirSync(dirname(filePath), { recursive: true }); } catch {}
  };

  const log = (event, detail = {}) => {
    const ts = new Date().toISOString();
    const entry = { ts, event, detail };
    ring.push(entry);
    if (ring.length > MAX_LOG_LINES) ring.shift();
    let payload = typeof detail === 'string' ? detail : JSON.stringify(detail);
    if (payload.length > MAX_LINE_CHARS) payload = payload.slice(0, MAX_LINE_CHARS) + '…';
    const line = `${ts} [${event}] ${payload}`;
    try {
      ensureDir();
      let lines = [];
      if (existsSync(filePath)) {
        lines = readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
      }
      lines.push(line);
      if (lines.length > MAX_LOG_LINES) lines = lines.slice(-MAX_LOG_LINES);
      writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
    } catch {}
    return entry;
  };

  const recent = (limit = MAX_LOG_LINES) => ring.slice(-limit);

  const clear = () => {
    ring.length = 0;
    try {
      ensureDir();
      writeFileSync(filePath, '', 'utf8');
    } catch {}
  };

  return { filePath, log, recent, clear };
}
