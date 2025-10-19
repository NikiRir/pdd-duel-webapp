/* =======================
   СОСТОЯНИЕ и ЗАПУСК
======================= */
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
  showLoader(true);
  setLoader(5);

  await loadTicketsAndBuildTopics(p => setLoader(5 + Math.floor(p*75))); // до 80%
  await Promise.all([
    loadPenalties().then(()=>setLoader(90)),
    loadMarkup().then(()=>setLoader(96))
  ]);

  setLoader(100);
  setTimeout(()=> showLoader(false), 250);
  renderHome();            // всегда есть стартовый экран — не будет «пустой коробки»
}

/* =======================
   ЛОАДЕР
======================= */
function showLoader(v){ qs("#loader").classList.toggle("hidden", !v); }
function setLoader(p){ qs("#loaderBar").style.width = Math.max(0,Math.min(100,p))+"%"; }

/* =======================
   НАВИГАЦИЯ (всегда новый экран)
======================= */
function setView(html){
  const host = qs("#screen");
  // плавно скрываем старый
  const old = host.firstElementChild;
  if (old){ old.classList.add("fadeout"); setTimeout(()=>old.remove(), 160); }
  // добавляем новый
  const view = document.createElement("div");
  view.className = "view";
  view.innerHTML = html;
  host.appendChild(view);
}
function setActive(id){
  qsa(".menu .btn").forEach(b=>b.classList.remove("active"));
  if(id) qs("#"+id)?.classList.add("active");
}
function renderHome(){
  setActive(null);
  setView(`
    <div class="card">
      <h3>Выбери режим сверху</h3>
      <p style="margin:.35rem 0 0;color:var(--muted)">Быстрая дуэль, Темы, Билеты, Разметка, Штрафы.</p>
    </div>
  `);
}

/* =======================
   МЕНЮ
======================= */
function bindMenu(){
  qs("#btnQuickDuel").onclick = () => { setActive("btnQuickDuel"); startDuel({mode:"quick"}); };
  qs("#btnTopics").onclick    = () => { setActive("btnTopics");    uiTopics(); };
  qs("#btnTickets").onclick   = () => { setActive("btnTickets");   uiTickets(); };
  qs("#btnMarkup").onclick    = () => { setActive("btnMarkup");    uiMarkup(); };
  qs("#btnPenalties").onclick = () => { setActive("btnPenalties"); uiPenalties(); };
  qs("#btnStats").onclick     = () => { setActive("btnStats");     setView(`<div class="card"><h3>Статистика</h3><p>Открой через Telegram WebApp, чтобы связать результаты с профилем.</p></div>`); };
}

/* =======================
   ЗАГРУЗКА ДАННЫХ (локально)
======================= */
async function loadTicketsAndBuildTopics(onProgress){
  const TOTAL = 40; let loaded = 0;
  const step = () => { loaded++; onProgress && onProgress(loaded/TOTAL); };

  const raw = [];
  for(let i=1;i<=TOTAL;i++){
    const names = [
      `Билет ${i}.json`, `Билет_${i}.json`,
      `${i}.json`, `ticket_${i}.json`, `Ticket_${i}.json`
    ];
    for(const name of names){
      const url = `questions/A_B/tickets/${encodeURIComponent(name)}`;
      try{
        const r = await fetch(url, { cache: "no-store" });
        if(!r.ok) continue;
        const data = await r.json();
        const list = Array.isArray(data) ? data : (data.questions || []);
        for(const q of list) if(q.ticket_number==null) q.ticket_number = i;
        raw.push(...list);
        break; // нашли вариант — идём к след. номеру
      }catch{/* пробуем следующее имя */}
    }
    step();
  }

  const norm = normalizeQuestions(raw);
  for(const q of norm){
    State.pool.push(q);
    if(q.ticket!=null){ const a=State.byTicket.get(q.ticket)||[]; a.push(q); State.byTicket.set(q.ticket,a); }
    for(const t of q.topics){ const b=State.topics.get(t)||[]; b.push(q); State.topics.set(t,b); }
  }
}

