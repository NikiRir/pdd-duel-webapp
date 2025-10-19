// ===================== ГЛОБАЛЬНОЕ СОСТОЯНИЕ =====================
const State = {
  pool: [],
  byTicket: new Map(),
  topics: new Map(),
  penalties: null,
  markup: null,
  duel: null,
  lock: false
};

// ===================== ЗАПУСК =====================
document.addEventListener("DOMContentLoaded", () => {
  bindMenu();
  bindScreenDelegation();
  boot();
});

async function boot() {
  showLoader(true);
  setLoader(10);
  await loadTicketsAndBuildTopics(p => setLoader(10 + p * 60));
  await Promise.all([loadPenalties(), loadMarkup()]);
  setLoader(100);
  setTimeout(() => showLoader(false), 400);
  renderHome();
}

// ===================== ЛОАДЕР =====================
function showLoader(v) { qs("#loader").classList.toggle("hidden", !v); }
function setLoader(p) { qs("#loaderBar").style.width = Math.min(100, p) + "%"; }

// ===================== МЕНЮ =====================
function bindMenu() {
  qsa(".menu [data-action]").forEach(btn => {
    btn.addEventListener("click", e => {
      const act = e.currentTarget.dataset.action;
      setActive(e.currentTarget.id);
      if (act === "quick") startDuel({ mode: "quick" });
      if (act === "topics") uiTopics();
      if (act === "tickets") uiTickets();
      if (act === "markup") uiMarkup();
      if (act === "penalties") uiPenalties();
      if (act === "stats") uiStats();
    });
  });
}

function setActive(id) {
  qsa(".menu .btn").forEach(b => b.classList.remove("active"));
  if (id) qs("#" + id)?.classList.add("active");
}

// ===================== НАВИГАЦИЯ =====================
function setView(html) {
  const host = qs("#screen");
  host.scrollTop = 0;
  host.replaceChildren();
  const view = document.createElement("div");
  view.className = "view";
  view.innerHTML = html;
  host.appendChild(view);
}

function renderHome() {
  setActive(null);
  setView(`
    <div class="card">
      <h3>Выбери режим сверху</h3>
      <p style="margin:.35rem 0 0;color:var(--muted)">
        Быстрая дуэль, Темы, Билеты, Разметка, Штрафы.
      </p>
    </div>
  `);
}

// ===================== ДЕЛЕГИРОВАНИЕ КЛИКОВ =====================
function bindScreenDelegation() {
  const screen = qs("#screen");
  screen.addEventListener("click", e => {
    const a = e.target.closest(".answer");
    if (a && a.dataset.i != null) return onAnswerClick(+a.dataset.i);
    const ticket = e.target.closest("[data-n]");
    if (ticket) return startTicket(+ticket.dataset.n);
    const topic = e.target.closest("[data-t]");
    if (topic) return startDuel({ mode: "topic", topic: topic.dataset.t });
    if (e.target.id === "again") return startDuel({ mode: State.duel.mode, topic: State.duel.topic });
    if (e.target.id === "home") return renderHome();
    if (e.target.id === "retryMarkup") { State.markup = null; uiMarkup(); }
    if (e.target.id === "retryPen") { State.penalties = null; uiPenalties(); }
  }, { passive: true });
}

