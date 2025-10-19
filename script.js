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
  lastTouchTs: 0, // защита от двойного срабатывания (touchstart + click)
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
  setLoader(8);
  await loadTickets(p => setLoader(8 + Math.floor(p*80)));
  setLoader(100);
  setTimeout(()=>showLoader(false), 250);
  renderHome();
}

/* =======================
   Лоадер
======================= */
function showLoader(v){ qs("#loader").classList.toggle("hidden", !v); }
function setLoader(p){ qs("#loaderBar").style.width = Math.max(0,Math.min(100,p))+"%"; }

/* =======================
   Навигация
======================= */
function setView(html){
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
      <p style="margin:.35rem 0 0;color:var(--muted)">⚡ Быстрая дуэль, 📚 Темы, 🎟️ Билеты</p>
    </div>
  `);
}
function setActive(id){
  qsa(".menu .btn").forEach(b=>b.classList.remove("active"));
  if(id) qs("#"+id)?.classList.add("active");
}

/* =======================
   Меню
======================= */
function bindMenu(){
  qsa(".menu [data-action]").forEach(btn=>{
    btn.addEventListener("click", (e)=>{
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
   Стабильная делегация событий (touchstart + click)
======================= */
function bindDelegation(){
  const screen = qs("#screen");
  screen.addEventListener("touchstart", handleTap, { passive:false });
  screen.addEventListener("click", (e)=>{
    // игнорируем клики, которые следуют сразу за touchstart
    if (Date.now() - State.lastTouchTs < 350) return;
    handleTap(e);
  }, { passive:false });
}

function handleTap(e){
  // фикс для некоторых WebView: если это touchstart — помечаем время
  if (e.type === "touchstart") State.lastTouchTs = Date.now();

  const ans = e.target.closest("button.answer");
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
    startDuel({mode:"topic", topic: topic.dataset.t});
    return;
  }
  if (e.target.id === "again"){ e.preventDefault(); startDuel(State.duel?.topic?{mode:"topic",topic:State.duel.topic}:{mode:"quick"}); return; }
  if (e.target.id === "home"){ e.preventDefault(); renderHome(); return; }
}

/* =======================
   Загрузка вопросов
======================= */
async function loadTickets(onProgress){
  const TOTAL = 40; let loaded = 0;
  const raw = [];

  for(let i=1;i<=TOTAL;i++){
    const names = [
      `Билет ${i}.json`, `Билет_${i}.json`,
      `${i}.json`, `ticket_${i}.json`
    ];
    let ok=false;
    for(const name of names){
      const url = `questions/A_B/tickets/${encodeURIComponent(name)}`;
      try{
        const r = await fetch(url, { cache: "no-store" });
        if(!r.ok) continue;
        const data = await r.json();
        const arr = Array.isArray(data) ? data : (data.questions || data.list || data.data || []);
        for(const q of arr) if(q.ticket_number==null) q.ticket_number = `Билет ${i}`;
        raw.push(...arr);
        ok=true; break;
      }catch{}
    }
    onProgress && onProgress(++loaded/TOTAL);
  }

  const norm = normalizeQuestions(raw);
  for(const q of norm){
    State.pool.push(q);
    (State.byTicket.get(q.ticket) ??= []).push(q);
    for(const t of q.topics) (State.topics.get(t) ??= []).push(q);
  }
  console.log(`✅ Загружено ${State.pool.length} вопросов, билетов: ${State.byTicket.size}, тем: ${State.topics.size}`);
}

/* =======================
   Нормализация
======================= */
function normalizeQuestions(raw){
  const out=[];
  for(const q of raw){
    const answersRaw = q.answers || q.variants || q.options || [];
    const answers = answersRaw.map(a => a?.answer_text ?? a?.text ?? a?.title ?? String(a));

    // Правильный индекс: сначала по флагу, потом по строке "Правильный ответ: N", потом по числовым полям
    let correctIndex = answersRaw.findIndex(a => a?.is_correct===true || a?.correct===true || a?.isRight===true);
    if (correctIndex < 0 && typeof q.correct_answer === "string"){
      const m = q.correct_answer.match(/(\d+)/);
      if (m){ const n = parseInt(m[1],10); if (!Number.isNaN(n)) correctIndex = n-1; }
    }
    if (correctIndex < 0 && typeof q.correct === "number") correctIndex = q.correct>0 ? q.correct-1 : q.correct;
    if (correctIndex < 0 && typeof q.correct_index === "number") correctIndex = q.correct_index;
    if (correctIndex < 0 && typeof q.correctIndex === "number") correctIndex = q.correctIndex;
    if (!Number.isInteger(correctIndex) || correctIndex<0 || correctIndex>=answers.length) correctIndex = 0;

    // Билет: "Билет 1" -> 1
    const ticket = parseTicketNumber(q.ticket_number ?? q.ticket);

    // Картинка: убираем ./ и корректно собираем путь
    const image = normalizeImagePath(q.image ?? q.img ?? null);

    out.push({
      id: q.id ?? cryptoId(),
      question: q.question ?? q.title ?? "Вопрос",
      answers: answers.length?answers:["Да","Нет","Не знаю"],
      correctIndex,
      ticket,
      topics: toArray(q.topic),
      image,
      tip: q.answer_tip ?? q.tip ?? ""
    });
  }
  return out;
}
function parseTicketNumber(val){
  if (val == null) return null;
  const m = String(val).match(/(\d+)/);
  return m ? parseInt(m[1],10) : null;
}
function toArray(x){ return Array.isArray(x) ? x : (x ? [x] : []); }
function cryptoId(){ try{ return crypto.randomUUID(); } catch{ return 'id-'+Math.random().toString(36).slice(2);}}

/* =======================
   Экраны
======================= */
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

function uiStats(){
  setView(`<div class="card"><h3>Статистика</h3><p>Скоро здесь будет прогресс дуэлей.</p></div>`);
}

/* =======================
   Викторина / Дуэль
======================= */
function startDuel({mode,topic=null}){
  const src = topic ? (State.topics.get(topic)||[]) : State.pool;
  if(!src.length){ setView(`<div class="card"><h3>Дуэль</h3><p>⚠️ Данных нет</p></div>`); return; }
  const q = shuffle(src).slice(0,20);
  State.duel = { mode, topic, i:0, me:0, q };
  renderQuestion();
}
function startTicket(n){
  const arr = State.byTicket.get(n) || [];
  if(!arr.length){ setView(`<div class="card"><h3>Билет ${n}</h3><p>⚠️ Вопросы не найдены</p></div>`); return; }
  const q = arr.length>20 ? shuffle(arr).slice(0,20) : arr.slice(0,20);
  State.duel = { mode:"ticket", topic:null, i:0, me:0, q };
  renderQuestion();
}

function renderQuestion(){
  const d = State.duel, q = d.q[d.i];
  setView(`
    <div class="card">
      <div class="meta">
        <div>Вопрос ${d.i+1}/${d.q.length}${q.ticket!=null?` • Билет ${esc(q.ticket)}`:""}${d.topic?` • Тема: ${esc(d.topic)}`:""}</div>
      </div>
      <h3>${esc(q.question)}</h3>
      ${q.image?`<img class="qimg" src="${imgQuestion(q.image)}" alt="" onerror="this.style.display='none'"/>`:""}
      <div class="grid">
        ${q.answers.map((a,i)=>`<button type="button" class="answer" data-i="${i}">${esc(a)}</button>`).join("")}
      </div>
      <div id="tip" class="meta" style="margin-top:10px;display:none">
        <span class="badge">💡 Подсказка</span><span>${esc(q.tip||"")}</span>
      </div>
      <div class="meta" style="margin-top:10px"><div>Ты: <b>${d.me}</b></div></div>
    </div>
  `);
  // Сбрасываем блокировку на каждый новый вопрос
  State.lock = false;
}

function onAnswer(idx){
  if(State.lock) return;
  const d=State.duel; if(!d) return;
  const q=d.q[d.i]; const correct=q.correctIndex ?? 0;

  // блок повторных тапов
  State.lock = true;

  const items = qsa(".answer");
  items.forEach((el,i)=>{
    el.disabled = true;
    el.classList.add(i===correct?"correct":(i===idx?"wrong":""));
  });

  if(idx===correct){
    d.me++; toast("✅ Верно!");
  }else{
    toast("❌ Ошибка");
    const tip=qs("#tip"); if(tip) tip.style.display="flex";
  }

  // Гарантированный переход на новую «страницу»
  setTimeout(()=>{
    d.i++;
    if(d.i<d.q.length){
      renderQuestion();
    }else{
      finishDuel();
    }
  }, 900);
}

function finishDuel(){
  const d=State.duel;
  setView(`
    <div class="card">
      <h3>${d.me>=Math.ceil(d.q.length*0.6)?"🏆 Отлично!":"🏁 Завершено"}</h3>
      <p style="margin:.35rem 0 0">Верных: <b>${d.me}</b> из ${d.q.length}</p>
      <div class="grid two" style="margin-top:10px">
        <button class="btn btn-primary" id="again">Ещё раз</button>
        <button class="btn" id="home">На главную</button>
      </div>
    </div>
  `);
}

/* =======================
   Утилиты
======================= */
const qs  = s => document.querySelector(s);
const qsa = s => [...document.querySelectorAll(s)];
function toast(text){ const t=qs("#toast"); t.innerHTML=`<div class="toast">${esc(text)}</div>`; t.style.opacity=1; setTimeout(()=>t.style.opacity=0,1400); }
function shuffle(a){ return a.map(x=>[Math.random(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]); }
function esc(s){ return String(s??"").replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m])); }

function normalizeImagePath(img){
  if(!img) return null;
  let name = String(img).trim();
  // убираем ведущие ./ и /
  name = name.replace(/^(\.\/)+/,'').replace(/^\/+/,'');
  // если уже начинается с images/ — используем как есть
  if(/^images\//i.test(name)) return name;
  // если начинается с A_B/ → это подпапка в images
  if(/^A_B\//i.test(name)) return "images/" + name;
  // если начинается с images/A_B/ уже правильно
  if(/^images\/A_B\//i.test(name)) return name;
  // иначе кладём по умолчанию в images/…
  return "images/" + name;
}
function imgQuestion(img){ return normalizeImagePath(img) || ""; }

/* =======================
   Конец
======================= */
