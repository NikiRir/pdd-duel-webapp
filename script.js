/* =======================
   Telegram + глобальное состояние
======================= */
const TG = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
try {
  TG?.ready();
  TG?.expand();
} catch (_) {
  // ignore telegram errors
}
 
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
    question: "Перед началом движения водитель должен…",
     answers: [
       { answer_text: "Убедиться в безопасности манёвра", is_correct: true },
       { answer_text: "Подать звуковой сигнал" },
      { answer_text: "Включить аварийную сигнализацию" }
     ],
    tip: "Перед началом движения водитель обязан убедиться, что манёвр безопасен."
   },
   {
     ticket_number: "Демо билет 2",
     topic: "Начало движения, маневрирование",
    question: "При изменении полосы движения необходимо…",
     answers: [
      { answer_text: "Подать сигнал указателями поворота", is_correct: true },
       { answer_text: "Снизить скорость до 20 км/ч" },
      { answer_text: "Включить дальний свет" }
     ],
    tip: "Перед перестроением водитель обязан предупредить об этом других участников движения."
   },
   {
     ticket_number: "Демо билет 3",
     topic: "Скорость движения",
     question: "Какова максимальная разрешённая скорость в населённом пункте?",
     answers: [
       { answer_text: "60 км/ч", is_correct: true },
       { answer_text: "70 км/ч" },
      { answer_text: "80 км/ч" }
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
      { answer_text: "400-500 метров" }
     ],
     tip: "Вне населённых пунктов предупреждающие знаки ставятся за 150-300 метров до опасного участка."
   },
   {
     ticket_number: "Демо билет 4",
    topic: "Проезд перекрёстков",
     question: "Кто имеет преимущество на нерегулируемом перекрёстке равнозначных дорог?",
     answers: [
       { answer_text: "Транспортное средство, находящееся справа", is_correct: true },
       { answer_text: "Транспортное средство, находящееся слева" },
      { answer_text: "Автомобиль с включённым ближним светом" }
     ],
     tip: "На перекрёстках равнозначных дорог действует правило «помехи справа»."
   },
   {
     ticket_number: "Демо билет 4",
    topic: "Проезд перекрёстков",
     question: "Как следует действовать при одновременном приближении к перекрёстку со встречным автомобилем и намерении повернуть налево?",
     answers: [
       { answer_text: "Уступить дорогу встречному автомобилю", is_correct: true },
       { answer_text: "Повернуть первым" },
      { answer_text: "Остановиться и ожидать звукового сигнала" }
     ],
     tip: "При повороте налево водитель уступает дорогу встречному транспорту, движущемуся прямо или направо."
   },
   {
     ticket_number: "Демо билет 5",
    topic: "Обгон, опережение",
     question: "Когда запрещён обгон?",
     answers: [
       { answer_text: "На перекрёстках и пешеходных переходах", is_correct: true },
       { answer_text: "На прямых участках дороги" },
      { answer_text: "На магистрали" }
     ],
     tip: "Обгон запрещён на перекрёстках, пешеходных переходах и в других опасных местах."
   },
   {
     ticket_number: "Демо билет 5",
    topic: "Обгон, опережение",
     question: "Как водитель должен поступить при встречном разъезде на узком мосту?",
     answers: [
       { answer_text: "Уступить дорогу автомобилю, который первым въехал на мост", is_correct: true },
       { answer_text: "Разъехаться по обочине" },
      { answer_text: "Подать звуковой сигнал" }
     ],
     tip: "На узком мосту преимущество имеет транспортное средство, которое первым въехало на мост."
   }
 ];
 
const State = {
  tickets: [],
  byTicket: new Map(),
  topics: new Map(),
  pool: [],
  markup: null,
  penalties: [],
  session: null,
  currentView: null,
  usedFallback: false,
  dataReady: false
};
 
