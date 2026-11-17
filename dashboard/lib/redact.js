'use strict';
// Strip secrets before anything is stored or shown. Passwords/OTPs/tokens/webhooks never reach the db.

const SECRET_KEY = /pass(word|wd)?|secret|token|otp|one.?time|verification.?code|api.?key|webhook|authorization|cookie/i;
const SECRET_VALUE = [
  /https:\/\/hooks\.slack\.com\/[^\s"']+/gi,
  /\bxox[abpr]-[A-Za-z0-9-]+/g,
  /\bsk-[A-Za-z0-9_-]{16,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
];

function envSecrets() {
  const out = [];
  for (const k of ['BIDBOT_SLACK_WEBHOOK', 'ANTHROPIC_API_KEY', 'GITHUB_TOKEN']) {
    const v = process.env[k];
    if (v && v.length > 8) out.push(v);
  }
  return out;
}

function redactString(s) {
  if (typeof s !== 'string') return s;
  for (const v of envSecrets()) s = s.split(v).join('[redacted]');
  for (const re of SECRET_VALUE) s = s.replace(re, '[redacted]');
  return s;
}

function redact(obj, depth = 0) {
  if (depth > 8 || obj == null) return obj;
  if (typeof obj === 'string') return redactString(obj);
  if (Array.isArray(obj)) return obj.map((x) => redact(x, depth + 1));
  if (typeof obj === 'object') {
    const out = {};
    // fill / fill_form: an element whose label/uid hints at a secret -> mask its value
    const hint = [obj.label, obj.name, obj.uid, obj.description].filter(Boolean).join(' ');
    const maskValue = SECRET_KEY.test(hint);
    for (const [k, v] of Object.entries(obj)) {
      if (SECRET_KEY.test(k) && typeof v !== 'object') out[k] = '[redacted]';
      else if (maskValue && k === 'value') out[k] = '[redacted]';
      else out[k] = redact(v, depth + 1);
    }
    return out;
  }
  return obj;
}

function clip(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) + '…' : s; }

// One-line human summary of a tool call for the activity feed.
function summarize(tool, input) {
  input = input || {};
  const t = String(tool || '').replace(/^mcp__chrome-devtools__/, '');
  switch (t) {
    case 'Bash': case 'PowerShell': return `${tool}: ${clip(input.description || input.command, 160)}`;
    case 'Read': return `Read ${clip(input.file_path, 140)}`;
    case 'Edit': case 'Write': case 'NotebookEdit': return `${t} ${clip(input.file_path || input.notebook_path, 140)}`;
    case 'Grep': return `Grep "${clip(input.pattern, 60)}" ${clip(input.path || '', 80)}`;
    case 'Glob': return `Glob ${clip(input.pattern, 100)}`;
    case 'navigate_page': return `Navigate ${clip(input.url || input.type, 160)}`;
    case 'new_page': return `New tab ${clip(input.url, 160)}`;
    case 'select_page': return `Switch to tab ${input.pageId ?? input.pageIdx ?? ''}`;
    case 'click': return `Click ${clip(input.uid, 40)}${input.dblClick ? ' (double)' : ''}`;
    case 'fill': return `Fill ${clip(input.uid, 30)} = ${clip(input.value, 80)}`;
    case 'fill_form': return `Fill form (${(input.elements || []).length} fields)`;
    case 'type_text': return `Type ${clip(input.text, 80)}`;
    case 'press_key': return `Key ${clip(input.key, 30)}`;
    case 'upload_file': return `Upload ${clip(input.filePath, 120)}`;
    case 'take_snapshot': return 'Read page (snapshot)';
    case 'take_screenshot': return 'Screenshot';
    case 'evaluate_script': return `Evaluate script ${clip((input.function || '').replace(/\s+/g, ' '), 100)}`;
    case 'wait_for': return `Wait for "${clip(input.text, 60)}"`;
    case 'list_pages': return 'List tabs';
    case 'reload_extension': return 'Reload bot extension';
    case 'trigger_extension_action': return `Bot action ${clip(JSON.stringify(input), 100)}`;
    case 'handle_dialog': return `Dialog ${input.action || ''}`;
    case 'Agent': return `Sub-agent: ${clip(input.description, 100)}`;
    case 'Skill': return `Skill ${clip(input.skill, 60)} ${clip(input.args || '', 60)}`;
    default: return `${t} ${clip(JSON.stringify(input), 120)}`;
  }
}

module.exports = { redact, redactString, summarize, clip };
