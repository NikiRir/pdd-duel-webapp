// === ГЛОБАЛЬНОЕ СОСТОЯНИЕ ===
const State = {
  pool: [],
  byTicket: new Map(),
  topics: new Map(),
  duel: null,
  lock: false,
};

// === СТАРТ ===
document.addEventListener("DOMContentLoaded", () => {
  bindMenu();
  bindDelegation();
  init();
});

async function init() {
  showLoader(true);
  setLoader(15);
  await loadTickets((p) => setLoader(15 + p * 60));
  setLoader(100);
  setTimeout(() => showLoader(false), 400);
  renderHome();
}

// === ЛОАДЕР ===
function showLoader(v) {
  document.querySelector("#loader").classList.toggle("hidden", !v);
}
function setLoader(p) {
  document.querySelector("#loaderBar").style.width = Math.min(100, p) + "%";
}

// === МЕНЮ ===
function bindMenu() {
  document.querySelectorAll(".menu [data-action]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const act = e.currentTarget.dataset.action;
      if (act === "quick") startDuel({ mode: "quick" });
      if (act === "topics") uiTopics();
      if (act === "tickets") uiTickets();
    });
  });
}

// === НАВИГАЦИЯ ===
function setView(html) {
  const host = document.querySelector("#screen");
  host.innerHTML = `<div class="view fadein">${html}</div>`;
}
function renderHome() {
  setView(`
    <div class="card">
      <h3>Выбери режим</h3>
      <p>⚡ Быстрая дуэль, 📚 Темы, 🎟️ Билеты</p>
    </div>
  `);
}

// === ДЕЛЕГИРОВАНИЕ КЛИКОВ ===
function bindDelegation() {
  const scr = document.querySelector("#screen");
  scr.addEventListener("pointerup", (e) => handleTap(e));
  scr.addEventListener("click", (e) => handleTap(e));
}

function handleTap(e) {
  const ans = e.target.closest(".answer");
  if (ans && ans.dataset.i != null) {
    onAnswer(+ans.dataset.i);
    return;
  }
  const ticket = e.target.closest("[data-n]");
  if (ticket) {
    startTicket(+ticket.dataset.n);
    return;
  }
  const topic = e.target.closest("[data-t]");
  if (topic) {
    startDuel({ mode: "topic", topic: topic.dataset.t });
    return;
  }
  if (e.target.id === "again") startDuel(State.duel);
  if (e.target.id === "home") renderHome();
}

// === ЗАГРУЗКА ВОПРОСОВ ===
async function loadTickets(onProgress) {
  const TOTAL = 40;
  let loaded = 0;
  const all = [];

  for (let i = 1; i <= TOTAL; i++) {
    const name = `Билет ${i}.json`;
    try {
      const r = await fetch(`questions/A_B/tickets/${encodeURIComponent(name)}`);
      if (!r.ok) continue;
      const data = await r.json();
      const arr = Array.isArray(data) ? data : data.questions || [];
      all.push(...arr);
    } catch (e) {
      console.warn("Ошибка загрузки билета", i, e);
    }
    onProgress(++loaded / TOTAL);
  }

  const norm = normalizeQuestions(all);
  for (const q of norm) {
    State.pool.push(q);
    if (!State.byTicket.has(q.ticket)) State.byTicket.set(q.ticket, []);
    State.byTicket.get(q.ticket).push(q);

    for (const t of q.topics) {
      if (!State.topics.has(t)) State.topics.set(t, []);
      State.topics.get(t).push(q);
    }
  }

  console.log("✅ Загружено вопросов:", State.pool.length);
}

// === НОРМАЛИЗАЦИЯ ===
function normalizeQuestions(raw) {
  const out = [];
  for (const q of raw) {
    const answersRaw = q.answers || [];
    const answers = answersRaw.map((a) => a.answer_text || a.text || a.title);

    // Определяем правильный ответ
    let correctIndex = answersRaw.findIndex((a) => a.is_correct === true);
    if (correctIndex < 0 && typeof q.correct_answer === "string") {
      const m = q.correct_answer.match(/(\d+)/);
      if (m) correctIndex = parseInt(m[1]) - 1;
    }
    if (correctIndex < 0) correctIndex = 0;

    // Номер билета
    let ticket = 0;
    const match = String(q.ticket_number || q.ticket || "").match(/(\d+)/);
    if (match) ticket = parseInt(match[1]);

    // Путь к изображению
    let image = q.image || "";
    if (image.startsWith("./")) image = image.slice(2);
    if (image && !image.startsWith("images/")) image = "images/" + image;

    out.push({
      question: q.question || q.title,
      answers,
      correctIndex,
      tip: q.answer_tip || q.tip || "",
      ticket,
      topics: q.topic ? (Array.isArray(q.topic) ? q.topic : [q.topic]) : [],
      image,
    });
  }
  return out;
}