const appRoot = document.querySelector(".app");
const screenEl = document.getElementById("screen");
const loaderBar = document.getElementById("loaderBar");
const toastEl = document.getElementById("toast");
const heroButtons = document.querySelectorAll("[data-action]");
const menuEl = document.querySelector(".menu.main-menu");
 
let toastTimer = null;
 
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
 }
 
function formatMultiline(value) {
  return escapeHtml(value).replace(/\n+/g, "<br />");
 }
 
function showToast(message) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("is-visible"), 3600);
}
 
function setLoaderProgress(step, total) {
  const percent = total > 0 ? Math.min(100, Math.round((step / total) * 100)) : 0;
  if (loaderBar) {
    loaderBar.style.width = `${percent}%`;
   }
 }
 
function setMenuActive(view) {
  if (!menuEl) return;
  menuEl.querySelectorAll("button").forEach((btn) => {
    if (btn.dataset.view === view) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
 }
 
function shuffle(array) {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
   }
  return copy;
 }
 
async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Не удалось загрузить ${url}`);
   }
  return response.json();
}
 
async function fetchPenalties(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Не удалось загрузить ${url}`);
   }
  const text = await response.text();
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        console.warn("Ошибка парсинга штрафа", error);
        return null;
       }
    })
    .filter(Boolean);
}

function resetState() {
  State.tickets = [];
  State.byTicket = new Map();
  State.topics = new Map();
  State.pool = [];
  State.session = null;
  State.markup = null;
  State.penalties = [];
  State.usedFallback = false;
}

function deriveTicketName(rawQuestions, url) {
  if (Array.isArray(rawQuestions) && rawQuestions.length > 0) {
    const withName = rawQuestions.find((item) => item?.ticket_number) ?? rawQuestions[0];
    if (withName?.ticket_number) {
      return withName.ticket_number;
    }
    if (withName?.ticket) {
      return withName.ticket;
    }
   }
  const parts = url.split("/");
  const filename = parts[parts.length - 1] || "Билет";
  return filename.replace(/\.json$/i, "");
}

function normalizeQuestion(raw, ticketName, index) {
  const id = raw.id || `${ticketName.replace(/\s+/g, "_")}-${index}`;
  const topics = Array.isArray(raw.topic)
    ? raw.topic.filter(Boolean)
    : raw.topic
    ? [raw.topic]
    : [];
  const answers = (raw.answers || []).map((answer, answerIndex) => ({
    text: answer?.answer_text ?? answer?.text ?? `Вариант ${answerIndex + 1}`,
    isCorrect: Boolean(answer?.is_correct ?? answer?.isCorrect ?? false)
  }));
  const image = raw.image && !/no_image/i.test(raw.image) ? raw.image : null;
  const tip = raw.answer_tip ?? raw.tip ?? "";
  return {
    id,
    ticket: raw.ticket_number || ticketName,
    category: raw.ticket_category || "",
    order: index,
    question: raw.question || "",
    answers,
    image,
    tip,
    topics
  };
 }
 
function registerQuestion(question) {
  State.pool.push(question);
  question.topics.forEach((topic) => {
    if (!State.topics.has(topic)) {
      State.topics.set(topic, []);
    }
    State.topics.get(topic).push(question);
  });
}

function registerTicket(ticketName, rawQuestions) {
  const normalized = rawQuestions.map((item, index) => normalizeQuestion(item, ticketName, index));
  normalized.forEach(registerQuestion);
  const category = normalized[0]?.category ?? "";
  State.byTicket.set(ticketName, normalized);
  const existingIndex = State.tickets.findIndex((item) => item.name === ticketName);
  const meta = {
    name: ticketName,
    category,
    count: normalized.length
  };
  if (existingIndex >= 0) {
    State.tickets[existingIndex] = meta;
   } else {
    State.tickets.push(meta);
   }
 }
 
