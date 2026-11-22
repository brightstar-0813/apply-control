'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'bbdash-'));
const PORT = 18000 + Math.floor(Math.random() * 1000);
process.env.BIDBOT_DASH_DATA = DATA;
fs.writeFileSync(path.join(DATA, 'config.json'), JSON.stringify({ port: PORT, runner: { enabled: false }, slack: { enabled: false } }));

const { parseQuestion } = require('../lib/questions');
const { redact, summarize } = require('../lib/redact');

test('parseQuestion takes the last Q and its quoted options', () => {
  const q = parseQuestion('blah Q1: old\n\nQ3: Shall I go? Reply "Q3 go", or "Q3 go cloudflare" to change.');
  assert.equal(q.qid, 'Q3');
  assert.deepEqual(q.options, ['go', 'go cloudflare']);
  const q2 = parseQuestion('Q4 (Avash #24): hybrid? Options: Yes / No. Reply "Q4 Yes".');
  assert.equal(q2.qid, 'Q4');
  assert.deepEqual(q2.options, ['Yes', 'No']);
  assert.equal(parseQuestion('no question here'), null);
});

test('redact masks secrets', () => {
  const r = redact({ password: 'x', command: 'curl https://hooks.slack.com/services/T/B/C', elements: [{ uid: 'password-field', value: 'hunter2' }] });
  assert.equal(r.password, '[redacted]');
  assert.ok(!r.command.includes('hooks.slack.com/services'));
  assert.equal(r.elements[0].value, '[redacted]');
  assert.match(summarize('mcp__chrome-devtools__navigate_page', { url: 'https://x.y' }), /Navigate https:\/\/x\.y/);
});

function req(method, p, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const r = http.request({ host: '127.0.0.1', port: PORT, path: p, method, agent: false,
      headers: { 'X-BB': '1', ...(data ? { 'Content-Type': 'application/json', 'Content-Length': data.length } : {}), ...headers } }, (res) => {
      let s = ''; res.on('data', (c) => { s += c; });
      res.on('end', () => { let j = s; try { j = JSON.parse(s); } catch { /* text */ } resolve({ status: res.statusCode, body: j, headers: res.headers }); });
    });
    r.on('error', reject); r.end(data || undefined);
  });
}

function runHook(payload) {
  return new Promise((resolve) => {
    const c = spawn(process.execPath, [path.join(__dirname, '..', 'hook.js')], { env: { ...process.env, BIDBOT_DASH_DATA: DATA } });
    let out = ''; c.stdout.on('data', (d) => { out += d; });
    c.on('exit', () => resolve(out ? JSON.parse(out) : null));
    c.stdin.end(JSON.stringify(payload));
  });
}

