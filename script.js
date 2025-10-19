/* Реальные данные из etspring/pdd_russia */
const RAW = (p) => `https://raw.githubusercontent.com/etspring/pdd_russia/master/${p}`;

/* ===== ГЛОБАЛЬНОЕ СОСТОЯНИЕ ===== */
const State = {
  pool: [],            // все вопросы
  byTicket: new Map(), // билет -> вопросы
  topics: new Map(),   // тема -> вопросы
  duel: null
};

/* ===== СТАРТ ===== */
document.addEventListener("DOMContentLoaded", () => {
  bindUI();        // привязываем кнопки
  safeInitTG();    // пробуем инициализировать Telegram (но работаем и без него)
  init();          // грузим реальные данные и показываем меню
});

async function init(){
  toast("Загружаю реальные вопросы ПДД…");
  await loadAllData();
  toast(`Готово! Вопросов: ${State.pool.length}`);
}

/* ===== КНОПКИ ===== */
function bindUI(){
  el("#btnQuickDuel").onclick = () => startDuel({ mode: "quick" });
  el("#btnTopics").onclick    = () => showTopics();
  el("#btnTickets").onclick   = () => showTickets();
  el("#btnStats").onclick     = () => {
    // если внутри Telegram — отправим сигнал боту, иначе покажем подсказку
    trySendToBot({ type: "stats_request" }) || toast("Открой через Telegram, чтобы посмотреть свою статистику");
  };
}

/* ===== ЗАГРУЗКА ДАННЫХ ===== */
async function loadAllData(){
  // 1) Билеты: пробуем несколько известных путей
  const ticketPaths = [
    "questions/tickets.json",
    "questions/tickets_A_B.json",
    "questions/tickets_C_D.json"
  ];
  const ticketsArr = await loadFirstAvailable(ticketPaths);
  const tickets = Array.isArray(ticketsArr) ? ticketsArr
                 : (ticketsArr?.tickets || ticketsArr?.data || []);

  // 2) Темы: возможные названия файла
  const topicPaths = ["questions/topics.json", "questions/topic.json"];
  let topics = [];
  try {
    const topicsRaw = await loadFirstAvailable(topicPaths);
    topics = Array.isArray(topicsRaw) ? topicsRaw
           : (topicsRaw?.topics || topicsRaw?.data || topicsRaw?.topic || []);
  } catch { /* допустимо: файла тем может не быть */ }

  // 3) Нормализуем и раскладываем
  const normTickets = normalizeQuestions(tickets);
  for(const q of normTickets){
    State.pool.push(q);
    if(q.ticket!=null){
      const arr = State.byTicket.get(q.ticket) || [];
      arr.push(q); State.byTicket.set(q.ticket, arr);
    }
    for(const t of q.topics){
      const arr = State.topics.get(t) || [];
      arr.push(q); State.topics.set(t, arr);
    }
  }

  const normTopics = normalizeQuestions(topics);
  for(const q of normTopics){
    if(!State.pool.find(x=>x.id===q.id)) State.pool.push(q);
    for(const t of q.topics){
      const arr = State.topics.get(t) || [];
      if(!arr.find(x=>x.id===q.id)) arr.push(q);
      State.topics.set(t, arr);
    }
  }
}

async function loadFirstAvailable(paths){
  let lastError = null;
  for(const p of paths){
    try{
      const r = await fetch(RAW(p), {cache:"no-store"});
      if(r.ok) return await r.json();
    }catch(e){ lastError = e; }
  }
  if(lastError) throw lastError;
  throw new Error("Не удалось загрузить файлы данных.");
}

/* Приводим разные форматы к единому */
function normalizeQuestions(raw){
  const out=[];
  for(const q of raw){
    const answers = (q.answers||[]).map(a=>a.answer_text ?? a.text ?? String(a));
    const correctIndex = (q.answers||[]).findIndex(a=>a.is_correct===true || a.correct===true);
    const topics = Array.isArray(q.topic) ? q.topic : (q.topic ? [q.topic] : []);
    out.push({
      id: q.id ?? crypto.randomUUID(),
      question: q.question ?? q.title ?? "Вопрос",
      answers: answers.length? answers : ["Да","Нет","Не знаю"],
      correctIndex: correctIndex>=0 ? correctIndex : 0,
      ticket: q.ticket_number ?? q.ticket ?? null,
      topics,
      image: q.image ?? null,
      tip: q.answer_tip ?? q.tip ?? null
    });
  }
  return out;
}

/* ===== ДУЭЛЬ / ВИКТОРИНА ===== */
function startDuel({mode, topic=null}){
  const src = topic ? (State.topics.get(topic)||[]) : State.pool;
  if(!src.length){ toast("Данные ещё не загружены"); return; }

  // Требование: 20 вопросов для билетов/тем. Быстрая дуэль тоже 20 для консистентности.
  const COUNT = 20;
  const q = shuffle(src).slice(0, COUNT);

  State.duel = { mode, topic, i:0, me:0, ai:0, q, timerMs: 25000 };
  renderQuestion();
}