// ===================== ЗАГРУЗКА ДАННЫХ =====================
async function loadTicketsAndBuildTopics(onProgress) {
  const TOTAL = 40;
  let loaded = 0;
  const step = () => onProgress && onProgress(++loaded / TOTAL);
  const raw = [];

  for (let i = 1; i <= TOTAL; i++) {
    const names = [`Билет ${i}.json`, `${i}.json`, `ticket_${i}.json`];
    for (const name of names) {
      try {
        const r = await fetch(`questions/A_B/tickets/${name}`);
        if (!r.ok) continue;
        const data = await r.json();
        const arr = Array.isArray(data) ? data : data.questions || [];
        for (const q of arr) q.ticket_number ??= i;
        raw.push(...arr);
        break;
      } catch {}
    }
    step();
  }

  const norm = normalizeQuestions(raw);
  for (const q of norm) {
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
}

async function loadPenalties() {
  try {
    const r = await fetch("penalties/penalties.json");
    if (!r.ok) return;
    const j = await r.json();
    State.penalties = Array.isArray(j) ? j : j.penalties || j.items || [];
  } catch {}
}

async function loadMarkup() {
  try {
    const r = await fetch("markup/markup.json");
    if (!r.ok) return;
    const j = await r.json();
    const arr = Array.isArray(j) ? j : j.markup || j.items || [];
    State.markup = arr.map((x, i) => ({
      id: x.id ?? i + 1,
      title: x.title || x.name || `Элемент ${i + 1}`,
      image: x.image || x.src || ""
    }));
  } catch {}
}

// ===================== НОРМАЛИЗАЦИЯ =====================
function normalizeQuestions(raw) {
  return raw.map((q, i) => {
    const answers = (q.answers || []).map(a => a.text || a.answer_text || String(a));
    let correctIndex = (q.answers || []).findIndex(a => a.is_correct || a.correct);
    if (correctIndex < 0 && typeof q.correct === "number") correctIndex = q.correct - 1;
    if (correctIndex < 0) correctIndex = 0;
    return {
      id: q.id || i,
      question: q.question || q.title || "Без текста",
      answers,
      correctIndex,
      ticket: q.ticket_number || q.ticket,
      topics: Array.isArray(q.topic) ? q.topic : q.topic ? [q.topic] : [],
      image: q.image || null,
      tip: q.answer_tip || q.tip || null
    };
  });
}

// ===================== ЭКРАНЫ =====================
function uiTopics() {
  const list = [...State.topics.keys()];
  if (!list.length) return setView(`<div class="card"><p>Темы не найдены</p></div>`);
  setView(`
    <div class="card"><h3>Темы</h3></div>
    <div class="card"><div class="grid auto">
      ${list.map(t => `<div class="answer" data-t="${esc(t)}">${esc(t)}</div>`).join("")}
    </div></div>
  `);
}

function uiTickets() {
  const arr = [...State.byTicket.keys()];
  if (!arr.length) return setView(`<div class="card"><p>Билеты не найдены</p></div>`);
  setView(`
    <div class="card"><h3>Билеты</h3></div>
    <div class="card"><div class="grid auto">
      ${arr.map(n => `<div class="answer" data-n="${n}">Билет ${n}</div>`).join("")}
    </div></div>
  `);
}

function uiMarkup() {
  if (!State.markup?.length)
    return setView(`<div class="card"><p>⚠️ Разметка не найдена</p>
      <button class="btn" id="retryMarkup">Перезагрузить</button></div>`);
  setView(`
    <div class="card"><h3>Разметка</h3></div>
    <div class="card"><div class="grid auto">
      ${State.markup.map(m => `
        <div class="row">
          ${m.image ? `<img src="images/markup/${m.image}" style="width:80px;height:50px;object-fit:contain;border-radius:8px;border:1px solid rgba(255,255,255,.1)" />` : ""}
          <div>${esc(m.title)}</div>
        </div>`).join("")}
    </div></div>
  `);
}

function uiPenalties() {
  if (!State.penalties?.length)
    return setView(`<div class="card"><p>⚠️ Штрафы не найдены</p>
      <button class="btn" id="retryPen">Перезагрузить</button></div>`);
  setView(`
    <div class="card"><h3>Штрафы</h3></div>
    <div class="card"><div class="grid">
      ${State.penalties.slice(0, 100).map(p => `
        <div class="row">
          <div><b>${esc(p.title || p.name || "Нарушение")}</b></div>
          <div class="badge">💸 ${esc(p.fine || p.amount || "—")}</div>
        </div>`).join("")}
    </div></div>
  `);
}

function uiStats() {
  setView(`<div class="card"><h3>Статистика</h3><p>В будущем — твои результаты, победы и темы.</p></div>`);
}

// ===================== ДУЭЛЬ =====================
function startDuel({ mode, topic = null }) {
  const src = topic ? State.topics.get(topic) || [] : State.pool;
  if (!src.length) return setView(`<div class="card"><p>⚠️ Нет данных</p></div>`);
  State.duel = { mode, topic, q: shuffle(src).slice(0, 20), i: 0, me: 0, ai: 0 };
  renderQuestion();
}

function startTicket(n) {
  const arr = State.byTicket.get(n) || [];
  if (!arr.length) return setView(`<div class="card"><p>Билет ${n} пуст</p></div>`);
  State.duel = { mode: "ticket", topic: null, q: shuffle(arr).slice(0, 20), i: 0, me: 0, ai: 0 };
  renderQuestion();
}

function renderQuestion() {
  const d = State.duel, q = d.q[d.i];
  setView(`
    <div class="card fade">
      <div class="meta">
        <div>Вопрос ${d.i + 1}/${d.q.length}${q.ticket ? " • Билет " + q.ticket : ""}</div>
      </div>
      <h3>${esc(q.question)}</h3>
      ${q.image ? `<img class="qimg" src="images/A_B/${q.image}" />` : ""}
      <div class="grid">
        ${q.answers.map((a, i) => `<div class="answer" data-i="${i}">${esc(a)}</div>`).join("")}
      </div>
      <div id="tip" class="meta" style="display:none;margin-top:8px">
        <span class="badge">💡 Подсказка:</span><span>${esc(q.tip || "нет подсказки")}</span>
      </div>
    </div>
  `);
}

function onAnswerClick(i) {
  if (State.lock) return;
  State.lock = true;
  const d = State.duel, q = d.q[d.i], correct = q.correctIndex ?? 0;
  const all = qsa(".answer");
  all.forEach((a, idx) => {
    a.classList.add(idx === correct ? "correct" : idx === i ? "wrong" : "");
    a.style.pointerEvents = "none";
  });

  if (i === correct) {
    d.me++;
    toast("✅ Верно!");
  } else {
    toast("❌ Ошибка");
    qs("#tip").style.display = "flex";
  }

  setTimeout(() => {
    State.lock = false;
    d.i++;
    if (d.i < d.q.length) renderQuestion();
    else finishDuel();
  }, 900);
}

function finishDuel() {
  const d = State.duel;
  setView(`
    <div class="card">
      <h3>${d.me > d.ai ? "🏆 Победа!" : "🤝 Завершено"}</h3>
      <p>Ты ответил верно на ${d.me} из ${d.q.length}</p>
      <div class="grid two" style="margin-top:12px">
        <button class="btn btn-primary" id="again">Ещё раз</button>
        <button class="btn" id="home">На главную</button>
      </div>
    </div>
  `);
}

// ===================== УТИЛИТЫ =====================
const qs = s => document.querySelector(s);
const qsa = s => [...document.querySelectorAll(s)];
function toast(t) {
  const el = qs("#toast");
  el.innerHTML = `<div class="toast">${t}</div>`;
  el.style.opacity = 1;
  setTimeout(() => (el.style.opacity = 0), 1200);
}
function shuffle(a) { return a.map(x => [Math.random(), x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]); }
function esc(s) { return String(s).replace(/[&<>"']/g, m => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" }[m])); }
