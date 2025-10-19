/* =========================================================
   ГЛОБАЛЬНОЕ СОСТОЯНИЕ + НАВИГАЦИЯ
========================================================= */
const State = {
  pool: [],
  byTicket: new Map(),
  topics: new Map(),
  penalties: null,
  markup: null,
  duel: null
};

document.addEventListener("DOMContentLoaded", () => {
  bindMenu();
  boot();
});

async function boot(){
  // Показать лоадер
  showLoader(true);
  setLoaderProgress(8);

  // Загружаем локальные данные
  await loadTicketsAndBuildTopics(p => setLoaderProgress(8 + Math.floor(p*70))); // до 78%
  await Promise.all([
    loadPenalties().then(()=>setLoaderProgress(88)),
    loadMarkup().then(()=>setLoaderProgress(96))
  ]);

  // Спрятать лоадер
  setLoaderProgress(100);
  setTimeout(()=> showLoader(false), 250);

  // Пустой стартовый экран
  renderHome();
}

/* ===== Экран/Навигация (всегда заменяем полностью) ===== */
function setView(html){
  const screen = qs("#screen");
  screen.innerHTML = `<div class="view">${html}</div>`;
}

function renderHome(){
  setActive(null);
  setView(`
    <div class="card">
      <h3>Выбери режим сверху</h3>
      <p style="margin:.4rem 0 0;color:var(--muted)">Быстрая дуэль, Темы, Билеты, Разметка, Штрафы.</p>
    </div>
  `);
}

function setActive(id){
  qsa(".menu .btn").forEach(b=>b.classList.remove("active"));
  if(id) qs("#"+id)?.classList.add("active");
}

/* =========================================================
   ЗАГРУЗКА ДАННЫХ (локально)
========================================================= */
async function loadTicketsAndBuildTopics(onProgress){
  const ALL = 40;
  let loaded = 0;
  const add = v => { loaded+=v; if (onProgress) onProgress(loaded/ALL); };

  const raw = [];
  for (let i=1;i<=ALL;i++){
    const variants = [
      `Билет ${i}.json`,
      `Билет_${i}.json`,
      `${i}.json`,
      `ticket_${i}.json`,
      `Ticket_${i}.json`
    ];
    let ok=false;
    for(const name of variants){
      const url = `questions/A_B/tickets/${encodeURIComponent(name)}`;
      try{
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) continue;
        const data = await r.json();
        const list = Array.isArray(data) ? data : (data.questions || []);
        for (const q of list) if (q.ticket_number == null) q.ticket_number = i;
        raw.push(...list);
        ok=true; break;
      }catch{/* next variant */}
    }
    add(1);
  }

  const norm = normalizeQuestions(raw);
  for (const q of norm){
    State.pool.push(q);
    if (q.ticket != null){
      const b = State.byTicket.get(q.ticket) || [];
      b.push(q); State.byTicket.set(q.ticket, b);
    }
    for (const t of q.topics){
      const a = State.topics.get(t) || [];
      a.push(q); State.topics.set(t, a);
    }
  }
}

async function loadPenalties(){
  try{
    const r = await fetch("penalties/penalties.json", { cache: "no-store" });
    if(!r.ok) return;
    const data = await r.json();
    State.penalties = Array.isArray(data) ? data : (data.penalties || data.items || []);
  }catch{/* ok */}
}
async function loadMarkup(){
  try{
    const r = await fetch("markup/markup.json", { cache: "no-store" });
    if(!r.ok) return;
    const data = await r.json();
    const list = Array.isArray(data) ? data : (data.items || data.markup || []);
    State.markup = list.map((x,i)=>({
      id: x.id ?? i+1,
      title: x.title || x.name || x.caption || `Элемент ${i+1}`,
      image: x.image || x.src || x.path || ""
    }));
  }catch{/* ok */}
}

function normalizeQuestions(raw){
  const out=[];
  for(const q of raw){
    const answers = (q.answers || []).map(a => a.answer_text ?? a.text ?? String(a));
    const correctIndex = (q.answers || []).findIndex(a => a.is_correct===true || a.correct===true || a.isRight===true);
    const topics = Array.isArray(q.topic) ? q.topic : (q.topic ? [q.topic] : []);
    out.push({
      id: q.id ?? crypto.randomUUID(),
      question: q.question ?? q.title ?? "Вопрос",
      answers: answers.length ? answers : ["Да","Нет","Не знаю"],
      correctIndex: Number.isInteger(correctIndex) && correctIndex >= 0 ? correctIndex : 0,
      ticket: q.ticket_number ?? q.ticket ?? null,
      topics,
      image: q.image ?? q.img ?? null,
      tip: q.answer_tip ?? q.tip ?? null
    });
  }
  return out;
}

