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