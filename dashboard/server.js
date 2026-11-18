'use strict';
// BrightStar Bid Bot - Mission Control server.
// Listens on 127.0.0.1 only; reach it remotely through Tailscale Funnel (HTTPS) + the password login.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const config = require('./lib/config');
const { open } = require('./lib/db');
const { redact, redactString, summarize, clip } = require('./lib/redact');
const { createTailer } = require('./lib/transcript');
const { createRunner } = require('./lib/runner');
const { parseQuestion } = require('./lib/questions');
const { createBots } = require('./lib/bots');
const { createSlack } = require('./lib/slack');
const BOT_ORIGIN = 'chrome-extension://jkhoiaahamddiojkmhhpnnjnkdjiiigj';

let cfg = config.load();
const db = open(config.DATA_DIR);
const PUBLIC = path.join(__dirname, 'public');
const RUNS = path.join(config.WORKSPACE, 'runs');
const SHOT = path.join(config.DATA_DIR, 'latest-shot');

// ---------- live state ----------
const S = {
  get busy() { return db.get('busy', false); },
  get paused() { return db.get('paused', false); },
  get stopReq() { return db.get('stopReq', false); },
};
const waiters = new Set();      // in-turn `cli.js wait` long-polls
const clients = new Set();      // SSE clients

function broadcast(type, data) {
  const msg = `event: ${type}\ndata: ${JSON.stringify(data || {})}\n\n`;
  for (const res of clients) { try { res.write(msg); } catch { clients.delete(res); } }
}
function addEvent(e) {
  const id = db.addEvent(e);
  db.set('lastEventTs', Date.now());
  broadcast('event', { id, ts: Date.now(), ...e, detail: undefined });
  return id;
}
function stateSnapshot() {
  const lastEventTs = db.get('lastEventTs', 0);
  return {
    busy: S.busy, paused: S.paused, stopReq: S.stopReq,
    status: db.get('statusText', ''), statusTs: db.get('statusTs', 0),
    session: db.get('session', null), lastEventTs,
    shotTs: db.get('shotTs', 0),
    waiting: waiters.size > 0,
    runner: runner.status(),
    runnerCfg: { enabled: cfg.runner.enabled, autoWake: cfg.runner.autoWake, permissionMode: cfg.runner.permissionMode, claudeFound: !!config.findClaude(cfg) },
    openQuestions: db.openQuestions(),
    pendingApprovals: db.pendingApprovals(),
    pendingMessages: db.peekPending().length,
  };
}
function pushState() { broadcast('state', stateSnapshot()); }

// Agent counts as idle after a Stop, or after 20 min without any hook event.
function agentIdle() {
  if (runner.running()) return false;
  if (waiters.size) return false;
  if (!S.busy) return true;
  return Date.now() - db.get('lastEventTs', 0) > 20 * 60e3 && !db.pendingApprovals().length && !S.paused;
}

// ---------- slack pings (only what needs the user) ----------
const slack = createSlack({ getCfg: () => cfg, onEvent: (e) => addEvent(e) });
function pingQuestion(q) {
  const first = q.text.split('\n').map((l) => l.trim()).filter(Boolean)[0] || q.qid;
  slack.notify('q:' + q.qid + ':' + first.slice(0, 40), `:bell: *Claude needs you* - ${first.slice(0, 300)}\nAnswer in the dashboard (Inbox).`, 10 * 60e3);
}
function pingApproval(id, label, sum) {
  slack.notify('a:' + id, `:shield: *Approval needed* (${label}): ${String(sum).slice(0, 200)}\nApprove or deny in the dashboard (Approve tab). Auto-denied after 30 min.`, 60e3);
}

// ---------- bot bridge ----------
const bots = createBots({ onEvent: (e) => addEvent(e) });
let botsPushTimer = null;
function throttledBotsPush() {
  if (botsPushTimer) return;
  botsPushTimer = setTimeout(() => { botsPushTimer = null; broadcast('bots', { bots: bots.list() }); }, 1000);
}

