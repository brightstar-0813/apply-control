'use strict';
// Shared config for server, hook and CLI. Secrets live OUTSIDE the repo in
// %LOCALAPPDATA%\bidbot-dashboard (password hash, hook token, sqlite db, screenshots).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');

const DATA_DIR = process.env.BIDBOT_DASH_DATA ||
  path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'bidbot-dashboard');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const WORKSPACE = path.resolve(__dirname, '..', '..');

const DEFAULTS = {
  port: 8787,
  passwordHash: null,          // scrypt "salt:hash" hex
  hookToken: null,             // shared secret hook.js / cli.js -> server
  setupToken: null,            // one-time token to set the password (local only)
  sessionDays: 30,
  publicUrl: null,            // e.g. https://bidbot.<tailnet>.ts.net (used in Slack pings)
  slack: { enabled: true },   // pings only for things that need the user
  runner: {
    enabled: true,
    autoWake: true,            // dashboard message while agent idle -> resume session headless
    permissionMode: 'auto',
    claudePath: null,          // null = newest VS Code extension binary
    cwd: WORKSPACE,
  },
  gates: [
    { id: 'git-push', enabled: true, label: 'git push', tool: '^(Bash|PowerShell)$', input: 'git\\s+push' },
    { id: 'bot-code', enabled: false, label: 'Edit bot code (C:\\brightstar-bid-bot)', tool: '^(Edit|Write|NotebookEdit)$', input: 'brightstar-bid-bot' },
    { id: 'mark-applied', enabled: false, label: 'Click in bot window (Mark applied etc.) - broad', tool: 'trigger_extension_action', input: '.' },
  ],
};

function ensureDir() { fs.mkdirSync(DATA_DIR, { recursive: true }); }

function load() {
  ensureDir();
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { /* first run */ }
  const merged = { ...DEFAULTS, ...cfg, runner: { ...DEFAULTS.runner, ...(cfg.runner || {}) } };
  if (!Array.isArray(cfg.gates)) merged.gates = DEFAULTS.gates;
  let dirty = false;
  if (!merged.hookToken) { merged.hookToken = crypto.randomBytes(24).toString('hex'); dirty = true; }
  if (!merged.passwordHash && !merged.setupToken) { merged.setupToken = crypto.randomBytes(16).toString('hex'); dirty = true; }
  if (dirty || !fs.existsSync(CONFIG_FILE)) save(merged);
  return merged;
}

function save(cfg) {
  ensureDir();
  const tmp = CONFIG_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2));
  fs.renameSync(tmp, CONFIG_FILE);
}

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return salt.toString('hex') + ':' + hash.toString('hex');
}

function checkPassword(pw, stored) {
  if (!stored || typeof pw !== 'string') return false;
  const [s, h] = stored.split(':');
  const want = Buffer.from(h, 'hex');
  const got = crypto.scryptSync(pw, Buffer.from(s, 'hex'), want.length);
  return crypto.timingSafeEqual(want, got);
}

// Newest Claude Code binary bundled with the VS Code extension (version changes on update).
function findClaude(cfg) {
  if (cfg && cfg.runner && cfg.runner.claudePath && fs.existsSync(cfg.runner.claudePath)) return cfg.runner.claudePath;
  const ext = path.join(os.homedir(), '.vscode', 'extensions');
  let best = null;
  try {
    for (const d of fs.readdirSync(ext)) {
      if (!d.startsWith('anthropic.claude-code-')) continue;
      const exe = path.join(ext, d, 'resources', 'native-binary', process.platform === 'win32' ? 'claude.exe' : 'claude');
      if (!fs.existsSync(exe)) continue;
      const st = fs.statSync(exe);
      if (!best || st.mtimeMs > best.t) best = { exe, t: st.mtimeMs };
    }
  } catch { /* no extensions dir */ }
  return best ? best.exe : null;
}

module.exports = { DATA_DIR, CONFIG_FILE, WORKSPACE, load, save, hashPassword, checkPassword, findClaude };
