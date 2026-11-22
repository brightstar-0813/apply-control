async () => {
  const d = await chrome.storage.local.get(["job_queue","batch_state","batch_run_mode","allowSubmitOnAssist","job_channel_filter"]);
  const q = d.job_queue || [], by = {};
  for (const j of q) by[j.status] = (by[j.status]||0)+1;
  return { status: document.querySelector('#status')?.innerText.slice(0,200),
    now: document.querySelector('#queueNowWorking')?.innerText.slice(0,200),
    batch: d.batch_state?.state ?? d.batch_state, mode: d.batch_run_mode, submit: d.allowSubmitOnAssist,
    filter: d.job_channel_filter, by, applied: q.filter(j=>j.applied).length,
    attention: q.filter(j => j.status==="error" || (j.status==="done" && !j.applied && j.error && !/^Skipped/.test(j.error)))
      .map(j => `${j.csvRow} ${j.company}: ${String(j.error).slice(0,80)}`) };
}
