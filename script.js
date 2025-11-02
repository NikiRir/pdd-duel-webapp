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
  tickets: []
};

const FALLBACK_QUESTION_BANK = [
  {
    question: "Пример вопроса ПДД",
    answers: [
      { text: "Правильный ответ", is_correct: true },
      { text: "Неправильный ответ 1", is_correct: false },
      { text: "Неправильный ответ 2", is_correct: false }
    ],
    tip: "Это демонстрационный вопрос"
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

// Улучшенная логика запуска
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp, { once: true });
} else {
  // DOM уже готов
  if (document.body) {
    setTimeout(initApp, 0);
  } else {
    // Ждем body
    const checkBody = setInterval(() => {
      if (document.body) {
        clearInterval(checkBody);
        initApp();
      }
    }, 10);
    // На всякий случай запускаем через 100мс
    setTimeout(() => {
      clearInterval(checkBody);
      if (document.body) initApp();
    }, 100);
  }
}
 
async function boot(){
  console.log("🚀 boot() запущен");
  
  // Принудительно показываем лоадер
  try {
    const loaderEl = document.querySelector("#loader");
    if (loaderEl) {
      loaderEl.classList.remove("hidden");
      loaderEl.style.display = "";
      loaderEl.style.visibility = "visible";
      loaderEl.style.opacity = "1";
    }
    if (document.body) {
      document.body.classList.add("is-loading");
    }
  } catch(e) {
    console.error("Ошибка при показе лоадера:", e);
  }
  
  let hasQuestions = false;
  const maxLoadTime = 8000; // 8 секунд максимум на загрузку
  
  // Сразу загружаем fallback данные для быстрого отклика
  try {
    console.log("📦 Загружаем fallback данные немедленно...");
    hydrateFallback({ reset: true });
    hasQuestions = State.pool.length > 0;
    console.log("✓ Fallback данные загружены, вопросов:", State.pool.length);
    // Если fallback загружен, сразу рендерим интерфейс
    if (hasQuestions) {
      try {
        renderHome();
        updateStatsCounters();
      } catch(e) {
        console.error("Ошибка рендеринга:", e);
      }
    }
  } catch(err) {
    console.error("Ошибка загрузки fallback данных:", err);
  }
  
  let loadTimeoutId = setTimeout(() => {
    console.warn("⏱️ Таймаут загрузки сработал (8 секунд)");
    if(!State.pool.length){
      try {
        console.log("📦 Применяем fallback по таймауту...");
        hydrateFallback();
        hasQuestions = State.pool.length > 0;
      } catch(err){
        console.error("Ошибка резервной загрузки билетов:", err);
      }
    }
    hasQuestions = State.pool.length > 0;
    try {
      setLoader(100);
      renderHome();
      updateStatsCounters();
    } catch(err){
      console.error("Ошибка при завершении:", err);
    }
    // Принудительно скрываем лоадер
    setTimeout(() => {
      hideLoaderForced();
      if(!hasQuestions){
        notifyDataIssue();
      }
    }, 100);
  }, maxLoadTime);

  try {
    const baseProgress = 5;
    setLoader(baseProgress);

    try {
      console.log("📥 Начинаем загрузку билетов...");
      await loadTickets(progress => {
        if (typeof progress === "number" && !Number.isNaN(progress)) {
          const clamped = Math.max(0, Math.min(1, progress));
          setLoader(baseProgress + Math.round(clamped * 85));
        }
      });
      console.log("✓ Билеты загружены, вопросов:", State.pool.length);
      hasQuestions = State.pool.length > 0;
    } catch(e) {
      console.error("Ошибка загрузки билетов:", e);
      hasQuestions = State.pool.length > 0;
    }
  } catch(e) {
    console.error("Критическая ошибка в boot():", e);
  } finally {
    if (loadTimeoutId) clearTimeout(loadTimeoutId);
    // Гарантируем, что данные есть перед скрытием лоадера
    if (!State.pool.length) {
      try {
        console.log("📦 Применяем fallback данные в finally...");
        hydrateFallback();
        console.log("✓ Fallback применен, вопросов:", State.pool.length);
      } catch(err) {
        console.error("Ошибка применения fallback в finally:", err);
      }
    }
    hasQuestions = State.pool.length > 0;
    setLoader(100);
    // Рендерим интерфейс
    try {
      renderHome();
      updateStatsCounters();
    } catch(err) {
      console.error("Ошибка при рендеринге:", err);
    }
    if(!hasQuestions) {
      setTimeout(()=>notifyDataIssue(), 350);
    }
    // Принудительно скрываем лоадер
    setTimeout(()=>{
      console.log("👋 Скрываем лоадер...");
      hideLoaderForced();
    }, 100);
  }
}
 
 /* =======================
    Лоадер
 ======================= */
function hideLoaderForced(){
  try {
    const loaderEl = document.querySelector("#loader");
    if (loaderEl) {
      loaderEl.classList.add("hidden");
      loaderEl.style.display = "none";
      loaderEl.style.visibility = "hidden";
      loaderEl.style.opacity = "0";
    }
    if (document.body) {
      document.body.classList.remove("is-loading");
    }
    console.log("✓ Лоадер скрыт принудительно");
  } catch(e) {
    console.error("Ошибка при скрытии лоадера:", e);
  }
}

