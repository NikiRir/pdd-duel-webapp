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

const MANIFEST_URL = "questions/index.json";
const FALLBACK_MANIFEST = {
  tickets: [
    "A_B/tickets/Билет 1.json",
    "A_B/tickets/Билет 2.json",
    "A_B/tickets/Билет 3.json",
    "A_B/tickets/Билет 4.json",
    "A_B/tickets/Билет 5.json",
    "A_B/tickets/Билет 6.json",
    "A_B/tickets/Билет 7.json",
    "A_B/tickets/Билет 8.json",
    "A_B/tickets/Билет 9.json",
    "A_B/tickets/Билет 10.json",
    "A_B/tickets/Билет 11.json",
    "A_B/tickets/Билет 12.json",
    "A_B/tickets/Билет 13.json",
    "A_B/tickets/Билет 14.json",
    "A_B/tickets/Билет 15.json",
    "A_B/tickets/Билет 16.json",
    "A_B/tickets/Билет 17.json",
    "A_B/tickets/Билет 18.json",
    "A_B/tickets/Билет 19.json",
    "A_B/tickets/Билет 20.json",
    "A_B/tickets/Билет 21.json",
    "A_B/tickets/Билет 22.json",
    "A_B/tickets/Билет 23.json",
    "A_B/tickets/Билет 24.json",
    "A_B/tickets/Билет 25.json",
    "A_B/tickets/Билет 26.json",
    "A_B/tickets/Билет 27.json",
    "A_B/tickets/Билет 28.json",
    "A_B/tickets/Билет 29.json",
    "A_B/tickets/Билет 30.json",
    "A_B/tickets/Билет 31.json",
    "A_B/tickets/Билет 32.json",
    "A_B/tickets/Билет 33.json",
    "A_B/tickets/Билет 34.json",
    "A_B/tickets/Билет 35.json",
    "A_B/tickets/Билет 36.json",
    "A_B/tickets/Билет 37.json",
    "A_B/tickets/Билет 38.json",
    "A_B/tickets/Билет 39.json",
    "A_B/tickets/Билет 40.json"
  ]
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
function showLoader(v){
  const isVisible = !!v;
  qs("#loader").classList.toggle("hidden", !isVisible);
  document.body.classList.toggle("is-loading", isVisible);
}
function setLoader(p){ qs("#loaderBar").style.width = Math.max(0,Math.min(100,p))+"%"; }

/* =======================
   Навигация
======================= */
function toggleSubpage(isSub){
  const appRoot = qs(".app");
  const isSubpage = !!isSub;
  appRoot?.classList.toggle("app--subpage", isSubpage);
  setActive(null);
  if (!isSubpage) return;

  const screen = document.querySelector("#screen");
  screen?.scrollIntoView({ block: "start", behavior: "smooth" });
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
  const ticket = e.target.closest("[data-ticket]");
  if (ticket){ e.preventDefault(); startTicket(ticket.dataset.ticket); return; }
  const topic = e.target.closest("[data-t]");
  if (topic){ e.preventDefault(); startDuel({mode:"topic", topic: topic.dataset.t}); return; }
  if (e.target.id === "again"){ e.preventDefault(); startDuel(State.duel?.topic?{mode:"topic",topic:State.duel.topic}:{mode:"quick"}); return; }
  if (e.target.id === "home"){ e.preventDefault(); renderHome(); return; }
}

/* =======================
   Загрузка билетов
======================= */
async function loadTickets(onProgress){
  if(State.pool.length) return State.pool;

  let manifest = null;
  try {
    manifest = await fetchJson(MANIFEST_URL);
  } catch(err){
    console.warn("⚠️ Не удалось загрузить manifest, используем запасной список", err);
  }

  const ticketFiles = uniqueStrings([
    ...(manifest?.tickets || []),
    ...FALLBACK_MANIFEST.tickets
  ]);
  if(!ticketFiles.length){
    console.warn("⚠️ Нет списка билетов для загрузки");
    return [];
  }

  const raw = [];
  let loaded = 0;
  const total = ticketFiles.length;

  for(const file of ticketFiles){
    const url = `questions/${encodePath(file)}`;
    try {
      const response = await fetch(url, { cache:"no-store" });
      if(!response.ok) throw new Error(`HTTP ${response.status}`);

      const payload = await response.json();
      const list = Array.isArray(payload) ? payload : (payload.questions || payload.list || payload.data || []);
      const ticketLabel = extractTicketLabel(file);
      for(const item of list){
        if(!item.ticket_number) item.ticket_number = ticketLabel;
        if(!item.ticket_category) item.ticket_category = "A,B";
        if(!item.__bucket) item.__bucket = ticketLabel;
      }
      raw.push(...list);
    } catch (err){
      console.error(`Не удалось загрузить ${file}:`, err);
    }

    loaded += 1;
    onProgress && onProgress(loaded / total);
    await delay(12);
  }

  const unique = deduplicate(raw);
  const norm = normalizeQuestions(unique);
  for(const q of norm){
    State.pool.push(q);
    const bucketKey = q.ticketKey;
    if (!State.byTicket.has(bucketKey)){
      State.byTicket.set(bucketKey, { label: q.ticketLabel, order: q.ticketNumber ?? Number.MAX_SAFE_INTEGER, questions: [] });
    }
    const bucket = State.byTicket.get(bucketKey);
    bucket.order = Math.min(bucket.order, Number.isFinite(q.ticketNumber) ? q.ticketNumber : Number.MAX_SAFE_INTEGER);
    bucket.questions.push(q);

    for(const t of q.topics){
      if (!State.topics.has(t)) State.topics.set(t, []);
      State.topics.get(t).push(q);
    }
  }

  console.log(`✅ Загружено ${State.pool.length} вопросов`);
  return State.pool;
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

    const ticketLabel = deriveTicketLabel(q);
    const ticketNumber = deriveTicketNumber(ticketLabel);
    const ticketKey = ticketLabel || (ticketNumber ? `Билет ${ticketNumber}` : `ticket-${out.length}`);

    let image = (q.image || "").replace(/^\.\//,"");
    if (image && !image.startsWith("images/")) image = "images/" + image;

    out.push({
      question: q.question || q.title || "Вопрос",
      answers,
      correctIndex,
      tip: q.answer_tip || q.tip || "",
      ticketNumber,
      ticketLabel,
      ticketKey,
      topics: Array.isArray(q.topic) ? q.topic : q.topic ? [q.topic] : [],
      image
    });
  }
  return out;
}

function deriveTicketLabel(q){
  if (typeof q.ticket_number === "string" && q.ticket_number.trim()) return q.ticket_number.trim();
  if (typeof q.ticket === "string" && q.ticket.trim()) return q.ticket.trim();
  if (typeof q.__bucket === "string" && q.__bucket.trim()) return q.__bucket.trim();
  if (typeof q.ticket === "number" && Number.isFinite(q.ticket)) return `Билет ${q.ticket}`;
  return "Билет";
}

function deriveTicketNumber(label){
  if (typeof label !== "string") return undefined;
  const match = label.match(/\d+/);
  if (!match) return undefined;
  const value = parseInt(match[0], 10);
  return Number.isFinite(value) ? value : undefined;
}

function deduplicate(raw){
  const seen = new Set();
  const out = [];
  for(const item of raw){
    const key = item.id || `${item.ticket_number||"?")}:${item.question}`;
    if(seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function uniqueStrings(list){
  const seen = new Set();
  const out = [];
  for(const item of list){
    if (typeof item !== "string" || !item.trim()) continue;
    const normalized = item.trim();
    if(seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function encodePath(path){
  return path.split("/").map(encodeURIComponent).join("/");
}

function extractTicketLabel(path){
  const fileName = path.split("/").pop() || "";
  const plain = fileName.replace(/\.json$/i, "");
  return plain.replace(/_/g, " ") || "Билет";
}

async function fetchJson(url){
  const response = await fetch(url, { cache:"no-store" });
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
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
  const tickets = [...State.byTicket.entries()].map(([key, meta]) => ({
    key,
    label: meta.label || key,
    order: Number.isFinite(meta.order) ? meta.order : Number.MAX_SAFE_INTEGER,
    questions: meta.questions
  })).sort((a,b)=> a.order - b.order || a.label.localeCompare(b.label,'ru'));
  if(!tickets.length){ setView(`<div class="card"><h3>Билеты</h3><p>❌ Билеты не найдены</p></div>`, { subpage: true }); return; }
  setView(`
    <div class="card"><h3>Билеты</h3></div>
    <div class="card"><div class="grid auto">
      ${tickets.map(t=>`<button type="button" class="answer" data-ticket="${esc(t.key)}">${esc(t.label)}</button>`).join("")}
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
function startTicket(key){
  const bucket = State.byTicket.get(key);
  const arr = bucket?.questions || [];
  if(!arr.length){ setView(`<div class="card"><h3>${esc(bucket?.label || key)}</h3><p>⚠️ Нет вопросов</p></div>`, { subpage: true }); return; }
  const q = arr.length>20 ? shuffle(arr).slice(0,20) : arr.slice(0,20);
  State.duel = { mode:"ticket", topic:null, i:0, me:0, q, ticketLabel: bucket?.label || key };
  renderQuestion();
}

function renderQuestion(){
  const d = State.duel, q = d.q[d.i];
  const ticketInfo = q.ticketLabel || (State.duel?.ticketLabel) || (q.ticketNumber ? `Билет ${q.ticketNumber}` : "Билет");
  setView(`
    <div class="card">
      <div class="meta">Вопрос ${d.i+1}/${d.q.length} • ${esc(ticketInfo)}</div>
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
function esc(s){return String(s??"").replace(/[&<>\"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));}
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