// === ЭКРАНЫ ===
function uiTopics() {
  const list = [...State.topics.keys()];
  if (!list.length) return setView(`<div class="card"><p>Темы не найдены</p></div>`);
  setView(`
    <div class="card"><h3>Темы</h3>
      ${list.map((t) => `<button class="answer" data-t="${t}">${t}</button>`).join("")}
    </div>
  `);
}

function uiTickets() {
  const tickets = [...State.byTicket.keys()].sort((a, b) => a - b);
  if (!tickets.length) return setView(`<div class="card"><p>Билеты не найдены</p></div>`);
  setView(`
    <div class="card"><h3>Билеты</h3>
      ${tickets.map((n) => `<button class="answer" data-n="${n}">Билет ${n}</button>`).join("")}
    </div>
  `);
}

// === СТАРТ ВИКТОРИНЫ ===
function startDuel({ mode = "quick", topic = null } = {}) {
  const src = topic ? State.topics.get(topic) || [] : State.pool;
  const questions = shuffle(src).slice(0, 20);
  State.duel = { q: questions, i: 0, me: 0, mode, topic };
  renderQuestion();
}

function startTicket(n) {
  const arr = State.byTicket.get(n) || [];
  if (!arr.length) return setView(`<div class="card"><p>Билет ${n} пуст</p></div>`);
  State.duel = { q: shuffle(arr).slice(0, 20), i: 0, me: 0, mode: "ticket", topic: null };
  renderQuestion();
}

// === ОТРИСОВКА ВОПРОСА ===
function renderQuestion() {
  const d = State.duel;
  const q = d.q[d.i];
  const total = d.q.length;

  setView(`
    <div class="card">
      <div class="meta">Вопрос ${d.i + 1}/${total}${q.ticket ? " • Билет " + q.ticket : ""}</div>
      <h3>${q.question}</h3>
      ${q.image ? `<img src="${q.image}" class="qimg"/>` : ""}
      <div class="grid">
        ${q.answers.map((a, i) => `<button class="answer" data-i="${i}">${a}</button>`).join("")}
      </div>
      <div id="tip" class="meta" style="display:none;margin-top:8px;color:#ccc">
        💡 ${q.tip}
      </div>
    </div>
  `);
}

// === ЛОГИКА ОТВЕТОВ ===
function onAnswer(i) {
  if (State.lock) return;
  const d = State.duel;
  const q = d.q[d.i];
  const correct = q.correctIndex;

  State.lock = true;
  const answers = document.querySelectorAll(".answer");

  console.log("🧩 Вопрос:", q.question);
  console.log("✅ Правильный индекс:", correct, "Клик:", i);

  answers.forEach((btn, idx) => {
    btn.disabled = true;
    if (idx === correct) btn.classList.add("correct");
    else if (idx === i) btn.classList.add("wrong");
  });

  if (i === correct) {
    d.me++;
    toast("✅ Верно!");
  } else {
    toast("❌ Ошибка");
    document.querySelector("#tip").style.display = "block";
  }

  setTimeout(() => {
    State.lock = false;
    d.i++;
    if (d.i < d.q.length) renderQuestion();
    else finishDuel();
  }, 1200);
}

// === ЗАВЕРШЕНИЕ ===
function finishDuel() {
  const d = State.duel;
  setView(`
    <div class="card">
      <h3>🏁 Завершено!</h3>
      <p>Ты ответил верно на ${d.me} из ${d.q.length}</p>
      <div class="grid two">
        <button class="btn btn-primary" id="again">Ещё раз</button>
        <button class="btn" id="home">На главную</button>
      </div>
    </div>
  `);
}

// === УТИЛИТЫ ===
function toast(t) {
  const el = document.querySelector("#toast");
  el.innerHTML = `<div class="toast">${t}</div>`;
  el.style.opacity = 1;
  setTimeout(() => (el.style.opacity = 0), 1500);
}
function shuffle(a) {
  return a.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
}
