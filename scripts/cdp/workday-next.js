async () => {
  // Presses Workday's footer "Save and Continue" (or "Next") through its click_filter overlay; returns the new step + any errors.
  // Not read-only: use it only after checking the step with workday-step.js. Never use on the Review step (Submit is a separate decision).
  const b = [...document.querySelectorAll('button')].find(b => /^(Save and Continue|Next)$/.test(b.textContent.trim()));
  if (!b) return { error: 'no Save and Continue / Next button' };
  const before = document.querySelector('[data-automation-id=progressBarActiveStep]')?.textContent;
  const f = b.parentElement.querySelector('[data-automation-id=click_filter]') || b;
  for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) f.dispatchEvent(new MouseEvent(t, { bubbles: true }));
  await new Promise(r => setTimeout(r, 6000));
  const after = document.querySelector('[data-automation-id=progressBarActiveStep]')?.textContent;
  const err = [...document.querySelectorAll('[data-automation-id=errorMessage],[data-automation-id=inputAlert]')].map(e => e.textContent.trim().slice(0, 100));
  return { moved: before !== after, step: after?.replace(/\s+/g, ' ').slice(0, 50), err };
}
