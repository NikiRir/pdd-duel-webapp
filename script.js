/* =======================
   Telegram + Глобальное состояние
======================= */
const TG = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
try { TG?.ready(); TG?.expand(); } catch(_) {}

const State = {
  pool: [],
  byTicket: new Map(),
  topics: new Map(),
  duel: null,
  lock: false,
  lastTouchTs: 0,
};

/* =======================
   Запуск
======================= */
document.addEventListener("DOMContentLoaded", () => {
  bindMenu();
  bindDelegation();
  boot();
});

async function boot(){
  showLoader(true);
  setLoader(5);
  try {
    await loadTickets(p => setLoader(5 + Math.floor(p * 85)));
  } catch(e) {
    console.error("Ошибка загрузки билетов:", e);
  }
  setLoader(100);
  setTimeout(()=>showLoader(false), 250);
  renderHome();
  updateStatsCounters();
}

/* =======================
   Лоадер
======================= */
function showLoader(v){ qs("#loader").classList.toggle("hidden", !v); }
function setLoader(p){ qs("#loaderBar").style.width = Math.max(0,Math.min(100,p))+"%"; }

/* =======================
   Навигация
======================= */
function toggleSubpage(isSub){
  const appRoot = qs(".app");
  appRoot?.classList.toggle("app--subpage", !!isSub);
  setActive(null);
  document.querySelector("#screen")?.scrollIntoView({ block: "start", behavior: "smooth" });
}

function setView(html, { subpage = true } = {}){
  toggleSubpage(subpage);
  const host = qs("#screen");
  host.scrollTop = 0;
  host.innerHTML = `<div class="view">${html}</div>`;
}
function renderHome(){
  setActive(null);
  setView(`
    <div class="card">
      <h3>Выбери режим сверху</h3>
      <p style="margin:.35rem 0 0;color:var(--muted)">⚡ Быстрая дуэль, 📚 Темы, 🎟️ Билеты</p>
    </div>
  `, { subpage: false });
}
function setActive(id){
  qsa("[data-action]").forEach(b=>b.classList.remove("active"));
  if(id) qs("#"+id)?.classList.add("active");
}

/* =======================
   Меню
======================= */
function bindMenu(){
  qsa("[data-action]").forEach(btn=>{
    btn.addEventListener("click", e=>{
      const act = e.currentTarget.dataset.action;
      setActive(e.currentTarget.id);
      if (act==="quick")    startDuel({mode:"quick"});
      if (act==="topics")   uiTopics();
      if (act==="tickets")  uiTickets();
      if (act==="stats")    uiStats();
    }, { passive:true });
  });
}

/* =======================
   Делегация событий
======================= */
function bindDelegation(){
  const screen = qs("#screen");
  screen.addEventListener("touchstart", handleTap, { passive:false });
  screen.addEventListener("click", e=>{
    if (Date.now() - State.lastTouchTs < 350) return;
    handleTap(e);
  }, { passive:false });
}

function handleTap(e){
  if (e.type === "touchstart") State.lastTouchTs = Date.now();

  const ans = e.target.closest("button.answer");
  if (ans && ans.dataset.i != null){ e.preventDefault(); onAnswer(+ans.dataset.i); return; }
  const ticket = e.target.closest("[data-n]");
  if (ticket){ e.preventDefault(); startTicket(+ticket.dataset.n); return; }
  const topic = e.target.closest("[data-t]");
  if (topic){ e.preventDefault(); startDuel({mode:"topic", topic: topic.dataset.t}); return; }
  if (e.target.id === "again"){ e.preventDefault(); startDuel(State.duel?.topic?{mode:"topic",topic:State.duel.topic}:{mode:"quick"}); return; }
  if (e.target.id === "home"){ e.preventDefault(); renderHome(); return; }
}

/* =======================
   Загрузка билетов
======================= */
async function loadTickets(onProgress){
  const TOTAL = 40; let loaded = 0;
  const raw = [];

  for(let i=1;i<=TOTAL;i++){
    const names = [
      `Билет ${i}.json`,
      `Билет_${i}.json`,
      `${i}.json`,
      `ticket_${i}.json`
    ];
    let found = false;
    for(const name of names){
      const url = `questions/A_B/tickets/${encodeURIComponent(name)}`;
      try{
        const r = await fetch(url, { cache:"no-store" });
        if(!r.ok) continue;
        const data = await r.json();
        const arr = Array.isArray(data) ? data : (data.questions || data.list || data.data || []);
        for(const q of arr) if(!q.ticket_number) q.ticket_number = `Билет ${i}`;
        raw.push(...arr);
        found = true;
        break;
      }catch(err){ console.warn("Ошибка загрузки:", name, err); }
    }
    onProgress && onProgress(++loaded / TOTAL);
    await delay(20);
  }

  const norm = normalizeQuestions(raw);
  for(const q of norm){
    State.pool.push(q);
    if (!State.byTicket.has(q.ticket)) State.byTicket.set(q.ticket, []);
    State.byTicket.get(q.ticket).push(q);

    for(const t of q.topics){
      if (!State.topics.has(t)) State.topics.set(t, []);
      State.topics.get(t).push(q);
    }
  }
  console.log(`✅ Загружено ${State.pool.length} вопросов`);
}

