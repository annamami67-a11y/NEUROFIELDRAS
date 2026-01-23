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


/* =========================
   NF_AUTH_V10 (demo cabinet)
   ========================= */
(function(){
  const STORAGE = {
    session: 'nf_session',
    profile: 'nf_profile',
    child: 'nf_child',
    tests: 'nf_tests',
    orders: 'nf_orders'
  };

  function getJSON(k, fallback){
    try{ return JSON.parse(localStorage.getItem(k) || '') }catch(e){ return fallback; }
  }
  function setJSON(k, v){ localStorage.setItem(k, JSON.stringify(v)); }

  function session(){ return getJSON(STORAGE.session, null); }
  function isAuthed(){ return !!session(); }

  function openModal(){
    const m=document.getElementById('authModal');
    if(!m) return;
    m.classList.add('is-open');
    m.setAttribute('aria-hidden','false');
  }
  function closeModal(){
    const m=document.getElementById('authModal');
    if(!m) return;
    m.classList.remove('is-open');
    m.setAttribute('aria-hidden','true');
  }

  function bindModal(){
    const m=document.getElementById('authModal');
    if(!m) return;
    m.addEventListener('click', (e)=>{
      if(e.target.matches('[data-auth-close]')) closeModal();
    });
    document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeModal(); });

    const tabs = Array.from(m.querySelectorAll('[data-auth-tab]'));
    const panels = Array.from(m.querySelectorAll('[data-auth-panel]'));
    tabs.forEach(btn=>{
      btn.addEventListener('click', ()=>{
        tabs.forEach(x=>x.classList.remove('is-active'));
        btn.classList.add('is-active');
        const key=btn.getAttribute('data-auth-tab');
        panels.forEach(p=>{
          p.classList.toggle('is-active', p.getAttribute('data-auth-panel')===key);
        });
      });
    });

    const sendBtn=document.getElementById('authSend');
    const loginBtn=document.getElementById('authLogin');
    const codeInput=document.getElementById('authCode');

    sendBtn && sendBtn.addEventListener('click', ()=>{
      window.NFToast && window.NFToast('Код отправлен', 'Демо‑код: 1234');
      codeInput && codeInput.focus();
    });

    loginBtn && loginBtn.addEventListener('click', ()=>{
      const code=(codeInput?.value||'').trim();
      if(code !== '1234'){
        window.NFToast && window.NFToast('Неверный код','Проверьте код и попробуйте снова');
        return;
      }
      const email=(document.getElementById('authEmail')?.value||'').trim();
      const phone=(document.getElementById('authPhone')?.value||'').trim();
      if(!email && !phone){
        window.NFToast && window.NFToast('Нужны данные','Введите email или телефон');
        return;
      }
      const s = { id: 'u_'+Date.now(), email: email||null, phone: phone||null, created_at: new Date().toISOString() };
      setJSON(STORAGE.session, s);

      const prof = getJSON(STORAGE.profile, null);
      if(!prof){
        setJSON(STORAGE.profile, { first_name:'', last_name:'', email: email||'', phone: phone||'' });
      }
      closeModal();
      window.NFToast && window.NFToast('Готово','Вы вошли. Открою кабинет.');
      setTimeout(()=>{ location.href='/cabinet.html'; }, 350);
    });

    m.querySelectorAll('[data-auth-soon]').forEach(a=>{
      a.addEventListener('click', (e)=>{
        e.preventDefault();
        window.NFToast && window.NFToast('Скоро','Добавим реальную авторизацию через VK ID и MAX на backend‑этапе');
      });
    });
  }

  function bindAuthButtons(){
    document.querySelectorAll('[data-auth-open]').forEach(a=>{
      a.addEventListener('click', (e)=>{
        e.preventDefault();
        openModal();
      });
    });
  }

  function renderCabinet(){
    if(!document.body || document.body.getAttribute('data-path') !== '/cabinet.html') return;

    const s=session();
    const profileBox=document.getElementById('profileBox');
    const childBox=document.getElementById('childBox');
    const testsBox=document.getElementById('testsBox');
    const ordersBox=document.getElementById('ordersBox');

    if(!s){
      profileBox.innerHTML = 'Похоже, вы не вошли. <a href="#login" data-auth-open>Открыть вход</a>.';
      bindAuthButtons();
      return;
    }

    const prof=getJSON(STORAGE.profile, {first_name:'',last_name:'',email:'',phone:''});
    const child=getJSON(STORAGE.child, {name:'',age:''});
    const tests=getJSON(STORAGE.tests, []);
    const orders=getJSON(STORAGE.orders, []);

    profileBox.innerHTML = `
      <div><b>${(prof.first_name||'')+' '+(prof.last_name||'')}</b></div>
      <div class="muted">${prof.email?('Email: '+prof.email):''}${prof.phone?(' • Тел: '+prof.phone):''}</div>
    `;

    childBox.innerHTML = (child.name || child.age)
      ? `<div><b>${child.name||'Ребёнок'}</b></div><div class="muted">Возраст: ${child.age||'—'}</div>`
      : `<div class="muted">Добавьте данные ребёнка — чтобы результаты тестов были в одном месте.</div>`;

    if(!tests.length){
      testsBox.innerHTML = '<div class="muted">Пока нет результатов. Пройдите тест — и результат появится здесь.</div>';
    } else {
      const rows = tests.slice().reverse().map(t=>{
        return `<tr>
          <td>${new Date(t.date).toLocaleDateString('ru-RU')}</td>
          <td>Сенс: ${t.sensory} • Вним: ${t.attention} • Комм: ${t.communication} • Гибк: ${t.flex} • Соц: ${t.social}</td>
          <td><b>Зона риска: ${t.risk}</b></td>
        </tr>`;
      }).join('');
      testsBox.innerHTML = `<table class="table">
        <thead><tr><th>Дата</th><th>Профиль</th><th>Рекомендация</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    }

    const praiseBox=document.getElementById('praiseBox');
    const praiseText=document.getElementById('praiseText');
    const last = tests.length ? tests[tests.length-1] : null;
    if(last){
      const avg = (last.sensory+last.attention+last.communication+last.flex+last.social)/5;
      let msg = '';
      if(avg >= 6){
        msg = 'Поздравляю! У вас отличные результаты! Продолжайте дальше в том же ритме!';
      } else if(avg >= 5){
        msg = 'Вы на хорошем пути. Сохраняйте предсказуемость и паузы — это укрепляет устойчивость.';
      } else {
        msg = 'Сейчас важнее всего снизить перегруз и сделать среду предсказуемой. Маленькие шаги — это уже прогресс.';
      }
      praiseBox.hidden = false;
      praiseText.textContent = msg;
    }

    if(!orders.length){
      ordersBox.innerHTML = '<div class="muted">Покупок пока нет. После оплаты материалы появятся здесь.</div>';
    } else {
      ordersBox.innerHTML = orders.slice().reverse().map(o=>{
        const files=(o.files||[]).map(f=>`
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">
            <a class="btn btn-primary" href="${f.url}" download>Скачать</a>
            <button class="btn" type="button" data-print="${f.url}">Печать</button>
          </div>
        `).join('');
        return `<div style="padding:10px 0;border-bottom:1px solid rgba(242,239,230,.10)">
          <div><b>${o.title}</b> <span class="muted">• ${new Date(o.date).toLocaleDateString('ru-RU')}</span></div>
          <div class="muted small">${o.note||''}</div>
          ${files}
        </div>`;
      }).join('');

      ordersBox.querySelectorAll('[data-print]').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const url=btn.getAttribute('data-print');
          const w=window.open(url, '_blank');
          if(!w) return;
          w.addEventListener('load', ()=>{ try{ w.print(); }catch(e){} });
        });
      });
    }

    document.getElementById('logout')?.addEventListener('click', ()=>{
      localStorage.removeItem(STORAGE.session);
      location.reload();
    });

    document.getElementById('editProfile')?.addEventListener('click', ()=>{
      const first=prompt('Имя', prof.first_name||'') ?? prof.first_name;
      const last=prompt('Фамилия', prof.last_name||'') ?? prof.last_name;
      const email=prompt('Email', prof.email||'') ?? prof.email;
      const phone=prompt('Телефон', prof.phone||'') ?? prof.phone;
      setJSON(STORAGE.profile, { first_name:first, last_name:last, email, phone });
      location.reload();
    });

    document.getElementById('addChild')?.addEventListener('click', ()=>{
      const name=prompt('Имя ребёнка', child.name||'') ?? child.name;
      const age=prompt('Возраст (число)', child.age||'') ?? child.age;
      setJSON(STORAGE.child, { name, age });
      location.reload();
    });
  }

  function hookTestSave(){
    if(!document.body || document.body.getAttribute('data-path') !== '/test.html') return;
    const btn=document.getElementById('calc');
    if(!btn) return;
    btn.addEventListener('click', ()=>{
      try{
        const s1=Number(document.getElementById('s1')?.value||1);
        const s2=Number(document.getElementById('s2')?.value||1);
        const s3=Number(document.getElementById('s3')?.value||1);
        const s4=Number(document.getElementById('s4')?.value||1);
        const s5=Number(document.getElementById('s5')?.value||1);
        const risk=Math.min(s1,s2,s3,s4,s5);
        const tests=getJSON(STORAGE.tests, []);
        tests.push({ date: new Date().toISOString(), sensory:s1, attention:s2, communication:s3, flex:s4, social:s5, risk });
        setJSON(STORAGE.tests, tests);
      }catch(e){}
    });
  }

  function hookPaymentSuccess(){
    if(!document.body || document.body.getAttribute('data-path') !== '/payment-success.html') return;
    setTimeout(()=>{ location.href='/cabinet.html'; }, 1200);
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    bindAuthButtons();
    bindModal();
    renderCabinet();
    hookTestSave();
    hookPaymentSuccess();
  });

  window.NF_AUTH = { open: openModal, close: closeModal, isAuthed };
})();