// ---------- runner (phase 4) ----------
const runner = createRunner({
  cfg,
  onEvent: (e) => addEvent(e),
  onSession: (id) => { db.set('session', id); pushState(); },
  onExit: (d) => { if (d && d.code) slack.notify('runner-fail', `:warning: *Headless run failed* (exit ${d.code}). Check the dashboard.`, 10 * 60e3); db.set('busy', false); pushState(); setTimeout(maybeWake, 1500); },
});

function wakePrompt(msgs) {
  return [
    '[Mission Control] Messages from the user, sent from the dashboard (treat as user instructions):',
    ...msgs.map((m) => `- ${m.text}`),
    '',
    'Act on them following CLAUDE.md and the skills. You are running headless from the dashboard:',
    'nobody is at the terminal, so ask questions in your final message (Q<n> format) - they appear in the dashboard inbox.',
  ].join('\n');
}

function maybeWake() {
  if (!cfg.runner.enabled || !cfg.runner.autoWake) return;
  if (!agentIdle()) return;
  const pending = db.peekPending();
  if (!pending.length) return;
  const session = db.get('session', null);
  const msgs = db.takePending();
  try {
    runner.start({ prompt: wakePrompt(msgs), resume: session });
    db.set('busy', true);
  } catch (e) {
    addEvent({ kind: 'runner', summary: 'Wake failed: ' + e.message, ok: false });
  }
  pushState();
}

// ---------- transcript tail ----------
createTailer({
  getPath: () => db.get('transcript', null),
  onText: (text, o) => {
    const ts = Date.parse(o.timestamp || '') || 0;
    if (ts && ts <= db.get('tailTs', 0)) return;
    if (ts) db.set('tailTs', ts);
    addEvent({ kind: 'say', session: o.sessionId, summary: clip(redactString(text), 4000) });
  },
  onImage: (buf, mime, o) => {
    const ts = Date.parse(o.timestamp || '') || Date.now();
    if (ts <= db.get('shotTs', 0)) return;
    fs.writeFileSync(SHOT, buf);
    db.set('shotTs', ts); db.set('shotMime', mime);
    broadcast('shot', { ts });
  },
});

// ---------- gates ----------
function matchGate(tool, input) {
  const s = JSON.stringify(input || {});
  for (const g of cfg.gates || []) {
    if (!g.enabled) continue;
    try {
      if (new RegExp(g.tool, 'i').test(tool) && new RegExp(g.input, 'i').test(s)) return g;
    } catch { /* bad regex in config */ }
  }
  return null;
}
function isDashboardCli(tool, input) {
  return /^(Bash|PowerShell)$/.test(tool) && /dashboard[\\/]+cli\.js/.test(String((input && input.command) || ''));
}

// ---------- hook handling ----------
function pendingContext() {
  const msgs = db.takePending();
  if (!msgs.length) return null;
  for (const m of msgs) addEvent({ kind: 'delivered', summary: 'Delivered to agent: ' + clip(m.text, 200) });
  pushState();
  return '[Mission Control] New messages from the user via the dashboard (treat as user instructions, act on them now):\n' +
    msgs.map((m) => '- ' + m.text).join('\n');
}

