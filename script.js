// ===================== ГЛОБАЛЬНОЕ СОСТОЯНИЕ =====================
const State = {
  pool: [],
  byTicket: new Map(),
  topics: new Map(),
  penalties: null,
  markup: null,
  duel: null,
  lock: false // блокируем повторные тапы на время показа результата
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
  await loadTicketsAndBuildTopics(p => setLoader(10 + Math.floor(p * 60)));
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
function setActive(id){ qsa(".menu .btn").forEach(b=>b.classList.remove("active")); if(id) qs("#"+id)?.classList.add("active"); }

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
function renderHome(){
  setActive(null);
  setView(`
    <div class="card">
      <h3>Выбери режим сверху</h3>
      <p style="margin:.35rem 0 0;color:var(--muted)">Быстрая дуэль, Темы, Билеты, Разметка, Штрафы.</p>
    </div>
  `);
}

// ===================== ДЕЛЕГИРОВАНИЕ КЛИКОВ ВНУТРИ #screen =====================
function bindScreenDelegation(){
  const screen = qs("#screen");

  // pointerup — стабильно для Telegram WebApp
  screen.addEventListener("pointerup", handleScreenTap, { passive:false });
  // запасной click (если pointer события "съедятся")
  screen.addEventListener("click", (e)=>{
    if (e.defaultPrevented) return;
    handleScreenTap(e);
  }, { passive:true });
}

function handleScreenTap(e){
  const ans = e.target.closest(".answer");
  if (ans && ans.dataset.i != null){
    e.preventDefault();
    onAnswer(+ans.dataset.i);
    return;
  }
  const ticket = e.target.closest("[data-n]");
  if (ticket){
    e.preventDefault();
    startTicket(+ticket.dataset.n);
    return;
  }
  const topic = e.target.closest("[data-t]");
  if (topic){
    e.preventDefault();
    startDuel({ mode:"topic", topic: topic.dataset.t });
    return;
  }
  if (e.target.id === "again"){ e.preventDefault(); startDuel({ mode: State.duel?.mode || "quick", topic: State.duel?.topic || null }); return; }
  if (e.target.id === "home"){ e.preventDefault(); renderHome(); return; }
  if (e.target.id === "retryMarkup"){ e.preventDefault(); State.markup=null; uiMarkup(); return; }
  if (e.target.id === "retryPen"){ e.preventDefault(); State.penalties=null; uiPenalties(); return; }
}

// ===================== ЗАГРУЗКА ДАННЫХ =====================
async function loadTicketsAndBuildTopics(onProgress){
  const TOTAL = 40; let loaded = 0;
  const step = () => onProgress && onProgress(++loaded/TOTAL);

  const raw = [];
  for(let i=1;i<=TOTAL;i++){
    const names = [`Билет ${i}.json`,`Билет_${i}.json`,`${i}.json`,`ticket_${i}.json`];
    let found=false;
    for(const name of names){
      try{
        const r = await fetch(`questions/A_B/tickets/${encodeURIComponent(name)}`,{cache:"no-store"});
        if(!r.ok) continue;
        const data = await r.json();
        const arr = Array.isArray(data)?data:(data.questions||data.list||data.data||[]);
        for(const q of arr) q.ticket_number ??= `Билет ${i}`; // нормализуем как в твоих файлах
        raw.push(...arr);
        found=true; break;
      }catch{}
    }
    step();
  }

  const norm = normalizeQuestions(raw);
  for(const q of norm){
    State.pool.push(q);
    if(q.ticket!=null){
      const a=State.byTicket.get(q.ticket)||[];
      a.push(q); State.byTicket.set(q.ticket,a);
    }
    for(const t of q.topics){
      const b=State.topics.get(t)||[];
      b.push(q); State.topics.set(t,b);
    }
  }
}

async function loadPenalties(){
  try{
    const r=await fetch("penalties/penalties.json",{cache:"no-store"});
    if(!r.ok) return;
    const j=await r.json();
    State.penalties = Array.isArray(j)?j:(j.penalties||j.items||j.list||j.data||[]);
  }catch{}
}
async function loadMarkup(){
  try{
    const r=await fetch("markup/markup.json",{cache:"no-store"});
    if(!r.ok) return;
    const j=await r.json();
    const arr=Array.isArray(j)?j:(j.markup||j.items||j.list||j.data||[]);
    State.markup = arr.map((x,i)=>({ id:x.id??i+1, title:x.title||x.name||x.caption||`Элемент ${i+1}`, image:x.image||x.src||x.path||"" }));
  }catch{}
}

// ===================== НОРМАЛИЗАЦИЯ =====================
function normalizeQuestions(raw){
  const out=[];
  for(const q of raw){
    const answersRaw = q.answers || q.variants || q.options || [];
    const answers = answersRaw.map(a=>a?.answer_text??a?.text??a?.title??String(a));

    // 1) пробуем флаг is_correct
    let correctIndex = answersRaw.findIndex(a => a?.is_correct===true || a?.correct===true || a?.isRight===true);

    // 2) если нет, пробуем строку "Правильный ответ: N"
    if (correctIndex < 0 && typeof q.correct_answer === "string"){
      const m = q.correct_answer.match(/(\d+)/);
      if (m){ const n = parseInt(m[1],10); if (!Number.isNaN(n)) correctIndex = n-1; }
    }
    // 3) другие возможные поля
    if (correctIndex < 0 && typeof q.correct === "number") correctIndex = q.correct>0 ? q.correct-1 : q.correct;
    if (correctIndex < 0 && typeof q.correct_index === "number") correctIndex = q.correct_index;
    if (correctIndex < 0 && typeof q.correctIndex === "number") correctIndex = q.correctIndex;
    if (!Number.isInteger(correctIndex) || correctIndex<0 || correctIndex>=answers.length) correctIndex = 0;

    // ticket_number может быть "Билет 1" → вытаскиваем число
    const tNum = parseTicketNumber(q.ticket_number ?? q.ticket);

    out.push({
      id: q.id ?? cryptoId(),
      question: q.question ?? q.title ?? "Вопрос",
      answers: answers.length?answers:["Да","Нет","Не знаю"],
      correctIndex,
      ticket: tNum,                               // числовой ID билета
      topics: toArray(q.topic),
      image: normalizeImagePath(q.image ?? q.img ?? null),
      tip: q.answer_tip ?? q.tip ?? null
    });
  }
  return out;
}

function parseTicketNumber(val){
  if (val == null) return null;
  if (typeof val === "number") return val;
  const s = String(val);
  const m = s.match(/(\d+)/);
  return m ? parseInt(m[1],10) : null;
}
function toArray(x){ return Array.isArray(x) ? x : (x ? [x] : []); }
function cryptoId(){
  if (crypto?.randomUUID) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2);
}

