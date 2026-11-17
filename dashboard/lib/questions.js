'use strict';
// Pull the final "Q<n>: ..." question (and its reply options) out of an agent message,
// so the dashboard can show it as a card with one-tap answers.

function parseQuestion(msg) {
  if (!msg) return null;
  const re = /\bQ(\d+)\b\s*(\([^)]*\))?\s*[:\-–]/g;
  let m, last = null;
  while ((m = re.exec(msg))) last = m;
  if (!last) return null;
  const qid = 'Q' + last[1];
  const text = msg.slice(last.index).trim().slice(0, 1200);
  const options = [];
  const add = (o) => {
    o = String(o || '').replace(/[*_`]/g, '').trim().replace(/[.;,]+$/, '');
    if (o && o.length <= 80 && !options.some((x) => x.toLowerCase() === o.toLowerCase())) options.push(o);
  };
  // Reply "Q3 Yes" / reply `Q3 go`
  const quoted = new RegExp(`["“\`']${qid}\\s+([^"”\`']+)["”\`']`, 'gi');
  while ((m = quoted.exec(text))) add(m[1]);
  // (options: A / B / C)  or  Options: A, B, C
  const om = text.match(/options?\s*:\s*(.+?)(?:\)|\n|\.\s|\.$|$)/i);
  if (om) om[1].split(/\s*\/\s*|\s*,\s*|\s+or\s+/i).forEach((o) => add(o.replace(/^["“`']|["”`']$/g, '')));
  return { qid, text, options: options.slice(0, 8) };
}

module.exports = { parseQuestion };
