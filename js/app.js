(function(){
  const path=(document.body.getAttribute("data-path")||"").replace(/\/+$/,"");
  document.querySelectorAll(".nav a").forEach(a=>{
    const href=(a.getAttribute("href")||"").replace(/\/+$/,"");
    if(href===path) a.classList.add("active");
  });
  window.NFToast=function(t,m){
    let el=document.getElementById("nf_toast");
    if(!el){
      el=document.createElement("div");
      el.id="nf_toast";
      el.className="notice";
      el.style.position="fixed"; el.style.left="18px"; el.style.right="18px"; el.style.bottom="18px";
      el.style.zIndex="999"; el.style.maxWidth="720px"; el.style.margin="0 auto"; el.style.display="none";
      document.body.appendChild(el);
    }
    el.innerHTML="<b>"+(t||"")+"</b><div class='small' style='margin-top:4px'>"+(m||"")+"</div>";
    el.style.display="block";
    clearTimeout(window.__t); window.__t=setTimeout(()=>el.style.display="none",2400);
  }
})();

/* MOBILE BURGER NAV v8 */
(function(){
  const burger = document.querySelector('[data-burger]');
  const drawer = document.querySelector('[data-drawer]');
  if(!burger || !drawer) return;
  const closeBtn = drawer.querySelector('[data-drawer-close]');
  const backdrop = drawer.querySelector('[data-drawer-backdrop]');
  function open(){
    drawer.classList.add('is-open');
    document.documentElement.style.overflow='hidden';
    burger.setAttribute('aria-expanded','true');
  }
  function close(){
    drawer.classList.remove('is-open');
    document.documentElement.style.overflow='';
    burger.setAttribute('aria-expanded','false');
  }
  burger.addEventListener('click', ()=> drawer.classList.contains('is-open') ? close() : open());
  closeBtn && closeBtn.addEventListener('click', close);
  backdrop && backdrop.addEventListener('click', close);
  drawer.addEventListener('click', (e)=>{
    const a=e.target.closest('a'); if(a) close();
  });
  document.addEventListener('keydown', (e)=>{
    if(e.key==='Escape') close();
  });
})();