async function loadPenalties(){
  try{
    const r = await fetch("penalties/penalties.json", { cache: "no-store" });
    if(!r.ok) return;
    const data = await r.json();
    State.penalties = Array.isArray(data) ? data : (data.penalties || data.items || []);
  }catch{}
}
async function loadMarkup(){
  try{
    const r = await fetch("markup/markup.json", { cache: "no-store" });
    if(!r.ok) return;
    const data = await r.json();
    const list = Array.isArray(data) ? data : (data.items || data.markup || []);
    State.markup = list.map((x,i)=>({ id:x.id??i+1, title:x.title||x.name||x.caption||`Элемент ${i+1}`, image:x.image||x.src||x.path||"" }));
  }catch{}
}

function normalizeQuestions(raw){
  const out=[];
  for(const q of raw){
    const answers = (q.answers||[]).map(a=>a.answer_text??a.text??String(a));
    const correctIndex = (q.answers||[]).findIndex(a=>a.is_correct===true||a.correct===true||a.isRight===true);
    const topics = Array.isArray(q.topic) ? q.topic : (q.topic ? [q.topic] : []);
    out.push({
      id: q.id ?? crypto.randomUUID(),
      question: q.question ?? q.title ?? "Вопрос",
      answers: answers.length ? answers : ["Да","Нет","Не знаю"],
      correctIndex: Number.isInteger(correctIndex)&&correctIndex>=0 ? correctIndex : 0,
      ticket: q.ticket_number ?? q.ticket ?? null,
      topics,
      image: q.image ?? q.img ?? null,
      tip: q.answer_tip ?? q.tip ?? null
    });
  }
  return out;
}

/* =======================
   ЭКРАНЫ
======================= */
function uiTopics(){
  const list = [...State.topics.keys()].sort((a,b)=>a.localeCompare(b,'ru'));
  if(!list.length){ setView(`<div class="card"><h3>Темы</h3><p>❌ Темы не найдены</p></div>`); return; }
  setView(`
    <div class="card"><h3>Темы</h3></div>
    <div class="card">
      <div class="grid auto">
        ${list.map(t=>`<div class="answer" data-t="${esc(t)}">${esc(t)}</div>`).join("")}
      </div>
    </div>
  `);
  qsa("[data-t]").forEach(el=>el.onclick=()=>startDuel({mode:"topic",topic:el.dataset.t}));
}

function uiTickets(){
  const ids = [...new Set(State.pool.map(q=>q.ticket).filter(v=>v!=null))].sort((a,b)=>a-b);
  if(!ids.length){ setView(`<div class="card"><h3>Билеты</h3><p>❌ Билеты не найдены</p></div>`); return; }
  setView(`
    <div class="card"><h3>Билеты</h3></div>
    <div class="card"><div class="grid auto">
      ${ids.map(n=>`<div class="answer" data-n="${n}">Билет ${n}</div>`).join("")}
    </div></div>
  `);
  qsa("[data-n]").forEach(el=>el.onclick=()=>startTicket(+el.dataset.n));
}

function uiMarkup(){
  if(!State.markup||!State.markup.length){ setView(`<div class="card"><h3>Разметка</h3><p>⚠️ Разметка не найдена</p></div>`); return; }
  setView(`
    <div class="card"><h3>Дорожная разметка</h3></div>
    <div class="card">
      <div class="grid auto">
        ${State.markup.map(it=>`
          <div class="row">
            <div style="display:flex;gap:10px;align-items:center">
              ${it.image?`<img src="${imgMarkup(it.image)}" alt="" style="width:84px;height:54px;object-fit:contain;background:#0b1021;border-radius:10px;border:1px solid rgba(255,255,255,.06)"/>`:""}
              <div><div style="font-weight:800">${esc(it.title)}</div>
              <div style="font-size:12px;color:var(--muted)">ID: ${esc(it.id)}</div></div>
            </div>
          </div>`).join("")}
      </div>
    </div>
  `);
}

