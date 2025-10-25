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
    ticket_number: "Демо билет 1",
    topic: "Общие положения",
    question: "Какой сигнал светофора разрешает движение?",
    answers: [
      { answer_text: "Зелёный", is_correct: true },
      { answer_text: "Жёлтый" },
      { answer_text: "Красный" },
      { answer_text: "Мигающий белый" }
    ],
    tip: "Зелёный сигнал разрешает движение водителям и пешеходам."
  },
  {
    ticket_number: "Демо билет 1",
    topic: "Общие положения",
    question: "Когда водитель обязан уступить дорогу пешеходу на нерегулируемом переходе?",
    answers: [
      { answer_text: "Всегда", is_correct: true },
      { answer_text: "Только ночью" },
      { answer_text: "Только когда нет других машин" },
      { answer_text: "Только в ясную погоду" }
    ],
    tip: "На нерегулируемых переходах водитель обязан уступить дорогу пешеходам."
  },
  {
    ticket_number: "Демо билет 2",
    topic: "Начало движения, маневрирование",
    question: "Перед началом движения водитель должен",
    answers: [
      { answer_text: "Убедиться в безопасности манёвра", is_correct: true },
      { answer_text: "Подать звуковой сигнал" },
      { answer_text: "Включить аварийную сигнализацию" },
      { answer_text: "Выполнить обгон" }
    ],
    tip: "Перед началом движения водитель обязан убедиться, что манёвр безопасен для других участников движения."
  },
  {
    ticket_number: "Демо билет 2",
    topic: "Начало движения, маневрирование",
    question: "При изменении полосы движения необходимо",
    answers: [
      { answer_text: "Подать соответствующий сигнал поворота", is_correct: true },
      { answer_text: "Снизить скорость до 20 км/ч" },
      { answer_text: "Включить дальний свет" },
      { answer_text: "Включить аварийную сигнализацию" }
    ],
    tip: "Перед перестроением водитель обязан подать сигнал указателями поворота."
  },
  {
    ticket_number: "Демо билет 3",
    topic: "Скорость движения",
    question: "Какова максимальная разрешённая скорость в населённом пункте?",
    answers: [
      { answer_text: "60 км/ч", is_correct: true },
      { answer_text: "70 км/ч" },
      { answer_text: "80 км/ч" },
      { answer_text: "90 км/ч" }
    ],
    tip: "По умолчанию в населённых пунктах разрешено ехать не быстрее 60 км/ч."
  },
  {
    ticket_number: "Демо билет 3",
    topic: "Скорость движения",
    question: "На каком расстоянии до опасного участка устанавливают предупреждающие знаки вне населённых пунктов?",
    answers: [
      { answer_text: "150-300 метров", is_correct: true },
      { answer_text: "50-100 метров" },
      { answer_text: "400-500 метров" },
      { answer_text: "Не ближе 20 метров" }
    ],
    tip: "Вне населённых пунктов предупреждающие знаки ставятся за 150-300 метров до опасного участка."
  },
  {
    ticket_number: "Демо билет 4",
    topic: "Проезд перекрестков",
    question: "Кто имеет преимущество на нерегулируемом перекрёстке равнозначных дорог?",
    answers: [
      { answer_text: "Транспортное средство, находящееся справа", is_correct: true },
      { answer_text: "Транспортное средство, находящееся слева" },
      { answer_text: "Автомобиль с включённым ближним светом" },
      { answer_text: "Тот, кто первым начал движение" }
    ],
    tip: "На перекрёстках равнозначных дорог действует правило «помехи справа»."
  },
  {
    ticket_number: "Демо билет 4",
    topic: "Проезд перекрестков",
    question: "Как следует действовать при одновременном приближении к перекрёстку со встречным автомобилем и намерении повернуть налево?",
    answers: [
      { answer_text: "Уступить дорогу встречному автомобилю", is_correct: true },
      { answer_text: "Повернуть первым" },
      { answer_text: "Остановиться и ожидать звукового сигнала" },
      { answer_text: "Проехать прямо" }
    ],
    tip: "При повороте налево водитель уступает дорогу встречному транспорту, движущемуся прямо или направо."
  },
  {
    ticket_number: "Демо билет 5",
    topic: "Обгон, опережение, встречный разъезд",
    question: "Когда запрещён обгон?",
    answers: [
      { answer_text: "На перекрёстках и пешеходных переходах", is_correct: true },
      { answer_text: "На прямых участках дороги" },
      { answer_text: "На магистрали" },
      { answer_text: "В светлое время суток" }
    ],
    tip: "Обгон запрещён на перекрёстках, пешеходных переходах и в других опасных местах."
  },
  {
    ticket_number: "Демо билет 5",
    topic: "Обгон, опережение, встречный разъезд",
    question: "Как водитель должен поступить при встречном разъезде на узком мосту?",
    answers: [
      { answer_text: "Уступить дорогу автомобилю, который первым въехал на мост", is_correct: true },
      { answer_text: "Разъехаться по обочине" },
      { answer_text: "Подать звуковой сигнал" },
      { answer_text: "Остановиться и выключить двигатель" }
    ],
    tip: "На узком мосту преимущество имеет транспортное средство, которое первым въехало на мост."
  },
  {
    ticket_number: "Демо билет 6",
    topic: "Остановка и стоянка",
    question: "Где запрещена стоянка?",
    answers: [
      { answer_text: "Ближе 5 м от пешеходного перехода", is_correct: true },
      { answer_text: "На правой обочине" },
      { answer_text: "На стоянке с табличкой 8.2.6" },
      { answer_text: "Перед гаражом" }
    ],
    tip: "Стоянка запрещена ближе 5 м от пешеходных переходов."
  },
  {
    ticket_number: "Демо билет 6",
    topic: "Остановка и стоянка",
    question: "Разрешена ли остановка на трамвайных путях?",
    answers: [
      { answer_text: "Запрещена", is_correct: true },
      { answer_text: "Разрешена на 5 минут" },
      { answer_text: "Разрешена при включённой аварийной сигнализации" },
      { answer_text: "Разрешена, если рядом нет трамвая" }
    ],
    tip: "Остановка на трамвайных путях запрещена."
  },
  {
    ticket_number: "Демо билет 7",
    topic: "Безопасность движения и техника управления автомобилем",
    question: "При заносе задней оси автомобиля следует",
    answers: [
      { answer_text: "Повернуть рулевое колесо в сторону заноса", is_correct: true },
      { answer_text: "Нажать на газ" },
      { answer_text: "Резко нажать на тормоз" },
      { answer_text: "Выключить фары" }
    ],
    tip: "Чтобы стабилизировать автомобиль, поворачивайте руль в сторону заноса."
  },
  {
    ticket_number: "Демо билет 7",
    topic: "Безопасность движения и техника управления автомобилем",
    question: "Что нужно сделать перед началом буксировки?",
    answers: [
      { answer_text: "Проверить исправность сцепного устройства", is_correct: true },
      { answer_text: "Включить дальний свет" },
      { answer_text: "Открыть капот" },
      { answer_text: "Снять аккумулятор" }
    ],
    tip: "Перед буксировкой убедитесь в надёжности соединения автомобилей."
  },
  {
    ticket_number: "Демо билет 8",
    topic: "Дорожные знаки",
    question: "Что означает знак «Главная дорога»?",
    answers: [
      { answer_text: "Вы движетесь по главной дороге", is_correct: true },
      { answer_text: "Впереди тупик" },
      { answer_text: "Запрещено движение" },
      { answer_text: "Впереди жилой район" }
    ],
    tip: "Знак подтверждает преимущество на перекрёстках."
  },
  {
    ticket_number: "Демо билет 8",
    topic: "Дорожные знаки",
    question: "Какой знак устанавливают перед крутым поворотом?",
    answers: [
      { answer_text: "Предупреждающий знак «Опасный поворот»", is_correct: true },
      { answer_text: "Запрещающий знак «Движение запрещено»" },
      { answer_text: "Информационный знак «Парковка»" },
      { answer_text: "Знак сервиса" }
    ],
    tip: "Знак «Опасный поворот» предупреждает о резком изменении направления дороги."
  },
  {
    ticket_number: "Демо билет 9",
    topic: "Дорожная разметка",
    question: "Что означает сплошная линия разметки?",
    answers: [
      { answer_text: "Пересекать её запрещено", is_correct: true },
      { answer_text: "Можно пересекать при обгоне" },
      { answer_text: "Она обозначает парковку" },
      { answer_text: "Указывает на место разворота" }
    ],
    tip: "Сплошную линию пересекать нельзя, кроме случаев объезда препятствия."
  },
  {
    ticket_number: "Демо билет 9",
    topic: "Дорожная разметка",
    question: "Что обозначает жёлтая прерывистая линия у тротуара?",
    answers: [
      { answer_text: "Запрещает стоянку", is_correct: true },
      { answer_text: "Указывает место парковки" },
      { answer_text: "Разрешает стоянку" },
      { answer_text: "Запрещает движение" }
    ],
    tip: "Жёлтая прерывистая линия запрещает стоянку, но допускает краткую остановку."
  },
  {
    ticket_number: "Демо билет 10",
    topic: "Ответственность водителя",
    question: "К чему приводит управление автомобилем в состоянии опьянения?",
    answers: [
      { answer_text: "К административной или уголовной ответственности", is_correct: true },
      { answer_text: "Никаких последствий" },
      { answer_text: "К повышению лимита скорости" },
      { answer_text: "К обязательному страховому возмещению" }
    ],
    tip: "Вождение в состоянии опьянения влечёт серьёзную ответственность и лишение прав."
  },
  {
    ticket_number: "Демо билет 10",
    topic: "Ответственность водителя",
    question: "Что обязан сделать водитель при ДТП без пострадавших?",
    answers: [
      { answer_text: "Остановиться и оформить происшествие", is_correct: true },
      { answer_text: "Продолжить движение" },
      { answer_text: "Скрыться" },
      { answer_text: "Перенести повреждённые части в салон" }
    ],
    tip: "Водитель обязан остановиться, включить аварийную сигнализацию и оформить ДТП."
  },
  {
    ticket_number: "Демо билет 11",
    topic: "Перевозка людей и грузов",
    question: "Можно ли перевозить пассажиров на заднем сиденье мотоцикла без бокового прицепа?",
    answers: [
      { answer_text: "Можно при наличии соответствующей категории и мотошлемов", is_correct: true },
      { answer_text: "Запрещено всегда" },
      { answer_text: "Можно только детей" },
      { answer_text: "Можно без шлемов" }
    ],
    tip: "Перевозка пассажира на мотоцикле допускается при наличии мотошлема и водительской категории A."
  },
  {
    ticket_number: "Демо билет 11",
    topic: "Перевозка людей и грузов",
    question: "Как разместить груз, выступающий более чем на 1 метр за габариты автомобиля?",
    answers: [
      { answer_text: "Обозначить его специальными знаками или флажками", is_correct: true },
      { answer_text: "Не обозначать" },
      { answer_text: "Закрепить только верёвкой" },
      { answer_text: "Перевозить только ночью" }
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
  hydrateFallback({ reset: true });
  showLoader(true);
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
      hydrateFallback();
    }
    const hasQuestions = State.pool.length > 0;
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
        if(!item.ticket_number) item.ticket_number = ticketLabel;
        if(!item.ticket_category) item.ticket_category = "A,B";
        if(!item.__bucket) item.__bucket = ticketLabel;
      }
      raw.push(...list);
      successes += list.length;
    } catch (err){
      console.error(`Не удалось загрузить ${file}:`, err);
      failures += 1;
      const failureThreshold = Math.min(5, ticketFiles.length);
      if(successes === 0 && failures >= failureThreshold){
        console.warn("⚠️ Слишком много ошибок при загрузке билетов, переключаемся на встроенный набор");
        break;
      }
    }

    loaded += 1;
    onProgress && onProgress(total ? loaded / total : 1);
    await delay(12);
  }

  if(!raw.length){
    console.warn("⚠️ Файлы билетов не загружены, используем встроенные вопросы");
    const fallback = hydrateFallback({ reset: !State.pool.length });
    onProgress && onProgress(1);
    return fallback;
  }

  applyQuestions(normalizeQuestions(deduplicate(raw)), "remote");

  console.log(`✅ Загружено ${State.pool.length} вопросов`);
  onProgress && onProgress(1);
  return State.pool;
}