function handleHook(body) {
  const p = body.payload || {};
  const ev = p.hook_event_name || body.event;
  const session = p.session_id || null;
  if (session) db.set('session', session);
  if (p.transcript_path) db.set('transcript', p.transcript_path);
  const headless = !!body.headless;

  switch (ev) {
    case 'SessionStart':
      addEvent({ kind: 'session', session, summary: `Session ${p.source || 'start'}${headless ? ' (headless)' : ''}` });
      pushState();
      return {};
    case 'UserPromptSubmit': {
      // One agent at a time: a terminal prompt while a headless run works is held, unless 'take over'.
      if (!headless && runner.running()) {
        if (/^\s*take\s*over\b/i.test(String(p.prompt || ''))) {
          runner.kill();
          addEvent({ kind: 'control', session, summary: 'Terminal took over - headless run stopped' });
          pushState();
          return { context: '[Mission Control] You took over from a dashboard-started headless run (now stopped). Check the dashboard feed / run log for what it did last before acting in Chrome.' };
        }
        addEvent({ kind: 'control', session, summary: 'Terminal prompt held: a headless run is active' });
        return { blockPrompt: 'A dashboard-started Claude run is working right now (one agent at a time). Type "take over" to stop it and continue here, or use Stop in the dashboard.' };
      }
      db.set('busy', true);
      if (!headless && p.prompt) {
        // Terminal and dashboard show one conversation; a terminal reply closes the open question cards.
        const text = redactString(String(p.prompt));
        addEvent({ kind: 'prompt', session, summary: 'You (terminal): ' + clip(text, 600) });
        db.addMessage('user', clip(text, 4000), true, 'terminal');
        const qm = text.match(/^\s*(Q\d+)\b[\s:,-]*(.*)$/is);
        for (const q of db.openQuestions()) db.answerQuestion(q.id, qm && q.qid === qm[1].toUpperCase() ? (qm[2] || text).slice(0, 500) : '(answered in terminal)');
      }
      const ctx = pendingContext();
      pushState();
      return ctx ? { context: ctx } : {};
    }
    case 'PreToolUse': {
      db.set('busy', true);
      const tool = p.tool_name || '';
      const input = p.tool_input || {};
      if (isDashboardCli(tool, input)) return { action: 'none' };
      if (!headless && runner.running()) {
        return { action: 'deny', reason: 'A dashboard-started headless Claude run is active (one agent at a time). Do not act in parallel: end your turn now in one line. The user can type "take over" to stop it.' };
      }
      if (S.stopReq) return { action: 'deny', reason: 'STOP pressed in the Mission Control dashboard. Do not continue the task: end your turn now with a short status and a Q<n> question.' };
      if (S.paused) {
        if (!body.polling) { addEvent({ kind: 'paused', session, tool, summary: 'Held (paused): ' + summarize(tool, redact(input)) }); pushState(); }
        return { action: 'wait', reason: 'Paused from the Mission Control dashboard.' };
      }
      if (body.approvalId) {
        const a = db.approval(body.approvalId);
        if (!a || a.status === 'pending') return { action: 'wait', approvalId: body.approvalId };
        if (a.status === 'approved') return { action: 'allow', reason: 'Approved in the Mission Control dashboard.' };
        return { action: 'deny', reason: a.status === 'expired' ? 'Approval timed out in the dashboard; treat as denied and ask the user (Q<n>).' : 'Denied by the user in the Mission Control dashboard. Do not retry this action; ask what to do instead.' };
      }
      const g = matchGate(tool, input);
      if (g) {
        const sum = summarize(tool, redact(input));
        const id = db.addApproval({ session, gate: g.label, tool, summary: sum, detail: clip(JSON.stringify(redact(input)), 4000) });
        addEvent({ kind: 'approval', session, tool, summary: `Needs approval (${g.label}): ${sum}` });
        broadcast('approval', { id });
        pingApproval(id, g.label, sum);
        pushState();
        return { action: 'wait', approvalId: id };
      }
      return { action: 'none' };
    }
    case 'PostToolUse':
    case 'PostToolUseFailure': {
      const tool = p.tool_name || '';
      const input = redact(p.tool_input || {});
      const resp = p.tool_response;
      const failed = ev === 'PostToolUseFailure' || !!(resp && typeof resp === 'object' && (resp.is_error || resp.isError || resp.interrupted));
      if (!isDashboardCli(tool, p.tool_input)) {
        addEvent({ kind: 'tool', session, tool, summary: summarize(tool, input), ok: !failed,
          detail: clip(JSON.stringify({ input, response: typeof resp === 'string' ? clip(redactString(resp), 1500) : undefined }), 4000) });
      }
      const ctx = pendingContext();
      return ctx ? { context: ctx } : {};
    }
    case 'Stop': {
      const msg = redactString(p.last_assistant_message || '');
      if (S.stopReq) db.set('stopReq', false);
      const ctx = pendingContext();
      if (ctx) { addEvent({ kind: 'resume', session, summary: 'Kept agent working: new dashboard messages' }); pushState(); return { block: ctx }; }
      db.set('busy', false);
      if (msg) {
        db.addMessage('agent', clip(msg, 6000), true);
        const q = parseQuestion(msg);
        if (q) {
          const old = db.questionByQid(q.qid);
          if (old) db.answerQuestion(old.id, '(superseded)');
          db.addQuestion(q.qid, q.text, q.options);
          broadcast('question', { qid: q.qid });
          pingQuestion(q);
        }
      }
      addEvent({ kind: 'stop', session, summary: 'Agent stopped - waiting for you' + (msg ? ': ' + clip(msg.split('\n').filter(Boolean).pop(), 300) : '') });
      pushState();
      setTimeout(maybeWake, 1500);
      return {};
    }
    case 'Notification':
      addEvent({ kind: 'notify', session, summary: clip(redactString(p.message || 'Notification'), 400) });
      return {};
    case 'SubagentStop':
      addEvent({ kind: 'subagent', session, summary: 'Sub-agent finished' });
      return {};
    default:
      addEvent({ kind: 'hook', session, summary: String(ev || 'hook') });
      return {};
  }
}

