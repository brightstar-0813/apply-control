#!/usr/bin/env node
'use strict';
// Claude Code hook -> Mission Control. One script for every hook event (see .claude/settings.json).
// Fails OPEN: if the dashboard is down, the agent works exactly as without it.
const http = require('node:http');
const config = require('./lib/config');

const cfg = config.load();
const HEADLESS = process.env.BIDBOT_DASH_RUNNER === '1';
const MAX_HOLD_MS = 29 * 60e3; // settings.json gives PreToolUse 1800 s

function post(body, timeoutMs) {
  return new Promise((resolve) => {
    const data = Buffer.from(JSON.stringify(body));
    const req = http.request({ host: '127.0.0.1', port: cfg.port, path: '/hook/event', method: 'POST', timeout: timeoutMs, agent: false,
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length, 'X-Hook-Token': cfg.hookToken } }, (res) => {
      let s = ''; res.setEncoding('utf8'); res.on('data', (c) => { s += c; });
      res.on('end', () => { try { resolve(res.statusCode === 200 ? JSON.parse(s) : null); } catch { resolve(null); } });
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
    req.end(data);
  });
}

function slimResponse(r) {
  if (r == null) return undefined;
  if (typeof r === 'string') return r.slice(0, 2000);
  if (typeof r !== 'object') return r;
  const out = {};
  for (const k of ['is_error', 'isError', 'interrupted', 'error', 'stderr']) if (r[k] != null) out[k] = typeof r[k] === 'string' ? r[k].slice(0, 500) : r[k];
  return out;
}

function out(obj) { if (obj) process.stdout.write(JSON.stringify(obj)); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  for await (const c of process.stdin) raw += c;
  let payload; try { payload = JSON.parse(raw); } catch { return; }
  const ev = payload.hook_event_name;
  if (payload.tool_response !== undefined) payload.tool_response = slimResponse(payload.tool_response);

  let r = await post({ event: ev, payload, headless: HEADLESS }, 1500);
  if (!r) return; // dashboard down -> no effect

  if (ev === 'PreToolUse') {
    const started = Date.now();
    while (r && r.action === 'wait') {
      if (Date.now() - started > MAX_HOLD_MS) {
        r = { action: 'deny', reason: 'Held too long in the dashboard (pause/approval). Treat as not approved; ask the user with a Q<n> question.' };
        break;
      }
      await sleep(2000);
      const next = await post({ event: ev, payload, headless: HEADLESS, polling: true, approvalId: r.approvalId }, 5000);
      if (next) r = next; // keep waiting through short server hiccups
    }
    if (r && (r.action === 'allow' || r.action === 'deny')) {
      out({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: r.action, permissionDecisionReason: r.reason || '' } });
    }
    return;
  }
  if (ev === 'Stop' && r.block) { out({ decision: 'block', reason: r.block }); return; }
  if (ev === 'UserPromptSubmit' && r.blockPrompt) { out({ decision: 'block', reason: r.blockPrompt }); return; }
  if ((ev === 'PostToolUse' || ev === 'UserPromptSubmit' || ev === 'PostToolUseFailure') && r.context) {
    out({ hookSpecificOutput: { hookEventName: ev, additionalContext: r.context } });
  }
}

main().catch(() => { /* never break the agent */ }).finally(() => { process.exitCode = 0; });
