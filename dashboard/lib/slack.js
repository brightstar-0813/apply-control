'use strict';
// Slack pings from Mission Control — only things that need the user (a question, an approval,
// a failed headless run), each short and pointing to the dashboard. Webhook: user env var
// BIDBOT_SLACK_WEBHOOK (never stored or logged here).
const https = require('node:https');
const { execFileSync } = require('node:child_process');

function webhook() {
  if (process.env.BIDBOT_SLACK_WEBHOOK) return process.env.BIDBOT_SLACK_WEBHOOK;
  if (process.platform !== 'win32') return null;
  try {
    const out = execFileSync('reg', ['query', 'HKCU\\Environment', '/v', 'BIDBOT_SLACK_WEBHOOK'], { encoding: 'utf8', windowsHide: true });
    const m = out.match(/BIDBOT_SLACK_WEBHOOK\s+REG_\w+\s+(\S+)/);
    return m ? m[1] : null;
  } catch { return null; }
}

function createSlack({ getCfg, onEvent }) {
  const last = new Map(); // dedupe key -> ts

  function post(text) {
    const url = webhook();
    if (!url || !/^https:\/\/hooks\.slack\.com\//.test(url)) return Promise.resolve(false);
    return new Promise((resolve) => {
      const body = Buffer.from(JSON.stringify({ text }));
      const u = new URL(url);
      const req = https.request({ host: u.host, path: u.pathname, method: 'POST', timeout: 8000,
        headers: { 'Content-Type': 'application/json', 'Content-Length': body.length } }, (res) => { res.resume(); resolve(res.statusCode === 200); });
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.on('error', () => resolve(false));
      req.end(body);
    });
  }

  /** key: dedupe id; minGapMs: don't repeat the same key sooner than this. */
  async function notify(key, text, minGapMs = 60e3) {
    const cfg = getCfg();
    if (!cfg.slack || cfg.slack.enabled === false) return false;
    const now = Date.now();
    if (now - (last.get(key) || 0) < minGapMs) return false;
    last.set(key, now);
    const link = cfg.publicUrl ? `\n👉 ${cfg.publicUrl}` : '';
    const ok = await post(`${text}${link}`);
    onEvent({ kind: 'notify', ok, summary: `Slack ping${ok ? '' : ' failed'}: ${text.split('\n')[0].slice(0, 160)}` });
    return ok;
  }

  return { notify, post };
}

module.exports = { createSlack };
