#!/usr/bin/env node
'use strict';
// Agent-side CLI for Mission Control (always allowed by the hook, even while paused).
//   node dashboard/cli.js status "Avash · Dice · row #24 Acme - filling Greenhouse form"
//   node dashboard/cli.js say "text"            (or: say --file msg.txt) - post to the inbox; a Q<n> becomes a card
//   node dashboard/cli.js wait [--timeout 600]   - block until the user sends a dashboard message, print it
//   node dashboard/cli.js state                  - JSON state (paused, open questions, ...)
//   node dashboard/cli.js setup-code             - first-run code for the password page (local only)
const fs = require('node:fs');
const http = require('node:http');
const config = require('./lib/config');

const cfg = config.load();
const [cmd, ...rest] = process.argv.slice(2);

function call(method, path, body, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = http.request({ host: '127.0.0.1', port: cfg.port, path, method, timeout: timeoutMs, agent: false,
      headers: { 'X-Hook-Token': cfg.hookToken, ...(data ? { 'Content-Type': 'application/json', 'Content-Length': data.length } : {}) } }, (res) => {
      let s = ''; res.setEncoding('utf8'); res.on('data', (c) => { s += c; });
      res.on('end', () => { try { resolve(JSON.parse(s)); } catch { resolve({ raw: s }); } });
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', reject);
    req.end(data || undefined);
  });
}

function textArg() {
  const i = rest.indexOf('--file');
  if (i >= 0) return fs.readFileSync(rest[i + 1], 'utf8');
  return rest.join(' ');
}

(async () => {
  try {
    switch (cmd) {
      case 'status': await call('POST', '/cli/status', { text: textArg() }); console.log('ok'); break;
      case 'say': await call('POST', '/cli/say', { text: textArg() }); console.log('ok'); break;
      case 'wait': {
        const i = rest.indexOf('--timeout');
        const t = i >= 0 ? Number(rest[i + 1]) : 600;
        const r = await call('GET', `/cli/wait?timeout=${t}`, null, (t + 15) * 1000);
        if (r.messages && r.messages.length) {
          console.log('Messages from the user (dashboard):');
          for (const m of r.messages) console.log('- ' + m.text);
        } else console.log('(no dashboard message within ' + t + ' s)');
        break;
      }
      case 'state': console.log(JSON.stringify(await call('GET', '/cli/state'), null, 2)); break;
      case 'setup-code':
        if (cfg.passwordHash) console.log('Password already set. To reset it, delete passwordHash in ' + config.CONFIG_FILE + ' and restart the server.');
        else console.log(`Open http://localhost:${cfg.port} on this server and enter setup code: ${cfg.setupToken}`);
        break;
      default:
        console.log('usage: cli.js status|say|wait|state|setup-code');
        process.exitCode = 2;
    }
  } catch (e) {
    console.log('Mission Control not reachable (' + e.message + '). Start it: powershell -File dashboard/start.ps1');
    process.exitCode = 1;
  }
})();
