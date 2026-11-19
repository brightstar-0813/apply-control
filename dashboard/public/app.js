'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ago = (ts) => {
    if (!ts) return '';
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.round(s / 60) + 'm ago';
    if (s < 86400) return Math.round(s / 3600) + 'h ago';
    return new Date(ts).toLocaleDateString();
  };
  const hhmm = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      method: opts.method || 'GET', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-BB': '1' },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (res.status === 401 && !path.startsWith('/api/login')) { showAuth(); throw new Error('login required'); }
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('json') ? await res.json() : await res.text();
    if (!res.ok) throw new Error((data && data.error) || res.statusText);
    return data;
  }

  // ---------------- auth ----------------
  async function boot() {
    let me;
    try { me = await (await fetch('/api/me', { credentials: 'same-origin' })).json(); } catch { me = { authed: false }; }
    if (me.authed) return startApp();
    showAuth(me.setupNeeded);
  }
  function showAuth(setup) {
    $('app').hidden = true; $('auth').hidden = false;
    $('setupForm').hidden = !setup; $('loginForm').hidden = !!setup;
    if (es) { es.close(); es = null; }
  }
  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault(); $('loginErr').textContent = '';
    try { await api('/api/login', { method: 'POST', body: { password: $('loginPw').value } }); $('loginPw').value = ''; startApp(); }
    catch (err) { $('loginErr').textContent = err.message; }
  });
  $('setupForm').addEventListener('submit', async (e) => {
    e.preventDefault(); $('setupErr').textContent = '';
    if ($('setupPw').value !== $('setupPw2').value) { $('setupErr').textContent = 'Passwords differ.'; return; }
    try { await api('/api/setup', { method: 'POST', body: { token: $('setupCode').value.trim(), password: $('setupPw').value } }); startApp(); }
    catch (err) { $('setupErr').textContent = err.message; }
  });

  // ---------------- app ----------------
  let state = null, es = null, oldest = 0, newest = 0, events = [];
  const seenNotify = new Set();

  function startApp() {
    $('auth').hidden = true; $('app').hidden = false;
    loadFeed(); loadThread(); loadBots().catch(() => {}); connect();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  function connect() {
    if (es) es.close();
    es = new EventSource('/api/stream');
    es.addEventListener('open', () => $('conn').classList.add('on'));
    es.addEventListener('error', () => { $('conn').classList.remove('on'); fetch('/api/me').then((r) => r.json()).then((m) => { if (!m.authed) showAuth(m.setupNeeded); }).catch(() => {}); });
    es.addEventListener('state', (e) => { state = JSON.parse(e.data); renderState(); });
    es.addEventListener('event', (e) => { const ev = JSON.parse(e.data); addEvents([ev], true); if (ev.kind === 'say' || ev.kind === 'user' || ev.kind === 'stop') loadThread(); });
    es.addEventListener('shot', () => renderShot(true));
    es.addEventListener('bots', (e) => { botsData = JSON.parse(e.data).bots || []; renderBots(); if (state) { renderQuestions(); renderOverview(); } });
    es.addEventListener('question', () => notify('New question from the agent', 'Open the dashboard to answer.'));
    es.addEventListener('approval', () => notify('Approval needed', 'The agent is waiting for your OK.'));
  }

  function stateLabel(s) {
    if (s.stopReq) return ['Stopping', 'stopping'];
    if (s.paused) return ['Paused', 'paused'];
    if (s.pendingApprovals.length) return ['Needs approval', 'waiting'];
    if (s.runner && s.runner.running) return ['Working (headless)', 'working'];
    if (s.waiting) return ['Waiting for you', 'waiting'];
    if (s.busy && Date.now() - s.lastEventTs < 20 * 60e3) return ['Working', 'working'];
    if (s.openQuestions.length) return ['Waiting for you', 'waiting'];
    return ['Idle', 'idle'];
  }

  function renderState() {
    const s = state; if (!s) return;
    const [label, cls] = stateLabel(s);
    const pill = $('statePill'); pill.textContent = label; pill.className = 'pill ' + cls;
    $('btnPause').textContent = s.paused || s.stopReq ? 'Resume' : 'Pause';
    $('btnPause').classList.toggle('good', s.paused || s.stopReq);
    $('statusText').textContent = s.status || 'No status posted yet.';
    $('lastAct').textContent = s.lastEventTs ? 'last action ' + ago(s.lastEventTs) : '';
    $('sessionInfo').textContent = s.session ? 'Session ' + s.session.slice(0, 8) + (s.pendingMessages ? ` · ${s.pendingMessages} message(s) not yet delivered` : '') : '';
    const r = s.runner || {};
    $('runnerInfo').textContent = r.running ? `Headless run active since ${hhmm(r.started)} (pid ${r.pid}) - the terminal session waits; type "take over" there to switch`
      : (r.last && r.last.ended ? `Last headless run ended ${ago(r.last.ended)} (exit ${r.last.code})` : (s.runnerCfg && !s.runnerCfg.claudeFound ? 'Claude Code binary not found - headless runs unavailable' : ''));
    $('btnRun').disabled = !!r.running || !(s.runnerCfg && s.runnerCfg.enabled);
    const nq = s.openQuestions.length, na = s.pendingApprovals.length;
    $('badgeInbox').hidden = !nq; $('badgeInbox').textContent = nq;
    $('badgeAppr').hidden = !na; $('badgeAppr').textContent = na;
    renderQuestions(); renderApprovals(); renderOverview();
    if (s.shotTs && s.shotTs !== renderShot.last) renderShot();
    document.title = (nq + na ? `(${nq + na}) ` : '') + 'Mission Control';
  }

  function renderShot() {
    if (!state || !state.shotTs) return;
    renderShot.last = state.shotTs;
    const url = '/api/screenshot?t=' + state.shotTs;
    $('shot').src = url; $('shot').hidden = false; $('shotLink').href = url; $('noShot').hidden = true;
    $('shotTime').textContent = hhmm(state.shotTs);
  }

  // ---------------- feed ----------------
  const ICON = { tool: '🔧', say: '💬', user: '🧑', prompt: '⌨️', stop: '⏸️', approval: '🛡️', control: '🎛️', runner: '🤖',
    status: '📍', session: '🟢', delivered: '📨', paused: '⏳', security: '🔒', notify: '🔔', resume: '▶️', subagent: '🧩', hook: '·' };
  const isRead = (e) => e.kind === 'tool' && /^(Read|Grep|Glob|Read page|List tabs|Wait for|Switch to tab)/.test(e.summary || '') && e.ok !== 0;

  function addEvents(list, live) {
    for (const e of list) {
      if (events.some((x) => x.id === e.id)) continue;
      events.push(e);
      if (!oldest || e.id < oldest) oldest = e.id;
      if (e.id > newest) newest = e.id;
    }
    events.sort((a, b) => b.id - a.id);
    if (events.length > 800) events.length = 800;
    renderFeed();
    if (live && state) state.lastEventTs = Date.now();
  }
  function renderFeed() {
    const hide = $('hideReads').checked;
    $('feed').innerHTML = events.filter((e) => !(hide && isRead(e))).slice(0, 400).map((e) =>
      `<li class="${esc(e.kind)}${e.ok === 0 ? ' fail' : ''}"><span class="ic">${ICON[e.kind] || '·'}</span>` +
      `<span class="tx">${esc(e.summary)}</span><span class="tm">${hhmm(e.ts)}</span></li>`).join('');
  }
  async function loadFeed() { addEvents(await api('/api/events?limit=200')); }
  $('moreFeed').addEventListener('click', async () => addEvents(await api('/api/events?limit=200&before=' + oldest)));
  $('hideReads').addEventListener('change', renderFeed);

  // ---------------- inbox ----------------
  async function loadThread() {
    const msgs = await api('/api/messages');
    $('thread').innerHTML = msgs.map((m) => `<li class="${m.author}"><div class="bubble">${esc(m.text)}` +
      `<span class="meta">${m.author === 'user' ? (m.via === 'terminal' ? 'terminal' : (m.delivered_ts ? 'delivered ' + hhmm(m.delivered_ts) : 'queued')) : 'agent'} · ${hhmm(m.ts)}` +
      `<button class="del" data-del="${m.id}" title="${m.author === 'user' && !m.delivered_ts ? 'Unsend' : 'Delete'}" aria-label="Delete message">✕</button></span></div></li>`).join('') ||
      '<li class="muted small">No messages.</li>';
    if (!$('tab-inbox').hidden) $('thread').lastElementChild?.scrollIntoView({ block: 'end' });
  }
  // Which job a question is about: "Q3 (Avash #24): ..." -> bot + queue row, when the bot shares it.
  function qContext(q) {
    const m = String(q.text).match(/^\s*Q\d+\s*(?:\(([^)]*)\))?\s*[:\-–]\s*/);
    const ctx = (m && m[1]) || '';
    const body = (m ? q.text.slice(m[0].length) : q.text).trim();
    const rm = ctx.match(/#\s*(\d+)/);
    const rowNo = rm ? Number(rm[1]) : null;
    let bot = botsData.find((b) => { const w = String(b.label || b.person || '').split(/[\s-]+/)[0].toLowerCase(); return w && ctx.toLowerCase().includes(w); });
    if (!bot && botsData.length === 1) bot = botsData[0];
    const row = bot && rowNo != null ? ((bot.state || {}).rows || []).find((r) => Number(r.row) === rowNo) : null;
    const nl = body.indexOf('\n');
    return { ctx, rowNo, row, head: (nl < 0 ? body : body.slice(0, nl)).trim(), rest: nl < 0 ? '' : body.slice(nl + 1).trim() };
  }
  const tag = (t) => (t ? `<span class="tag">${esc(t)}</span>` : '');
  function questionCard(q) {
    const c = qContext(q); const r = c.row;
    const title = r ? `<b>${esc(r.title || r.company || 'Row ' + r.row)}</b>${r.title && r.company ? ` <span class="muted">${esc(r.company)}</span>` : ''}`
      : `<b>${esc(q.qid || 'Question')}</b>${c.ctx ? ` <span class="muted">${esc(c.ctx)}</span>` : ''}`;
    const tags = (r ? tag(q.qid) + tag('row ' + r.row) + (boardOf(r.source) !== 'Direct / other' ? tag(boardOf(r.source)) : '') + (atsOf(r.source) !== 'Unknown' ? tag(atsOf(r.source)) : '') : '') + tag(hhmm(q.ts));
    return `
      <article class="need q" data-id="${q.id}">
        <header class="need-top"><div class="need-title">${title}</div><div class="tags">${tags}</div></header>
        <div class="need-body">
          <p class="need-q">${esc(c.head)}</p>
          ${c.rest ? `<p class="need-more">${esc(c.rest)}</p>` : ''}
          ${q.options.length ? `<div class="opts">${q.options.map((o) => `<button class="btn small" data-ans="${esc(o)}">${esc(o)}</button>`).join('')}</div>` : ''}
          <div class="answer"><textarea rows="2" placeholder="Type your answer here" aria-label="Your answer to ${esc(q.qid || 'the question')}"></textarea>
            <button class="btn primary" data-free="1">Send answer and continue</button></div>
        </div>
        <footer class="need-foot">
          ${c.rowNo != null ? '<button class="btn small" data-skip="1">Skip this job</button>' : ''}
          ${r && r.link ? `<a class="btn ghost small" href="${esc(r.link)}" target="_blank" rel="noopener noreferrer">Open job</a>` : ''}
          <button class="btn ghost small" data-dismiss="1">Dismiss</button>
        </footer>
      </article>`;
  }
  function approvalCard(a) {
    return `
      <article class="need appr" data-id="${a.id}">
        <header class="need-top"><div class="need-title"><b>Approval needed</b> <span class="muted">${esc(a.gate)}</span></div><div class="tags">${tag(hhmm(a.ts))}</div></header>
        <div class="need-body">
          <p class="need-q">${esc(a.summary)}</p>
          <details><summary class="muted small">Details</summary><pre>${esc(a.detail)}</pre></details>
          <div class="acts"><button class="btn good" data-d="approve">Approve</button><button class="btn danger" data-d="deny">Deny</button></div>
        </div>
      </article>`;
  }
  // Re-render only when the content changes, and keep what the user is typing.
  function setCards(el, html) {
    if (el._html === html) return;
    const drafts = {}; let focus = null;
    el.querySelectorAll('.q').forEach((c) => {
      const t = c.querySelector('textarea'); if (!t) return;
      if (t.value) drafts[c.dataset.id] = t.value;
      if (t === document.activeElement) focus = [c.dataset.id, t.selectionStart, t.selectionEnd];
    });
    el.innerHTML = html; el._html = html;
    el.querySelectorAll('.q').forEach((c) => {
      const t = c.querySelector('textarea'); if (!t) return;
      if (drafts[c.dataset.id]) t.value = drafts[c.dataset.id];
      if (focus && focus[0] === c.dataset.id) { t.focus(); t.setSelectionRange(focus[1], focus[2]); }
    });
  }
  function renderQuestions() {
    const qs = state.openQuestions, n = qs.length;
    $('qBar').hidden = n < 2; $('qCount').textContent = n + ' open questions';
    setCards($('questions'), qs.map(questionCard).join(''));
    renderNeeds();
  }
  function renderNeeds() {
    if (!state) return;
    const qs = state.openQuestions, as = state.pendingApprovals, n = qs.length + as.length;
    $('needs').hidden = !n; $('allClear').hidden = !!n;
    $('needsCount').textContent = n;
    setCards($('needsList'), as.map(approvalCard).join('') + qs.map(questionCard).join(''));
    $('needBtn').hidden = !n; $('needBtn').textContent = n === 1 ? '1 needs you' : n + ' need you';
    $('badgeLive').hidden = !n; $('badgeLive').textContent = n;
  }
  async function onCardClick(e) {
    const t = e.target.closest('button'); if (!t) return;
    const card = t.closest('.need'); if (!card) return;
    const id = card.dataset.id;
    const answer = (a) => api(`/api/questions/${id}/answer`, { method: 'POST', body: { answer: a } });
    try {
      if (t.dataset.d) { t.disabled = true; await api('/api/approvals/' + id, { method: 'POST', body: { decision: t.dataset.d } }); loadApprHist(); return; }
      if (t.dataset.ans) { t.disabled = true; await answer(t.dataset.ans); }
      else if (t.dataset.free) {
        const ta = card.querySelector('textarea'); const v = ta.value.trim();
        if (!v) { ta.focus(); return; }
        t.disabled = true; t.textContent = 'Sending…'; await answer(v); ta.value = '';
      }
      else if (t.dataset.skip) { if (!confirm('Skip this job? The agent drops this row and continues with the next one.')) return; t.disabled = true; await answer('skip this job'); }
      else if (t.dataset.dismiss) { if (!confirm('Dismiss this question without answering?')) return; await api(`/api/questions/${id}/dismiss`, { method: 'POST' }); }
      else return;
      loadThread();
    } catch (err) { t.disabled = false; if (t.dataset.free) t.textContent = 'Send answer and continue'; alert(err.message); }
  }
  function onCardKey(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.tagName === 'TEXTAREA') e.target.closest('.need')?.querySelector('[data-free]')?.click();
  }
  for (const id of ['needsList', 'questions', 'approvals']) { $(id).addEventListener('click', onCardClick); $(id).addEventListener('keydown', onCardKey); }
  $('needBtn').addEventListener('click', () => {
    document.querySelector('.tabs button[data-tab="live"]').click();
    $('needs').scrollIntoView({ block: 'start' });
    $('needsList').querySelector('textarea, .acts .btn')?.focus({ preventScroll: true });
  });

  // ---------------- overview (tiles + breakdown) ----------------
  const BOARDS = [[/dice\.com$/, 'Dice'], [/indeed\.com$/, 'Indeed'], [/builtin/, 'Built In'], [/himalayas\.app$/, 'Himalayas'],
    [/jobright\.ai$/, 'JobRight'], [/jobgether\.com$/, 'Jobgether'], [/linkedin\.com$/, 'LinkedIn']];
  const ATS = [[/greenhouse\.io$/, 'Greenhouse'], [/workdayjobs\.com$/, 'Workday'], [/lever\.co$/, 'Lever'], [/ashbyhq\.com$/, 'Ashby'],
    [/icims\.com$/, 'iCIMS'], [/paylocity\.com$/, 'Paylocity'], [/smartrecruiters\.com$/, 'SmartRecruiters'], [/bamboohr\.com$/, 'BambooHR'],
    [/successfactors\.(com|eu)$/, 'SuccessFactors'], [/taleo\.net$/, 'Taleo'], [/jobvite\.com$/, 'Jobvite'], [/dice\.com$/, 'Dice Easy Apply'], [/indeed\.com$/, 'Indeed Apply']];
  const pick = (list, host, d) => { const h = String(host || '').toLowerCase(); const x = list.find(([re]) => re.test(h)); return x ? x[1] : d; };
  const boardOf = (host) => pick(BOARDS, host, 'Direct / other');
  const atsOf = (host) => pick(ATS, host, 'Unknown');
  const bucket = (st) => (st === 'applied' ? 'sub' : st === 'error' || st === 'failed' ? 'err' : st === 'skipped' ? 'skip' : 'todo');
  const num = (v, cls) => `<td class="n${v ? ' ' + cls : ' zero'}">${v}</td>`;
  function table(title, rows, keyOf) {
    const g = new Map();
    for (const r of rows) { const k = keyOf(r.source); const o = g.get(k) || { sub: 0, err: 0, todo: 0, skip: 0, all: 0 }; o[bucket(r.status)] += 1; o.all += 1; g.set(k, o); }
    const last = (k) => (k === 'Unknown' || k === 'Direct / other' ? 1 : 0);
    const body = [...g.entries()].sort((x, y) => last(x[0]) - last(y[0]) || y[1].all - x[1].all)
      .map(([k, o]) => `<tr><th scope="row">${esc(k)}</th>${num(o.sub, 'ok')}${num(o.err, 'bad')}${num(o.todo, '')}${num(o.skip, '')}${num(o.all, '')}</tr>`).join('');
    return `<div class="card"><div class="tbl"><table class="stats"><thead><tr><th scope="col">${title}</th>` +
      '<th scope="col" class="n">Submitted</th><th scope="col" class="n">Errors</th><th scope="col" class="n">To do</th><th scope="col" class="n">Skipped</th><th scope="col" class="n">All</th>' +
      `</tr></thead><tbody>${body}</tbody></table></div></div>`;
  }
  function renderOverview() {
    if (!state) return;
    const need = state.openQuestions.length + state.pendingApprovals.length;
    const t = { applied: 0, todo: 0, queue: 0, error: 0 }; const per = { applied: [], todo: [], queue: [] };
    let rows = [], shown = 0, total = 0;
    for (const b of botsData) {
      const s = b.state || {}; const c = s.counters || {}; const name = String(b.label || b.person || 'Bot').split(' ')[0];
      const todo = (c.pending || 0) + (c.running || 0);
      t.applied += c.applied || 0; t.todo += todo; t.queue += c.queue || 0; t.error += c.error || 0;
      per.applied.push(`${name} ${c.applied || 0}`); per.todo.push(`${name} ${todo}`); per.queue.push(`${name} ${c.queue || 0}`);
      rows = rows.concat(s.rows || []); shown += (s.rows || []).length; total += s.rowsTotal || (s.rows || []).length;
    }
    const has = botsData.length > 0; const sub = (k) => (botsData.length > 1 ? per[k].join(' · ') : '');
    const tile = (cls, label, v, note) => `<div class="tile ${cls}"><span class="tl">${label}</span><b>${v}</b><span class="tn">${esc(note || '')}</span></div>`;
    const v = (x) => (has ? x : '–');
    $('tiles').innerHTML = tile('ok', 'Submitted', v(t.applied), sub('applied')) +
      tile(need ? 'warn' : '', 'Needs you', need, t.error ? `${t.error} row${t.error === 1 ? '' : 's'} stopped with errors` : '') +
      tile('', 'To do', v(t.todo), sub('todo')) + tile('info', 'Tracked', v(t.queue), has ? sub('queue') : 'Open the bot window to see queue numbers');
    $('breakdown').innerHTML = rows.length ? table('Job board', rows, boardOf) + table('Application system', rows, atsOf) +
      (shown < total ? `<p class="muted small span2">Tables cover the ${shown} of ${total} rows the bot shares (active rows first); the tiles count every row.</p>` : '') : '';
  }
  $('thread').addEventListener('click', async (e) => {
    const id = e.target.dataset.del; if (!id) return;
    const li = e.target.closest('li');
    try { await api(`/api/messages/${id}/delete`, { method: 'POST' }); li.remove(); } catch (err) { alert(err.message); }
  });
  $('chatClear').addEventListener('click', async () => {
    if (!confirm('Delete all chat messages? Messages not yet delivered to the agent are unsent.')) return;
    try { await api('/api/messages/clear', { method: 'POST' }); loadThread(); } catch (err) { alert(err.message); }
  });
  $('qDismissAll').addEventListener('click', async () => {
    if (!confirm('Dismiss all open questions?')) return;
    try { await api('/api/questions/dismiss-all', { method: 'POST' }); } catch (err) { alert(err.message); }
  });
  $('compose').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = $('msg').value.trim(); if (!text) return;
    try { await api('/api/messages', { method: 'POST', body: { text } }); $('msg').value = ''; loadThread(); }
    catch (err) { alert(err.message); }
  });
  $('msg').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('compose').requestSubmit(); });

  // ---------------- approvals ----------------
  function renderApprovals() {
    setCards($('approvals'), state.pendingApprovals.map(approvalCard).join('') || '<div class="card"><p class="muted">Nothing waiting for approval.</p></div>');
  }
  async function loadApprHist() {
    const list = await api('/api/approvals');
    $('apprHist').innerHTML = list.filter((a) => a.status !== 'pending').map((a) =>
      `<li class="${a.status === 'approved' ? '' : 'fail'}"><span class="ic">${a.status === 'approved' ? '✅' : '⛔'}</span>` +
      `<span class="tx">${esc(a.status)} · ${esc(a.summary)}</span><span class="tm">${hhmm(a.ts)}</span></li>`).join('') || '<li><span></span><span class="tx muted">None yet.</span></li>';
  }

  // ---------------- controls ----------------
  $('btnPause').addEventListener('click', () => api('/api/control', { method: 'POST', body: { action: state && (state.paused || state.stopReq) ? 'resume' : 'pause' } }).catch((e) => alert(e.message)));
  $('btnStop').addEventListener('click', () => {
    if (confirm('Stop the agent? It ends its turn at its next action (a headless run is killed now).')) api('/api/control', { method: 'POST', body: { action: 'stop' } }).catch((e) => alert(e.message));
  });
  $('quickRuns').addEventListener('click', (e) => { const p = e.target.dataset.p; if (p) $('runPrompt').value = p; });
  $('btnRun').addEventListener('click', async () => {
    $('runErr').textContent = '';
    const prompt = $('runPrompt').value.trim(); if (!prompt) { $('runErr').textContent = 'Write a prompt or tap a chip.'; return; }
    const body = { prompt, resume: $('runResume').checked };
    try { await api('/api/runner/start', { method: 'POST', body }); $('runPrompt').value = ''; }
    catch (err) {
      if (/busy/.test(err.message) && confirm(err.message + '\n\nStart anyway?')) {
        try { await api('/api/runner/start', { method: 'POST', body: { ...body, force: true } }); } catch (e2) { $('runErr').textContent = e2.message; }
      } else $('runErr').textContent = err.message;
    }
  });

  // ---------------- bots (bot bridge) ----------------
  let botsData = [];
  async function loadBots() { const r = await api('/api/bots'); botsData = r.bots; renderBots(); if (state) { renderQuestions(); renderOverview(); } }
  const CONFIRM = {
    start: 'Start the batch on this bot?', stop: 'Stop the batch?', skip: 'Skip the row the bot is working on?',
    rowApply: 'Open and apply this row now?', rowMarkApplied: 'Mark this row applied? Only do this after you saw a real confirmation page.',
    rowRemove: 'Remove this row from the queue?', person: 'Switch the active person in this bot?',
  };
  function seg(bot, cmd, current, options) {
    return `<div class="chips">${options.map(([v, l]) => `<button class="chip${String(current) === String(v) ? ' on' : ''}" data-bot="${esc(bot)}" data-cmd="${cmd}" data-value="${esc(v)}">${esc(l)}</button>`).join('')}</div>`;
  }
  function renderBots() {
    if ($('tab-bots').hidden) return;
    if ($('botsList').contains(document.activeElement) && ['SELECT', 'INPUT'].includes(document.activeElement.tagName)) return;
    if (!botsData.length) {
      $('botsList').innerHTML = '<div class="card"><h2>No bot window connected</h2><p class="muted">Open the BrightStar Bid Bot window in Avash\'s or Lewis\'s Chrome profile on the server (after the bot update is loaded). It connects within a few seconds.</p></div>';
      return;
    }
    $('botsList').innerHTML = botsData.map((b) => {
      const s = b.state || {}; const id = b.botId; const c = s.counters || {}; const bt = s.batch || {};
      const counters = ['queue', 'pending', 'done', 'applied', 'skipped', 'error'].map((k) => `<div class="ctr"><b>${esc(c[k] ?? '–')}</b><span>${k}</span></div>`).join('');
      const rows = (s.rows || []).map((r) => `<li class="qrow">
          <div class="qmain"><b>#${esc(r.row)}</b> ${esc(r.company || '')} <span class="muted">· ${esc(r.title || '')}</span>
            <div class="muted small">${esc(r.source || '')} · <span class="st st-${esc(String(r.status || '').toLowerCase().replace(/\W+/g, '-'))}">${esc(r.status || '')}</span>${r.link ? ` · <a href="${esc(r.link)}" target="_blank" rel="noopener noreferrer">job</a>` : ''}</div></div>
          <div class="qacts">
            ${(r.actions || []).includes('apply') ? `<button class="btn small" data-bot="${esc(id)}" data-cmd="rowApply" data-row="${esc(r.key)}">Apply</button>` : ''}
            ${(r.actions || []).includes('markApplied') ? `<button class="btn small good" data-bot="${esc(id)}" data-cmd="rowMarkApplied" data-row="${esc(r.key)}">Mark applied</button>` : ''}
            ${(r.actions || []).includes('remove') ? `<button class="btn small danger" data-bot="${esc(id)}" data-cmd="rowRemove" data-row="${esc(r.key)}">✕</button>` : ''}
          </div></li>`).join('');
      const filters = (s.filters || []).filter((f) => !/linkedin/i.test(f.id + f.label)).map((f) => [f.id, f.label + (f.count != null ? ` (${f.count})` : '')]);
      const persons = (s.persons || []).map((p) => `<option value="${esc(p.id)}"${p.id === s.person ? ' selected' : ''}>${esc(p.label)}</option>`).join('');
      const tabs = (s.captureTabs || []).map((t) => `<option${t === s.captureTab ? ' selected' : ''}>${esc(t)}</option>`).join('');
      const cmds = (b.commands || []).slice(0, 5).map((x) => `<li class="${x.status === 'error' ? 'fail' : ''}"><span class="ic">${x.status === 'done' ? '✅' : x.status === 'error' ? '⚠️' : '⏳'}</span><span class="tx">${esc(x.label)}${x.args && x.args.value != null ? ' → ' + esc(x.args.value) : ''}${x.result ? ' · ' + esc(x.result) : ''}</span><span class="tm">${hhmm(x.ts)}</span></li>`).join('');
      return `<div class="card bot">
        <div class="row-between"><h2>${esc(b.label || b.person || 'Bot')} <span class="dot ${b.online ? 'on' : ''}" title="${b.online ? 'online' : 'offline'}"></span></h2>
          <button class="btn ghost small" data-bot="${esc(id)}" data-cmd="refresh">↻</button></div>
        <p class="status-text">${esc(s.status || '')}</p>
        ${s.nowWorking ? `<p class="muted small">Now: ${esc(s.nowWorking)}</p>` : ''}
        <div class="ctrs">${counters}</div>
        <div class="btnrow">
          <button class="btn primary" data-bot="${esc(id)}" data-cmd="start" ${bt.canStart === false ? 'disabled' : ''}>Start</button>
          ${bt.paused ? `<button class="btn good" data-bot="${esc(id)}" data-cmd="resume">Resume</button>` : `<button class="btn" data-bot="${esc(id)}" data-cmd="pause" ${bt.running ? '' : 'disabled'}>Pause</button>`}
          <button class="btn" data-bot="${esc(id)}" data-cmd="skip" ${bt.running ? '' : 'disabled'}>Skip row</button>
          <button class="btn danger" data-bot="${esc(id)}" data-cmd="stop" ${bt.running || bt.paused ? '' : 'disabled'}>Stop</button>
        </div>
        <h3>Load jobs</h3>
        <div class="btnrow"><button class="btn" data-bot="${esc(id)}" data-cmd="loadSheet">Load from sheet</button></div>
        <label>Jobs sheet link
          <span class="inrow"><input type="url" data-field="sheetUrl" value="${esc(s.sheetUrl || '')}" placeholder="https://docs.google.com/spreadsheets/d/…" autocomplete="off">
          <button class="btn small" data-bot="${esc(id)}" data-save="sheetUrl">Save</button></span></label>
        <label>Capture tab
          <span class="inrow"><input type="text" data-field="captureTab" value="${esc(s.captureTab || '')}" placeholder="US-SF-Jobs" autocomplete="off">
          <button class="btn small" data-bot="${esc(id)}" data-save="captureTab">Save</button></span></label>
        <p class="muted small">Source: ${esc(s.source || '?')}${s.sheetName ? ' · tab ' + esc(s.sheetName) : ''} · Save first, then Load from sheet.</p>
        <h3>Source filter</h3>${seg(id, 'filter', s.filter, filters)}
        <h3>Batch mode</h3>${seg(id, 'batchMode', s.batchMode, [['generate', 'Generate'], ['apply', 'Generate + Apply']])}
        <h3>Options</h3>
        ${seg(id, 'autoSubmit', s.autoSubmit ? 'on' : 'off', [['on', 'Auto submit ON'], ['off', 'Auto submit OFF']])}
        ${seg(id, 'autofill', s.autofill ? 'on' : 'off', [['on', 'Autofill ON'], ['off', 'Autofill OFF']])}
        ${persons ? `<label>Person <select data-bot="${esc(id)}" data-cmd="person">${persons}</select></label>` : ''}
        <h3>Queue <span class="muted small">(${(s.rows || []).length}${s.rowsTotal > (s.rows || []).length ? ' of ' + s.rowsTotal : ''} shown)</span></h3>
        <ol class="queue">${rows || '<li class="muted">Queue empty.</li>'}</ol>
        ${cmds ? `<h3>Recent commands</h3><ol class="feed">${cmds}</ol>` : ''}
        <p class="muted small">Updated ${ago(s.ts || b.lastSeen)}</p>
      </div>`;
    }).join('');
  }
  async function botCmd(bot, cmd, args) {
    if (CONFIRM[cmd] && !confirm(CONFIRM[cmd])) return;
    if (cmd === 'autoSubmit' && args.value === 'on' && !confirm('Turn ON auto submit? The bot will submit applications on adapter sites by itself.')) return;
    try { await api(`/api/bots/${bot}/command`, { method: 'POST', body: { cmd, args } }); } catch (err) { alert(err.message); }
  }
  $('botsList').addEventListener('click', (e) => {
    const sv = e.target.closest('[data-save]');
    if (sv) {
      const input = sv.parentElement.querySelector('input');
      const value = input.value.trim();
      if (!value) { alert('Empty'); return; }
      botCmd(sv.dataset.bot, sv.dataset.save, { value }).then(() => input.blur());
      return;
    }
    const el = e.target.closest('[data-cmd]'); if (!el || el.tagName === 'SELECT') return;
    const args = {}; if (el.dataset.value != null) args.value = el.dataset.value; if (el.dataset.row != null) args.row = el.dataset.row;
    botCmd(el.dataset.bot, el.dataset.cmd, args);
  });
  $('botsList').addEventListener('change', (e) => {
    const el = e.target.closest('select[data-cmd]'); if (!el) return;
    botCmd(el.dataset.bot, el.dataset.cmd, { value: el.value }); el.blur();
  });

  // ---------------- runs ----------------
  async function loadRuns() {
    const runs = await api('/api/runs');
    $('runs').innerHTML = runs.map((r) => `<li><a data-name="${esc(r.name)}">${esc(r.name.replace(/\.md$/, ''))}</a>` +
      ` <span class="muted small">updated ${ago(r.mtime)}</span></li>`).join('') || '<li class="muted">No run logs yet.</li>';
  }
  $('runs').addEventListener('click', async (e) => {
    const n = e.target.dataset.name; if (!n) return;
    const doc = await api('/api/runs/' + encodeURIComponent(n));
    $('runDoc').innerHTML = md(doc.text); $('runList').hidden = true; $('runView').hidden = false; window.scrollTo(0, 0);
  });
  $('runBack').addEventListener('click', () => { $('runView').hidden = true; $('runList').hidden = false; });

  function inline(s) {
    return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|\W)\*([^*]+)\*(?=\W|$)/g, '$1<i>$2</i>');
  }
  function md(text) {
    const lines = text.split(/\r?\n/); const out = []; let i = 0;
    while (i < lines.length) {
      const l = lines[i];
      if (/^```/.test(l)) { const buf = []; i++; while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]); i++; out.push(`<pre>${esc(buf.join('\n'))}</pre>`); continue; }
      const h = l.match(/^(#{1,3})\s+(.*)/); if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
      if (/^\s*\|/.test(l)) {
        const rows = []; while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
        const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        const body = rows.filter((r) => !/^\s*\|?\s*:?-{2,}/.test(r));
        out.push('<div class="tbl"><table>' + body.map((r, k) => '<tr>' + cells(r).map((c) => k ? `<td>${inline(c)}</td>` : `<th>${inline(c)}</th>`).join('') + '</tr>').join('') + '</table></div>');
        continue;
      }
      if (/^\s*[-*]\s+/.test(l)) { const items = []; while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, '')); out.push('<ul>' + items.map((x) => `<li>${inline(x)}</li>`).join('') + '</ul>'); continue; }
      if (l.trim()) out.push(`<p>${inline(l)}</p>`);
      i++;
    }
    return out.join('');
  }

  // ---------------- settings ----------------
  let settings = null;
  async function loadSettings() {
    settings = await api('/api/settings');
    $('setRunner').checked = settings.runner.enabled; $('setWake').checked = settings.runner.autoWake; $('setMode').value = settings.runner.permissionMode;
    $('gates').innerHTML = settings.gates.map((g, k) => `<li class="gate" data-k="${k}">
      <label class="check"><input type="checkbox" data-f="enabled" ${g.enabled ? 'checked' : ''}> <b>${esc(g.label)}</b></label>
      <input type="text" data-f="tool" value="${esc(g.tool)}" aria-label="Tool regex">
      <input type="text" data-f="input" value="${esc(g.input)}" aria-label="Input regex"></li>`).join('');
  }
  $('saveSettings').addEventListener('click', async () => {
    const gates = [...$('gates').children].map((li) => {
      const g = { ...settings.gates[li.dataset.k] };
      li.querySelectorAll('[data-f]').forEach((el) => { g[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value; });
      return g;
    });
    try {
      await api('/api/settings', { method: 'POST', body: { gates, runner: { enabled: $('setRunner').checked, autoWake: $('setWake').checked, permissionMode: $('setMode').value } } });
      $('setMsg').textContent = 'Saved.'; loadSettings();
    } catch (err) { $('setMsg').textContent = err.message; }
  });
  $('pwForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api('/api/password', { method: 'POST', body: { current: $('pwCur').value, next: $('pwNew').value } }); $('pwMsg').textContent = 'Changed. Sign in again.'; setTimeout(boot, 800); }
    catch (err) { $('pwMsg').textContent = err.message; }
  });
  $('btnLogout').addEventListener('click', async () => { await api('/api/logout', { method: 'POST' }).catch(() => {}); showAuth(false); });

  // ---------------- notifications ----------------
  $('btnNotify').addEventListener('click', async () => {
    if (!('Notification' in window)) { alert('This browser has no notifications. On iPhone, add the page to the Home Screen first.'); return; }
    const p = await Notification.requestPermission();
    $('btnNotify').textContent = p === 'granted' ? 'Alerts enabled ✓' : 'Alerts blocked in browser settings';
  });
  async function notify(title, body) {
    const key = title + Math.floor(Date.now() / 5000);
    if (seenNotify.has(key)) return; seenNotify.add(key);
    if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
    if (!('Notification' in window) || Notification.permission !== 'granted' || !document.hidden) return;
    try { const reg = await navigator.serviceWorker.getRegistration(); if (reg) reg.showNotification(title, { body, tag: title, icon: 'icon.svg' }); else new Notification(title, { body }); } catch { /* ignore */ }
  }

  // ---------------- tabs ----------------
  document.querySelector('.tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]'); if (!b) return;
    document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b));
    document.querySelectorAll('.tab').forEach((t) => { t.hidden = t.id !== 'tab-' + b.dataset.tab; });
    if (b.dataset.tab === 'runs') loadRuns();
    if (b.dataset.tab === 'bots') loadBots();
    if (b.dataset.tab === 'settings') loadSettings();
    if (b.dataset.tab === 'approve') loadApprHist();
    if (b.dataset.tab === 'inbox') loadThread();
    window.scrollTo(0, 0);
  });
  setInterval(() => { if (state) { $('lastAct').textContent = state.lastEventTs ? 'last action ' + ago(state.lastEventTs) : ''; } }, 15000);

  boot();
})();