function hydrateFallback({ reset = false } = {}){
  if(reset || !State.pool.length){
    console.warn("ℹ️ Используем встроенный демонстрационный набор вопросов");
    applyQuestions(normalizeQuestions(FALLBACK_QUESTION_BANK.map(item=>({ ...item }))), "fallback");
  } else {
    State.usedFallback = true;
  }
  return State.pool;
}

async function loadMarkup(){
  if (Array.isArray(State.markup)) return State.markup;
  const response = await fetch(MARKUP_URL, { cache:"no-store" });
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  const groups = Object.entries(payload || {}).map(([title, data])=>{
    const items = Object.values(data || {}).map(item=>({
      number: item.number || "",
      description: item.description || "",
      image: normalizeImagePath(item.image)
    })).sort((a,b)=>a.number.localeCompare(b.number,'ru',{numeric:true,sensitivity:'base'}));
    return { title, items };
  }).sort((a,b)=>a.title.localeCompare(b.title,'ru',{sensitivity:'base'}));
  State.markup = groups;
  return groups;
}

async function loadPenalties(){
  if (Array.isArray(State.penalties)) return State.penalties;
  const response = await fetch(PENALTIES_URL, { cache:"no-store" });
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
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
    const answersRaw = q.answers || q.variants || q.options || [];
    const answers = answersRaw.map(a => a?.answer_text ?? a?.text ?? a?.title ?? String(a));

    let correctIndex = answersRaw.findIndex(a => a?.is_correct===true);
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

function deduplicate(raw){
  const seen = new Set();
  const out = [];
  for(const item of raw){
    const key = item.id || `${item.ticket_number||"?"}:${item.question}`;
    if(seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function uniqueStrings(list){
  const seen = new Set();
  const out = [];
  for(const item of list){
    if (typeof item !== "string" || !item.trim()) continue;
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
  setView(`<div class="card"><h3>Дорожная разметка</h3><p class="meta">Загружаем данные…</p></div>`, { subpage: true, title: "Разметка" });
  try {
    const groups = await loadMarkup();
    if(!groups.length){
      setView(`<div class="card"><h3>Дорожная разметка</h3><p>❌ Данные не найдены</p></div>`, { subpage: true, title: "Разметка" });
      return;
    }
    const total = groups.reduce((acc,g)=>acc + g.items.length, 0);
    setView(`
      <div class="card">
        <h3>Дорожная разметка</h3>
        <p class="meta">Типов: ${formatNumber(total)} в ${formatNumber(groups.length)} разделах</p>
      </div>
      ${groups.map(group=>`
        <section class="card markup-category">
          <h3>${esc(group.title)}</h3>
          <div class="markup-list">
            ${group.items.map(item=>`
              <article class="markup-item">
                <header class="markup-item__head">
                  <span class="markup-item__badge">${esc(item.number)}</span>
                </header>
                ${item.image ? `<img src="${item.image}" alt="Разметка ${esc(item.number)}" loading="lazy" class="markup-item__image" />` : ""}
                <p>${esc(item.description)}</p>
              </article>
            `).join("")}
          </div>
        </section>
      `).join("")}
    `, { subpage: true, title: "Разметка" });
  } catch(err){
    console.error("Не удалось загрузить разметку:", err);
    setView(`<div class="card"><h3>Дорожная разметка</h3><p>⚠️ Ошибка загрузки данных</p></div>`, { subpage: true, title: "Разметка" });
  }
}

async function uiPenalties(){
  setView(`<div class="card"><h3>Штрафы</h3><p class="meta">Загружаем данные…</p></div>`, { subpage: true, title: "Штрафы" });
  try {
    const list = await loadPenalties();
    if(!list.length){
      setView(`<div class="card"><h3>Штрафы</h3><p>❌ Данные не найдены</p></div>`, { subpage: true, title: "Штрафы" });
      return;
    }
    setView(`
      <div class="card">
        <h3>Штрафы</h3>
        <p class="meta">Записей: ${formatNumber(list.length)}</p>
      </div>
      <div class="card penalties-card">
        <div class="penalties-grid">
          ${list.map(item=>`
            <article class="penalty">
              <h4>${esc(item.articlePart)}</h4>
              <p>${esc(item.text)}</p>
              <p class="penalty__fine">${esc(item.penalty)}</p>
            </article>
          `).join("")}
        </div>
      </div>
    `, { subpage: true, title: "Штрафы" });
  } catch(err){
    console.error("Не удалось загрузить штрафы:", err);
    setView(`<div class="card"><h3>Штрафы</h3><p>⚠️ Ошибка загрузки данных</p></div>`, { subpage: true, title: "Штрафы" });
  }
}

function uiStats(){
  setView(`<div class="card"><h3>Статистика</h3><p>Скоро здесь будет прогресс дуэлей.</p></div>`, { subpage: true, title: "Статистика" });
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
  const arr = bucket?.questions || [];
  if(!arr.length){ setView(`<div class="card"><h3>${esc(bucket?.label || key)}</h3><p>⚠️ Нет вопросов</p></div>`, { subpage: true, title: bucket?.label || "Билет" }); return; }
  const q = arr.length>20 ? shuffle(arr).slice(0,20) : arr.slice(0,20);
  State.duel = {
    mode:"ticket",
    topic:null,
    i:0,
    me:0,
    q,
    ticketLabel: bucket?.label || key,
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
  const ticketInfo = q.ticketLabel || (State.duel?.ticketLabel) || (q.ticketNumber ? `Билет ${q.ticketNumber}` : "Билет");
  const headerTitle = d.mode === "topic" && d.topic ? d.topic : (d.mode === "ticket" ? (State.duel?.ticketLabel || ticketInfo) : "Дуэль");
  const answerState = d.answers[d.i];
  const isAnswered = !!(answerState && answerState.status);
  const tracker = renderTracker();
  const controls = renderQuestionControls(isAnswered);

  setView(`
    ${tracker}
    <div class="card">
      <div class="meta">Вопрос ${d.i+1}/${d.q.length} • ${esc(ticketInfo)}</div>
      <h3>${esc(q.question)}</h3>
      ${q.image?`<img src="${q.image}" class="qimg" onerror="this.style.display='none'"/>`:""}
      <div class="grid">${q.answers.map((a,i)=>renderAnswerButton(a, i, q, answerState)).join("")}</div>
      <div id="tip" class="meta" style="${answerState?.status === "wrong" ? "display:block" : "display:none"};margin-top:8px;color:#ccc">💡 ${esc(q.tip)}</div>
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
  if(prev?.status){
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
      if(State.duel === d && d.i === currentIndex && d.answers[currentIndex]?.status === "correct"){
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
function esc(s){return String(s??"").replace(/[&<>\"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));}
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
        const status = info?.status;
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
  if(answerState?.status){
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
    if(d.answers[d.i]?.status){
      finishDuel();
    }
    return;
  }
  if(!d.answers[d.i]?.status) return;
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