function registerFallbackTickets() {
  if (!FALLBACK_QUESTION_BANK.length) return;
  const grouped = new Map();
  FALLBACK_QUESTION_BANK.forEach((item, index) => {
    const ticket = item.ticket_number || "Демо билет";
    if (!grouped.has(ticket)) {
      grouped.set(ticket, []);
     }
    const clone = {
      ...item,
      id: item.id || `${ticket.replace(/\s+/g, "_")}-${index}`
    };
    grouped.get(ticket).push(clone);
  });
  grouped.forEach((questions, ticket) => {
    registerTicket(ticket, questions);
  });
  State.usedFallback = true;
}

function ensureDataReady() {
  if (State.dataReady) return true;
  showToast("Данные ещё загружаются…");
  return false;
}

function renderTicketsView() {
  const totalQuestions = State.pool.length;
  const totalTickets = State.tickets.length;
  if (!totalTickets) {
    screenEl.innerHTML = '<div class="view"><p class="empty-state">Не удалось загрузить билеты. Попробуйте обновить страницу.</p></div>';
    return;
   }
  const cards = State.tickets
    .slice()
    .sort((a, b) => {
      const aNum = parseInt(a.name.replace(/[^0-9]/g, ""), 10);
      const bNum = parseInt(b.name.replace(/[^0-9]/g, ""), 10);
      if (Number.isNaN(aNum) || Number.isNaN(bNum)) {
        return a.name.localeCompare(b.name, "ru");
      }
      return aNum - bNum;
    })
    .map((ticket) => {
      const encoded = encodeURIComponent(ticket.name);
      const category = ticket.category ? `<span class="ticket-card__meta">Категория ${escapeHtml(ticket.category)}</span>` : "";
      return `
        <button class="ticket-card" data-ticket="${encoded}">
          <span class="ticket-card__title">${escapeHtml(ticket.name)}</span>
          ${category}
          <span class="ticket-card__meta">${ticket.count} вопросов</span>
        </button>
      `;
    })
    .join("");
  screenEl.innerHTML = `
    <div class="view tickets-view">
      <div>
        <h2 class="section-title">Билеты ГИБДД</h2>
        <p class="section-subtitle">Выбери билет и потренируйся. Всего вопросов: ${totalQuestions}.</p>
      </div>
      <div class="ticket-grid">${cards}</div>
    </div>
  `;
  screenEl.querySelectorAll("[data-ticket]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ticketName = decodeURIComponent(btn.dataset.ticket);
      openTicket(ticketName);
    });
  });
 }
 
function renderTopicsView() {
  if (!State.topics.size) {
    screenEl.innerHTML = '<div class="view"><p class="empty-state">Темы появятся после загрузки вопросов.</p></div>';
    return;
   }
  const topics = Array.from(State.topics.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .map(([name, questions]) => {
      const encoded = encodeURIComponent(name);
      return `
        <button class="topic-card" data-topic="${encoded}">
          <span class="topic-card__title">${escapeHtml(name)}</span>
          <span class="topic-card__meta">${questions.length} вопросов</span>
        </button>
      `;
    })
    .join("");
  screenEl.innerHTML = `
    <div class="view topics-view">
      <div>
        <h2 class="section-title">Темы</h2>
        <p class="section-subtitle">Повторяй конкретные разделы и закрывай пробелы в знаниях.</p>
      </div>
      <div class="topic-grid">${topics}</div>
    </div>
  `;
  screenEl.querySelectorAll("[data-topic]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const topicName = decodeURIComponent(btn.dataset.topic);
      openTopic(topicName);
    });
  });
 }
 
