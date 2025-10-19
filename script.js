/* ======== НАСТРОЙКА ======== */
const REPO = "etspring/pdd_russia";
const BRANCH = "master";

/* ======== ЗАГРУЗКА ФАЙЛОВ ЧЕРЕЗ GITHUB API ======== */
const RAW = (p) =>
  `https://api.github.com/repos/${REPO}/contents/${p}?ref=${BRANCH}`;

async function fetchJsonFile(path) {
  try {
    const res = await fetch(RAW(path));
    if (!res.ok) throw new Error(`Ошибка загрузки ${path}`);
    const data = await res.json();
    const text = atob(data.content);
    return JSON.parse(text);
  } catch (err) {
    console.error("Ошибка при загрузке файла:", path, err);
    return null;
  }
}

/* ======== ГЛОБАЛЬНОЕ СОСТОЯНИЕ ======== */
const State = {
  pool: [],
  byTicket: new Map(),
  topics: new Map(),
  duel: null,
};

/* ======== ИНИЦИАЛИЗАЦИЯ ======== */
document.addEventListener("DOMContentLoaded", () => {
  bindUI();
  initApp();
});

async function initApp() {
  toast("📥 Загружаю реальные вопросы ПДД...");
  await loadAllData();
  toast(`✅ Загружено ${State.pool.length} вопросов, ${State.topics.size} тем`);
}

/* ======== КНОПКИ ======== */
function bindUI() {
  el("#btnQuickDuel").onclick = () => startDuel({ mode: "quick" });
  el("#btnTopics").onclick = () => showTopics();
  el("#btnTickets").onclick = () => showTickets();
  el("#btnStats").onclick = () =>
    toast("📊 Статистика работает только внутри Telegram WebApp");
}

/* ======== ЗАГРУЗКА ДАННЫХ ======== */
async function loadAllData() {
  const ticketsPaths = [
    "questions/tickets_A_B.json",
    "questions/tickets.json",
    "questions/tickets_C_D.json",
  ];

  const topicsPaths = ["questions/topics.json", "questions/topic.json"];

  const ticketsData = await loadFirstAvailable(ticketsPaths);
  const topicsData = await loadFirstAvailable(topicsPaths);

  const tickets = Array.isArray(ticketsData)
    ? ticketsData
    : ticketsData?.tickets || [];
  const topics = Array.isArray(topicsData)
    ? topicsData
    : topicsData?.topics || [];

  const normalized = normalizeQuestions(tickets);
  for (const q of normalized) {
    State.pool.push(q);
    if (q.ticket) {
      const arr = State.byTicket.get(q.ticket) || [];
      arr.push(q);
      State.byTicket.set(q.ticket, arr);
    }
    for (const t of q.topics) {
      const arr = State.topics.get(t) || [];
      arr.push(q);
      State.topics.set(t, arr);
    }
  }

  const normalizedTopics = normalizeQuestions(topics);
  for (const q of normalizedTopics) {
    if (!State.pool.find((x) => x.id === q.id)) State.pool.push(q);
    for (const t of q.topics) {
      const arr = State.topics.get(t) || [];
      if (!arr.find((x) => x.id === q.id)) arr.push(q);
      State.topics.set(t, arr);
    }
  }
}

async function loadFirstAvailable(paths) {
  for (const p of paths) {
    const data = await fetchJsonFile(p);
    if (data) return data;
  }
  return [];
}

/* ======== НОРМАЛИЗАЦИЯ ВОПРОСОВ ======== */
function normalizeQuestions(raw) {
  const out = [];
  for (const q of raw) {
    const answers = (q.answers || []).map(
      (a) => a.answer_text || a.text || String(a)
    );
    const correctIndex = (q.answers || []).findIndex(
      (a) => a.is_correct === true || a.correct === true
    );
    const topics = Array.isArray(q.topic)
      ? q.topic
      : q.topic
      ? [q.topic]
      : [];

    out.push({
      id: q.id || crypto.randomUUID(),
      question: q.question || q.title || "Без текста вопроса",
      answers: answers.length ? answers : ["Да", "Нет"],
      correctIndex: correctIndex >= 0 ? correctIndex : 0,
      ticket: q.ticket_number || q.ticket || null,
      topics,
      image: q.image || null,
      tip: q.answer_tip || q.tip || null,
    });
  }
  return out;
}

/* ======== ДУЭЛЬ ======== */
function startDuel({ mode, topic = null }) {
  const src = topic ? State.topics.get(topic) || [] : State.pool;
  if (!src.length) {
    toast("⚠️ Данные ещё не загружены");
    return;
  }

  const questions = shuffle(src).slice(0, 20);
  State.duel = { mode, topic, i: 0, me: 0, ai: 0, q: questions, timerMs: 25000 };
  renderQuestion();
}

