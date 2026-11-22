() => { const t=document.body.innerText; const m=t.match(/.{0,80}(thank you|application (was )?(received|submitted|sent)|we have received|successfully submitted).{0,80}/i);
  return { url: location.href.slice(0,150), confirmed: !!m, text: m?.[0] }; }