test('server: setup, login, hooks, pause, gates, messages', async (t) => {
  const { server } = require('../server');
  await new Promise((r) => (server.listening ? r() : server.once('listening', r)));
  t.after(() => server.close());
  const cfg = JSON.parse(fs.readFileSync(path.join(DATA, 'config.json'), 'utf8'));

  // no auth -> 401; remote setup refused
  assert.equal((await req('GET', '/api/state')).status, 401);
  assert.equal((await req('POST', '/api/setup', { token: cfg.setupToken, password: 'longenough1' }, { 'X-Forwarded-For': '1.2.3.4' })).status, 403);
  const setup = await req('POST', '/api/setup', { token: cfg.setupToken, password: 'longenough1' });
  assert.equal(setup.status, 200);
  const cookie = setup.headers['set-cookie'][0].split(';')[0];
  const A = { Cookie: cookie };
  assert.equal((await req('POST', '/api/login', { password: 'wrong' })).status, 401);
  assert.equal((await req('POST', '/api/login', { password: 'longenough1' })).status, 200);
  assert.equal((await req('GET', '/api/state', null, A)).status, 200);
  // CSRF header required for writes
  assert.equal((await req('POST', '/api/control', { action: 'pause' }, { ...A, 'X-BB': '' })).status, 403);

  // hook without token -> 401; normal tool -> no output
  assert.equal((await req('POST', '/hook/event', {})).status, 401);
  const pre = { hook_event_name: 'PreToolUse', session_id: 's1', tool_name: 'Read', tool_input: { file_path: 'C:/x' } };
  assert.equal(await runHook(pre), null);

  // message queued -> injected after next tool call
  await req('POST', '/api/messages', { text: 'skip #24' }, A);
  const post = await runHook({ hook_event_name: 'PostToolUse', session_id: 's1', tool_name: 'Read', tool_input: {}, tool_response: 'ok' });
  assert.match(post.hookSpecificOutput.additionalContext, /skip #24/);

  // Stop with Q -> question card; Stop while message pending -> block
  await runHook({ hook_event_name: 'Stop', session_id: 's1', last_assistant_message: 'Done.\nQ7: continue? Reply "Q7 yes" or "Q7 no".' });
  let st = (await req('GET', '/api/state', null, A)).body;
  assert.equal(st.openQuestions[0].qid, 'Q7');
  assert.deepEqual(st.openQuestions[0].options, ['yes', 'no']);
  await req('POST', `/api/questions/${st.openQuestions[0].id}/answer`, { answer: 'yes' }, A);
  const stop2 = await runHook({ hook_event_name: 'Stop', session_id: 's1', last_assistant_message: 'x' });
  assert.equal(stop2.decision, 'block');
  assert.match(stop2.reason, /Q7 yes/);

  // gate: git push waits for approval -> approve -> allow
  const hookP = runHook({ hook_event_name: 'PreToolUse', session_id: 's1', tool_name: 'Bash', tool_input: { command: 'git push origin main' } });
  let appr;
  for (let i = 0; i < 30 && !appr; i++) { await new Promise((r) => setTimeout(r, 200)); appr = (await req('GET', '/api/state', null, A)).body.pendingApprovals[0]; }
  assert.ok(appr, 'approval created');
  await req('POST', '/api/approvals/' + appr.id, { decision: 'approve' }, A);
  const gated = await hookP;
  assert.equal(gated.hookSpecificOutput.permissionDecision, 'allow');

  // stop -> deny; dashboard cli always passes
  await req('POST', '/api/control', { action: 'stop' }, A);
  const denied = await runHook(pre);
  assert.equal(denied.hookSpecificOutput.permissionDecision, 'deny');
  assert.equal(await runHook({ ...pre, tool_name: 'Bash', tool_input: { command: 'node dashboard/cli.js wait' } }), null);
  await req('POST', '/api/control', { action: 'resume' }, A);
  assert.equal(await runHook(pre), null);

  // cli wait gets a message sent while waiting
  const waitP = req('GET', '/cli/wait?timeout=10', null, { 'X-Hook-Token': cfg.hookToken });
  await new Promise((r) => setTimeout(r, 200));
  await req('POST', '/api/messages', { text: 'cap 10' }, A);
  const w = await waitP;
  assert.equal(w.body.messages[0].text, 'cap 10');

  // delete / unsend a queued message, clear chat, dismiss all questions
  await req('POST', '/api/messages', { text: 'oops wrong' }, A);
  let msgs = (await req('GET', '/api/messages', null, A)).body;
  const oops = msgs.find((x) => x.text === 'oops wrong');
  assert.equal((await req('POST', '/api/messages/' + oops.id + '/delete', null, A)).status, 200);
  assert.equal((await req('GET', '/api/state', null, A)).body.pendingMessages, 0);
  await runHook({ hook_event_name: 'Stop', session_id: 's1', last_assistant_message: 'Q8: go? Reply "Q8 yes".' });
  assert.equal((await req('POST', '/api/questions/dismiss-all', null, A)).status, 200);
  assert.equal((await req('GET', '/api/state', null, A)).body.openQuestions.length, 0);
  assert.equal((await req('POST', '/api/messages/clear', null, A)).status, 200);
  assert.equal((await req('GET', '/api/messages', null, A)).body.length, 0);

  // one agent at a time: fake an active headless run
  const { runner } = require('../server');
  const realRunning = runner.running, realKill = runner.kill;
  let killed = false;
  runner.running = () => !killed; runner.kill = () => { killed = true; return true; };
  const held = await runHook({ hook_event_name: 'UserPromptSubmit', session_id: 's1', prompt: 'do something' });
  assert.equal(held.decision, 'block');
  assert.match(held.reason, /take over/);
  const denied2 = await runHook(pre);
  assert.equal(denied2.hookSpecificOutput.permissionDecision, 'deny');
  const headlessOk = await new Promise((resolve) => {
    const c = spawn(process.execPath, [path.join(__dirname, '..', 'hook.js')], { env: { ...process.env, BIDBOT_DASH_DATA: DATA, BIDBOT_DASH_RUNNER: '1' } });
    let out = ''; c.stdout.on('data', (d) => { out += d; }); c.on('exit', () => resolve(out)); c.stdin.end(JSON.stringify(pre));
  });
  assert.equal(headlessOk, '');
  const took = await runHook({ hook_event_name: 'UserPromptSubmit', session_id: 's1', prompt: 'take over' });
  assert.ok(killed, JSON.stringify(took));
  assert.match(took.hookSpecificOutput.additionalContext, /took over/);
  assert.equal(await runHook(pre), null);
  runner.running = realRunning; runner.kill = realKill;
});

test('bots: sync, commands, results, person allowlist, LinkedIn refused', () => {
  const { createBots } = require('../lib/bots');
  const events = [];
  const bots = createBots({ onEvent: (e) => events.push(e) });
  bots.sync({ botId: 'abc123-window', state: { person: 'avash-chapagain', personLabel: 'Avash', persons: [{ id: 'avash-chapagain' }, { id: 'carlos-x' }] } });
  const b = bots.list()[0];
  assert.deepEqual(b.state.persons.map((p) => p.id), ['avash-chapagain']);
  assert.throws(() => bots.enqueue(b.botId, 'filter', { value: 'linkedin' }), /LinkedIn/);
  assert.throws(() => bots.enqueue(b.botId, 'person', { value: 'carlos-x' }), /Avash or Lewis/);
  assert.throws(() => bots.enqueue(b.botId, 'evil'), /unknown/);
  const c = bots.enqueue(b.botId, 'loadSheet');
  const out = bots.sync({ botId: b.botId });
  assert.equal(out.commands[0].cmd, 'loadSheet');
  bots.sync({ botId: b.botId, results: [{ id: c.id, ok: true, message: 'Loaded 22 jobs' }] });
  assert.equal(bots.list()[0].commands[0].status, 'done');
  assert.ok(events.some((e) => /Loaded 22 jobs/.test(e.summary)));
});

test('bots: resume builds counted per day, queue reloads only re-base', () => {
  const { createBots } = require('../lib/bots');
  const kv = new Map(); const store = { get: (k, d) => (kv.has(k) ? JSON.parse(kv.get(k)) : d), set: (k, v) => kv.set(k, JSON.stringify(v)) };
  let t = new Date(2026, 10, 22, 9, 0).getTime();
  const bots = createBots({ onEvent: () => {}, store, clock: () => t });
  const sync = (queue, built) => bots.sync({ botId: 'abc123-window', state: { person: 'avash-chapagain', counters: { queue, built } } });
  sync(10, 2); assert.deepEqual([bots.list()[0].built.today, bots.list()[0].built.lastBuiltAt], [0, null]); // first sight: baseline only
  t += 60e3; sync(10, 3); assert.equal(bots.list()[0].built.today, 1); assert.equal(bots.list()[0].built.lastBuiltAt, t);
  t += 60e3; sync(25, 9); assert.equal(bots.list()[0].built.today, 1); // Load from sheet: no fake builds
  t += 60e3; sync(25, 11); assert.equal(bots.list()[0].built.today, 3);
  const again = createBots({ onEvent: () => {}, store, clock: () => t }); // server restart keeps today's count
  again.sync({ botId: 'abc123-window', state: { counters: { queue: 25, built: 11 } } }); assert.equal(again.list()[0].built.today, 3);
  t = new Date(2026, 10, 23, 8, 0).getTime(); sync(25, 11); assert.equal(bots.list()[0].built.today, 0); // new day
});
