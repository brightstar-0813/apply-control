'use strict';
// Bot bridge registry: each open BrightStar Bid Bot window (one per Chrome profile) syncs its
// state here every ~2 s and picks up commands the user queued from the dashboard.
// The bridge executes commands by clicking the bot's own controls (see bot: dashboard-bridge.js).

const COMMANDS = {
  // id: [label, needsConfirm]
  loadSheet: ['Load from sheet', false],
  start: ['Start batch', true],
  pause: ['Pause batch', false],
  skip: ['Skip current row', true],
  resume: ['Resume batch', false],
  stop: ['Stop batch', true],
  filter: ['Set source filter', false],
  batchMode: ['Set batch mode', false],
  autoSubmit: ['Set allow auto submit', true],
  autofill: ['Set autofill', false],
  person: ['Switch person', true],
  rowApply: ['Apply row', true],
  rowMarkApplied: ['Mark row applied', true],
  rowRemove: ['Remove row', true],
  captureTab: ['Set capture tab', false],
  sheetUrl: ['Set jobs sheet link', false],
  refresh: ['Refresh state', false],
};
const NEVER_FILTERS = /linkedin/i; // CLAUDE.md rule 11
// Only enabled people (apply-control profiles/index.md). Other bot persons are never offered.
const ENABLED_PERSONS = new Set(['avash-chapagain', 'dmario-lewis']);

const dayOf = (ts) => new Date(ts).toLocaleDateString('en-CA'); // YYYY-MM-DD, server local time

function createBots({ onEvent, store = null, clock = () => Date.now() }) {
  const bots = new Map(); // botId -> { botId, person, label, lastSeen, state, queue: [], results: [] }
  let seq = 1;

  // Resume builds: the bridge reports counters.built (rows with saved files). A rise while the
  // queue length stays the same is a new build; a queue reload (length change) only re-bases.
  function trackBuilds(b, st) {
    const c0 = st && st.counters; if (!c0) return;
    // older bridge (bot not reloaded yet): no counters.built → use done (rows whose files were generated)
    const kind = typeof c0.built === 'number' ? 'built' : 'done';
    const c = { queue: c0.queue, kind, built: kind === 'built' ? c0.built : Number(c0.done) || 0 };
    const t = clock(); const key = 'built:' + b.botId;
    const rec = b.built || (store && store.get(key, null)) || { today: 0, day: dayOf(t), lastBuiltAt: null };
    if (rec.day !== dayOf(t)) { rec.day = dayOf(t); rec.today = 0; }
    const prev = b.builtPrev; b.builtPrev = { built: c.built, queue: c.queue, kind };
    if (prev && prev.kind === kind && prev.queue === c.queue && c.built > prev.built) {
      rec.today += c.built - prev.built; rec.lastBuiltAt = t;
      onEvent({ kind: 'bot', ok: true, summary: `${b.label || 'Bot'}: resume built (${rec.today} today)` });
    }
    b.built = rec; if (store) store.set(key, rec);
  }

  function sync(body) {
    const id = String(body.botId || '').slice(0, 64);
    if (!/^[\w-]{6,64}$/.test(id)) throw new Error('bad botId');
    let b = bots.get(id);
    if (!b) { b = { botId: id, queue: [], results: [], firstSeen: Date.now() }; bots.set(id, b); onEvent({ kind: 'bot', summary: `Bot window connected (${body.person || 'unknown person'})` }); }
    b.lastSeen = clock();
    if (body.state && typeof body.state === 'object') {
      if (Array.isArray(body.state.persons)) body.state.persons = body.state.persons.filter((x) => ENABLED_PERSONS.has(x.id));
      b.state = body.state; b.person = body.state.person || b.person; b.label = body.state.personLabel || b.person;
      trackBuilds(b, body.state); }
    for (const r of Array.isArray(body.results) ? body.results.slice(0, 20) : []) {
      const c = b.results.find((x) => x.id === r.id);
      if (c && c.status === 'sent') {
        c.status = r.ok ? 'done' : 'error'; c.result = String(r.message || '').slice(0, 500); c.doneTs = Date.now();
        onEvent({ kind: 'bot', ok: !!r.ok, summary: `${b.label || 'Bot'}: ${c.label}${c.args && c.args.value != null ? ' → ' + c.args.value : ''} ${r.ok ? 'done' : 'failed'}${c.result ? ' - ' + c.result : ''}` });
      }
    }
    const out = b.queue.splice(0, b.queue.length);
    for (const c of out) c.status = 'sent';
    b.results = b.results.slice(-30);
    return { commands: out.map(({ id: cid, cmd, args }) => ({ id: cid, cmd, args })) };
  }

  function enqueue(botId, cmd, args) {
    const b = bots.get(botId);
    if (!b) throw new Error('bot not connected');
    if (!COMMANDS[cmd]) throw new Error('unknown command');
    if (clock() - (b.lastSeen || 0) > 20e3) throw new Error('bot window is offline (open the bot window in that Chrome profile)');
    args = args && typeof args === 'object' ? args : {};
    if (cmd === 'sheetUrl' && !/^https:[/][/]docs[.]google[.]com[/]spreadsheets[/]d[/][A-Za-z0-9_-]{10,}/.test(String(args.value || ''))) throw new Error('not a Google Sheets link');
    if (cmd === 'captureTab' && !String(args.value || '').trim()) throw new Error('capture tab is empty');
    if (cmd === 'person' && !ENABLED_PERSONS.has(String(args.value || ''))) throw new Error('only Avash or Lewis can be selected');
    if (cmd === 'filter' && NEVER_FILTERS.test(String(args.value || ''))) throw new Error('LinkedIn filter is never used (rule 11)');
    const c = { id: seq++, cmd, args, label: COMMANDS[cmd][0], status: 'queued', ts: Date.now() };
    b.queue.push(c); b.results.push(c);
    onEvent({ kind: 'bot', summary: `You → ${b.label || 'bot'}: ${c.label}${args.value != null ? ' → ' + args.value : ''}${args.row != null ? ' (row ' + args.row + ')' : ''}` });
    return c;
  }

  function list() {
    const now = clock();
    return [...bots.values()]
      .filter((b) => now - (b.lastSeen || 0) < 10 * 60e3)
      .map((b) => ({ botId: b.botId, person: b.person, label: b.label, online: now - b.lastSeen < 20e3, lastSeen: b.lastSeen,
        state: b.state || null, commands: b.results.slice(-10).reverse(),
        built: b.built && b.built.day === dayOf(now) ? b.built : { today: 0, lastBuiltAt: b.built ? b.built.lastBuiltAt : null } }))
      .sort((a, b) => String(a.label).localeCompare(String(b.label)));
  }

  return { sync, enqueue, list, COMMANDS };
}

module.exports = { createBots };
