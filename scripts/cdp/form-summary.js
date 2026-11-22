() => { const vis=e=>e.offsetParent!==null, lab=e=>(e.labels?.[0]?.innerText||e.getAttribute('aria-label')||e.placeholder||e.name||e.id||'').trim().slice(0,70);
  const req=[...document.querySelectorAll('input,select,textarea')].filter(e=>vis(e)&&e.type!=='hidden'&&(e.required||e.getAttribute('aria-required')==='true'));
  const empty=req.filter(e=>/checkbox|radio/.test(e.type)?!document.querySelector(`[name="${CSS.escape(e.name)}"]:checked`):!e.value);
  return { url: location.href.slice(0,150), title: document.title.slice(0,80),
    emptyRequired: [...new Set(empty.map(lab))].slice(0,30),
    panel: document.querySelector('[data-brightstar-autofill-panel]')?.innerText.slice(0,800),
    captcha: !!document.querySelector('iframe[src*="recaptcha"],iframe[src*="hcaptcha"],#turnstile-container,.cf-turnstile'),
    buttons: [...document.querySelectorAll('button,input[type=submit],a[role=button]')].filter(vis).map(b=>(b.innerText||b.value||'').trim()).filter(Boolean).slice(0,15) }; }