function uiPenalties(){
  if(!State.penalties||!State.penalties.length){ setView(`<div class="card"><h3>Штрафы</h3><p>⚠️ Штрафы не найдены</p></div>`); return; }
  setView(`
    <div class="card"><h3>Штрафы</h3></div>
    <div class="card">
      <input id="penq" placeholder="Поиск по описанию..." class="row" style="width:100%;outline:none;margin-bottom:10px"/>
      <div id="penlist" class="grid"></div>
    </div>
  `);
  const list=qs("#penlist");
  const draw=q=>{
    const f=String(q||"").toLowerCase();
    const items=State.penalties.filter(p=>!f||String(p.title||p.name||p.description||"").toLowerCase().includes(f));
    list.innerHTML=items.map(p=>`
      <div class="row">
        <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:0">
          <div style="font-weight:800">${esc(p.title||p.name||"Нарушение")}</div>
          ${p.article?`<div class="badge">📜 Статья: ${esc(p.article)}</div>`:""}
        </div>
        <div class="badge">💸 ${esc(p.fine||p.amount||p.penalty||"—")}</div>
      </div>`).join("");
  };
  draw(""); qs("#penq").oninput=e=>draw(e.target.value);
}

/* =======================
   ДУЭЛЬ / ВИКТОРИНА
======================= */
function startDuel({mode,topic=null}){
  const src = topic ? (State.topics.get(topic)||[]) : State.pool;
  if(!src.length){ setView(`<div class="card"><h3>Дуэль</h3><p>⚠️ Данные не найдены</p></div>`); return; }

  const q = shuffle(src).slice(0,20);
  State.duel = { mode, topic, i:0, me:0, ai:0, q };
  renderQuestion();
}

function renderQuestion(){
  const d = State.duel, q = d.q[d.i];
  setView(`
    <div class="card">
      <div class="meta">
        <div>Вопрос ${d.i+1}/${d.q.length}${q.ticket!=null?` • Билет ${esc(q.ticket)}`:""}${d.topic?` • Тема: ${esc(d.topic)}`:""}</div>
        <div class="badge">⏱️ 25с</div>
      </div>
      <h3>${esc(q.question)}</h3>
      ${q.image?`<img class="qimg" src="${imgQuestion(q.image)}" alt=""/>`:""}
      <div class="grid">
        ${q.answers.map((a,i)=>`<div class="answer" data-i="${i}">${esc(a)}</div>`).join("")}
      </div>
      <div id="tip" class="meta" style="margin-top:10px;display:none">
        <span class="badge">💡 Подсказка</span><span>${esc(q.tip||"Подсказка недоступна")}</span>
      </div>
      <div class="meta" style="margin-top:10px"><div>Ты: <b>${d.me}</b></div><div>ИИ: <b>${d.ai}</b></div></div>
    </div>
  `);
  qsa(".answer").forEach(el=>el.onclick=()=>onAnswer(+el.dataset.i));
}

function onAnswer(idx){
  const d=State.duel, q=d.q[d.i], correct=q.correctIndex??0;

  qsa(".answer").forEach((el,i)=>{
    el.classList.add(i===correct?"correct":(i===idx?"wrong":""));
    el.style.pointerEvents="none";
  });

  if(idx===correct){ d.me++; toast("✅ Верно!"); }
  else{ toast("❌ Ошибка"); const tip=qs("#tip"); if(tip) tip.style.display="flex"; }

  const ai = Math.random()<0.85 ? correct : pickWrong(correct,q.answers.length);
  if(ai===correct) d.ai++;

  setTimeout(()=>nextQuestion(),650);
}

function nextQuestion(){
  const d=State.duel;
  d.i++;
  if(d.i<d.q.length) renderQuestion(); else finishDuel();
}

function finishDuel(){
  const d=State.duel;
  setView(`
    <div class="card">
      <h3>${d.me>d.ai?"🏆 Победа!":(d.me<d.ai?"💀 Поражение":"🤝 Ничья")}</h3>
      <p style="margin:.35rem 0 0">Ты: <b>${d.me}</b> • ИИ: <b>${d.ai}</b> • Всего: ${d.q.length}</p>
      <div class="grid two" style="margin-top:10px">
        <button class="btn btn-primary" id="again">Ещё раз</button>
        <button class="btn" id="home">На главную</button>
      </div>
    </div>
  `);
  qs("#again").onclick=()=>startDuel({mode:d.mode,topic:d.topic});
  qs("#home").onclick = ()=>renderHome();
}

/* =======================
   УТИЛИТЫ / ИЗОБРАЖЕНИЯ
======================= */
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