function renderMarkupView() {
  if (!State.markup) {
    screenEl.innerHTML = '<div class="view"><p class="empty-state">Не удалось загрузить справочник разметки.</p></div>';
    return;
   }
  const sections = Object.entries(State.markup)
    .map(([groupName, items]) => {
      const cards = Object.values(items)
        .map((item) => {
          const img = item.image ? `<img src="${item.image}" alt="Разметка ${escapeHtml(item.number)}" class="markup-item__image" loading="lazy" />` : "";
          return `
            <article class="markup-item">
              <div class="markup-item__header">
                ${img}
                <div>
                  <p class="markup-card__title">${escapeHtml(item.number)}</p>
                  <p class="section-subtitle">${formatMultiline(item.description)}</p>
                </div>
              </div>
            </article>
          `;
        })
        .join("");
      return `
        <section class="markup-section">
          <h3 class="section-title">${escapeHtml(groupName)}</h3>
          <div class="markup-grid">${cards}</div>
        </section>
      `;
    })
    .join("");
  screenEl.innerHTML = `
    <div class="view markup-view">
      <div>
        <h2 class="section-title">Дорожная разметка</h2>
        <p class="section-subtitle">Все обозначения с пояснениями и изображениями.</p>
      </div>
      ${sections}
    </div>
  `;
 }
 
function renderPenaltiesView() {
  if (!State.penalties.length) {
    screenEl.innerHTML = '<div class="view"><p class="empty-state">Не удалось загрузить базу штрафов.</p></div>';
     return;
   }
  const rows = State.penalties
    .map((penalty) => `
      <article class="penalty-item">
        <p class="penalty-item__article">Статья ${escapeHtml(penalty.article_part)}</p>
        <p class="penalty-item__text">${formatMultiline(penalty.text)}</p>
        <p class="penalty-item__amount">${escapeHtml(penalty.penalty)}</p>
      </article>
    `)
    .join("");
  screenEl.innerHTML = `
    <div class="view penalties-view">
      <div>
        <h2 class="section-title">Штрафы</h2>
        <p class="section-subtitle">Краткий справочник КоАП для водителей.</p>
      </div>
      <div class="penalty-section">${rows}</div>
    </div>
  `;
 }
 
function openTicket(ticketName) {
  if (!ensureDataReady()) return;
  const questions = State.byTicket.get(ticketName);
  if (!questions) {
    showToast("Не удалось открыть билет.");
    return;
   }
  startSession("ticket", {
    questions,
    ticket: ticketName,
    returnView: State.currentView || "tickets"
  });
}

function openTopic(topicName) {
  if (!ensureDataReady()) return;
  const questions = State.topics.get(topicName);
  if (!questions) {
    showToast("Не удалось открыть тему.");
    return;
  }
  startSession("topic", {
    questions,
    topic: topicName,
    returnView: State.currentView || "topics"
  });
 }
 
function startQuickDuel() {
  if (!ensureDataReady()) return;
  if (!State.pool.length) {
    showToast("Недостаточно вопросов для дуэли.");
    return;
   }
  const deck = shuffle(State.pool).slice(0, Math.min(10, State.pool.length));
  startSession("duel", {
    questions: deck,
    returnView: State.currentView || "tickets"
  });
}

function startSession(type, options) {
  const session = {
    type,
    questions: options.questions.slice(),
    index: 0,
    answers: new Map(),
    ticket: options.ticket || null,
    topic: options.topic || null,
    returnView: options.returnView || "tickets"
   };
  if (type === "topic") {
    session.label = options.topic;
  } else if (type === "ticket") {
    session.label = options.ticket;
  } else {
    session.label = "Быстрая дуэль";
   }
  State.session = session;
  appRoot.classList.add("app--subpage");
  renderSession();
}

function closeSession() {
  const { returnView } = State.session || {};
  State.session = null;
  appRoot.classList.remove("app--subpage");
  openView(returnView || "tickets");
}

function finishSession() {
  const session = State.session;
  if (!session) return;
  const total = session.questions.length;
  const correct = Array.from(session.answers.values()).filter((answer) => answer.isCorrect).length;
  const prefix = session.type === "duel" ? "Результат дуэли" : "Тренировка завершена";
  showToast(`${prefix}: ${correct} из ${total}.`);
  closeSession();
}

