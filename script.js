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
  markup: null,
  penalties: null,
};

const MANIFEST_URL = "questions/index.json";
const MARKUP_URL = "markup/markup.json";
const PENALTIES_URL = "penalties/penalties.json";
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

function setView(html, { subpage = true, title = "" } = {}){
  toggleSubpage(subpage);
  const host = qs("#screen");
  host.scrollTop = 0;
  const content = subpage ? wrapSubpage(title, html) : html;
  host.innerHTML = `<div class="view">${content}</div>`;
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

function wrapSubpage(title, html){
  const safe = esc((title || "ПДД ДУЭЛИ").trim());
  return `
    <header class="subpage-header">
      <button type="button" class="back-btn" data-back aria-label="Назад">
        <span class="back-btn__icon" aria-hidden="true"></span>
        <span class="back-btn__label">Назад</span>
      </button>
      <h2 class="subpage-title">${safe}</h2>
    </header>
    ${html}
  `;
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
      if (act==="markup")   uiMarkup();
      if (act==="penalties")uiPenalties();
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
  if (ans && ans.dataset.i != null){
    e.preventDefault();
    if (ans.disabled) return;
    onAnswer(+ans.dataset.i);
    return;
  }
  const ticket = e.target.closest("[data-ticket]");
  if (ticket){ e.preventDefault(); startTicket(ticket.dataset.ticket); return; }
  const topic = e.target.closest("[data-t]");
  if (topic){ e.preventDefault(); startDuel({mode:"topic", topic: topic.dataset.t}); return; }
  const back = e.target.closest("[data-back]");
  if (back){ e.preventDefault(); renderHome(); return; }
  const dot = e.target.closest("[data-question]");
  if (dot){
    e.preventDefault();
    if (dot.disabled) return;
    goToQuestion(+dot.dataset.question);
    return;
  }
  if (e.target.closest("[data-prev]")){
    e.preventDefault();
    previousQuestion();
    return;
  }
  if (e.target.closest("[data-next]")){
    e.preventDefault();
    nextQuestion();
    return;
  }
  if (e.target.closest("[data-finish]")){
    e.preventDefault();
    finishDuel();
    return;
  }
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

async function loadMarkup(){
  if (Array.isArray(State.markup)) return State.markup;
  const response = await fetch(MARKUP_URL, { cache:"no-store" });
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  const groups = Object.entries(payload || {}).map(([title, data])=>{
    const items = Object.values(data || {}).map(item=>({
      number: item.number || "",
      description: item.description || "",
      image: normalizeImagePath(item.image)
    })).sort((a,b)=>a.number.localeCompare(b.number,'ru',{numeric:true,sensitivity:'base'}));
    return { title, items };
  }).sort((a,b)=>a.title.localeCompare(b.title,'ru',{sensitivity:'base'}));
  State.markup = groups;
  return groups;
}

async function loadPenalties(){
  if (Array.isArray(State.penalties)) return State.penalties;
  const response = await fetch(PENALTIES_URL, { cache:"no-store" });
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  const lines = text.split(/\n+/).map(line=>line.trim()).filter(Boolean);
  const items = [];
  for(const line of lines){
    try {
      const obj = JSON.parse(line);
      items.push({
        articlePart: obj.article_part || obj.articlePart || "—",
        text: obj.text || "",
        penalty: obj.penalty || ""
      });
    } catch(err){
      console.error("Не удалось разобрать штраф:", err, line);
    }
  }
  items.sort((a,b)=>a.articlePart.localeCompare(b.articlePart,'ru',{numeric:true,sensitivity:'base'}));
  State.penalties = items;
  return items;
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

    const image = normalizeImagePath(q.image);

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
    const key = item.id || `${item.ticket_number||"?"}:${item.question}`;
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

function normalizeImagePath(path){
  const raw = (path ?? "").toString().trim();
  if(!raw) return "";
  const withoutDots = raw.replace(/^\.+/, "").replace(/^\/+/, "");
  if(/^https?:/i.test(raw)) return raw;
  if(/^https?:/i.test(withoutDots)) return withoutDots;
  if(!withoutDots) return "";
  if(withoutDots.startsWith("images/")) return withoutDots;
  return `images/${withoutDots}`;
}

/* =======================
   Экраны
======================= */
function uiTopics(){
  const list=[...State.topics.keys()].sort((a,b)=>a.localeCompare(b,'ru'));
  if(!list.length){ setView(`<div class="card"><h3>Темы</h3><p>❌ Темы не найдены</p></div>`, { subpage: true, title: "Темы" }); return; }
  setView(`
    <div class="card"><h3>Темы</h3></div>
    <div class="card"><div class="grid auto">
      ${list.map(t=>`<button type="button" class="answer" data-t="${esc(t)}">${esc(t)}</button>`).join("")}
    </div></div>
  `, { subpage: true, title: "Темы" });
}

function uiTickets(){
  const tickets = [...State.byTicket.entries()].map(([key, meta]) => ({
    key,
    label: meta.label || key,
    order: Number.isFinite(meta.order) ? meta.order : Number.MAX_SAFE_INTEGER,
    questions: meta.questions
  })).sort((a,b)=> a.order - b.order || a.label.localeCompare(b.label,'ru'));
  if(!tickets.length){
    setView(`<div class="card"><h3>Билеты</h3><p>❌ Билеты не найдены</p></div>`, { subpage: true, title: "Билеты" });
    return;
  }
  setView(`
    <div class="card"><h3>Билеты</h3></div>
    <div class="card"><div class="grid auto">
      ${tickets.map(t=>`<button type="button" class="answer" data-ticket="${esc(t.key)}">${esc(t.label)}</button>`).join("")}
    </div></div>
  `, { subpage: true, title: "Билеты" });
}

async function uiMarkup(){
  setView(`<div class="card"><h3>Дорожная разметка</h3><p class="meta">Загружаем данные…</p></div>`, { subpage: true, title: "Разметка" });
  try {
    const groups = await loadMarkup();
    if(!groups.length){
      setView(`<div class="card"><h3>Дорожная разметка</h3><p>❌ Данные не найдены</p></div>`, { subpage: true, title: "Разметка" });
      return;
    }
    const total = groups.reduce((acc,g)=>acc + g.items.length, 0);
    setView(`
      <div class="card">
        <h3>Дорожная разметка</h3>
        <p class="meta">Типов: ${formatNumber(total)} в ${formatNumber(groups.length)} разделах</p>
      </div>
      ${groups.map(group=>`
        <section class="card markup-category">
          <h3>${esc(group.title)}</h3>
          <div class="markup-list">
            ${group.items.map(item=>`
              <article class="markup-item">
                <header class="markup-item__head">
                  <span class="markup-item__badge">${esc(item.number)}</span>
                </header>
                ${item.image ? `<img src="${item.image}" alt="Разметка ${esc(item.number)}" loading="lazy" class="markup-item__image" />` : ""}
                <p>${esc(item.description)}</p>
              </article>
            `).join("")}
          </div>
        </section>
      `).join("")}
    `, { subpage: true, title: "Разметка" });
  } catch(err){
    console.error("Не удалось загрузить разметку:", err);
    setView(`<div class="card"><h3>Дорожная разметка</h3><p>⚠️ Ошибка загрузки данных</p></div>`, { subpage: true, title: "Разметка" });
  }
}

async function uiPenalties(){
  setView(`<div class="card"><h3>Штрафы</h3><p class="meta">Загружаем данные…</p></div>`, { subpage: true, title: "Штрафы" });
  try {
    const list = await loadPenalties();
    if(!list.length){
      setView(`<div class="card"><h3>Штрафы</h3><p>❌ Данные не найдены</p></div>`, { subpage: true, title: "Штрафы" });
      return;
    }
    setView(`
      <div class="card">
        <h3>Штрафы</h3>
        <p class="meta">Записей: ${formatNumber(list.length)}</p>
      </div>
      <div class="card penalties-card">
        <div class="penalties-grid">
          ${list.map(item=>`
            <article class="penalty">
              <h4>${esc(item.articlePart)}</h4>
              <p>${esc(item.text)}</p>
              <p class="penalty__fine">${esc(item.penalty)}</p>
            </article>
          `).join("")}
        </div>
      </div>
    `, { subpage: true, title: "Штрафы" });
  } catch(err){
    console.error("Не удалось загрузить штрафы:", err);
    setView(`<div class="card"><h3>Штрафы</h3><p>⚠️ Ошибка загрузки данных</p></div>`, { subpage: true, title: "Штрафы" });
  }
}

function uiStats(){
  setView(`<div class="card"><h3>Статистика</h3><p>Скоро здесь будет прогресс дуэлей.</p></div>`, { subpage: true, title: "Статистика" });
}

/* =======================
   Викторина
======================= */
function startDuel({mode,topic=null}){
  const src = topic ? (State.topics.get(topic)||[]) : State.pool;
  if(!src.length){ setView(`<div class="card"><h3>Дуэль</h3><p>⚠️ Нет данных</p></div>`, { subpage: true, title: topic || "Дуэль" }); return; }
  const q = shuffle(src).slice(0,20);
  State.duel = {
    mode,
    topic,
    i:0,
    me:0,
    q,
    answers: Array(q.length).fill(null),
    furthest: 0,
    completed: false
  };
  renderQuestion(0);
}
function startTicket(key){
  const bucket = State.byTicket.get(key);
  const arr = bucket?.questions || [];
  if(!arr.length){ setView(`<div class="card"><h3>${esc(bucket?.label || key)}</h3><p>⚠️ Нет вопросов</p></div>`, { subpage: true, title: bucket?.label || "Билет" }); return; }
  const q = arr.length>20 ? shuffle(arr).slice(0,20) : arr.slice(0,20);
  State.duel = {
    mode:"ticket",
    topic:null,
    i:0,
    me:0,
    q,
    ticketLabel: bucket?.label || key,
    answers: Array(q.length).fill(null),
    furthest: 0,
    completed: false
  };
  renderQuestion(0);
}

function renderQuestion(targetIndex){
  const d = State.duel;
  if(!d || !Array.isArray(d.q)) return;
  if(typeof targetIndex !== "number") targetIndex = d.i;
  if(targetIndex >= d.q.length){
    finishDuel();
    return;
  }
  d.i = Math.max(0, Math.min(targetIndex, d.q.length - 1));
  const q = d.q[d.i];
  const ticketInfo = q.ticketLabel || (State.duel?.ticketLabel) || (q.ticketNumber ? `Билет ${q.ticketNumber}` : "Билет");
  const headerTitle = d.mode === "topic" && d.topic ? d.topic : (d.mode === "ticket" ? (State.duel?.ticketLabel || ticketInfo) : "Дуэль");
  const answerState = d.answers[d.i];
  const isAnswered = !!(answerState && answerState.status);
  const tracker = renderTracker();
  const controls = renderQuestionControls(isAnswered);

  setView(`
    ${tracker}
    <div class="card">
      <div class="meta">Вопрос ${d.i+1}/${d.q.length} • ${esc(ticketInfo)}</div>
      <h3>${esc(q.question)}</h3>
      ${q.image?`<img src="${q.image}" class="qimg" onerror="this.style.display='none'"/>`:""}
      <div class="grid">${q.answers.map((a,i)=>renderAnswerButton(a, i, q, answerState)).join("")}</div>
      <div id="tip" class="meta" style="${answerState?.status === "wrong" ? "display:block" : "display:none"};margin-top:8px;color:#ccc">💡 ${esc(q.tip)}</div>
    </div>
    ${controls}
  `, { subpage: true, title: headerTitle });
  State.lock = false;
}

function onAnswer(i){
  if(State.lock) return;
  State.lock = true;
  const d = State.duel, q = d.q[d.i];
  const correct = q.correctIndex;
  const prev = d.answers[d.i];
  if(prev?.status) return;

  const isCorrect = (i === correct);
  if(isCorrect) d.me++;

  d.answers[d.i] = { status: isCorrect ? "correct" : "wrong", selected: i };
  d.furthest = Math.min(d.q.length - 1, Math.max(d.furthest, d.i + 1));

  if(isCorrect){ toast("✅ Верно!"); }
  else { toast("❌ Ошибка"); }

  renderQuestion(d.i);
}

function finishDuel(){
  const d=State.duel;
  if(!d || d.completed) return;
  d.completed = true;
  const headerTitle = d.mode === "ticket" ? (d.ticketLabel || "Билет") : (d.mode === "topic" && d.topic ? d.topic : "Дуэль");
  setView(`
    <div class="card">
      <h3>${d.me>=Math.ceil(d.q.length*0.6)?"🏆 Отлично!":"🏁 Завершено"}</h3>
      <p>Верных: <b>${d.me}</b> из ${d.q.length}</p>
      <div class="grid two" style="margin-top:10px">
        <button class="btn btn-primary" id="again">Ещё раз</button>
        <button class="btn" id="home">На главную</button>
      </div>
    </div>
  `, { subpage: true, title: headerTitle });
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
function formatNumber(value){
  return Number.isFinite(value) ? value.toLocaleString("ru-RU") : "0";
}

function renderTracker(){
  const d = State.duel;
  if(!d) return "";
  return `
    <nav class="question-tracker" aria-label="Прогресс вопросов">
      ${d.q.map((_, idx)=>{
        const info = d.answers[idx];
        const status = info?.status;
        const classes = ["tracker-dot"];
        if(idx === d.i) classes.push("is-current");
        if(status === "correct") classes.push("is-correct");
        if(status === "wrong") classes.push("is-wrong");
        const disabled = idx > d.furthest ? "disabled" : "";
        return `<button type="button" class="${classes.join(" ")}" data-question="${idx}" ${disabled}><span>${idx+1}</span></button>`;
      }).join("")}
    </nav>
  `;
}

function renderAnswerButton(text, index, question, answerState){
  const classes = ["answer"];
  let disabled = "";
  if(answerState?.status){
    disabled = "disabled";
    if(index === question.correctIndex) classes.push("correct");
    if(answerState.status === "wrong" && index === answerState.selected) classes.push("wrong");
  }
  return `<button class="${classes.join(" ")}" data-i="${index}" ${disabled}>${esc(text)}</button>`;
}

function renderQuestionControls(isAnswered){
  const d = State.duel;
  if(!d) return "";
  const atStart = d.i === 0;
  const atEnd = d.i === d.q.length - 1;
  const nextLabel = atEnd ? "Завершить" : "Следующий";
  const nextAttr = atEnd ? "data-finish" : "data-next";
  const prevBtn = `<button class="btn ghost nav-btn" data-prev ${atStart?"disabled":""}>⬅️ Назад</button>`;
  const nextBtn = `<button class="btn btn-primary nav-btn" ${nextAttr} ${isAnswered?"":"disabled"}>${nextLabel} ➡️</button>`;
  return `
    <div class="question-controls">
      ${prevBtn}
      ${nextBtn}
    </div>
  `;
}

function goToQuestion(index){
  const d = State.duel;
  if(!d) return;
  const target = Math.max(0, Math.min(index, d.q.length - 1));
  if(target > d.furthest) return;
  renderQuestion(target);
}

function nextQuestion(){
  const d = State.duel;
  if(!d) return;
  if(d.i >= d.q.length - 1){
    if(d.answers[d.i]?.status){
      finishDuel();
    }
    return;
  }
  if(!d.answers[d.i]?.status) return;
  d.furthest = Math.min(d.q.length - 1, Math.max(d.furthest, d.i + 1));
  renderQuestion(d.i + 1);
}

function previousQuestion(){
  const d = State.duel;
  if(!d) return;
  if(d.i <= 0) return;
  renderQuestion(d.i - 1);
}