// ---------- http helpers ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };

function send(res, code, body, headers = {}) {
  const isObj = body !== null && typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(code, {
    'Content-Type': isObj ? 'application/json; charset=utf-8' : (headers['Content-Type'] || 'text/plain; charset=utf-8'),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
    ...headers,
  });
  res.end(isObj ? JSON.stringify(body) : body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', (c) => { n += c.length; if (n > 2e6) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { const s = Buffer.concat(chunks).toString('utf8'); try { resolve(s ? JSON.parse(s) : {}); } catch { reject(new Error('bad json')); } });
    req.on('error', reject);
  });
}
function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('='); if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function clientIp(req) { return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(); }
function isRemote(req) { return !!(req.headers['x-forwarded-for'] || req.headers['tailscale-funnel-request'] || req.headers['cf-connecting-ip']); }
function authed(req) { return db.validLogin(cookies(req).bb_sess); }
function hookAuthed(req) {
  const t = String(req.headers['x-hook-token'] || '');
  return t.length === cfg.hookToken.length && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(cfg.hookToken));
}

// Login throttling: 5 fails per IP -> 15 min lock; 30 fails/hour overall -> 15 min lock for everyone.
const fails = new Map(); let globalFails = []; let globalLockUntil = 0;
function loginBlocked(ip) {
  const f = fails.get(ip);
  return Date.now() < globalLockUntil || (f && f.until > Date.now());
}
function loginFailed(ip) {
  const f = fails.get(ip) || { n: 0, until: 0 };
  f.n += 1; if (f.n >= 5) { f.until = Date.now() + 15 * 60e3; f.n = 0; }
  fails.set(ip, f);
  globalFails = globalFails.filter((t) => t > Date.now() - 3600e3); globalFails.push(Date.now());
  if (globalFails.length >= 30) { globalLockUntil = Date.now() + 15 * 60e3; globalFails = []; }
}