function renderQuestion() {
  const d = State.duel,
    q = d.q[d.i];
  const screen = el("#screen");

  screen.innerHTML = `
    <div class="card">
      <div class="meta">
        <div>Вопрос ${d.i + 1}/${d.q.length}${
    q.ticket ? " • Билет " + q.ticket : ""
  }</div>
        <div class="timer"><div class="tbar" id="tbar"></div></div>
      </div>
      <h3>${escapeHtml(q.question)}</h3>
      ${q.image ? `<img class="qimg" src="${imgUrl(q.image)}"/>` : ""}
      <div class="grid">
        ${q.answers
          .map(
            (a, i) => `<div class="answer" data-i="${i}">${escapeHtml(a)}</div>`
          )
          .join("")}
      </div>
    </div>
  `;

  let left = d.timerMs;
  const bar = el("#tbar");
  const timer = setInterval(() => {
    left -= 50;
    bar.style.width = (100 * left) / d.timerMs + "%";
    if (left <= 0) {
      clearInterval(timer);
      finishAnswer(-1);
    }
  }, 50);

  elAll(".answer").forEach((el) => {
    el.onclick = () => {
      clearInterval(timer);
      finishAnswer(+el.dataset.i);
    };
  });

  function finishAnswer(i) {
    const correct = q.correctIndex;
    elAll(".answer").forEach((a, j) => {
      a.classList.add(j === correct ? "correct" : j === i ? "wrong" : "");
      a.style.pointerEvents = "none";
    });
    if (i === correct) {
      d.me++;
      toast("✅ Верно!");
    } else toast("❌ Ошибка");
    const ai = Math.random() < 0.85 ? correct : pickWrong(correct, q.answers.length);
    if (ai === correct) d.ai++;
    setTimeout(() => {
      d.i++;
      d.i < d.q.length ? renderQuestion() : finishDuel();
    }, 600);
  }
}

function finishDuel() {
  const d = State.duel;
  el("#screen").innerHTML = `
    <div class="card">
      <h3>${d.me > d.ai ? "🏆 Победа!" : d.me < d.ai ? "💀 Поражение" : "🤝 Ничья"}</h3>
      <p>Ты: ${d.me} • ИИ: ${d.ai}</p>
      <div class="grid two" style="margin-top:8px">
        <button class="btn btn-primary" id="again">Ещё раз</button>
        <button class="btn" id="home">На главную</button>
      </div>
    </div>`;
  el("#again").onclick = () => startDuel({ mode: d.mode, topic: d.topic });
  el("#home").onclick = () => (el("#screen").innerHTML = "");
}

/* ======== СПИСКИ ======== */
function showTopics() {
  const topics = [...State.topics.keys()].sort();
  if (!topics.length) return toast("❌ Темы не найдены");
  el("#screen").innerHTML = `
    <div class="card">
      <h3>Темы</h3>
      <div class="grid auto" style="margin-top:8px">
        ${topics
          .map((t) => `<div class="answer" data-t="${escapeHtml(t)}">${t}</div>`)
          .join("")}
      </div>
    </div>`;
  elAll("[data-t]").forEach(
    (e) => (e.onclick = () => startDuel({ mode: "topic", topic: e.dataset.t }))
  );
}

function showTickets() {
  const tickets = [...new Set(State.pool.map((q) => q.ticket).filter(Boolean))];
  if (!tickets.length) return toast("❌ Билеты не найдены");
  el("#screen").innerHTML = `
    <div class="card">
      <h3>Билеты</h3>
      <div class="grid auto" style="margin-top:8px">
        ${tickets
          .map((t) => `<div class="answer" data-n="${t}">Билет ${t}</div>`)
          .join("")}
      </div>
    </div>`;
  elAll("[data-n]").forEach(
    (e) => (e.onclick = () => startTicket(+e.dataset.n))
  );
}

function startTicket(num) {
  const arr = State.pool.filter((q) => q.ticket === num);
  if (!arr.length) return toast("Нет данных по билету");
  State.duel = { mode: "ticket", topic: null, i: 0, me: 0, ai: 0, q: shuffle(arr).slice(0, 20), timerMs: 25000 };
  renderQuestion();
}

/* ======== УТИЛИТЫ ======== */
const el = (s) => document.querySelector(s);
const elAll = (s) => [...document.querySelectorAll(s)];
function toast(text) {
  const t = el("#toast");
  t.innerHTML = `<div class="toast">${escapeHtml(text)}</div>`;
  t.style.opacity = 1;
  setTimeout(() => (t.style.opacity = 0), 1500);
}
function shuffle(a) {
  return a.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
}
function pickWrong(c, n) {
  const arr = [...Array(n).keys()].filter((i) => i !== c);
  return arr[Math.floor(Math.random() * arr.length)];
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
function imgUrl(p) {
  const clean = p.replace(/^\.\//, "").replace(/^\//, "");
  return `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${clean}`;
}
