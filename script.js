 /* =======================
    Telegram + Глобальное состояние
 ======================= */
 // Сразу убираем загрузчик, если он есть
if (document.body) {
  document.body.classList.remove("is-loading");
  const loader = document.getElementById("loader");
  if (loader) loader.remove();
}

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
   penaltiesLoading: false,
   markupLoading: false,
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
    Лоадер
======================= */
function showLoader(text = "Загрузка...", subtext = "") {
  const overlay = qs("#loader-overlay");
  const loaderText = qs(".loader-text");
  const loaderSubtext = qs(".loader-subtext");
  if(overlay && loaderText) {
    loaderText.textContent = text;
    if(loaderSubtext) loaderSubtext.textContent = subtext;
    overlay.classList.add("active");
  }
}

function hideLoader() {
  const overlay = qs("#loader-overlay");
  if(overlay) {
    overlay.classList.remove("active");
    setTimeout(() => {
      const progress = qs("#loader-progress");
      if(progress) progress.style.width = "0%";
    }, 300);
  }
}

function updateLoaderProgress(percent, subtext = "") {
  const progress = qs("#loader-progress");
  const loaderSubtext = qs(".loader-subtext");
  if(progress) progress.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  if(loaderSubtext && subtext) loaderSubtext.textContent = subtext;
}

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
  
  // Предзагружаем штрафы и разметку параллельно в фоне
  Promise.all([
    loadPenalties().catch(() => {}),
    loadMarkup().catch(() => {})
  ]).catch(() => {});
  
  showLoader("Загрузка билетов...", "Подготовка данных");
  
  // Добавляем общий таймаут для boot (максимум 35 секунд)
  const bootTimeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Таймаут загрузки приложения")), 35000);
  });

  const bootTask = async () => {
    let hasQuestions = false;
    
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

    // Загружаем билеты с таймаутом (максимум 20 секунд)
    try {
      const loadTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Таймаут загрузки билетов")), 20000);
      });

      try {
        console.log("📥 Начинаем загрузку билетов...");
        updateLoaderProgress(20, "Загрузка списка билетов...");
        await Promise.race([loadTickets(), loadTimeout]);
        updateLoaderProgress(90, "Обработка данных...");
        console.log("✓ Билеты загружены, вопросов:", State.pool.length);
        hasQuestions = State.pool.length > 0;
      } catch(e) {
        console.error("Ошибка загрузки билетов:", e);
        hasQuestions = State.pool.length > 0;
      }
    } catch(e) {
      console.error("Критическая ошибка в boot():", e);
    }

    // Гарантируем, что данные есть
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
  };

  try {
    await Promise.race([bootTask(), bootTimeout]);
  } catch(err) {
    console.error("⚠️ Критическая ошибка или таймаут в boot():", err);
    // В случае критической ошибки гарантируем, что есть хотя бы fallback данные
    if (!State.pool.length) {
      try {
        hydrateFallback();
        renderHome();
        updateStatsCounters();
      } catch(finalErr) {
        console.error("Критическая ошибка применения fallback:", finalErr);
      }
    }
  } finally {
    updateLoaderProgress(100, "Готово!");
    setTimeout(() => {
      hideLoader();
    }, 500);
    console.log("✅ boot() завершен");
  }
}
 
 
 /* =======================
    Навигация
 ======================= */
 function toggleSubpage(isSub){
   const appRoot = qs(".app");
   const isSubpage = !!isSub;
  if (appRoot) appRoot.classList.toggle("app--subpage", isSubpage);
   setActive(null);
   // Убрали scrollIntoView - теперь контент показывается как полноэкранная страница
 }
 
 function setView(html, { subpage = true, title = "" } = {}){
   toggleSubpage(subpage);
   const host = qs("#screen");
   if(!host) {
     console.error("Элемент #screen не найден");
     return;
   }
   
   if (subpage) {
     const header = `<header class="subpage-header">
       <button type="button" class="back-btn" data-back aria-label="Назад">
         <span class="back-btn__icon" aria-hidden="true"></span>
         <span class="back-btn__label">Назад</span>
       </button>
       <h2 class="subpage-title">${esc((title || "ПДД ДУЭЛИ").trim())}</h2>
     </header>`;
     
     const fullContent = `<div class="view">${header}${html || ""}</div>`;
     
     host.innerHTML = fullContent;
     host.style.display = "block";
     host.style.visibility = "visible";
     host.style.opacity = "1";
     host.style.position = "fixed";
     host.style.top = "0";
     host.style.left = "0";
     host.style.right = "0";
     host.style.bottom = "0";
     host.style.zIndex = "1001";
     host.style.backgroundColor = "#ffffff";
     host.style.overflowY = "auto";
     host.style.padding = "20px";
     host.className = "screen";
     host.scrollTop = 0;
   } else {
     host.style.display = "none";
     host.innerHTML = "";
     host.className = "screen screen--hidden";
   }
 }
 function renderHome(){
   clearAdvanceTimer();
   setActive(null);
   setView("", { subpage: false });
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
  // Проверяем темы ПЕРВЫМИ, до проверки ответов
  const topic = e.target.closest("[data-t]");
  if (topic && !topic.hasAttribute("data-i")){ 
    e.preventDefault(); 
    e.stopPropagation();
    startDuel({mode:"topic", topic: topic.dataset.t}); 
    return; 
  }
  const ticket = e.target.closest("[data-ticket]");
  if (ticket){ 
    e.preventDefault(); 
    e.stopPropagation();
    startTicket(ticket.dataset.ticket); 
    return; 
  }
  const back = e.target.closest("[data-back]");
  if (back){ 
    e.preventDefault(); 
    e.stopPropagation();
    renderHome(); 
    return; 
  }
  const dot = e.target.closest("[data-question]");
  if (dot){
    e.preventDefault();
    e.stopPropagation();
    if (dot.disabled) return;
    goToQuestion(+dot.dataset.question);
    return;
  }
  if (e.target.closest("[data-prev]")){
    e.preventDefault();
    e.stopPropagation();
    previousQuestion();
    return;
  }
  if (e.target.closest("[data-next]")){
    e.preventDefault();
    e.stopPropagation();
    nextQuestion();
    return;
  }
  if (e.target.closest("[data-finish]")){
    e.preventDefault();
    e.stopPropagation();
    finishDuel();
    return;
  }
  if (e.target.id === "again"){ 
    e.preventDefault();
    e.stopPropagation();
    const currentDuel = State.duel;
    if (currentDuel && currentDuel.topic){
      startDuel({ mode: "topic", topic: currentDuel.topic });
    } else {
      startDuel({ mode: "quick" });
    }
    return;
  }
  if (e.target.id === "home"){ 
    e.preventDefault(); 
    e.stopPropagation();
    renderHome(); 
    return; 
  }
  // Проверяем ответы ТОЛЬКО если есть data-i
  const answer = e.target.closest("button.answer[data-i]");
  if (answer && answer.hasAttribute("data-i") && !answer.hasAttribute("data-t")){
    e.preventDefault();
    e.stopPropagation();
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
async function loadTickets(){
  // Общий таймаут для всей функции (30 секунд максимум)
  const overallTimeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Общий таймаут загрузки билетов")), 30000);
  });

  const loadTask = async () => {
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
      return;
    }

    const raw = [];
    let loaded = 0;
    let successes = 0;
    let failures = 0;
    const total = ticketFiles.length;
    const maxFailures = Math.ceil(total * 0.7); // Если больше 70% файлов не загрузилось, прекращаем

    // Обновляем прогресс загрузки
    const updateProgress = () => {
      const percent = 20 + Math.floor((loaded / total) * 70);
      updateLoaderProgress(percent, `Загружено ${loaded} из ${total} файлов...`);
    };

    // Ограничиваем количество одновременных загрузок
    const maxConcurrent = 5;
    const chunks = [];
    for (let i = 0; i < ticketFiles.length; i += maxConcurrent) {
      chunks.push(ticketFiles.slice(i, i + maxConcurrent));
    }

    for (const chunk of chunks) {
      if(failures > maxFailures && raw.length === 0){
        console.warn("⚠️ Слишком много ошибок загрузки, переключаемся на fallback");
        break;
      }

      // Загружаем чанк параллельно, но с ограничением
      await Promise.allSettled(chunk.map(async (file) => {
        const url = `questions/${encodePath(file)}`;
        try {
          const response = await fetchWithTimeout(url, { cache:"no-store" }, 2000); // Уменьшил таймаут до 2 секунд
          if(!response.ok) throw new Error(`HTTP ${response.status}`);

          const payload = await response.json();
          const list = Array.isArray(payload) ? payload : (payload.questions || payload.list || payload.data || []);
          const ticketLabel = extractTicketLabel(file);
          for(const item of list){
            raw.push({ ...item, __ticketLabel: ticketLabel });
          }
          successes++;
          loaded++;
          updateProgress();
        } catch(err) {
          console.warn("Не удалось загрузить " + file + ":", err);
          failures++;
          loaded++;
          updateProgress();
        }
      }));
    }

    if (raw.length > 0) {
      const normalized = normalizeQuestions(raw);
      applyQuestions(normalized, "remote");
    } else {
      // Если ничего не загрузилось, используем fallback
      console.log("📦 Ничего не загружено, применяем fallback данные");
    }
  };

  try {
    await Promise.race([loadTask(), overallTimeout]);
  } catch(err) {
    console.warn("⚠️ Превышен общий таймаут загрузки билетов:", err);
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
  // Не очищаем данные, если новых данных нет или их меньше
  if (!norm || norm.length === 0) {
    console.warn("⚠️ Попытка применить пустые данные, пропускаем");
    return;
  }
  // Если уже есть fallback данные и новые данные не лучше, не заменяем
  if (source === "remote" && State.usedFallback && norm.length < State.pool.length) {
    console.warn("⚠️ Новые данные меньше текущих, сохраняем существующие");
    return;
  }
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
   const listId = "topics-list";
   
   if(!list.length){ 
     setView(`<div class="card"><h3>Темы</h3><p>❌ Темы не найдены</p></div>`, { subpage: true, title: "Темы" }); 
     return; 
   }
   
   const html = `
     <div class="card"><h3>Темы</h3></div>
     <div class="card">
       <input type="text" id="search-topics" class="search-input" placeholder="🔍 Поиск тем..." data-search-target="${listId}" />
     </div>
     <div class="card"><div class="grid auto topics-grid" id="${listId}">
       ${list.map(t=>`<button type="button" class="btn topic-btn" data-search-text="${esc(t.toLowerCase())}" data-t="${esc(t)}">${esc(t)}</button>`).join("")}
     </div></div>
   `;
   
   setView(html, { subpage: true, title: "Темы" });
   
   scheduleFrame(() => {
     const searchInput = qs("#search-topics");
     const listContainer = qs(`#${listId}`);
     if(searchInput && listContainer) {
       bindSearch("search-topics", listId);
     }
   });
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
 
async function loadMarkup(){
  if (State.markup) return State.markup;
  try {
    const response = await fetchWithTimeout(MARKUP_URL, { cache:"no-store" }, 10000);
    if(response.ok) {
      const data = await response.json();
      State.markup = data;
      return data;
    }
  } catch(err) {
    console.warn("Не удалось загрузить разметку:", err);
  }
  return null;
}

async function uiMarkup(){
  // Если данные уже загружены, показываем сразу
  if(!State.markup) {
    // Показываем placeholder сразу для мгновенного отклика
    setView(`<div class="card"><h3>Разметка</h3></div><div class="card"><input type="text" class="search-input" placeholder="🔍 Поиск разметки..." disabled /></div><div><div class="card"><h3>Загрузка...</h3></div></div>`, { subpage: true, title: "Разметка" });
    
    // Загружаем в фоне
    if(!State.markupLoading) {
      State.markupLoading = true;
      await loadMarkup();
      State.markupLoading = false;
    } else {
      // Ждем завершения текущей загрузки
      while(State.markupLoading) {
        await new Promise(r => setTimeout(r, 50));
      }
    }
  }
  
  const markup = State.markup;
  
  if(!markup || typeof markup !== "object") {
    setView(`<div class="card"><h3>Разметка</h3><p>❌ Данные разметки не найдены</p></div>`, { subpage: true, title: "Разметка" });
    return;
  }

  const categories = Object.keys(markup);
  const listId = "markup-list";
  let html = `
    <div class="card"><h3>Разметка</h3></div>
    <div class="card">
      <input type="text" id="search-markup" class="search-input" placeholder="🔍 Поиск разметки..." data-search-target="${listId}" />
    </div>
    <div id="${listId}">
  `;

  for(const category of categories) {
    const items = markup[category];
    if(!items || typeof items !== "object") continue;

    const itemKeys = Object.keys(items).sort((a,b)=>{
      const numA = parseFloat(a) || 0;
      const numB = parseFloat(b) || 0;
      return numA - numB;
    });

    html += `
      <div class="markup-category">
        <div class="card">
          <h3>${esc(category)}</h3>
        </div>
        <div class="markup-list">
          ${itemKeys.map(key => {
            const item = items[key];
            if(!item) return "";
            const number = item.number || key;
            const image = item.image || "";
            const description = item.description || "";
            const imagePath = image.startsWith("./") ? image.substring(2) : image;
            const searchText = `${number} ${description} ${category}`.toLowerCase();
            return `
              <div class="markup-item" data-search-text="${esc(searchText)}">
                <div class="markup-item__head">
                  <h4>${esc(number)}</h4>
                  <span class="markup-item__badge">${esc(number)}</span>
                </div>
                ${image ? `<img src="${esc(imagePath)}" class="markup-item__image" alt="${esc(number)}" onerror="this.style.display='none'">` : ""}
                <p>${esc(description)}</p>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }
  
  html += `</div>`;
  setView(html, { subpage: true, title: "Разметка" });
  bindSearch("search-markup", listId);
}

function uiStats(){
  const questionsCount = State.pool.length;
  const topicsCount = State.topics.size;
  const ticketsCount = State.byTicket.size;
  
  setView(`
    <div class="card">
      <h3>Статистика</h3>
    </div>
    <div class="card">
      <div class="grid auto">
        <div class="stat-item">
          <div class="stat-value">${formatNumber(questionsCount)}</div>
          <div class="stat-label">Вопросов</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${formatNumber(topicsCount)}</div>
          <div class="stat-label">Тем</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${formatNumber(ticketsCount)}</div>
          <div class="stat-label">Билетов</div>
        </div>
      </div>
    </div>
  `, { subpage: true, title: "Статистика" });
}

async function uiPenalties(){
  // Если данные уже загружены, показываем сразу
  if(!State.penalties || State.penalties.length === 0) {
    // Показываем placeholder сразу для мгновенного отклика
    setView(`<div class="card penalties-card"><h3>Штрафы</h3></div><div class="card"><input type="text" class="search-input" placeholder="🔍 Поиск штрафов..." disabled /></div><div class="penalties-grid"><div class="penalty"><h4>Загрузка...</h4></div></div>`, { subpage: true, title: "Штрафы" });
    
    // Загружаем в фоне
    if(!State.penaltiesLoading) {
      State.penaltiesLoading = true;
      await loadPenalties();
      State.penaltiesLoading = false;
    } else {
      // Ждем завершения текущей загрузки
      while(State.penaltiesLoading) {
        await new Promise(r => setTimeout(r, 50));
      }
    }
  }

  const items = State.penalties || [];
  const listId = "penalties-list";
  
  if(!items.length) {
    setView(`<div class="card"><h3>Штрафы</h3><p>❌ Данные о штрафах не найдены</p></div>`, { subpage: true, title: "Штрафы" });
    return;
  }

  const html = `
    <div class="card penalties-card">
      <h3>Штрафы</h3>
    </div>
    <div class="card">
      <input type="text" id="search-penalties" class="search-input" placeholder="🔍 Поиск штрафов..." data-search-target="${listId}" />
    </div>
    <div class="penalties-grid" id="${listId}">
      ${items.map(item => {
        const searchText = `${item.articlePart || ""} ${item.text || ""} ${item.penalty || ""}`.toLowerCase();
        return `
          <div class="penalty" data-search-text="${esc(searchText)}">
            <h4>Статья ${esc(item.articlePart || "—")}</h4>
            <p>${esc(item.text || "")}</p>
            <p class="penalty__fine">${esc(item.penalty || "—")}</p>
          </div>
        `;
      }).join("")}
    </div>
  `;

  setView(html, { subpage: true, title: "Штрафы" });
  bindSearch("search-penalties", listId);
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
   
   // Индикатор прогресса сверху
   const progressPercent = ((d.i+1)/d.q.length*100).toFixed(0);
   const progressIndicator = `<div class="question-progress"><div class="question-progress-bar" style="--progress-width: ${progressPercent}%"><div style="width: ${progressPercent}%"></div></div><span class="question-progress-text">${d.i+1}/${d.q.length}</span></div>`;
 
   setView(`
     ${progressIndicator}
     ${tracker}
     <div class="card">
       <div class="meta">${esc(ticketInfo)}</div>
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
 
   // Улучшенные тосты с анимацией
   if(isCorrect){ 
     toast("✓");
   } else { 
     toast("✕");
   }
 
   // Обновляем UI без полной перерисовки для производительности
   const answerButtons = qsa("button.answer[data-i]");
   answerButtons.forEach((btn, idx) => {
     btn.classList.remove("correct", "wrong");
     if (idx === i) {
       btn.classList.add(isCorrect ? "correct" : "wrong");
     }
     if (idx === correct && !isCorrect) {
       btn.classList.add("correct");
     }
     btn.disabled = true;
   });
   
   // Обновляем трекер
   const trackerDot = qs(`[data-question="${currentIndex}"]`);
   if(trackerDot) {
     trackerDot.classList.remove("is-correct", "is-wrong");
     trackerDot.classList.add(isCorrect ? "is-correct" : "is-wrong");
   }
   
   // Обновляем индикатор прогресса
   const progressBar = qs(".question-progress-bar > div");
   const progressPercent = ((currentIndex+1)/d.q.length*100).toFixed(0);
   if(progressBar) {
     progressBar.style.width = `${progressPercent}%`;
   }
   const progressText = qs(".question-progress-text");
   if(progressText) {
     progressText.textContent = `${currentIndex+1}/${d.q.length}`;
   }

   if(isCorrect){
     // Переходим к следующему вопросу без перерисовки текущего
     State.advanceTimer = setTimeout(()=>{
      const currentAnswer = d.answers[currentIndex];
      const isCurrentCorrect = currentAnswer && currentAnswer.status === "correct";
      if(State.duel === d && d.i === currentIndex && isCurrentCorrect){
         d.i = Math.min(d.i + 1, d.q.length - 1);
         if(d.i >= d.q.length){
           finishDuel();
         } else {
           renderQuestion(d.i);
         }
       }
     }, 800);
   } else {
     // Если неправильно, просто разблокируем для следующей попытки (если разрешено)
     State.lock = false;
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
 function toast(t){
   const el=qs("#toast");
   if(!el) return;
   el.innerHTML=`<div class="toast">${t}</div>`;
   el.style.opacity=1;
   el.style.transform="translateX(-50%) translateY(0)";
   setTimeout(()=>{
     el.style.opacity=0;
     el.style.transform="translateX(-50%) translateY(20px)";
   },2500);
 }
function esc(s){
  const base = s == null ? "" : s;
  return String(base).replace(/[&<>\"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
}
 function bindSearch(inputId, targetId){
   const input = document.getElementById(inputId);
   if(!input) return;
   const target = document.getElementById(targetId);
   if(!target) return;
   
   input.addEventListener("input", (e) => {
     const query = e.target.value.toLowerCase().trim();
     const items = target.querySelectorAll("[data-search-text]");
     
     items.forEach(item => {
       const searchText = item.getAttribute("data-search-text") || "";
       if(!query || searchText.includes(query)) {
         item.style.display = "";
         item.classList.add("fade-in");
       } else {
         item.style.display = "none";
       }
     });
     
     // Скрываем пустые категории для разметки
     if(targetId === "markup-list") {
       const categories = target.querySelectorAll(".markup-category");
       categories.forEach(cat => {
         const visibleItems = cat.querySelectorAll("[data-search-text]:not([style*='display: none'])");
         if(visibleItems.length === 0 && query) {
           cat.style.display = "none";
         } else {
           cat.style.display = "";
         }
       });
     }
   });
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
