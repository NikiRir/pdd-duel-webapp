/* =======================
   Telegram + Глобальное состояние
======================= */
const TG = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
try { TG?.ready(); TG?.expand(); } catch(_) {}

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
};

let delegationBound = false;
let menuBound = false;
const scheduleFrame = typeof requestAnimationFrame === "function" ? requestAnimationFrame : (fn)=>setTimeout(fn, 16);

const MANIFEST_URL = "questions/index.json";
const MARKUP_URL = "markup/markup.json";
const PENALTIES_URL = "penalties/penalties.json";
const FALLBACK_MANIFEST = {
  tickets: [
    "A_B/tickets/Билет 1.json",
    "A_B/tickets/Билет 2.json",
    "A_B/tickets/Билет 3.json",
    "A_B/tickets/Билет 4.json",
    "A_B/tickets/Билет 5.json",
    "A_B/tickets/Билет 6.json",
    "A_B/tickets/Билет 7.json",
    "A_B/tickets/Билет 8.json",
    "A_B/tickets/Билет 9.json",
    "A_B/tickets/Билет 10.json",
    "A_B/tickets/Билет 11.json",
    "A_B/tickets/Билет 12.json",
    "A_B/tickets/Билет 13.json",
    "A_B/tickets/Билет 14.json",
    "A_B/tickets/Билет 15.json",
    "A_B/tickets/Билет 16.json",
    "A_B/tickets/Билет 17.json",
    "A_B/tickets/Билет 18.json",
    "A_B/tickets/Билет 19.json",
    "A_B/tickets/Билет 20.json",
    "A_B/tickets/Билет 21.json",
    "A_B/tickets/Билет 22.json",
    "A_B/tickets/Билет 23.json",
    "A_B/tickets/Билет 24.json",
    "A_B/tickets/Билет 25.json",
    "A_B/tickets/Билет 26.json",
    "A_B/tickets/Билет 27.json",
    "A_B/tickets/Билет 28.json",
    "A_B/tickets/Билет 29.json",
    "A_B/tickets/Билет 30.json",
    "A_B/tickets/Билет 31.json",
    "A_B/tickets/Билет 32.json",
    "A_B/tickets/Билет 33.json",
    "A_B/tickets/Билет 34.json",
    "A_B/tickets/Билет 35.json",
    "A_B/tickets/Билет 36.json",
    "A_B/tickets/Билет 37.json",
    "A_B/tickets/Билет 38.json",
    "A_B/tickets/Билет 39.json",
    "A_B/tickets/Билет 40.json"
  ]
};

const FALLBACK_QUESTION_BANK = [
  {
    question: "Какой сигнал светофора разрешает движение?",
    answers: [
      { answer_text: "Зелёный", is_correct: true },
      { answer_text: "Жёлтый" },
      { answer_text: "Красный" }
    ],
    tip: "Зелёный сигнал разрешает движение, жёлтый предупреждает, красный запрещает.",
    ticket_number: "Демо билет",
    topic: "Общие положения"
  },
  {
    question: "Нужно ли пропускать пешехода на нерегулируемом переходе?",
    answers: [
      { answer_text: "Да, всегда", is_correct: true },
      { answer_text: "Только ночью" },
      { answer_text: "Нет" }
    ],
    tip: "Водитель обязан уступить дорогу пешеходам на нерегулируемом переходе.",
    ticket_number: "Демо билет",
    topic: "Пешеходные переходы"
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
  const baseProgress = 5;
  setLoader(baseProgress);
  let hasQuestions = false;
  try {
    const pool = await loadTickets(progress => {
      if (typeof progress === "number" && !Number.isNaN(progress)) {
        const clamped = Math.max(0, Math.min(1, progress));
        setLoader(baseProgress + Math.round(clamped * 85));
      }
    });
    hasQuestions = Array.isArray(pool) ? pool.length > 0 : State.pool.length > 0;
  } catch(e) {
    console.error("Ошибка загрузки билетов:", e);
  } finally {
    setLoader(100);
    renderHome();
    updateStatsCounters();
    setTimeout(()=>showLoader(false), 250);
    if(!hasQuestions) setTimeout(()=>notifyDataIssue(), 350);
  }
}

/* =======================
   Лоадер
======================= */
function showLoader(v){
  const isVisible = !!v;
  qs("#loader").classList.toggle("hidden", !isVisible);
  document.body.classList.toggle("is-loading", isVisible);
}
function setLoader(p){ qs("#loaderBar").style.width = Math.max(0,Math.min(100,p))+"%"; }

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
  host.scrollTop = 0;
  const content = subpage ? wrapSubpage(title, html) : html;
  host.innerHTML = `<div class="view">${content}</div>`;
}
function renderHome(){
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
  if(id) qs("#"+id)?.classList.add("active");
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
  const screen = qs("#screen");
  if(!screen){
    console.warn("Элемент #screen не найден, повторная попытка привязки событий");
    scheduleFrame(bindDelegation);
    return;
  }
  delegationBound = true;
  screen.addEventListener("pointerdown", handlePointerDown, { passive:true });
  screen.addEventListener("pointermove", handlePointerMove, { passive:true });
  screen.addEventListener("pointerup", handlePointerUp, { passive:false });
  screen.addEventListener("pointercancel", handlePointerCancel, { passive:true });
  screen.addEventListener("click", handleClick, { passive:false });
}

