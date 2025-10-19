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
  setLoader(10);
  await loadTickets((p) => setLoader(10 + p * 70));
  setLoader(100);
  setTimeout(() => showLoader(false), 300);
  renderHome();
}

// === ЛОАДЕР ===
function showLoader(v) { qs("#loader").classList.toggle("hidden", !v); }
function setLoader(p) { qs("#loaderBar").style.width = Math.min(100, p) + "%"; }

// === МЕНЮ ===
function bindMenu() {
  qsa(".menu [data-action]").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      const act = e.currentTarget.dataset.action;
      if (act === "quick") startDuel({ mode: "quick" });
      if (act === "topics") uiTopics();
      if (act === "tickets") uiTickets();
    })
  );
}

// === НАВИГАЦИЯ ===
function setView(html) {
  const host = qs("#screen");
  host.innerHTML = `<div class="view fadein">${html}</div>`;
}
function renderHome() {
  setView(`<div class="card"><h3>Меню</h3><p>⚡ Быстрая дуэль, 📚 Темы, 🎟️ Билеты</p></div>`);
}

// === КЛИКИ ===
function bindDelegation() {
  const scr = qs("#screen");
  ["pointerup","click","touchend"].forEach(ev =>
    scr.addEventListener(ev, handleTap, { passive: false })
  );
}
function handleTap(e) {
  const ans = e.target.closest(".answer");
  if (ans && ans.dataset.i != null) { onAnswer(+ans.dataset.i); return; }
  const ticket = e.target.closest("[data-n]");
  if (ticket) { startTicket(+ticket.dataset.n); return; }
  const topic = e.target.closest("[data-t]");
  if (topic) { startDuel({ mode:"topic", topic: topic.dataset.t }); return; }
  if (e.target.id === "again") startDuel(State.duel);
  if (e.target.id === "home") renderHome();
}

// === ЗАГРУЗКА ===
async function loadTickets(onProgress) {
  const TOTAL = 40; let loaded = 0;
  const all = [];
  for (let i = 1; i <= TOTAL; i++) {
    try {
      const r = await fetch(`questions/A_B/tickets/Билет%20${i}.json`);
      if (!r.ok) continue;
      const data = await r.json();
      const arr = Array.isArray(data) ? data : data.questions || [];
      all.push(...arr);
    } catch {}
    onProgress(++loaded / TOTAL);
  }
  const norm = normalizeQuestions(all);
  for (const q of norm) {
    State.pool.push(q);
    (State.byTicket.get(q.ticket) ??= []).push(q);
    for (const t of q.topics) (State.topics.get(t) ??= []).push(q);
  }
  console.log("✅ Загружено:", State.pool.length);
}

// === НОРМАЛИЗАЦИЯ ===
function normalizeQuestions(raw) {
  const out = [];
  for (const q of raw) {
    const answersRaw = q.answers || [];
    const answers = answersRaw.map(a => a.answer_text || a.text || a.title || "");
    let correctIndex = answersRaw.findIndex(a => a.is_correct);
    if (correctIndex < 0 && typeof q.correct_answer === "string") {
      const m = q.correct_answer.match(/\d+/);
      if (m) correctIndex = parseInt(m[0]) - 1;
    }
    if (correctIndex < 0) correctIndex = 0;

    let ticket = 0; const m2 = String(q.ticket_number||"").match(/\d+/);
    if (m2) ticket = parseInt(m2[0]);
    let image = (q.image || "").replace(/^\.\//,"");
    if (image && !image.startsWith("images/")) image = "images/" + image;

    out.push({
      question: q.question || q.title,
      answers, correctIndex,
      tip: q.answer_tip || "", ticket,
      topics: Array.isArray(q.topic) ? q.topic : q.topic ? [q.topic] : [],
      image
    });
  }
  return out;
}

// === ЭКРАНЫ ===
function uiTopics() {
  const list = [...State.topics.keys()];
  if (!list.length) return setView(`<div class="card"><p>Темы не найдены</p></div>`);
  setView(`<div class="card"><h3>Темы</h3>${list.map(t=>`<button class="answer" data-t="${t}">${t}</button>`).join("")}</div>`);
}
function uiTickets() {
  const ids = [...State.byTicket.keys()].sort((a,b)=>a-b);
  if (!ids.length) return setView(`<div class="card"><p>Билеты не найдены</p></div>`);
  setView(`<div class="card"><h3>Билеты</h3>${ids.map(n=>`<button class="answer" data-n="${n}">Билет ${n}</button>`).join("")}</div>`);
}

// === ВИКТОРИНА ===
function startDuel({mode="quick",topic=null}={}) {
  const src = topic ? (State.topics.get(topic)||[]) : State.pool;
  const q = shuffle(src).slice(0,20);
  State.duel = { q, i:0, me:0 };
  renderQuestion();
}
function startTicket(n) {
  const arr = State.byTicket.get(n)||[];
  if(!arr.length) return setView(`<div class="card"><p>Билет ${n} пуст</p></div>`);
  State.duel = { q: arr.slice(0,20), i:0, me:0 };
  renderQuestion();
}
function renderQuestion() {
  const d = State.duel; const q = d.q[d.i];
  setView(`
    <div class="card">
      <div class="meta">Вопрос ${d.i+1}/${d.q.length} • Билет ${q.ticket}</div>
      <h3>${q.question}</h3>
      ${q.image?`<img src="${q.image}" class="qimg"/>`:""}
      <div class="grid">${q.answers.map((a,i)=>`<button class="answer" data-i="${i}">${a}</button>`).join("")}</div>
      <div id="tip" class="meta" style="display:none;margin-top:8px;color:#ccc">💡 ${q.tip}</div>
    </div>`);
  State.lock = false;
}

// === ОТВЕТ ===
function onAnswer(i){
  if(State.lock) return;
  State.lock = true;
  const d = State.duel, q = d.q[d.i], correct = q.correctIndex;
  console.log("click", i, "correct", correct);
  const btns = qsa(".answer");
  btns.forEach((b,idx)=>{
    b.disabled=true;
    if(idx===correct)b.classList.add("correct");
    else if(idx===i)b.classList.add("wrong");
  });
  if(i===correct){ d.me++; toast("✅ Верно!"); }
  else { toast("❌ Ошибка"); qs("#tip").style.display="block"; }

  // 🔥 разблокировка и переход (гарантированный)
  setTimeout(()=>{ State.lock=false; d.i++; if(d.i<d.q.length) renderQuestion(); else finishDuel(); }, 1100);
}

// === ФИНИШ ===
function finishDuel(){
  const d=State.duel;
  setView(`<div class="card"><h3>🏁 Конец!</h3>
    <p>Правильных ответов: ${d.me} из ${d.q.length}</p>
    <div class="grid two">
      <button class="btn btn-primary" id="again">Ещё раз</button>
      <button class="btn" id="home">Главная</button>
    </div></div>`);
}

// === УТИЛИТЫ ===
const qs=s=>document.querySelector(s);
const qsa=s=>[...document.querySelectorAll(s)];
function shuffle(a){return a.map(x=>[Math.random(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);}
function toast(t){const el=qs("#toast");el.innerHTML=`<div class="toast">${t}</div>`;el.style.opacity=1;setTimeout(()=>el.style.opacity=0,1500);}
