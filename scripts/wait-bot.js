'use strict';
// Wait until a person's bot batch stops running (paused / complete / offline), then print why and exit.
// Read-only: polls Mission Control's /cli/bots. Usage: node scripts/wait-bot.js <person> [maxMinutes=9]
// Keep maxMinutes under the shell tool's 10-minute limit and call it again while it prints "still running".
const config = require('../dashboard/lib/config');
const cfg = config.load();
const who = new RegExp(process.argv[2] || 'avash', 'i');
const MAX_MIN = Number(process.argv[3] || 9);
const t0 = Date.now();
let offlineSince = 0, last = '', counters = null;
async function tick() {
  let bots;
  try {
    const r = await fetch(`http://127.0.0.1:${cfg.port}/cli/bots`, { headers: { 'X-Hook-Token': cfg.hookToken } });
    bots = await r.json();
  } catch (e) { last = 'dashboard unreachable: ' + e.message; return null; }
  const b = bots.find((x) => who.test(String(x.person) + String(x.label)));
  if (!b || !b.online) {
    offlineSince = offlineSince || Date.now();
    return Date.now() - offlineSince > 120e3 ? 'bot window offline for 2 min' : null;
  }
  offlineSince = 0;
  const st = String(b.status || ''); const bt = b.batch || {};
  last = st; counters = b.counters;
  const cooling = /Cooling down/i.test(st); // its text contains "rate-limit protection"
  if (/Batch paused|Batch complete/i.test(st)) return st;
  if (!cooling && /rate.?limit|too many requests/i.test(st)) return st;
  if (bt.paused || (bt.running === false && !cooling)) return 'batch not running: ' + st;
  return null;
}
(async () => {
  for (;;) {
    const why = await tick();
    const waitedMin = Math.round((Date.now() - t0) / 60000);
    if (why) { console.log(JSON.stringify({ stopped: true, why, counters, waitedMin })); return; }
    if (Date.now() - t0 > MAX_MIN * 60e3) { console.log(JSON.stringify({ stopped: false, why: 'still running', last, counters, waitedMin })); return; }
    await new Promise((res) => setTimeout(res, 20000));
  }
})();