/* =========================================================
   МЕНЮ/ЭКРАНЫ
========================================================= */
function bindMenu(){
  qs("#btnQuickDuel").onclick = () => { setActive("btnQuickDuel"); startDuel({mode:"quick"}); };
  qs("#btnTopics").onclick    = () => { setActive("btnTopics");    uiTopics(); };
  qs("#btnTickets").onclick   = () => { setActive("btnTickets");   uiTickets(); };
  qs("#btnMarkup").onclick    = () => { setActive("btnMarkup");    uiMarkup(); };
  qs("#btnPenalties").onclick = () => { setActive("btnPenalties"); uiPenalties(); };
  qs("#btnStats").onclick     = () => { setActive("btnStats");     setView(`<div class="card"><h3>Статистика</h3><p>Открой через Telegram WebApp, чтобы связать результаты с профилем.</p></div>`); };
}

function uiTopics(){
  const list = [...State.topics.keys()].sort((a,b)=> a.localeCompare(b,'ru'));
  if(!list.length){ setView(`<div class="card"><h3>Темы</h3><p>❌ Темы не найдены</p></div>`); return; }
  setView(`
    <div class="card"><h3>Темы</h3></div>
    <div class="card">
      <div class="grid auto">
        ${list.map(t=>`<div class="answer" data-t="${esc(t)}">${esc(t)}</div>`).join("")}
      </div>
    </div>
  `);
  qsa("[data-t]").forEach(el => el.onclick = () => startDuel({mode:"topic", topic: el.dataset.t}));
}

function uiTickets(){
  const ids = [...new Set(State.pool.map(q=>q.ticket).filter(v=>v!=null))].sort((a,b)=>a-b);
  if(!ids.length){ setView(`<div class="card"><h3>Билеты</h3><p>❌ Билеты не найдены</p></div>`); return; }
  setView(`
    <div class="card"><h3>Билеты</h3></div>
    <div class="card">
      <div class="grid auto">
        ${ids.map(n=>`<div class="answer" data-n="${n}">Билет ${n}</div>`).join("")}
      </div>
    </div>
  `);
  qsa("[data-n]").forEach(el => el.onclick = () => startTicket(+el.dataset.n));
}

