/* ===== Параметры репозитория ===== */
const REPO = "etspring/pdd_russia";
const BRANCH = "master";

/* ===== Зеркала для загрузки JSON/картинок =====
   1) jsDelivr  (обычно работает в Telegram WebView)
   2) raw.githubusercontent (классический RAW)
   3) GitHub API (JSON base64) — как последний fallback
*/
const MIRRORS_JSON = [
  (p) => `https://cdn.jsdelivr.net/gh/${REPO}@${BRANCH}/${p}`,
  (p) => `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${p}`,
  (p) => `https://api.github.com/repos/${REPO}/contents/${p}?ref=${BRANCH}`, // спец. обработка
];
const MIRROR_IMG = (p) => `https://cdn.jsdelivr.net/gh/${REPO}@${BRANCH}/${p}`;

/* ===== Глобальное состояние ===== */
const State = {
  pool: [],
  byTicket: new Map(),
  topics: new Map(),
  duel: null,
};

/* ===== DOM Ready ===== */
document.addEventListener("DOMContentLoaded", () => {
  bindUI();
  initApp();
});

async function initApp() {
  toast("📥 Загружаю реальные вопросы ПДД…");
  try {
    await loadAllData();
    toast(`✅ Готово! Вопросов: ${State.pool.length}, тем: ${State.topics.size}`);
  } catch (e) {
    console.error(e);
    toast("❌ Не удалось загрузить данные. Проверь интернет/Telegram.");
  }
}

/* ===== Кнопки ===== */
function bindUI() {
  qs("#btnQuickDuel").onclick = () => startDuel({ mode: "quick" });
  qs("#btnTopics").onclick = () => showTopics();
  qs("#btnTickets").onclick = () => showTickets();
  qs("#btnStats").onclick = () =>
    toast("📊 Статистика доступна при открытии через Telegram WebApp");
}

/* ===== Загрузка данных ===== */
async function loadAllData() {
  // Точки входа (поддерживаем разные структуры репозитория)
  const ticketCandidates = [
    "questions/tickets_A_B.json",
    "questions/tickets.json",
    "questions/tickets_C_D.json",
  ];
  const topicCandidates = ["questions/topics.json", "questions/topic.json"];

  const ticketsRaw = await fetchFirstJson(ticketCandidates);
  const topicsRaw = await fetchFirstJson(topicCandidates); // может отсутствовать — ок

  const tickets = Array.isArray(ticketsRaw)
    ? ticketsRaw
    : ticketsRaw?.tickets || ticketsRaw?.data || [];

  const topics = Array.isArray(topicsRaw)
    ? topicsRaw
    : topicsRaw?.topics || topicsRaw?.data || topicsRaw?.topic || [];

  // нормализация
  const t1 = normalizeQuestions(tickets);
  for (const q of t1) {
    State.pool.push(q);
    if (q.ticket != null) {
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

  const t2 = normalizeQuestions(topics);
  for (const q of t2) {
    if (!State.pool.find((x) => x.id === q.id)) State.pool.push(q);
    for (const t of q.topics) {
      const arr = State.topics.get(t) || [];
      if (!arr.find((x) => x.id === q.id)) arr.push(q);
      State.topics.set(t, arr);
    }
  }
}

/* Загружаем JSON, пробуя зеркала по очереди */
async function fetchFirstJson(paths) {
  for (const path of paths) {
    // 1 и 2 зеркала — сразу как текст JSON
    for (let i = 0; i < 2; i++) {
      try {
        const url = MIRRORS_JSON[i](path) + `?nocache=${Date.now()}`;
        const r = await fetch(url, { cache: "no-store" });
        if (r.ok) return await r.json();
      } catch {}
    }
    // 3-е зеркало — GitHub API (content base64)
    try {
      const url = MIRRORS_JSON[2](path);
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw 0;
      const data = await r.json();
      if (data && data.content) {
        const text = atob(data.content);
        return JSON.parse(text);
      }
    } catch {}
  }
  return []; // не нашли — вернём пусто, дальше корректно обработаем
}

/* Нормализация формата вопросов к общему виду */
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
      question: q.question || q.title || "Вопрос",
      answers: answers.length ? answers : ["Да", "Нет", "Не знаю"],
      correctIndex: correctIndex >= 0 ? correctIndex : 0,
      ticket: q.ticket_number ?? q.ticket ?? null,
      topics,
      image: q.image || null,
      tip: q.answer_tip || q.tip || null,
    });
  }
  return out;
}

/* ===== Дуэль / Викторина ===== */
function startDuel({ mode, topic = null }) {
  const src = topic ? State.topics.get(topic) || [] : State.pool;
  if (!src.length) return toast("⚠️ Данные ещё не загружены");

  const questions = shuffle(src).slice(0, 20); // 20 вопросов
  State.duel = { mode, topic, i: 0, me: 0, ai: 0, q: questions, timerMs: 25000 };
  renderQuestion();
}