function showLoader(v){
  const isVisible = !!v;
 const el = document.querySelector("#loader");
 if (el) {
   el.classList.toggle("hidden", !isVisible);
   if (!isVisible) {
     el.style.display = "none";
   } else {
     el.style.display = "";
   }
 }
 if (document.body) {
   document.body.classList.toggle("is-loading", isVisible);
   if (!isVisible) {
     document.body.classList.remove("is-loading");
   }
 }
 if (!isVisible) {
   hideLoaderForced();
 }
}
function setLoader(p){
  const bar = document.querySelector("#loaderBar");
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
function bindDelegation(){
  if (delegationBound) return;
  document.addEventListener("click", handleClick, { passive: false });
  document.addEventListener("pointerdown", handlePointerDown, { passive: true });
  document.addEventListener("pointermove", handlePointerMove, { passive: true });
  document.addEventListener("pointerup", handlePointerUp, { passive: true });
  document.addEventListener("pointercancel", handlePointerCancel, { passive: true });
  delegationBound = true;
}

function handleTap(e){
  const topic = e.target.closest("[data-t]");
  if (topic){ e.preventDefault(); startDuel({mode:"topic", topic: topic.dataset.t}); return; }
  const ticket = e.target.closest("[data-ticket]");
  if (ticket){ e.preventDefault(); startTicket(ticket.dataset.ticket); return; }
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
  const answer = e.target.closest("button.answer[data-i]");
  if (answer){
    e.preventDefault();
    const index = parseInt(answer.dataset.i);
    if (!isNaN(index)){
      onAnswer(index);
    }
    return;
  }
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
  if (!tap || e.pointerId !== tap.pointerId) return;
  if (!tap.moved && tap.target) {
    handleTap({ target: tap.target, preventDefault: ()=>{}, currentTarget: tap.target });
  }
  State.tap = null;
}

function handlePointerCancel(){
  State.tap = null;
}

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
  const maxFailures = Math.ceil(total * 0.7); // Если больше 70% файлов не загрузилось, прекращаем

 for(const file of ticketFiles){
   if(failures > maxFailures && raw.length === 0){
     console.warn("⚠️ Слишком много ошибок загрузки, переключаемся на fallback");
     break;
   }
   
   const url = `questions/${encodePath(file)}`;
   try {
     const response = await fetchWithTimeout(url, { cache:"no-store" }, 3000); // Уменьшил таймаут до 3 секунд
     if(!response.ok) throw new Error(`HTTP ${response.status}`);

      const payload = await response.json();
      const list = Array.isArray(payload) ? payload : (payload.questions || payload.list || payload.data || []);
      const ticketLabel = extractTicketLabel(file);
      for(const item of list){
       raw.push({ ...item, __ticketLabel: ticketLabel });
      }
      successes++;
      loaded++;
      if (onProgress && total > 0) {
        onProgress(loaded / total);
      }
   } catch(err) {
     console.warn("Не удалось загрузить " + file + ":", err);
     failures++;
     loaded++;
     if (onProgress && total > 0) {
       onProgress(loaded / total);
     }
   }
 }

 if (raw.length > 0) {
   const normalized = normalizeQuestions(raw);
   applyQuestions(normalized, "remote");
 } else {
   // Если ничего не загрузилось, используем fallback
   console.log("📦 Ничего не загружено, применяем fallback данные");
   try {
     hydrateFallback();
   } catch(err) {
     console.error("Ошибка применения fallback данных:", err);
   }
 }

 if (onProgress) {
   onProgress(1);
 }
}

async function loadPenalties(){
  let text = "";
  try {
    const response = await fetchWithTimeout(PENALTIES_URL, { cache:"no-store" }, 10000);
    if(response.ok) {
      text = await response.text();
    }
  } catch(err) {
    console.warn("Не удалось загрузить штрафы:", err);
  }
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

function hydrateFallback(options = {}){
  if (options.reset) {
    resetQuestionState();
  }
  
  if (!FALLBACK_QUESTION_BANK || !Array.isArray(FALLBACK_QUESTION_BANK) || FALLBACK_QUESTION_BANK.length === 0) {
    console.warn("FALLBACK_QUESTION_BANK не определен или пуст");
    return;
  }
  
  const normalized = normalizeQuestions(FALLBACK_QUESTION_BANK);
  applyQuestions(normalized, "fallback");
  return normalized;
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
   return Number.isFinite(value) ? value : undefined;
 }
 
 function uniqueStrings(items){
   const seen = new Set();
   const out = [];
   for(const item of items){
     if (typeof item !== "string") continue;
     const normalized = item.trim();
     if(!normalized || seen.has(normalized)) continue;
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
 
async function fetchWithTimeout(url, options = {}, timeoutMs = 10000){
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch(err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Request timeout: ${url}`);
    }
    throw err;
  }
}

async function fetchJson(url){
  const response = await fetchWithTimeout(url, { cache:"no-store" }, 3000); // Уменьшил таймаут до 3 секунд
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