// ===================== ЭКРАНЫ =====================
function uiTopics(){
  const list=[...State.topics.keys()].sort((a,b)=>a.localeCompare(b,'ru'));
  if(!list.length){ setView(`<div class="card"><h3>Темы</h3><p>❌ Темы не найдены</p></div>`); return; }
  setView(`
    <div class="card"><h3>Темы</h3></div>
    <div class="card"><div class="grid auto">
      ${list.map(t=>`<button type="button" class="answer" data-t="${esc(t)}">${esc(t)}</button>`).join("")}
    </div></div>
  `);
}

function uiTickets(){
  const ids=[...State.byTicket.keys()].sort((a,b)=>a-b);
  if(!ids.length){ setView(`<div class="card"><h3>Билеты</h3><p>❌ Билеты не найдены</p></div>`); return; }
  setView(`
    <div class="card"><h3>Билеты</h3></div>
    <div class="card"><div class="grid auto">
      ${ids.map(n=>`<button type="button" class="answer" data-n="${n}">Билет ${n}</button>`).join("")}
    </div></div>
  `);
}

function uiMarkup(){
  if(!State.markup){
    setView(`<div class="card"><h3>Разметка</h3><p>⏳ Загружаем…</p></div>`);
    loadMarkup().then(()=>uiMarkup()); return;
  }
  if(!State.markup.length){
    setView(`<div class="card"><h3>Разметка</h3><p>⚠️ Разметка не найдена</p><button class="btn" id="retryMarkup">🔄 Перезагрузить</button></div>`);
    return;
  }
  setView(`
    <div class="card"><h3>Дорожная разметка</h3></div>
    <div class="card"><div class="grid auto">
      ${State.markup.map(it=>`
        <div class="row">
          ${it.image?`<img src="${imgMarkup(it.image)}" alt="" style="width:84px;height:54px;object-fit:contain;background:#0b1021;border-radius:10px;border:1px solid rgba(255,255,255,.06)"/>`:""}
          <div style="font-weight:800">${esc(it.title)}</div>
          <div class="badge">ID: ${esc(it.id)}</div>
        </div>`).join("")}
    </div></div>
  `);
}