function renderQuestion() {
  const d = State.duel;
  const q = d.q[d.i];
  const container = qs("#screen");
  container.innerHTML = `
    <div class="card">
      <div class="meta">
        <div>Вопрос ${d.i + 1}/${d.q.length}${
    q.ticket != null ? " • Билет " + escape(q.ticket) : ""
  }</div>
        <div class="timer"><div class="tbar" id="tbar"></div></div>
      </div>
      <h3>${escape(q.question)}</h3>
      ${q.image ? `<img class="qimg" src="${imageUrl(q.image)}" alt=""/>` : ""}
      <div class="grid">
        ${q.answers
          .map((a, i) => `<div class="answer" data-i="${i}">${escape(a)}</div>`)
          .join("")}
      </div>
      ${q.tip ? `<div class="meta" style="margin-top:8px"><span>Подсказка:</span><span>${escape(q.tip)}</span></div>` : ""}
      <div class="meta" style="margin-top:6px">
        <div>Ты: <b>${d.me}</b></div><div>ИИ: <b>${d.ai}</b></div>
      </div>
    </div>
  `;

  // таймер
  let left = d.timerMs;
  const bar = qs("#tbar");
  const t = setInterval(() => {
    left -= 50;
    bar.style.width = Math.max(0, (100 * left) / d.timerMs) + "%";
    if (left <= 0) {
      clearInterval(t);
      finish(-1);
    }
  }, 50);

  qsa(".answer").forEach((el) => {
    el.onclick = () => {
      clearInterval(t);
      finish(+el.dataset.i);
    };
  });

  function finish(i) {
    const correct = q.correctIndex;
    qsa(".answer").forEach((el, j) => {
      el.classList.add(j === correct ? "correct" : j === i ? "wrong" : "");
      el.style.pointerEvents = "none";
    });
    if (i === correct) {
      d.me++;
      toast("✅ Верно!");
    } else toast("❌ Ошибка");

    // ИИ (85% точность)
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
  qs("#screen").innerHTML = `
    <div class="card">
      <h3>${d.me > d.ai ? "🏆 Победа!" : d.me < d.ai ? "💀 Поражение" : "🤝 Ничья"}</h3>
      <p style="margin:6px 0 0">Ты: <b>${d.me}</b> • ИИ: <b>${d.ai}</b></p>
      <div class="grid two" style="margin-top:10px">
        <button class="btn btn-primary" id="again">Ещё раз</button>
        <button class="btn" id="home">На главную</button>
      </div>
    </div>`;
  qs("#again").onclick = () => startDuel({ mode: d.mode, topic: d.topic });
  qs("#home").onclick = () => (qs("#screen").innerHTML = "");
}

/* ===== Темы / Билеты ===== */
function showTopics() {
  const list = [...State.topics.keys()].sort();
  if (!list.length) return toast("❌ Темы не найдены");
  qs("#screen").innerHTML = `
    <div class="card">
      <h3>Темы</h3>
      <div class="grid auto" style="margin-top:8px">
        ${list.map((t) => `<div class="answer" data-t="${escape(t)}">${escape(t)}</div>`).join("")}
      </div>
    </div>`;
  qsa("[data-t]").forEach((e) => (e.onclick = () => startDuel({ mode: "topic", topic: e.dataset.t })));
}

function showTickets() {
  const list = [...new Set(State.pool.map((q) => q.ticket).filter((x) => x != null))].sort((a,b)=>a-b);
  if (!list.length) return toast("❌ Билеты не найдены");
  qs("#screen").innerHTML = `
    <div class="card">
      <h3>Билеты</h3>
      <div class="grid auto" style="margin-top:8px">
        ${list.map((t) => `<div class="answer" data-n="${t}">Билет ${t}</div>`).join("")}
      </div>
    </div>`;
  qsa("[data-n]").forEach((e) => (e.onclick = () => startTicket(+e.dataset.n)));
}

function startTicket(n) {
  const arr = State.pool.filter((q) => q.ticket === n);
  if (!arr.length) return toast("Нет вопросов для этого билета");
  State.duel = { mode: "ticket", topic: null, i: 0, me: 0, ai: 0, q: shuffle(arr).slice(0, 20), timerMs: 25000 };
  renderQuestion();
}

/* ===== Утилиты ===== */
const qs = (s) => document.querySelector(s);
const qsa = (s) => [...document.querySelectorAll(s)];
function toast(text){ const t=qs("#toast"); t.innerHTML=`<div class="toast">${escape(text)}</div>`; t.style.opacity=1; setTimeout(()=>t.style.opacity=0,1500); }
function escape(s){ return String(s).replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m])); }
function shuffle(a){ return a.map(x=>[Math.random(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]); }
function pickWrong(c,n){ const arr=[...Array(n).keys()].filter(i=>i!==c); return arr[Math.floor(Math.random()*arr.length)]; }
function imageUrl(p){ if(!p) return ""; const clean=String(p).replace(/^\.\//,"").replace(/^\//,""); return MIRROR_IMG(clean); }