function renderSession() {
  const session = State.session;
  if (!session) return;
  const question = session.questions[session.index];
  if (!question) {
    finishSession();
     return;
   }
  const total = session.questions.length;
  const answered = session.answers.get(question.id);
  const tracker = session.questions
    .map((item, index) => {
      const answer = session.answers.get(item.id);
      const classes = ["tracker-dot"];
      if (index === session.index) classes.push("is-current");
      if (answer) classes.push(answer.isCorrect ? "is-correct" : "is-wrong");
      const disabled = !answer && index !== session.index ? "disabled" : "";
      return `<button class="${classes.join(" ")}" data-jump="${index}" ${disabled}>${index + 1}</button>`;
    })
    .join("");
  const answersHtml = question.answers
    .map((answer, index) => {
      const isCurrentChoice = answered && answered.choice === index;
      const classes = ["answer-btn"];
      if (answered) {
        if (answer.isCorrect) {
          classes.push("is-correct");
        } else if (isCurrentChoice) {
          classes.push("is-wrong");
        }
       }
      const disabled = answered ? "disabled" : "";
      return `<button class="${classes.join(" ")}" data-answer="${index}" ${disabled}>${escapeHtml(answer.text)}</button>`;
    })
    .join("");
  const topics = question.topics.length
    ? question.topics
        .map((topic) => `<span class="topic-pill" data-topic="${encodeURIComponent(topic)}">${escapeHtml(topic)}</span>`)
        .join("")
    : '<span class="topic-pill">Общий вопрос</span>';
  const resultBadge = answered
    ? `<div class="question-result">${answered.isCorrect ? "✅ Верно" : "❌ Неверно"}</div>`
    : "";
  const tip = answered && question.tip ? `<div class="question-tip">${formatMultiline(question.tip)}</div>` : "";
  const image = question.image ? `<img src="${question.image}" alt="Иллюстрация к вопросу" class="question-card__image" loading="lazy" />` : "";
  screenEl.innerHTML = `
    <div class="view question-view">
      <header class="subpage-header">
        <button class="back-btn" data-action="close-session">
          <span class="back-btn__icon" aria-hidden="true"></span>
          <span class="back-btn__label">Назад</span>
        </button>
        <div>
          <h2 class="subpage-title">${escapeHtml(session.label)}</h2>
          <p class="subpage-meta">Вопрос ${session.index + 1} из ${total}</p>
        </div>
      </header>
      <div class="question-tracker">${tracker}</div>
      <article class="question-card card">
        ${image}
        <p class="question-text">${escapeHtml(question.question)}</p>
        <div class="answers">${answersHtml}</div>
        ${tip}
      </article>
      <footer class="question-meta">
        <div class="question-topics">
          <span class="question-topics__label">Темы:</span>
          ${topics}
        </div>
        ${resultBadge}
      </footer>
      <div class="question-controls">
        <button class="btn ghost nav-btn" data-nav="prev" ${session.index === 0 ? "disabled" : ""}>← Назад</button>
        <button class="btn btn-primary nav-btn" data-nav="next" ${!answered ? "disabled" : ""}>${session.index === total - 1 ? "Завершить" : "Далее →"}</button>
      </div>
    </div>
  `;
  const backBtn = screenEl.querySelector('[data-action="close-session"]');
  backBtn?.addEventListener("click", closeSession);
  screenEl.querySelectorAll(".tracker-dot").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = Number(btn.dataset.jump);
      if (Number.isInteger(target)) {
        session.index = target;
        renderSession();
      }
    });
  });
  screenEl.querySelectorAll(".answer-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (session.answers.has(question.id)) return;
      const choice = Number(btn.dataset.answer);
      const answer = question.answers[choice];
      const isCorrect = Boolean(answer?.isCorrect ?? answer?.is_correct);
      session.answers.set(question.id, { choice, isCorrect });
      renderSession();
      if (!isCorrect && question.tip) {
        showToast("Ошибка. Посмотри подсказку.");
      }
    });
  });
  const prevBtn = screenEl.querySelector('[data-nav="prev"]');
  prevBtn?.addEventListener("click", () => {
    if (session.index > 0) {
      session.index -= 1;
      renderSession();
    }
  });
  const nextBtn = screenEl.querySelector('[data-nav="next"]');
  nextBtn?.addEventListener("click", () => {
    if (!session.answers.has(question.id)) return;
    if (session.index >= total - 1) {
      finishSession();
    } else {
      session.index += 1;
      renderSession();
    }
  });
  screenEl.querySelectorAll(".topic-pill[data-topic]").forEach((pill) => {
    pill.addEventListener("click", () => {
      const topicName = decodeURIComponent(pill.dataset.topic);
      openTopic(topicName);
    });
  });
}