function uiPenalties(){
  if(!State.penalties){
    setView(`<div class="card"><h3>Штрафы</h3><p>⏳ Загружаем…</p></div>`);
    loadPenalties().then(()=>uiPenalties()); return;
  }
  if(!State.penalties.length){
    setView(`<div class="card"><h3>Штрафы</h3><p>⚠️ Штрафы не найдены</p><button class="btn" id="retryPen">🔄 Перезагрузить</button></div>`);
    return;
  }
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

function uiStats(){
  setView(`<div class="card"><h3>Статистика</h3><p>Скоро: результаты дуэлей и прогресс по темам.</p></div>`);
}

// ===================== ДУЭЛЬ / ВИКТОРИНА =====================
function startDuel({mode,topic=null}){
  const src = topic ? (State.topics.get(topic)||[]) : State.pool;
  if(!src.length){ setView(`<div class="card"><h3>Дуэль</h3><p>⚠️ Данные не найдены</p></div>`); return; }
  const q = shuffle(src).slice(0,20);
  State.duel = { mode, topic, i:0, me:0, ai:0, q };
  renderQuestion();
}

function startTicket(n){
  const arr = State.byTicket.get(n) || [];
  if(!arr.length){ setView(`<div class="card"><h3>Билет ${n}</h3><p>⚠️ Вопросы не найдены</p></div>`); return; }
  const q = arr.length>20 ? shuffle(arr).slice(0,20) : arr.slice(0,20);
  State.duel = { mode:"ticket", topic:null, i:0, me:0, ai:0, q };
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
        ${q.answers.map((a,i)=>`<button type="button" class="answer" data-i="${i}">${esc(a)}</button>`).join("")}
      </div>
      <div id="tip" class="meta" style="margin-top:10px;display:none">
        <span class="badge">💡 Подсказка</span><span>${esc(q.tip||"Подсказка недоступна")}</span>
      </div>
      <div class="meta" style="margin-top:10px"><div>Ты: <b>${d.me}</b></div><div>ИИ: <b>${d.ai}</b></div></div>
    </div>
  `);
}

function onAnswer(idx){
  if(State.lock) return;
  const d=State.duel; if(!d) return;
  const q=d.q[d.i]; const correct=q.correctIndex??0;

  State.lock = true;

  const items = qsa(".answer");
  items.forEach((el,i)=>{
    el.disabled = true;
    el.classList.add(i===correct?"correct":(i===idx?"wrong":""));
  });

  if(idx===correct){ d.me++; toast("✅ Верно!"); }
  else{ toast("❌ Ошибка"); const tip=qs("#tip"); if(tip) tip.style.display="flex"; }

  // имитация ответа «ИИ»
  const ai = Math.random()<0.85 ? correct : pickWrong(correct, items.length);
  if(ai===correct) d.ai++;

  // Надёжный переход на «новую страницу» с вопросом
  requestAnimationFrame(()=>{
    setTimeout(()=>{
      d.i++;
      State.lock = false;
      if(d.i<d.q.length) renderQuestion();
      else finishDuel();
    }, 900);
  });
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
}

// ===================== УТИЛИТЫ =====================
const qs  = s => document.querySelector(s);
const qsa = s => [...document.querySelectorAll(s)];
function toast(text){ const t=qs("#toast"); t.innerHTML=`<div class="toast">${esc(text)}</div>`; t.style.opacity=1; setTimeout(()=>t.style.opacity=0,1400); }
function shuffle(a){ return a.map(x=>[Math.random(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]); }
function pickWrong(c,n){ const arr=[...Array(n).keys()].filter(i=>i!==c); return arr[Math.floor(Math.random()*arr.length)]; }
function esc(s){ return String(s).replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;","&gt;":"&gt;","\"":"&quot;","'":"&#39;"}[m])); }

/* пути изображений */
function normalizeImagePath(img){
  if(!img) return null;
  let name = String(img).trim();

  // убираем стартовое "./"
  name = name.replace(/^\.\/+/, "");

  // если уже начинается с images/ — возвращаем как есть
  if(/^images\//i.test(name)) return name;

  // если начинается с A_B/ → это каталог внутри images
  if(/^A_B\//i.test(name)) return "images/" + name;

  // дефолт: кладём в images/A_B
  return "images/A_B/" + name;
}
function imgQuestion(img){ return normalizeImagePath(img) || ""; }
function imgMarkup(img){
  if(!img) return "";
  let name = String(img).replace(/^\.\/+/, "");
  if(/^images\//i.test(name)) return name;
  if(/^markup\//i.test(name)) return "images/" + name;
  return "images/markup/" + name;
}