/* =======================
   Нормализация данных
======================= */
function normalizeQuestions(raw){
  const out=[];
  for(const q of raw){
    const answersRaw = q.answers || q.variants || q.options || [];
    const answers = answersRaw.map(a => a?.answer_text ?? a?.text ?? a?.title ?? String(a));

    let correctIndex = answersRaw.findIndex(a => a?.is_correct===true);
    if (correctIndex < 0 && typeof q.correct_answer === "string"){
      const m = q.correct_answer.match(/\d+/);
      if (m) correctIndex = parseInt(m[0]) - 1;
    }
    if (correctIndex < 0) correctIndex = 0;

    let ticket = 0; const m2 = String(q.ticket_number||"").match(/\d+/);
    if (m2) ticket = parseInt(m2[0]);

    let image = (q.image || "").replace(/^\.\//,"");
    if (image && !image.startsWith("images/")) image = "images/" + image;

    out.push({
      question: q.question || q.title || "Вопрос",
      answers,
      correctIndex,
      tip: q.answer_tip || q.tip || "",
      ticket,
      topics: Array.isArray(q.topic) ? q.topic : q.topic ? [q.topic] : [],
      image
    });
  }
  return out;
}

/* =======================
   Экраны
======================= */
function uiTopics(){
  const list=[...State.topics.keys()].sort((a,b)=>a.localeCompare(b,'ru'));
  if(!list.length){ setView(`<div class="card"><h3>Темы</h3><p>❌ Темы не найдены</p></div>`, { subpage: true }); return; }
  setView(`
    <div class="card"><h3>Темы</h3></div>
    <div class="card"><div class="grid auto">
      ${list.map(t=>`<button type="button" class="answer" data-t="${esc(t)}">${esc(t)}</button>`).join("")}
    </div></div>
  `, { subpage: true });
}

function uiTickets(){
  const ids=[...State.byTicket.keys()].sort((a,b)=>a-b);
  if(!ids.length){ setView(`<div class="card"><h3>Билеты</h3><p>❌ Билеты не найдены</p></div>`, { subpage: true }); return; }
  setView(`
    <div class="card"><h3>Билеты</h3></div>
    <div class="card"><div class="grid auto">
      ${ids.map(n=>`<button type="button" class="answer" data-n="${n}">Билет ${n}</button>`).join("")}
    </div></div>
  `, { subpage: true });
}

function uiStats(){
  setView(`<div class="card"><h3>Статистика</h3><p>Скоро здесь будет прогресс дуэлей.</p></div>`, { subpage: true });
}

/* =======================
   Викторина
======================= */
function startDuel({mode,topic=null}){
  const src = topic ? (State.topics.get(topic)||[]) : State.pool;
  if(!src.length){ setView(`<div class="card"><h3>Дуэль</h3><p>⚠️ Нет данных</p></div>`, { subpage: true }); return; }
  const q = shuffle(src).slice(0,20);
  State.duel = { mode, topic, i:0, me:0, q };
  renderQuestion();
}
function startTicket(n){
  const arr = State.byTicket.get(n) || [];
  if(!arr.length){ setView(`<div class="card"><h3>Билет ${n}</h3><p>⚠️ Нет вопросов</p></div>`, { subpage: true }); return; }
  const q = arr.length>20 ? shuffle(arr).slice(0,20) : arr.slice(0,20);
  State.duel = { mode:"ticket", topic:null, i:0, me:0, q };
  renderQuestion();
}

function renderQuestion(){
  const d = State.duel, q = d.q[d.i];
  setView(`
    <div class="card">
      <div class="meta">Вопрос ${d.i+1}/${d.q.length} • Билет ${q.ticket}</div>
      <h3>${esc(q.question)}</h3>
      ${q.image?`<img src="${q.image}" class="qimg" onerror="this.style.display='none'"/>`:""}
      <div class="grid">${q.answers.map((a,i)=>`<button class="answer" data-i="${i}">${esc(a)}</button>`).join("")}</div>
      <div id="tip" class="meta" style="display:none;margin-top:8px;color:#ccc">💡 ${esc(q.tip)}</div>
    </div>
  `, { subpage: true });
  State.lock = false;
}

function onAnswer(i){
  if(State.lock) return;
  State.lock = true;
  const d = State.duel, q = d.q[d.i];
  const correct = q.correctIndex;

  const btns = qsa(".answer");
  btns.forEach((b,idx)=>{
    b.disabled = true;
    if(idx===correct)b.classList.add("correct");
    else if(idx===i)b.classList.add("wrong");
  });

  if(i===correct){ d.me++; toast("✅ Верно!"); }
  else { toast("❌ Ошибка"); qs("#tip").style.display="block"; }

  setTimeout(()=>{
    State.lock=false;
    d.i++;
    if(d.i<d.q.length) renderQuestion();
    else finishDuel();
  }, 1000);
}

function finishDuel(){
  const d=State.duel;
  setView(`
    <div class="card">
      <h3>${d.me>=Math.ceil(d.q.length*0.6)?"🏆 Отлично!":"🏁 Завершено"}</h3>
      <p>Верных: <b>${d.me}</b> из ${d.q.length}</p>
      <div class="grid two" style="margin-top:10px">
        <button class="btn btn-primary" id="again">Ещё раз</button>
        <button class="btn" id="home">На главную</button>
      </div>
    </div>
  `, { subpage: true });
}

/* =======================
   Утилиты
======================= */
const qs=s=>document.querySelector(s);
const qsa=s=>[...document.querySelectorAll(s)];
function delay(ms){ return new Promise(r=>setTimeout(r,ms)); }
function shuffle(a){return a.map(x=>[Math.random(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);}
function toast(t){const el=qs("#toast");el.innerHTML=`<div class="toast">${t}</div>`;el.style.opacity=1;setTimeout(()=>el.style.opacity=0,1500);}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));}
function updateStatsCounters(){
  setStat("statQuestions", State.pool.length);
  setStat("statTopics", State.topics.size);
  setStat("statTickets", State.byTicket.size);
}
function setStat(id, value){
  const el = qs(`#${id}`);
  if(!el) return;
  el.textContent = value ? value.toLocaleString("ru-RU") : "0";
}
