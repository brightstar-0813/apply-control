'use strict';
// Read-only tail of the active Claude Code session transcript (.jsonl):
// emits the agent's text messages and saves the newest screenshot it received.
const fs = require('node:fs');
const path = require('node:path');

const START_BACK = 768 * 1024; // on a new transcript, replay roughly the last 768 KB

function createTailer({ getPath, onText, onImage, intervalMs = 2000 }) {
  let cur = null, offset = 0, rest = '';

  function handleLine(line) {
    if (!line || line[0] !== '{') return;
    let o; try { o = JSON.parse(line); } catch { return; }
    const content = o.message && o.message.content;
    if (!Array.isArray(content)) return;
    if (o.type === 'assistant') {
      const text = content.filter((c) => c.type === 'text' && c.text && c.text.trim()).map((c) => c.text).join('\n');
      if (text) onText(text, o);
    } else if (o.type === 'user') {
      for (const c of content) {
        if (c.type !== 'tool_result' || !Array.isArray(c.content)) continue;
        for (const part of c.content) {
          if (part.type === 'image' && part.source && part.source.data) {
            onImage(Buffer.from(part.source.data, 'base64'), part.source.media_type || 'image/jpeg', o);
          }
        }
      }
    }
  }

  function tick() {
    const p = getPath();
    if (!p || !fs.existsSync(p)) return;
    let size; try { size = fs.statSync(p).size; } catch { return; }
    if (p !== cur) { cur = p; offset = Math.max(0, size - START_BACK); rest = ''; if (offset > 0) rest = null; }
    if (size < offset) { offset = 0; rest = ''; }
    if (size === offset) return;
    const fd = fs.openSync(p, 'r');
    try {
      const len = Math.min(size - offset, 32 * 1024 * 1024);
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, offset);
      offset += len;
      let text = buf.toString('utf8');
      if (rest === null) { const nl = text.indexOf('\n'); text = nl >= 0 ? text.slice(nl + 1) : ''; rest = ''; }
      text = rest + text;
      const lines = text.split('\n');
      rest = lines.pop();
      for (const l of lines) { try { handleLine(l.trim()); } catch { /* ignore bad line */ } }
    } finally { fs.closeSync(fd); }
  }

  const timer = setInterval(() => { try { tick(); } catch { /* keep running */ } }, intervalMs);
  timer.unref();
  return { stop: () => clearInterval(timer), tick };
}

module.exports = { createTailer, path };
