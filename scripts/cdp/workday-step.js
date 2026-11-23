async () => {
  // Read-only summary of the current Workday wizard step: step label, each form field (* = required) and its value, errors.
  await new Promise(r => setTimeout(r, 2500));
  const out = [];
  for (const el of document.querySelectorAll('[data-automation-id^="formField-"]')) {
    const labEl = el.querySelector('label,legend');
    const lab = labEl?.textContent.trim().replace(/\s+/g, ' ').slice(0, 60);
    const req = /\*/.test(labEl?.textContent || '');
    const inp = el.querySelector('input:not([type=hidden]),textarea');
    const btn = el.querySelector('button[aria-haspopup]');
    const chips = [...el.querySelectorAll('[data-automation-id=selectedItem]')].map(c => c.textContent.trim()).join(';');
    let val;
    if (inp && /radio|checkbox/.test(inp.type)) val = [...el.querySelectorAll('input')].filter(i => i.checked).map(i => (i.labels?.[0]?.textContent || i.closest('div')?.textContent || 'on').trim().slice(0, 25)).join(',');
    else if (inp?.type === 'file') val = [...el.querySelectorAll('[data-automation-id=file-upload-item-name]')].map(f => f.textContent.trim()).join(';');
    else if (btn) val = btn.textContent.trim();
    else val = inp?.value;
    out.push(`${req ? '*' : ''}${lab} = ${String(chips || val || '').slice(0, 50)}`);
  }
  const files = [...document.querySelectorAll('[data-automation-id=file-upload-item-name]')].map(f => f.textContent.trim());
  const err = [...document.querySelectorAll('[data-automation-id=errorMessage],[data-automation-id=inputAlert]')].map(e => e.textContent.trim().slice(0, 100));
  return {
    url: location.href.slice(-70),
    step: document.querySelector('[data-automation-id=progressBarActiveStep]')?.textContent.replace(/\s+/g, ' ').slice(0, 50),
    fields: out, files, err
  };
}
