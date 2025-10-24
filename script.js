diff --git a/script.js b/script.js
index 345a485e3b9ed63b09ee3a9be209d83b8d26f864..b643d5ccb83aead4ea3fa4410a807eed3dd61dd5 100644
--- a/script.js
+++ b/script.js
@@ -11,85 +11,86 @@ const State = {
   duel: null,
   lock: false,
   lastTouchTs: 0,
 };
 
 /* =======================
    Запуск
 ======================= */
 document.addEventListener("DOMContentLoaded", () => {
   bindMenu();
   bindDelegation();
   boot();
 });
 
 async function boot(){
   showLoader(true);
   setLoader(5);
   try {
     await loadTickets(p => setLoader(5 + Math.floor(p * 85)));
   } catch(e) {
     console.error("Ошибка загрузки билетов:", e);
   }
   setLoader(100);
   setTimeout(()=>showLoader(false), 250);
   renderHome();
+  updateStatsCounters();
 }
 
 /* =======================
    Лоадер
 ======================= */
 function showLoader(v){ qs("#loader").classList.toggle("hidden", !v); }
 function setLoader(p){ qs("#loaderBar").style.width = Math.max(0,Math.min(100,p))+"%"; }
 
 /* =======================
    Навигация
 ======================= */
 function setView(html){
   const host = qs("#screen");
   host.scrollTop = 0;
   host.innerHTML = `<div class="view">${html}</div>`;
 }
 function renderHome(){
   setActive(null);
   setView(`
     <div class="card">
       <h3>Выбери режим сверху</h3>
       <p style="margin:.35rem 0 0;color:var(--muted)">⚡ Быстрая дуэль, 📚 Темы, 🎟️ Билеты</p>
     </div>
   `);
 }
 function setActive(id){
-  qsa(".menu .btn").forEach(b=>b.classList.remove("active"));
+  qsa("[data-action]").forEach(b=>b.classList.remove("active"));
   if(id) qs("#"+id)?.classList.add("active");
 }
 
 /* =======================
    Меню
 ======================= */
 function bindMenu(){
-  qsa(".menu [data-action]").forEach(btn=>{
+  qsa("[data-action]").forEach(btn=>{
     btn.addEventListener("click", e=>{
       const act = e.currentTarget.dataset.action;
       setActive(e.currentTarget.id);
       if (act==="quick")    startDuel({mode:"quick"});
       if (act==="topics")   uiTopics();
       if (act==="tickets")  uiTickets();
       if (act==="stats")    uiStats();
     }, { passive:true });
   });
 }
 
 /* =======================
    Делегация событий
 ======================= */
 function bindDelegation(){
   const screen = qs("#screen");
   screen.addEventListener("touchstart", handleTap, { passive:false });
   screen.addEventListener("click", e=>{
     if (Date.now() - State.lastTouchTs < 350) return;
     handleTap(e);
   }, { passive:false });
 }
 
 function handleTap(e){
   if (e.type === "touchstart") State.lastTouchTs = Date.now();
@@ -271,25 +272,35 @@ function onAnswer(i){
 }
 
 function finishDuel(){
   const d=State.duel;
   setView(`
     <div class="card">
       <h3>${d.me>=Math.ceil(d.q.length*0.6)?"🏆 Отлично!":"🏁 Завершено"}</h3>
       <p>Верных: <b>${d.me}</b> из ${d.q.length}</p>
       <div class="grid two" style="margin-top:10px">
         <button class="btn btn-primary" id="again">Ещё раз</button>
         <button class="btn" id="home">На главную</button>
       </div>
     </div>
   `);
 }
 
 /* =======================
    Утилиты
 ======================= */
 const qs=s=>document.querySelector(s);
 const qsa=s=>[...document.querySelectorAll(s)];
 function delay(ms){ return new Promise(r=>setTimeout(r,ms)); }
 function shuffle(a){return a.map(x=>[Math.random(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);}
 function toast(t){const el=qs("#toast");el.innerHTML=`<div class="toast">${t}</div>`;el.style.opacity=1;setTimeout(()=>el.style.opacity=0,1500);}
 function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));}
+function updateStatsCounters(){
+  setStat("statQuestions", State.pool.length);
+  setStat("statTopics", State.topics.size);
+  setStat("statTickets", State.byTicket.size);
+}
+function setStat(id, value){
+  const el = qs(`#${id}`);
+  if(!el) return;
+  el.textContent = value ? value.toLocaleString("ru-RU") : "0";
+}