function handleTap(e){
  if (e.type === "touchstart" || (e.type === "pointerup" && e.pointerType === "touch")) {
    State.lastTouchTs = Date.now();
  }

  const ans = e.target.closest("button.answer");
  if (ans && ans.dataset.i != null){
    e.preventDefault();
    if (ans.disabled) return;
    onAnswer(+ans.dataset.i);
    return;
  }
  const ticket = e.target.closest("[data-ticket]");
  if (ticket){ e.preventDefault(); startTicket(ticket.dataset.ticket); return; }
  const topic = e.target.closest("[data-t]");
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
  if (e.target.id === "again"){ e.preventDefault(); startDuel(State.duel?.topic?{mode:"topic",topic:State.duel.topic}:{mode:"quick"}); return; }
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
  if (!tap || e.pointerId !== tap.pointerId) return;

  if (!tap.moved && tap.target) {
    const finalEl = document.elementFromPoint(e.clientX, e.clientY);
    const finalTarget = getActionTarget(finalEl);
    if (finalTarget === tap.target) {
      const synthetic = {
        type: "pointerup",
        pointerType: "touch",
        target: finalTarget,
        preventDefault: () => e.preventDefault(),
      };
      handleTap(synthetic);
      State.ignoreClickUntil = Date.now() + 400;
    }
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
  if(State.pool.length) {
    onProgress && onProgress(1);
    return State.pool;
  }

  onProgress && onProgress(0);

  let manifest = null;
  try {
    manifest = await fetchJson(MANIFEST_URL);
  } catch(err){
    console.warn("⚠️ Не удалось загрузить manifest, используем запасной список", err);
  }

  const ticketFiles = uniqueStrings([
    ...(manifest?.tickets || []),
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
        if(!item.ticket_number) item.ticket_number = ticketLabel;
        if(!item.ticket_category) item.ticket_category = "A,B";
        if(!item.__bucket) item.__bucket = ticketLabel;
      }
      raw.push(...list);
    } catch (err){
      console.error(`Не удалось загрузить ${file}:`, err);
    }

    loaded += 1;
    onProgress && onProgress(total ? loaded / total : 1);
    await delay(12);
  }

  if(!raw.length){
    console.warn("⚠️ Файлы билетов не загружены, используем встроенные вопросы");
    raw.push(...FALLBACK_QUESTION_BANK.map(item=>({ ...item })));
  }

  const unique = deduplicate(raw);
  const norm = normalizeQuestions(unique);
  for(const q of norm){
    State.pool.push(q);
    const bucketKey = q.ticketKey;
    if (!State.byTicket.has(bucketKey)){
      State.byTicket.set(bucketKey, { label: q.ticketLabel, order: q.ticketNumber ?? Number.MAX_SAFE_INTEGER, questions: [] });
    }
    const bucket = State.byTicket.get(bucketKey);
    bucket.order = Math.min(bucket.order, Number.isFinite(q.ticketNumber) ? q.ticketNumber : Number.MAX_SAFE_INTEGER);
    bucket.questions.push(q);

    for(const t of q.topics){
      if (!State.topics.has(t)) State.topics.set(t, []);
      State.topics.get(t).push(q);
    }
  }

  console.log(`✅ Загружено ${State.pool.length} вопросов`);
  onProgress && onProgress(1);
  return State.pool;
}

function hydrateFallback(){
  if(State.pool.length) return State.pool;
  const norm = normalizeQuestions(FALLBACK_QUESTION_BANK.map(item=>({ ...item })));
  for(const q of norm){
    State.pool.push(q);
    const key = q.ticketKey;
    if(!State.byTicket.has(key)){
      State.byTicket.set(key, { label: q.ticketLabel, order: q.ticketNumber ?? Number.MAX_SAFE_INTEGER, questions: [] });
    }
    State.byTicket.get(key).questions.push(q);
    for(const t of q.topics){
      if(!State.topics.has(t)) State.topics.set(t, []);
      State.topics.get(t).push(q);
    }
  }
  return State.pool;
}

... (остальная часть файла)
