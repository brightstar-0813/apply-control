'use strict';
// Phase 4: headless Claude Code runs started from the dashboard (`claude -p`, optionally --resume).
// Uses the logged-in Claude Code account of this Windows user (no API key, no extra cost).
// Hooks from .claude/settings.json still fire, so a headless run shows up in the dashboard
// and obeys Pause / Stop / approval gates exactly like the VS Code session.
const { spawn } = require('node:child_process');
const { findClaude } = require('./config');

function createRunner({ cfg, onEvent, onSession, onExit }) {
  let child = null, info = null;

  function running() { return !!child; }
  function status() { return child ? { running: true, ...info } : { running: false, last: info }; }

  function start({ prompt, resume }) {
    if (child) throw new Error('A headless run is already active');
    const exe = findClaude(cfg);
    if (!exe) throw new Error('Claude Code binary not found (VS Code extension)');
    const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose',
      '--permission-mode', cfg.runner.permissionMode || 'auto'];
    if (resume) args.push('--resume', resume);
    child = spawn(exe, args, {
      cwd: cfg.runner.cwd,
      env: { ...process.env, BIDBOT_DASH_RUNNER: '1' },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    info = { pid: child.pid, started: Date.now(), resume: resume || null, prompt: prompt.slice(0, 300), session: resume || null };
    onEvent({ kind: 'runner', summary: `Headless run started${resume ? ' (resume ' + resume.slice(0, 8) + ')' : ''}: ${prompt.slice(0, 120)}` });

    let buf = '', errTail = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (d) => {
      buf += d;
      const lines = buf.split('\n'); buf = lines.pop();
      for (const l of lines) {
        let o; try { o = JSON.parse(l); } catch { continue; }
        if (o.type === 'system' && o.subtype === 'init' && o.session_id) { info.session = o.session_id; onSession(o.session_id); }
        if (o.type === 'result') { info.result = { is_error: !!o.is_error, subtype: o.subtype, cost: o.total_cost_usd }; }
      }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (d) => { errTail = (errTail + d).slice(-2000); });
    child.on('error', (e) => { errTail += '\n' + e.message; });
    child.on('exit', (code) => {
      const done = { ...info, ended: Date.now(), code, error: code ? errTail.trim().slice(-600) : null };
      child = null; info = done;
      onEvent({ kind: 'runner', summary: `Headless run ended (exit ${code})${done.error ? ': ' + done.error.slice(0, 200) : ''}`, ok: code === 0 });
      onExit(done);
    });
    return info;
  }

  function kill() {
    if (!child) return false;
    const pid = child.pid;
    if (process.platform === 'win32') spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true });
    else child.kill('SIGTERM');
    return true;
  }

  return { start, kill, running, status };
}

module.exports = { createRunner };
