// ADP Workforce Now (workforcenow.adp.com recruitment) — Tripoint-style screening page
// through Self-ID, Review and e-sign checkbox. Read the salary from window.__adpSalary
// (set it first with a one-line evaluate) or defaults to 150000. Stops before Submit;
// the typed full name + Submit stay manual. Returns a short status string.
async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const vis = (sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent);
  const text = () => { const t = document.body.innerText; return t.slice(t.lastIndexOf('Self-Attest & Submit')); };
  const next = async () => {
    const b = vis('button').filter((b) => /^Next/.test(b.innerText.trim())).pop();
    if (!b) return false; b.click(); await sleep(4500); return true;
  };
  const radioFor = (qRe, label) => {
    const r = [...document.querySelectorAll('input[type=radio]')].find((i) => {
      const box = i.closest('fieldset,[role=radiogroup]')?.parentElement || i.closest('div');
      return qRe.test(box?.innerText || '') && (i.labels?.[0]?.innerText.trim() || i.value) === label;
    });
    if (r && !r.checked) (r.labels?.[0] || r).click();
    return !!r;
  };
  const out = [];
  let t = text();
  if (/Please answer the following questions/.test(t)) {
    out.push('cit=' + radioFor(/United States citizen/, 'Yes'));
    out.push('bi=' + radioFor(/background investigation/, 'Yes'));
    out.push('ref=' + radioFor(/employees inform/, 'No'));
    return out.join(' ') + ' | questions page: certs, Trailblazer, salary, currency still need the snapshot flow';
  }
  if (/Voluntary Self-ID\nNotice/.test(t)) {
    const d = [...document.querySelectorAll('input[type=checkbox]')].find((i) => /decline/i.test(i.closest('label,div')?.innerText || ''));
    if (d?.checked) return 'STOP: decline box checked';
    if (!/Man\/Male/.test(t) || !/Not Hispanic/.test(t) || !/\nAsian/.test(t)) return 'STOP: self-ID not prefilled: ' + t.slice(0, 300);
    await next(); t = text();
  }
  if (/Review your application/.test(t)) {
    const rev = t.slice(0, 1800);
    await next(); t = text();
    const c = [...document.querySelectorAll('input[type=checkbox]')].find((i) => /sign electronically/i.test(i.labels?.[0]?.innerText || i.closest('div')?.innerText || ''));
    if (c && !c.checked) { (c.labels?.[0] || c).click(); await sleep(1200); }
    return 'REVIEW:\n' + rev + '\nesign=' + c?.checked;
  }
  return 'unknown step: ' + t.slice(0, 400);
}
