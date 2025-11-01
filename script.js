 /* =======================
    Telegram + Глобальное состояние
 ======================= */
 const TG = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
try {
  if (TG && typeof TG.ready === "function") TG.ready();
  if (TG && typeof TG.expand === "function") TG.expand();
} catch(_) {}
 
 const State = {
   pool: [],
   byTicket: new Map(),
   topics: new Map(),
   duel: null,
   lock: false,
   lastTouchTs: 0,
   markup: null,
   penalties: null,
   tap: null,
   ignoreClickUntil: 0,
   advanceTimer: null,
   usedFallback: false,
 };
 
 let delegationBound = false;
 let menuBound = false;
 const scheduleFrame = typeof requestAnimationFrame === "function" ? requestAnimationFrame : (fn)=>setTimeout(fn, 16);
 
 const MANIFEST_URL = "questions/index.json";
 const MARKUP_URL = "markup/markup.json";
 const PENALTIES_URL = "penalties/penalties.json";
 const FALLBACK_MANIFEST = {
   tickets: [
@@ -336,137 +339,167 @@ const FALLBACK_QUESTION_BANK = [
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
  if (appRoot) appRoot.classList.toggle("app--subpage", isSubpage);
   setActive(null);
   if (!isSubpage) return;
 
   const screen = document.querySelector("#screen");
  if (screen) screen.scrollIntoView({ block: "start", behavior: "smooth" });
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
   } else {
     host.classList.add("screen--hidden");
     host.innerHTML = "";
   }
 }
 function renderHome(){
   clearAdvanceTimer();
   setActive(null);
   setView("", { subpage: false });
 }
 
 function wrapSubpage(title, html){
   const safe = esc((title || "ПДД ДУЭЛИ").trim());
   return `
     <header class="subpage-header">
       <button type="button" class="back-btn" data-back aria-label="Назад">
         <span class="back-btn__icon" aria-hidden="true"></span>
         <span class="back-btn__label">Назад</span>
       </button>
       <h2 class="subpage-title">${safe}</h2>
     </header>
     ${html}
   `;
 }
 function setActive(id){
   qsa("[data-action]").forEach(b=>b.classList.remove("active"));
  if(id){
    const el = qs("#"+id);
    if (el) el.classList.add("active");
  }
 }
 
 /* =======================
    Меню
 ======================= */
 function bindMenu(){
   if (menuBound) return;
   qsa("[data-action]").forEach(btn=>{
     btn.addEventListener("click", e=>{
       const act = e.currentTarget.dataset.action;
       setActive(e.currentTarget.id);
       if (act==="quick")    startDuel({mode:"quick"});
       if (act==="topics")   uiTopics();
       if (act==="tickets")  uiTickets();
       if (act==="markup")   uiMarkup();
       if (act==="penalties")uiPenalties();
       if (act==="stats")    uiStats();
     }, { passive:true });
   });
   menuBound = true;
 }
 
 /* =======================
    Делегация событий
 ======================= */
@@ -504,51 +537,60 @@ function handleTap(e){
   if (topic){ e.preventDefault(); startDuel({mode:"topic", topic: topic.dataset.t}); return; }
   const back = e.target.closest("[data-back]");
   if (back){ e.preventDefault(); renderHome(); return; }
   const dot = e.target.closest("[data-question]");
   if (dot){
     e.preventDefault();
     if (dot.disabled) return;
     goToQuestion(+dot.dataset.question);
     return;
   }
   if (e.target.closest("[data-prev]")){
     e.preventDefault();
     previousQuestion();
     return;
   }
   if (e.target.closest("[data-next]")){
     e.preventDefault();
     nextQuestion();
     return;
   }
   if (e.target.closest("[data-finish]")){
     e.preventDefault();
     finishDuel();
     return;
   }
  if (e.target.id === "again"){ 
    e.preventDefault();
    const currentDuel = State.duel;
    if (currentDuel && currentDuel.topic){
      startDuel({ mode: "topic", topic: currentDuel.topic });
    } else {
      startDuel({ mode: "quick" });
    }
    return;
  }
   if (e.target.id === "home"){ e.preventDefault(); renderHome(); return; }
 }
 
 function handlePointerDown(e){
   if (e.pointerType !== "touch") return;
   State.tap = {
     pointerId: e.pointerId,
     target: getActionTarget(e.target),
     startX: e.clientX,
     startY: e.clientY,
     moved: false,
   };
 }
 
 function handlePointerMove(e){
   const tap = State.tap;
   if (!tap || e.pointerId !== tap.pointerId) return;
   if (Math.abs(e.clientX - tap.startX) > 12 || Math.abs(e.clientY - tap.startY) > 12) {
     tap.moved = true;
   }
 }
 
 function handlePointerUp(e){
   if (e.pointerType !== "touch") return;
   const tap = State.tap;
@@ -579,52 +621,53 @@ function handlePointerCancel(){
 function handleClick(e){
   if (State.ignoreClickUntil && Date.now() < State.ignoreClickUntil) {
     return;
   }
   handleTap(e);
 }
 
 function getActionTarget(el){
   if (!el) return null;
   return el.closest("button.answer,[data-ticket],[data-t],[data-question],[data-prev],[data-next],[data-finish],#again,#home");
 }
 
 /* =======================
    Загрузка билетов
 ======================= */
 async function loadTickets(onProgress){
   onProgress && onProgress(0);
 
   let manifest = null;
   try {
     manifest = await fetchJson(MANIFEST_URL);
   } catch(err){
     console.warn("⚠️ Не удалось загрузить manifest, используем запасной список", err);
   }
 
  const manifestTickets = (manifest && Array.isArray(manifest.tickets)) ? manifest.tickets : [];
   const ticketFiles = uniqueStrings([
    ...manifestTickets,
     ...FALLBACK_MANIFEST.tickets
   ]);
   if(!ticketFiles.length){
     console.warn("⚠️ Нет списка билетов для загрузки");
     const fallback = hydrateFallback();
     onProgress && onProgress(1);
     return fallback;
   }
 
   const raw = [];
   let loaded = 0;
   let successes = 0;
   let failures = 0;
   const total = ticketFiles.length;
 
   for(const file of ticketFiles){
     const url = `questions/${encodePath(file)}`;
     try {
       const response = await fetch(url, { cache:"no-store" });
       if(!response.ok) throw new Error(`HTTP ${response.status}`);
 
       const payload = await response.json();
       const list = Array.isArray(payload) ? payload : (payload.questions || payload.list || payload.data || []);
       const ticketLabel = extractTicketLabel(file);
       for(const item of list){
@@ -698,99 +741,107 @@ async function loadPenalties(){
   const lines = text.split(/\n+/).map(line=>line.trim()).filter(Boolean);
   const items = [];
   for(const line of lines){
     try {
       const obj = JSON.parse(line);
       items.push({
         articlePart: obj.article_part || obj.articlePart || "—",
         text: obj.text || "",
         penalty: obj.penalty || ""
       });
     } catch(err){
       console.error("Не удалось разобрать штраф:", err, line);
     }
   }
   items.sort((a,b)=>a.articlePart.localeCompare(b.articlePart,'ru',{numeric:true,sensitivity:'base'}));
   State.penalties = items;
   return items;
 }
 
 /* =======================
    Нормализация данных
 ======================= */
 function normalizeQuestions(raw){
   const out=[];
   for(const q of raw){
    const answersRaw = Array.isArray(q.answers) ? q.answers : (Array.isArray(q.variants) ? q.variants : (Array.isArray(q.options) ? q.options : []));
    const answers = answersRaw.map(a => {
      if (a && typeof a === "object"){
        if (Object.prototype.hasOwnProperty.call(a, "answer_text") && a.answer_text != null) return a.answer_text;
        if (Object.prototype.hasOwnProperty.call(a, "text") && a.text != null) return a.text;
        if (Object.prototype.hasOwnProperty.call(a, "title") && a.title != null) return a.title;
      }
      return String(a != null ? a : "");
    });
 
    let correctIndex = answersRaw.findIndex(a => a && typeof a === "object" && a.is_correct === true);
     if (correctIndex < 0 && typeof q.correct_answer === "string"){
       const m = q.correct_answer.match(/\d+/);
       if (m) correctIndex = parseInt(m[0]) - 1;
     }
     if (correctIndex < 0) correctIndex = 0;
 
     const ticketLabel = deriveTicketLabel(q);
     const ticketNumber = deriveTicketNumber(ticketLabel);
     const ticketKey = ticketLabel || (ticketNumber ? `Билет ${ticketNumber}` : `ticket-${out.length}`);
 
     const image = normalizeImagePath(q.image);
 
     out.push({
       question: q.question || q.title || "Вопрос",
       answers,
       correctIndex,
       tip: q.answer_tip || q.tip || "",
       ticketNumber,
       ticketLabel,
       ticketKey,
       topics: Array.isArray(q.topic) ? q.topic : q.topic ? [q.topic] : [],
       image
     });
   }
   return out;
 }
 
 function resetQuestionState(){
   State.pool.length = 0;
   State.byTicket.clear();
   State.topics.clear();
 }
 
 function applyQuestions(norm, source = "remote"){
   resetQuestionState();
   ingestQuestions(norm);
   State.usedFallback = source === "fallback";
 }
 
 function ingestQuestions(norm){
   for(const q of norm){
     State.pool.push(q);
     const bucketKey = q.ticketKey;
     if (!State.byTicket.has(bucketKey)){
      const orderValue = Number.isFinite(q.ticketNumber) ? q.ticketNumber : Number.MAX_SAFE_INTEGER;
      State.byTicket.set(bucketKey, { label: q.ticketLabel, order: orderValue, questions: [] });
     }
     const bucket = State.byTicket.get(bucketKey);
     bucket.order = Math.min(bucket.order, Number.isFinite(q.ticketNumber) ? q.ticketNumber : Number.MAX_SAFE_INTEGER);
     bucket.questions.push(q);
 
     for(const t of q.topics){
       if (!State.topics.has(t)) State.topics.set(t, []);
       State.topics.get(t).push(q);
     }
   }
 }
 
 function deriveTicketLabel(q){
   if (typeof q.ticket_number === "string" && q.ticket_number.trim()) return q.ticket_number.trim();
   if (typeof q.ticket === "string" && q.ticket.trim()) return q.ticket.trim();
   if (typeof q.__bucket === "string" && q.__bucket.trim()) return q.__bucket.trim();
   if (typeof q.ticket === "number" && Number.isFinite(q.ticket)) return `Билет ${q.ticket}`;
   return "Билет";
 }
 
 function deriveTicketNumber(label){
   if (typeof label !== "string") return undefined;
   const match = label.match(/\d+/);
   if (!match) return undefined;
   const value = parseInt(match[0], 10);
@@ -817,69 +868,69 @@ function uniqueStrings(list){
     const normalized = item.trim();
     if(seen.has(normalized)) continue;
     seen.add(normalized);
     out.push(normalized);
   }
   return out;
 }
 
 function encodePath(path){
   return path.split("/").map(encodeURIComponent).join("/");
 }
 
 function extractTicketLabel(path){
   const fileName = path.split("/").pop() || "";
   const plain = fileName.replace(/\.json$/i, "");
   return plain.replace(/_/g, " ") || "Билет";
 }
 
 async function fetchJson(url){
   const response = await fetch(url, { cache:"no-store" });
   if(!response.ok) throw new Error(`HTTP ${response.status}`);
   return response.json();
 }
 
 function normalizeImagePath(path){
  const raw = path == null ? "" : path.toString().trim();
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
@@ -955,237 +1006,247 @@ function uiStats(){
 }
 
 /* =======================
    Викторина
 ======================= */
 function startDuel({mode,topic=null}){
   clearAdvanceTimer();
   const src = topic ? (State.topics.get(topic)||[]) : State.pool;
   if(!src.length){ setView(`<div class="card"><h3>Дуэль</h3><p>⚠️ Нет данных</p></div>`, { subpage: true, title: topic || "Дуэль" }); return; }
   const q = shuffle(src).slice(0,20);
   State.duel = {
     mode,
     topic,
     i:0,
     me:0,
     q,
     answers: Array(q.length).fill(null),
     furthest: 0,
     completed: false
   };
   renderQuestion(0);
 }
 function startTicket(key){
   clearAdvanceTimer();
   const bucket = State.byTicket.get(key);
  const arr = (bucket && Array.isArray(bucket.questions)) ? bucket.questions : [];
  const label = bucket && bucket.label ? bucket.label : key;
  if(!arr.length){ setView(`<div class="card"><h3>${esc(label)}</h3><p>⚠️ Нет вопросов</p></div>`, { subpage: true, title: label || "Билет" }); return; }
   const q = arr.length>20 ? shuffle(arr).slice(0,20) : arr.slice(0,20);
   State.duel = {
     mode:"ticket",
     topic:null,
     i:0,
     me:0,
     q,
    ticketLabel: label,
     answers: Array(q.length).fill(null),
     furthest: 0,
     completed: false
   };
   renderQuestion(0);
 }
 
 function renderQuestion(targetIndex){
   const d = State.duel;
   if(!d || !Array.isArray(d.q)) return;
   clearAdvanceTimer();
   if(typeof targetIndex !== "number") targetIndex = d.i;
   if(targetIndex >= d.q.length){
     finishDuel();
     return;
   }
   d.i = Math.max(0, Math.min(targetIndex, d.q.length - 1));
   const q = d.q[d.i];
  const duelTicketLabel = d.ticketLabel ? d.ticketLabel : null;
  const ticketInfo = q.ticketLabel || duelTicketLabel || (q.ticketNumber ? `Билет ${q.ticketNumber}` : "Билет");
  const headerTitle = d.mode === "topic" && d.topic ? d.topic : (d.mode === "ticket" ? (duelTicketLabel || ticketInfo) : "Дуэль");
   const answerState = d.answers[d.i];
   const isAnswered = !!(answerState && answerState.status);
  const tipVisible = !!(answerState && answerState.status === "wrong");
   const tracker = renderTracker();
   const controls = renderQuestionControls(isAnswered);
 
   setView(`
     ${tracker}
     <div class="card">
       <div class="meta">Вопрос ${d.i+1}/${d.q.length} • ${esc(ticketInfo)}</div>
       <h3>${esc(q.question)}</h3>
       ${q.image?`<img src="${q.image}" class="qimg" onerror="this.style.display='none'"/>`:""}
       <div class="grid">${q.answers.map((a,i)=>renderAnswerButton(a, i, q, answerState)).join("")}</div>
      <div id="tip" class="meta" style="${tipVisible ? "display:block" : "display:none"};margin-top:8px;color:#ccc">💡 ${esc(q.tip)}</div>
     </div>
     ${controls}
   `, { subpage: true, title: headerTitle });
   State.lock = false;
 }
 
 function onAnswer(i){
   if(State.lock) return;
   State.lock = true;
   const d = State.duel, q = d.q[d.i];
   const currentIndex = d.i;
   const correct = q.correctIndex;
   const prev = d.answers[d.i];
  if(prev && prev.status){
     State.lock = false;
     return;
   }
 
   const isCorrect = (i === correct);
   if(isCorrect) d.me++;
 
   d.answers[d.i] = { status: isCorrect ? "correct" : "wrong", selected: i };
   d.furthest = Math.min(d.q.length - 1, Math.max(d.furthest, d.i + 1));
 
   if(isCorrect){ toast("✅ Верно!"); }
   else { toast("❌ Ошибка"); }
 
   renderQuestion(d.i);
 
   if(isCorrect){
     State.advanceTimer = setTimeout(()=>{
      const currentAnswer = d.answers[currentIndex];
      const isCurrentCorrect = currentAnswer && currentAnswer.status === "correct";
      if(State.duel === d && d.i === currentIndex && isCurrentCorrect){
         nextQuestion();
       }
     }, 650);
   }
 }
 
 function finishDuel(){
   const d=State.duel;
   if(!d || d.completed) return;
   clearAdvanceTimer();
   d.completed = true;
   const headerTitle = d.mode === "ticket" ? (d.ticketLabel || "Билет") : (d.mode === "topic" && d.topic ? d.topic : "Дуэль");
   setView(`
     <div class="card">
       <h3>${d.me>=Math.ceil(d.q.length*0.6)?"🏆 Отлично!":"🏁 Завершено"}</h3>
       <p>Верных: <b>${d.me}</b> из ${d.q.length}</p>
       <div class="grid two" style="margin-top:10px">
         <button class="btn btn-primary" id="again">Ещё раз</button>
         <button class="btn" id="home">На главную</button>
       </div>
     </div>
   `, { subpage: true, title: headerTitle });
 }
 
 /* =======================
    Утилиты
 ======================= */
 const qs=s=>document.querySelector(s);
 const qsa=s=>[...document.querySelectorAll(s)];
 function delay(ms){ return new Promise(r=>setTimeout(r,ms)); }
 function shuffle(a){return a.map(x=>[Math.random(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);}
 function toast(t){const el=qs("#toast");el.innerHTML=`<div class="toast">${t}</div>`;el.style.opacity=1;setTimeout(()=>el.style.opacity=0,1500);}
function esc(s){
  const base = s == null ? "" : s;
  return String(base).replace(/[&<>\"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
}
 function updateStatsCounters(){
   setStat("statQuestions", State.pool.length);
   setStat("statTopics", State.topics.size);
   setStat("statTickets", State.byTicket.size);
 }
 function setStat(id, value){
   const el = qs(`#${id}`);
   if(!el) return;
   el.textContent = value ? value.toLocaleString("ru-RU") : "0";
 }
 function formatNumber(value){
   return Number.isFinite(value) ? value.toLocaleString("ru-RU") : "0";
 }
 
 function clearAdvanceTimer(){
   if(State.advanceTimer){
     clearTimeout(State.advanceTimer);
     State.advanceTimer = null;
   }
 }
 
 function notifyDataIssue(){
   if (State.pool.length) return;
   toast("⚠️ Не удалось загрузить билеты. Проверьте соединение и обновите страницу.");
 }
 
 function renderTracker(){
   const d = State.duel;
   if(!d) return "";
   return `
     <nav class="question-tracker" aria-label="Прогресс вопросов">
       ${d.q.map((_, idx)=>{
         const info = d.answers[idx];
        const status = info && info.status;
         const classes = ["tracker-dot"];
         if(idx === d.i) classes.push("is-current");
         if(status === "correct") classes.push("is-correct");
         if(status === "wrong") classes.push("is-wrong");
         const disabled = idx > d.furthest ? "disabled" : "";
         return `<button type="button" class="${classes.join(" ")}" data-question="${idx}" ${disabled}><span>${idx+1}</span></button>`;
       }).join("")}
     </nav>
   `;
 }
 
 function renderAnswerButton(text, index, question, answerState){
   const classes = ["answer"];
   let disabled = "";
  if(answerState && answerState.status){
     disabled = "disabled";
     if(index === question.correctIndex) classes.push("correct");
     if(answerState.status === "wrong" && index === answerState.selected) classes.push("wrong");
   }
   return `<button class="${classes.join(" ")}" data-i="${index}" ${disabled}>${esc(text)}</button>`;
 }
 
 function renderQuestionControls(isAnswered){
   const d = State.duel;
   if(!d) return "";
   const atStart = d.i === 0;
   const atEnd = d.i === d.q.length - 1;
   const nextLabel = atEnd ? "Завершить" : "Следующий";
   const nextAttr = atEnd ? "data-finish" : "data-next";
   const prevBtn = `<button class="btn ghost nav-btn" data-prev ${atStart?"disabled":""}>⬅️ Назад</button>`;
   const nextBtn = `<button class="btn btn-primary nav-btn" ${nextAttr} ${isAnswered?"":"disabled"}>${nextLabel} ➡️</button>`;
   return `
     <div class="question-controls">
       ${prevBtn}
       ${nextBtn}
     </div>
   `;
 }
 
 function goToQuestion(index){
   const d = State.duel;
   if(!d) return;
   clearAdvanceTimer();
   const target = Math.max(0, Math.min(index, d.q.length - 1));
   if(target > d.furthest) return;
   renderQuestion(target);
 }
 
 function nextQuestion(){
   const d = State.duel;
   if(!d) return;
   clearAdvanceTimer();
   if(d.i >= d.q.length - 1){
    const current = d.answers[d.i];
    if(current && current.status){
       finishDuel();
     }
     return;
   }
  const activeAnswer = d.answers[d.i];
  if(!(activeAnswer && activeAnswer.status)) return;
   d.furthest = Math.min(d.q.length - 1, Math.max(d.furthest, d.i + 1));
   renderQuestion(d.i + 1);
 }
 
 function previousQuestion(){
   const d = State.duel;
   if(!d) return;
   clearAdvanceTimer();
   if(d.i <= 0) return;
   renderQuestion(d.i - 1);
 }
