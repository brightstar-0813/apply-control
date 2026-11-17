'use strict';
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function open(dataDir) {
  const db = new DatabaseSync(path.join(dataDir, 'dashboard.sqlite'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY, ts INTEGER NOT NULL, session TEXT, kind TEXT NOT NULL,
      tool TEXT, summary TEXT, detail TEXT, ok INTEGER);
    CREATE INDEX IF NOT EXISTS events_ts ON events(ts);
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY, ts INTEGER NOT NULL, author TEXT NOT NULL, text TEXT NOT NULL,
      delivered_ts INTEGER);
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY, ts INTEGER NOT NULL, qid TEXT, text TEXT NOT NULL, options TEXT,
      answered_ts INTEGER, answer TEXT);
    CREATE TABLE IF NOT EXISTS approvals (
      id INTEGER PRIMARY KEY, ts INTEGER NOT NULL, session TEXT, gate TEXT, tool TEXT,
      summary TEXT, detail TEXT, status TEXT NOT NULL DEFAULT 'pending', decided_ts INTEGER);
    CREATE TABLE IF NOT EXISTS logins (
      token TEXT PRIMARY KEY, ts INTEGER NOT NULL, expires INTEGER NOT NULL, ua TEXT);
    CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);
  `);
  try { db.exec('ALTER TABLE messages ADD COLUMN via TEXT'); } catch { /* already there */ }

  const q = (sql) => db.prepare(sql);
  const st = {
    kvGet: q('SELECT v FROM kv WHERE k = ?'),
    kvSet: q('INSERT INTO kv(k, v) VALUES(?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v'),
    addEvent: q('INSERT INTO events(ts, session, kind, tool, summary, detail, ok) VALUES(?,?,?,?,?,?,?)'),
    events: q('SELECT * FROM events WHERE id > ? ORDER BY id DESC LIMIT ?'),
    eventsBefore: q('SELECT * FROM events WHERE id < ? ORDER BY id DESC LIMIT ?'),
    pruneEvents: q('DELETE FROM events WHERE id < (SELECT MAX(id) FROM events) - ?'),
    addMsg: q('INSERT INTO messages(ts, author, text, delivered_ts, via) VALUES(?,?,?,?,?)'),
    msgs: q('SELECT * FROM messages ORDER BY id DESC LIMIT ?'),
    pendingMsgs: q("SELECT * FROM messages WHERE author = 'user' AND delivered_ts IS NULL ORDER BY id"),
    deliver: q('UPDATE messages SET delivered_ts = ? WHERE id = ?'),
    delMsg: q('DELETE FROM messages WHERE id = ?'),
    clearMsgs: q('DELETE FROM messages'),
    dismissAllQs: q("UPDATE questions SET answered_ts = ?, answer = '(dismissed)' WHERE answered_ts IS NULL"),
    addQ: q('INSERT INTO questions(ts, qid, text, options) VALUES(?,?,?,?)'),
    openQs: q('SELECT * FROM questions WHERE answered_ts IS NULL ORDER BY id DESC LIMIT 50'),
    qByQid: q('SELECT * FROM questions WHERE qid = ? AND answered_ts IS NULL'),
    answerQ: q('UPDATE questions SET answered_ts = ?, answer = ? WHERE id = ?'),
    addAppr: q('INSERT INTO approvals(ts, session, gate, tool, summary, detail) VALUES(?,?,?,?,?,?)'),
    appr: q('SELECT * FROM approvals WHERE id = ?'),
    pendingAppr: q("SELECT * FROM approvals WHERE status = 'pending' ORDER BY id"),
    recentAppr: q('SELECT * FROM approvals ORDER BY id DESC LIMIT 30'),
    decideAppr: q("UPDATE approvals SET status = ?, decided_ts = ? WHERE id = ? AND status = 'pending'"),
    addLogin: q('INSERT INTO logins(token, ts, expires, ua) VALUES(?,?,?,?)'),
    login: q('SELECT * FROM logins WHERE token = ? AND expires > ?'),
    delLogin: q('DELETE FROM logins WHERE token = ?'),
    delAllLogins: q('DELETE FROM logins'),
  };

  return {
    raw: db,
    get(k, d = null) { const r = st.kvGet.get(k); if (!r) return d; try { return JSON.parse(r.v); } catch { return d; } },
    set(k, v) { st.kvSet.run(k, JSON.stringify(v)); },
    addEvent(e) {
      const r = st.addEvent.run(Date.now(), e.session || null, e.kind, e.tool || null, e.summary || null,
        e.detail == null ? null : (typeof e.detail === 'string' ? e.detail : JSON.stringify(e.detail)), e.ok == null ? null : (e.ok ? 1 : 0));
      if (Number(r.lastInsertRowid) % 500 === 0) st.pruneEvents.run(20000);
      return Number(r.lastInsertRowid);
    },
    events(afterId = 0, limit = 200) { return st.events.all(afterId, limit); },
    eventsBefore(id, limit = 200) { return st.eventsBefore.all(id, limit); },
    addMessage(author, text, delivered = false, via = null) {
      return Number(st.addMsg.run(Date.now(), author, text, delivered ? Date.now() : null, via).lastInsertRowid);
    },
    messages(limit = 100) { return st.msgs.all(limit).reverse(); },
    takePending() {
      const rows = st.pendingMsgs.all();
      const now = Date.now();
      for (const r of rows) st.deliver.run(now, r.id);
      return rows;
    },
    peekPending() { return st.pendingMsgs.all(); },
    deleteMessage(id) { return st.delMsg.run(id).changes > 0; },
    clearMessages() { return st.clearMsgs.run().changes; },
    dismissAllQuestions() { return st.dismissAllQs.run(Date.now()).changes; },
    addQuestion(qid, text, options) { return Number(st.addQ.run(Date.now(), qid, text, JSON.stringify(options || [])).lastInsertRowid); },
    openQuestions() { return st.openQs.all().map((r) => ({ ...r, options: JSON.parse(r.options || '[]') })); },
    questionByQid(qid) { return st.qByQid.get(qid); },
    answerQuestion(id, answer) { st.answerQ.run(Date.now(), answer, id); },
    addApproval(a) { return Number(st.addAppr.run(Date.now(), a.session || null, a.gate, a.tool, a.summary, a.detail || null).lastInsertRowid); },
    approval(id) { return st.appr.get(id); },
    pendingApprovals() { return st.pendingAppr.all(); },
    recentApprovals() { return st.recentAppr.all(); },
    decideApproval(id, status) { return st.decideAppr.run(status, Date.now(), id).changes > 0; },
    addLogin(token, days, ua) { st.addLogin.run(token, Date.now(), Date.now() + days * 864e5, ua || ''); },
    validLogin(token) { return !!(token && st.login.get(token, Date.now())); },
    delLogin(token) { st.delLogin.run(token); },
    delAllLogins() { st.delAllLogins.run(); },
  };
}

module.exports = { open };