function openView(view) {
  if (!ensureDataReady()) return;
  State.currentView = view;
  screenEl.scrollTop = 0;
  appRoot.classList.remove("app--subpage");
  setMenuActive(view);
  switch (view) {
    case "tickets":
      renderTicketsView();
      break;
    case "topics":
      renderTopicsView();
      break;
    case "markup":
      renderMarkupView();
      break;
    case "penalties":
      renderPenaltiesView();
      break;
    default:
      renderTicketsView();
      break;
   }
 }
 
async function loadData() {
  resetState();
  heroButtons.forEach((btn) => {
    btn.disabled = true;
  });
  menuEl?.querySelectorAll("button").forEach((btn) => {
    btn.disabled = true;
  });
  screenEl.innerHTML = '<div class="view"><p class="view-intro">Загружаем данные билетов и справочников…</p></div>';
  let manifest;
  let totalSteps = 3;
  let completed = 0;
  try {
    manifest = await fetchJSON(MANIFEST_URL);
  } catch (error) {
    console.warn("Не удалось загрузить manifest", error);
    manifest = FALLBACK_MANIFEST;
    State.usedFallback = true;
   }
  totalSteps = (manifest?.tickets?.length || 0) + 3;
  completed += 1;
  setLoaderProgress(completed, totalSteps);
  try {
    State.markup = await fetchJSON(MARKUP_URL);
  } catch (error) {
    console.warn("Не удалось загрузить markup", error);
    State.markup = null;
   }
  completed += 1;
  setLoaderProgress(completed, totalSteps);
  try {
    State.penalties = await fetchPenalties(PENALTIES_URL);
  } catch (error) {
    console.warn("Не удалось загрузить penalties", error);
    State.penalties = [];
  }
  completed += 1;
  setLoaderProgress(completed, totalSteps);
 
  const tickets = manifest?.tickets || [];
  for (const ticketPath of tickets) {
    const url = ticketPath.startsWith("http") ? ticketPath : `questions/${ticketPath}`;
    try {
      const data = await fetchJSON(url);
      const ticketName = deriveTicketName(data, ticketPath);
      registerTicket(ticketName, data);
    } catch (error) {
      console.warn("Не удалось загрузить билет", ticketPath, error);
    }
    completed += 1;
    setLoaderProgress(completed, totalSteps);
  }
 
  if (!State.pool.length) {
    registerFallbackTickets();
  }
 
  State.dataReady = true;
  document.body.classList.remove("is-loading");
  heroButtons.forEach((btn) => {
    btn.disabled = false;
  });
  menuEl?.querySelectorAll("button").forEach((btn) => {
    btn.disabled = false;
  });
  if (State.usedFallback) {
    showToast("Работаем в офлайн-режиме: используем встроенный набор вопросов.");
   }
  openView("tickets");
 }
 
document.addEventListener("DOMContentLoaded", () => {
  heroButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      if (action === "quick") {
        startQuickDuel();
      }
      if (action === "tickets") {
        openView("tickets");
      }
    });
  });
  menuEl?.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      if (view) {
        openView(view);
      }
    });
  });
  loadData().catch((error) => {
    console.error(error);
    showToast("Не удалось загрузить данные. Попробуйте обновить страницу.");
    document.body.classList.remove("is-loading");
  });
});