function uiMarkup(){
  if(!State.markup || !State.markup.length){
    setView(`<div class="card"><h3>Разметка</h3><p>⚠️ Разметка не найдена</p></div>`);
    return;
  }
  setView(`
    <div class="card"><h3>Дорожная разметка</h3></div>
    <div class="card">
      <div class="grid auto">
        ${State.markup.map(it=>`
          <div class="row">
            <div style="display:flex;gap:10px;align-items:center">
              ${it.image ? `<img src="${imgMarkup(it.image)}" alt="" style="width:84px;height:54px;object-fit:contain;background:#0b1021;border-radius:10px;border:1px solid rgba(255,255,255,.06)"/>` : ""}
              <div>
                <div style="font-weight:800">${esc(it.title)}</div>
                <div style="font-size:12px;color:var(--muted)">ID: ${esc(it.id)}</div>
              </div>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `);
}

function uiPenalties(){
  if(!State.penalties || !State.penalties.length){
    setView(`<div class="card"><h3>Штрафы</h3><p>⚠️ Штрафы не найдены</p></div>`);
    return;
  }
  setView(`
    <div class="card"><h3>Штрафы</h3></div>
    <div class="card">
      <input id="penq" placeholder="Поиск по описанию..." class="row" style="width:100%;outline:none;margin-bottom:10px"/>
      <div id="penlist" class="grid"></div>
    </div>
  `);
  const list = qs("#penlist");
  const draw = (query="")=>{
    const f = String(query).trim().toLowerCase();
    const items = State.penalties.filter(p=>{
      const text = String(p.title||p.name||p.description||"").toLowerCase();
      return !f || text.includes(f);
    });
    list.innerHTML = items.map(p=>`
      <div class="row">
        <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:0">
          <div style="font-weight:800">${esc(p.title||p.name||"Нарушение")}</div>
          ${p.article ? `<div class="badge">📜 Статья: ${esc(p.article)}</div>` : ""}
        </div>
        <div class="badge">💸 ${esc(p.fine||p.amount||p.penalty||"—")}</div>
      </div>
    `).join("");
  };
  draw();
  qs("#penq").oninput = e => draw(e.target.value);
}

/* =========================================================
   ДУЭЛЬ / ВИКТОРИНА
========================================================= */
function startDuel({mode, topic=null}){
  const src = topic ? (State.topics.get(topic)||[]) : State.pool;
  if(!src.length){ setView(`<div class="card"><h3>Дуэль</h3><p>⚠️ Данные не найдены</p></div>`); return; }

  const questions = shuffle(src).slice(0,20); // 20 вопросов
  State.duel = { mode, topic, i:0, me:0, ai:0, q:questions, showTip:false };
  renderQuestion();
}

function renderQuestion(){
  const d = State.duel, q = d.q[d.i];

  setView(`
    <div class="card">
      <div class="meta">
        <div>Вопрос ${d.i+1}/${d.q.length}${q.ticket!=null ? " • Билет "+esc(q.ticket) : ""}${d.topic ? " • Тема: "+esc(d.topic) : ""}</div>
        <div class="badge">⏱️ 25с</div>
      </div>
      <h3>${esc(q.question)}</h3>
      ${q.image ? `<img class="qimg" src="${imgQuestion(q.image)}" alt=""/>` : ""}
      <div class="grid">
        ${q.answers.map((a,idx)=>`<div class="answer" data-i="${idx}">${esc(a)}</div>`).join("")}
      </div>
      <div id="tip" class="meta" style="margin-top:10px;display:none">
        <span class="badge">💡 Подсказка</span><span>${esc(q.tip || "Подсказка недоступна")}</span>
      </div>
      <div class="meta" style="margin-top:10px"><div>Ты: <b>${d.me}</b></div><div>ИИ: <b>${d.ai}</b></div></div>
    </div>
  `);

  qsa(".answer").forEach(el => el.onclick = () => onAnswer(+el.dataset.i));
  // подсказка скрыта по умолчанию — ровно как просил
}

function onAnswer(idx){
  const d = State.duel, q = d.q[d.i];
  const correct = q.correctIndex ?? 0;

  qsa(".answer").forEach((el,i)=>{
    el.classList.add(i===correct ? "correct" : (i===idx ? "wrong" : ""));
    el.style.pointerEvents = "none";
  });

  if (idx === correct){
    d.me++; toast("✅ Верно!");
  } else {
    toast("❌ Ошибка");
    // показать подсказку ТОЛЬКО после неправильного ответа
    const tip = qs("#tip"); if (tip) tip.style.display = "flex";
  }

  // ИИ с вероятностью 85% попадает
  const ai = Math.random() < 0.85 ? correct : pickWrong(correct, q.answers.length);
  if (ai === correct) d.ai++;

  // Переход на следующий вопрос
  setTimeout(()=> nextQuestion(), 650);
}

function nextQuestion(){
  const d = State.duel;
  d.i++;
  if (d.i < d.q.length) renderQuestion();
  else finishDuel();
}

function finishDuel(){
  const d = State.duel;
  setView(`
    <div class="card">
      <h3>${d.me>d.ai ? "🏆 Победа!" : (d.me<d.ai ? "💀 Поражение" : "🤝 Ничья")}</h3>
      <p style="margin:.4rem 0 0">Ты: <b>${d.me}</b> • ИИ: <b>${d.ai}</b> • Всего: ${d.q.length}</p>
      <div class="grid two" style="margin-top:10px">
        <button class="btn btn-primary" id="again">Ещё раз</button>
        <button class="btn" id="home">На главную</button>
      </div>
    </div>
  `);
  qs("#again").onclick = () => startDuel({mode:d.mode, topic:d.topic});
  qs("#home").onclick  = () => renderHome();
}

/* =========================================================
   ЛОАДЕР / УТИЛИТЫ / ИЗОБРАЖЕНИЯ
========================================================= */
function showLoader(v){ qs("#loader").classList.toggle("hidden", !v); }
function setLoaderProgress(p){ qs("#loaderBar").style.width = Math.max(0, Math.min(100, p)) + "%"; }

const qs  = s => document.querySelector(s);
const qsa = s => [...document.querySelectorAll(s)];
function toast(text){ const t=qs("#toast"); t.innerHTML=`<div class="toast">${esc(text)}</div>`; t.style.opacity=1; setTimeout(()=>t.style.opacity=0,1400); }
function shuffle(a){ return a.map(x=>[Math.random(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]); }
function pickWrong(c,n){ const arr=[...Array(n).keys()].filter(i=>i!==c); return arr[Math.floor(Math.random()*arr.length)]; }
function esc(s){ return String(s).replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;","&gt;":"&gt;","\"":"&quot;","'":"&#39;"}[m])); }

/* пути изображений */
function imgQuestion(img){
  let name = String(img).replace(/^\.?\//,'');
  if(/^images\//i.test(name)) return name;
  if(/^A_B\//i.test(name))    return `images/${name}`;
  return `images/A_B/${name}`;
}
function imgMarkup(img){
  let name = String(img).replace(/^\.?\//,'');
  if(/^images\//i.test(name)) return name;
  if(/^markup\//i.test(name)) return `images/${name}`;
  return `images/markup/${name}`;
}