function renderQuestion(){
  const d = State.duel, q = d.q[d.i];
  const screen = el("#screen");
  screen.innerHTML = `
    <div class="card">
      <div class="meta">
        <div>Вопрос ${d.i+1}/${d.q.length}${d.topic? " • "+escapeHtml(d.topic):""}${q.ticket!=null? " • Билет "+escapeHtml(q.ticket):""}</div>
        <div class="timer"><div class="tbar" id="tbar"></div></div>
      </div>
      <h3>${escapeHtml(q.question)}</h3>
      ${q.image? `<img class="qimg" src="${imgUrl(q.image)}" alt=""/>` : ""}
      <div class="grid">
        ${q.answers.map((a,i)=>`<div class="answer" data-i="${i}">${escapeHtml(a)}</div>`).join("")}
      </div>
      ${q.tip? `<div class="meta" style="margin-top:10px"><span>Подсказка:</span><span>${escapeHtml(q.tip)}</span></div>`:""}
      <div class="meta" style="margin-top:8px">
        <div>Ты: <b>${d.me}</b></div>
        <div>ИИ: <b>${d.ai}</b></div>
      </div>
    </div>
  `;

  // таймер
  let left = d.timerMs; const step = 50; const bar = el("#tbar");
  const timer = setInterval(()=>{
    left -= step; const x = Math.max(0, left/d.timerMs);
    bar.style.width = (x*100).toFixed(1)+"%";
    if(left<=0){ clearInterval(timer); finishAnswer(-1); }
  }, step);

  // обработка выбора
  for(const ans of screen.querySelectorAll(".answer")){
    ans.onclick = () => { clearInterval(timer); finishAnswer(parseInt(ans.dataset.i,10)); };
  }

  function finishAnswer(my){
    const correct = q.correctIndex ?? 0;
    screen.querySelectorAll(".answer").forEach((el,i)=>{
      el.classList.add(i===correct? "correct" : (i===my? "wrong" : ""));
      el.style.pointerEvents="none";
    });

    if(my===correct){ d.me++; toast("✅ Верно!"); } else { toast("❌ Ошибка"); }

    // ИИ отвечает с 88% точности
    const ai = Math.random()<0.88 ? correct : pickWrong(correct, q.answers.length);
    if(ai===correct) d.ai++;

    setTimeout(()=>{
      d.i++;
      if(d.i<d.q.length) renderQuestion(); else finishDuel();
    }, 640);
  }
}

function finishDuel(){
  const d = State.duel;
  const result = d.me>d.ai ? "🏆 Победа" : (d.me<d.ai ? "💀 Поражение" : "🤝 Ничья");
  el("#screen").innerHTML = `
    <div class="card">
      <h3 style="margin-bottom:6px">${result}</h3>
      <div class="meta"><div>Ты: <b>${d.me}</b></div><div>ИИ: <b>${d.ai}</b></div></div>
      <div class="grid two" style="margin-top:8px">
        <button class="btn btn-primary" id="again">Ещё раз</button>
        <button class="btn" id="home">На главную</button>
      </div>
    </div>
  `;
  el("#again").onclick = () => startDuel({mode:d.mode, topic:d.topic});
  el("#home").onclick  = () => { el("#screen").innerHTML = ""; };

  trySendToBot({
    type:"duel_result",
    payload:{ mode:d.mode, topic:d.topic, me:d.me, ai:d.ai, total:d.q.length }
  });
}

/* ===== СПИСКИ ТЕМ / БИЛЕТОВ ===== */
function showTopics(){
  const topics = [...State.topics.keys()].sort();
  if(!topics.length){ toast("Темы не найдены"); return; }
  el("#screen").innerHTML = `
    <div class="card">
      <h3>Темы</h3>
      <div class="grid auto" style="margin-top:8px">
        ${topics.map(t=>`<div class="answer" data-t="${escapeHtml(t)}">${escapeHtml(t)}</div>`).join("")}
      </div>
    </div>`;
  for(const n of elAll("[data-t]")) n.onclick = () => startDuel({mode:"topic", topic:n.dataset.t});
}

function showTickets(){
  const unique = [...new Set(State.pool.map(q => q.ticket).filter(v=>v!=null))].sort((a,b)=>a-b);
  if(!unique.length){ toast("Билеты не найдены"); return; }
  el("#screen").innerHTML = `
    <div class="card">
      <h3>Билеты</h3>
      <div class="grid auto" style="margin-top:8px">
        ${unique.map(t=>`<div class="answer" data-n="${t}">Билет ${t}</div>`).join("")}
      </div>
    </div>`;
  for(const n of elAll("[data-n]")) n.onclick = () => startTicket(parseInt(n.dataset.n,10));
}

function startTicket(num){
  const arr = State.pool.filter(q => q.ticket === num);
  if(!arr.length){ toast("Нет вопросов для этого билета"); return; }
  State.duel = { mode:"ticket", topic:null, i:0, me:0, ai:0, q: shuffle(arr).slice(0,20), timerMs:25000 };
  renderQuestion();
}

/* ===== TELEGRAM WEBAPP (безопасно) ===== */
function safeInitTG(){
  try{
    if(window.Telegram && window.Telegram.WebApp){
      window.Telegram.WebApp.ready();
    }
  }catch(e){ /* не мешаем сайту работать */ }
}
function trySendToBot(msg){
  try{
    if(window.Telegram && window.Telegram.WebApp){
      window.Telegram.WebApp.sendData(JSON.stringify(msg));
      return true;
    }
  }catch(e){}
  return false;
}

/* ===== УТИЛИТЫ ===== */
const el = (s) => document.querySelector(s);
const elAll = (s)=> [...document.querySelectorAll(s)];
function toast(text){
  const wrap = el("#toast");
  wrap.innerHTML = `<div class="toast">${escapeHtml(text)}</div>`;
  wrap.style.opacity = 1; setTimeout(()=> wrap.style.opacity = 0, 1400);
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m])); }
function shuffle(a){ return a.map(x=>[Math.random(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]); }
function pickWrong(c,n){ const opts=[...Array(n).keys()].filter(i=>i!==c); return opts[Math.floor(Math.random()*opts.length)]; }
function imgUrl(p){ if(!p) return ""; const clean = String(p).replace(/^\.\//,"").replace(/^\//,""); return RAW(clean); }
