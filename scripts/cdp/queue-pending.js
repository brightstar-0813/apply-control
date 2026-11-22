async () => (await chrome.storage.local.get("job_queue")).job_queue
  .filter(j => j.status==="pending").slice(0,15)
  .map(j => `${j.csvRow} | ${j.company} | ${String(j.title).slice(0,50)} | ${new URL(j.jdLink).host}`)