function sessionCookie(req, token, maxAge) {
  const secure = isRemote(req) || String(req.headers['x-forwarded-proto'] || '') === 'https';
  return `bb_sess=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

function listRuns() {
  try {
    return fs.readdirSync(RUNS).filter((f) => /^[\w.-]+\.md$/.test(f)).map((f) => {
      const st = fs.statSync(path.join(RUNS, f));
      return { name: f, mtime: st.mtimeMs, size: st.size };
    }).sort((a, b) => b.name.localeCompare(a.name));
  } catch { return []; }
}

// ---------- routes ----------
async function route(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const m = req.method;

  // Bot bridge: only the bot extension, only directly on this machine (never via the Funnel proxy)
  if (p.startsWith('/bot/')) {
    const origin = String(req.headers.origin || '');
    const cors = { 'Access-Control-Allow-Origin': BOT_ORIGIN, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' };
    if (isRemote(req) || origin !== BOT_ORIGIN) return send(res, 403, { error: 'local bot only' });
    if (m === 'OPTIONS') return send(res, 204, '', cors);
    if (p === '/bot/sync' && m === 'POST') {
      const out = { ...bots.sync(await readBody(req)), publicUrl: cfg.publicUrl || null };
      throttledBotsPush();
      return send(res, 200, out, cors);
    }
    return send(res, 404, { error: 'not found' }, cors);
  }

  // Hook + CLI endpoints (shared secret; never exposed meaningfully without the token)
  if (p.startsWith('/hook/') || p.startsWith('/cli/')) {
    if (!hookAuthed(req)) return send(res, 401, { error: 'bad token' });
    if (p === '/hook/event' && m === 'POST') return send(res, 200, handleHook(await readBody(req)));
    if (p === '/cli/status' && m === 'POST') {
      const b = await readBody(req);
      db.set('statusText', clip(redactString(String(b.text || '')), 300)); db.set('statusTs', Date.now());
      addEvent({ kind: 'status', summary: 'Status: ' + clip(redactString(String(b.text || '')), 300) });
      pushState(); return send(res, 200, { ok: true });
    }
    if (p === '/cli/say' && m === 'POST') {
      const b = await readBody(req); const text = clip(redactString(String(b.text || '')), 6000);
      db.addMessage('agent', text, true); addEvent({ kind: 'say', summary: text });
      const q = parseQuestion(text);
      if (q) { const old = db.questionByQid(q.qid); if (old) db.answerQuestion(old.id, '(superseded)'); db.addQuestion(q.qid, q.text, q.options); pingQuestion(q); }
      pushState(); return send(res, 200, { ok: true });
    }
    if (p === '/cli/wait' && m === 'GET') {
      const timeout = Math.min(Number(url.searchParams.get('timeout') || 600), 3000) * 1000;
      const now = db.takePending();
      if (now.length) { pushState(); return send(res, 200, { messages: now }); }
      const w = { res, timer: null };
      w.timer = setTimeout(() => { waiters.delete(w); pushState(); send(res, 200, { messages: [], timeout: true }); }, timeout);
      req.on('close', () => { clearTimeout(w.timer); waiters.delete(w); pushState(); });
      waiters.add(w); pushState();
      return;
    }
    if (p === '/cli/state' && m === 'GET') return send(res, 200, stateSnapshot());
    return send(res, 404, { error: 'not found' });
  }

  // Auth endpoints
  if (p === '/api/me') return send(res, 200, { authed: authed(req), setupNeeded: !cfg.passwordHash });
  if (p === '/api/setup' && m === 'POST') {
    const b = await readBody(req);
    if (cfg.passwordHash) return send(res, 400, { error: 'already set up' });
    if (isRemote(req)) return send(res, 403, { error: 'Set the password on the server itself (http://localhost:' + cfg.port + ').' });
    if (!b.token || b.token !== cfg.setupToken) return send(res, 403, { error: 'wrong setup code' });
    if (typeof b.password !== 'string' || b.password.length < 10) return send(res, 400, { error: 'Use at least 10 characters.' });
    cfg.passwordHash = config.hashPassword(b.password); cfg.setupToken = null; config.save(cfg);
    const token = crypto.randomBytes(32).toString('hex'); db.addLogin(token, cfg.sessionDays, req.headers['user-agent']);
    return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, token, cfg.sessionDays * 86400) });
  }
  if (p === '/api/login' && m === 'POST') {
    const ip = clientIp(req);
    if (loginBlocked(ip)) return send(res, 429, { error: 'Too many attempts. Try again in 15 minutes.' });
    const b = await readBody(req);
    if (!config.checkPassword(String(b.password || ''), cfg.passwordHash)) {
      loginFailed(ip); addEvent({ kind: 'security', summary: `Failed dashboard login from ${ip}` });
      await new Promise((r) => setTimeout(r, 800));
      return send(res, 401, { error: 'Wrong password' });
    }
    const token = crypto.randomBytes(32).toString('hex'); db.addLogin(token, cfg.sessionDays, req.headers['user-agent']);
    addEvent({ kind: 'security', summary: `Dashboard login from ${ip} (${clip(req.headers['user-agent'] || '', 80)})` });
    return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, token, cfg.sessionDays * 86400) });
  }
  if (p === '/api/logout' && m === 'POST') {
    db.delLogin(cookies(req).bb_sess);
    return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, '', 0) });
  }

  // Static (login page is part of the app; data needs auth)
  if (!p.startsWith('/api/')) {
    const file = p === '/' ? 'index.html' : p.slice(1);
    if (!/^[\w.-]+$/.test(file)) return send(res, 404, 'not found');
    const fp = path.join(PUBLIC, file);
    if (!fs.existsSync(fp)) return send(res, 404, 'not found');
    return send(res, 200, fs.readFileSync(fp), { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
  }

  if (!authed(req)) return send(res, 401, { error: 'login required' });
  if (m !== 'GET' && req.headers['x-bb'] !== '1') return send(res, 403, { error: 'missing header' });

  if (p === '/api/stream') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(`event: state\ndata: ${JSON.stringify(stateSnapshot())}\n\n`);
    clients.add(res);
    const hb = setInterval(() => { try { res.write(': hb\n\n'); } catch { /* closed */ } }, 20000);
    req.on('close', () => { clearInterval(hb); clients.delete(res); });
    return;
  }
  if (p === '/api/state') return send(res, 200, stateSnapshot());
  if (p === '/api/events') {
    const before = Number(url.searchParams.get('before') || 0);
    const after = Number(url.searchParams.get('after') || 0);
    const limit = Math.min(Number(url.searchParams.get('limit') || 150), 500);
    return send(res, 200, before ? db.eventsBefore(before, limit) : db.events(after, limit));
  }
  if (p === '/api/messages' && m === 'GET') return send(res, 200, db.messages(150));
  if (p === '/api/messages' && m === 'POST') {
    const b = await readBody(req);
    const text = String(b.text || '').trim().slice(0, 4000);
    if (!text) return send(res, 400, { error: 'empty' });
    const qm = text.match(/^\s*(Q\d+)\b[\s:,-]*(.*)$/is);
    if (qm) { const q = db.questionByQid(qm[1].toUpperCase()); if (q) db.answerQuestion(q.id, qm[2] || text); }
    db.addMessage('user', text, false, 'dashboard');
    addEvent({ kind: 'user', summary: 'You (dashboard): ' + clip(text, 600) });
    deliverToWaiters();
    pushState();
    setTimeout(maybeWake, 300);
    return send(res, 200, { ok: true });
  }
  let mm;
  if ((mm = p.match(/^\/api\/messages\/(\d+)\/delete$/)) && m === 'POST') {
    const ok = db.deleteMessage(Number(mm[1])); pushState(); return send(res, ok ? 200 : 404, { ok });
  }
  if (p === '/api/messages/clear' && m === 'POST') {
    const n = db.clearMessages(); addEvent({ kind: 'control', summary: `You cleared the chat (${n} messages)` }); pushState(); return send(res, 200, { ok: true, n });
  }
  if (p === '/api/questions/dismiss-all' && m === 'POST') {
    const n = db.dismissAllQuestions(); pushState(); return send(res, 200, { ok: true, n });
  }
  if ((mm = p.match(/^\/api\/questions\/(\d+)\/answer$/)) && m === 'POST') {
    const b = await readBody(req);
    const q = db.openQuestions().find((x) => x.id === Number(mm[1]));
    if (!q) return send(res, 404, { error: 'question not open' });
    const ans = String(b.answer || '').trim().slice(0, 2000);
    db.answerQuestion(q.id, ans);
    const text = `${q.qid || 'Answer'} ${ans}`;
    db.addMessage('user', text);
    addEvent({ kind: 'user', summary: 'You answered ' + clip(text, 400) });
    deliverToWaiters(); pushState(); setTimeout(maybeWake, 300);
    return send(res, 200, { ok: true });
  }
  if ((mm = p.match(/^\/api\/questions\/(\d+)\/dismiss$/)) && m === 'POST') {
    db.answerQuestion(Number(mm[1]), '(dismissed)'); pushState(); return send(res, 200, { ok: true });
  }
  if ((mm = p.match(/^\/api\/approvals\/(\d+)$/)) && m === 'POST') {
    const b = await readBody(req);
    const status = b.decision === 'approve' ? 'approved' : 'denied';
    const ok = db.decideApproval(Number(mm[1]), status);
    const a = db.approval(Number(mm[1]));
    if (ok) addEvent({ kind: 'approval', summary: `You ${status} : ${a && a.summary}` });
    pushState(); return send(res, ok ? 200 : 409, { ok });
  }
  if (p === '/api/approvals' && m === 'GET') return send(res, 200, db.recentApprovals());
  if (p === '/api/control' && m === 'POST') {
    const b = await readBody(req);
    switch (b.action) {
      case 'pause': db.set('paused', true); addEvent({ kind: 'control', summary: 'You paused the agent' }); break;
      case 'resume': db.set('paused', false); db.set('stopReq', false); addEvent({ kind: 'control', summary: 'You resumed the agent' }); break;
      case 'stop':
        db.set('paused', false); db.set('stopReq', true);
        if (runner.kill()) addEvent({ kind: 'control', summary: 'You stopped the headless run' });
        addEvent({ kind: 'control', summary: 'You pressed STOP - agent will end its turn at its next action' });
        break;
      case 'clearstop': db.set('stopReq', false); break;
      case 'markIdle': db.set('busy', false); break;
      default: return send(res, 400, { error: 'unknown action' });
    }
    pushState(); return send(res, 200, { ok: true });
  }
  if (p === '/api/runner/start' && m === 'POST') {
    const b = await readBody(req);
    const prompt = String(b.prompt || '').trim().slice(0, 4000);
    if (!prompt) return send(res, 400, { error: 'empty prompt' });
    if (!cfg.runner.enabled) return send(res, 400, { error: 'runner disabled' });
    if (!agentIdle() && !b.force) return send(res, 409, { error: 'The agent looks busy (VS Code or headless). Send a message instead, or force.' });
    try {
      const session = b.resume ? db.get('session', null) : null;
      const info = runner.start({ prompt, resume: session });
      db.set('busy', true); db.set('stopReq', false);
      addEvent({ kind: 'user', summary: 'You started a run: ' + clip(prompt, 300) });
      pushState(); return send(res, 200, { ok: true, info });
    } catch (e) { return send(res, 400, { error: e.message }); }
  }
  if (p === '/api/runner/kill' && m === 'POST') { const ok = runner.kill(); pushState(); return send(res, 200, { ok }); }
  if (p === '/api/settings' && m === 'GET') return send(res, 200, { gates: cfg.gates, runner: { autoWake: cfg.runner.autoWake, enabled: cfg.runner.enabled, permissionMode: cfg.runner.permissionMode } });
  if (p === '/api/settings' && m === 'POST') {
    const b = await readBody(req);
    if (Array.isArray(b.gates)) {
      cfg.gates = b.gates.slice(0, 30).map((g) => ({ id: String(g.id || crypto.randomBytes(4).toString('hex')).slice(0, 40), enabled: !!g.enabled,
        label: String(g.label || '').slice(0, 120), tool: String(g.tool || '').slice(0, 200), input: String(g.input || '').slice(0, 300) }));
      for (const g of cfg.gates) { try { new RegExp(g.tool); new RegExp(g.input); } catch { return send(res, 400, { error: 'bad regex in ' + g.label }); } }
    }
    if (b.runner) {
      if (typeof b.runner.autoWake === 'boolean') cfg.runner.autoWake = b.runner.autoWake;
      if (typeof b.runner.enabled === 'boolean') cfg.runner.enabled = b.runner.enabled;
      if (['auto', 'acceptEdits', 'default', 'plan'].includes(b.runner.permissionMode)) cfg.runner.permissionMode = b.runner.permissionMode;
    }
    config.save(cfg); addEvent({ kind: 'control', summary: 'Settings changed' }); pushState();
    return send(res, 200, { ok: true });
  }
  if (p === '/api/password' && m === 'POST') {
    const b = await readBody(req);
    if (!config.checkPassword(String(b.current || ''), cfg.passwordHash)) return send(res, 403, { error: 'current password wrong' });
    if (typeof b.next !== 'string' || b.next.length < 10) return send(res, 400, { error: 'Use at least 10 characters.' });
    cfg.passwordHash = config.hashPassword(b.next); config.save(cfg); db.delAllLogins();
    addEvent({ kind: 'security', summary: 'Dashboard password changed; all devices signed out' });
    return send(res, 200, { ok: true });
  }
  if (p === '/api/screenshot') {
    if (!fs.existsSync(SHOT)) return send(res, 404, 'no screenshot yet');
    return send(res, 200, fs.readFileSync(SHOT), { 'Content-Type': db.get('shotMime', 'image/jpeg') });
  }
  if (p === '/api/bots' && m === 'GET') return send(res, 200, { bots: bots.list(), commands: bots.COMMANDS });
  if ((mm = p.match(/^\/api\/bots\/([\w-]{6,64})\/command$/)) && m === 'POST') {
    const b = await readBody(req);
    try { const c = bots.enqueue(mm[1], String(b.cmd || ''), b.args); throttledBotsPush(); return send(res, 200, { ok: true, id: c.id }); }
    catch (e) { return send(res, 400, { error: e.message }); }
  }
  if (p === '/api/runs') return send(res, 200, listRuns());
  if ((mm = p.match(/^\/api\/runs\/([\w.-]+\.md)$/))) {
    const fp = path.join(RUNS, mm[1]);
    if (!fs.existsSync(fp)) return send(res, 404, { error: 'not found' });
    return send(res, 200, { name: mm[1], text: redactString(fs.readFileSync(fp, 'utf8')) });
  }
  return send(res, 404, { error: 'not found' });
}

function deliverToWaiters() {
  if (!waiters.size) return;
  const msgs = db.takePending();
  if (!msgs.length) return;
  for (const w of waiters) { clearTimeout(w.timer); try { send(w.res, 200, { messages: msgs }); } catch { /* closed */ } }
  waiters.clear();
  addEvent({ kind: 'delivered', summary: `Delivered ${msgs.length} message(s) to the waiting agent` });
}

// Expire approvals left pending > 30 min (the hook gives up at ~29 min anyway).
setInterval(() => {
  for (const a of db.pendingApprovals()) {
    if (Date.now() - a.ts > 30 * 60e3) { db.decideApproval(a.id, 'expired'); pushState(); }
    else if (Date.now() - a.ts > 10 * 60e3) slack.notify('a-remind:' + a.id, `:hourglass: Still waiting for your approval: ${String(a.summary).slice(0, 160)}`, 60 * 60e3);
  }
}, 60e3).unref();

const server = http.createServer((req, res) => {
  route(req, res).catch((e) => { try { send(res, 500, { error: e.message }); } catch { /* already sent */ } });
});
server.requestTimeout = 0; // long-polls / SSE
server.listen(cfg.port, '127.0.0.1', () => {
  console.log(`Mission Control on http://localhost:${cfg.port}  (data: ${config.DATA_DIR})`);
  if (!cfg.passwordHash) console.log(`First run: open http://localhost:${cfg.port} on this server and use setup code ${cfg.setupToken}`);
});
module.exports = { server, handleHook, db, runner };
