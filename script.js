diff --git a/script.js b/script.js
index 91dd7ada733416cc5617f5f84e8ed1294bc84a21..91b815a85c45ed878983ee0e3bb10abfdef9ad35 100644
++ b/script.js
@@ -336,85 +336,112 @@ const FALLBACK_QUESTION_BANK = [
     ],
     tip: "Выступающий груз необходимо обозначить флажками или световозвращателями."
   }
 ];
 
 /* =======================
    Запуск
 ======================= */
 function initApp(){
   try {
     bindMenu();
     bindDelegation();
   } catch(err){
     console.error("Ошибка инициализации интерфейса:", err);
   }
   boot();
 }
 
 if (document.readyState === "loading") {
   document.addEventListener("DOMContentLoaded", initApp, { once: true });
 } else {
   setTimeout(initApp, 0);
 }
 
 async function boot(){
   showLoader(true);
  let hasQuestions = false;
   try {
    try {
      hydrateFallback({ reset: true });
    } catch(err){
      console.error("Ошибка подготовки демонстрационных билетов:", err);
    }

    const baseProgress = 5;
    setLoader(baseProgress);

    try {
      await loadTickets(progress => {
        if (typeof progress === "number" && !Number.isNaN(progress)) {
          const clamped = Math.max(0, Math.min(1, progress));
          setLoader(baseProgress + Math.round(clamped * 85));
        }
      });
    } catch(e) {
      console.error("Ошибка загрузки билетов:", e);
    } finally {
      if(!State.pool.length){
        try {
          hydrateFallback();
        } catch(err){
          console.error("Ошибка резервной загрузки билетов:", err);
        }
       }
      hasQuestions = State.pool.length > 0;
      setLoader(100);
      try {
        renderHome();
      } catch(err){
        console.error("Ошибка отображения главного экрана:", err);
      }
      try {
        updateStatsCounters();
      } catch(err){
        console.error("Ошибка обновления статистики:", err);
      }
      if(!hasQuestions) setTimeout(()=>notifyDataIssue(), 350);
     }
  } finally {
     setTimeout(()=>showLoader(false), 250);
   }
 }
 
 /* =======================
    Лоадер
 ======================= */
 function showLoader(v){
   const isVisible = !!v;
  const el = qs("#loader");
  if (el) el.classList.toggle("hidden", !isVisible);
  if (document.body) document.body.classList.toggle("is-loading", isVisible);
}
function setLoader(p){
  const bar = qs("#loaderBar");
  if (!bar) return;
  bar.style.width = Math.max(0,Math.min(100,p))+"%";
 }
 
 /* =======================
    Навигация
 ======================= */
 function toggleSubpage(isSub){
   const appRoot = qs(".app");
   const isSubpage = !!isSub;
   appRoot?.classList.toggle("app--subpage", isSubpage);
   setActive(null);
   if (!isSubpage) return;
 
   const screen = document.querySelector("#screen");
   screen?.scrollIntoView({ block: "start", behavior: "smooth" });
 }
 
 function setView(html, { subpage = true, title = "" } = {}){
   toggleSubpage(subpage);
   const host = qs("#screen");
   if(!host) return;
   host.scrollTop = 0;
 
   if (subpage) {
     const content = wrapSubpage(title, html);
     host.classList.remove("screen--hidden");
     host.innerHTML = `<div class="view">${content}</div>`;
@@ -835,51 +862,51 @@ function extractTicketLabel(path){
 async function fetchJson(url){
   const response = await fetch(url, { cache:"no-store" });
   if(!response.ok) throw new Error(`HTTP ${response.status}`);
   return response.json();
 }
 
 function normalizeImagePath(path){
   const raw = (path ?? "").toString().trim();
   if(!raw) return "";
   const withoutDots = raw.replace(/^\.\//, "").replace(/^\/+/, "");
   if(/^https?:/i.test(raw)) return raw;
   if(/^https?:/i.test(withoutDots)) return withoutDots;
   if(!withoutDots) return "";
   if(withoutDots.startsWith("images/")) return withoutDots;
   return `images/${withoutDots}`;
 }
 
 /* =======================
    Экраны
 ======================= */
 function uiTopics(){
   const list=[...State.topics.keys()].sort((a,b)=>a.localeCompare(b,'ru'));
   if(!list.length){ setView(`<div class="card"><h3>Темы</h3><p>❌ Темы не найдены</p></div>`, { subpage: true, title: "Темы" }); return; }
   setView(`
     <div class="card"><h3>Темы</h3></div>
    <div class="card"><div class="grid auto">
       ${list.map(t=>`<button type="button" class="answer" data-t="${esc(t)}">${esc(t)}</button>`).join("")}
     </div></div>
   `, { subpage: true, title: "Темы" });
 }
 
 function uiTickets(){
   const tickets = [...State.byTicket.entries()].map(([key, meta]) => ({
     key,
     label: meta.label || key,
     order: Number.isFinite(meta.order) ? meta.order : Number.MAX_SAFE_INTEGER,
     questions: meta.questions
   })).sort((a,b)=> a.order - b.order || a.label.localeCompare(b.label,'ru'));
   if(!tickets.length){
     setView(`<div class="card"><h3>Билеты</h3><p>❌ Билеты не найдены</p></div>`, { subpage: true, title: "Билеты" });
     return;
   }
   setView(`
     <div class="card"><h3>Билеты</h3></div>
     <div class="card"><div class="grid auto">
       ${tickets.map(t=>`<button type="button" class="answer" data-ticket="${esc(t.key)}">${esc(t.label)}</button>`).join("")}
     </div></div>
   `, { subpage: true, title: "Билеты" });
 }
 
 async function uiMarkup(){
