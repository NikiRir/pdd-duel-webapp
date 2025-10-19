/* =======================
   ГЛОБАЛЬНОЕ СОСТОЯНИЕ
======================= */
const State = {
  pool: [],            // все вопросы
  byTicket: new Map(), // номер билета -> вопросы
  topics: new Map(),   // тема -> вопросы
  penalties: null,     // штрафы
  markup: null,        // разметка
  duel: null
};

/* =======================
   СТАРТ
======================= */
document.addEventListener("DOMContentLoaded", () => {
  bindMenu();
  initApp();
});

async function initApp() {
  toast("📥 Загружаю билеты, темы, разметку и штрафы…");
  await loadTicketsAndBuildTopics();    // билеты + темы из билетов
  await Promise.all([loadPenalties(), loadMarkup()]);
  toast(`✅ Вопросов: ${State.pool.length} • Тем: ${State.topics.size}${State.penalties ? " • Штрафов: "+State.penalties.length : ""}${State.markup ? " • Элементов разметки: "+State.markup.length : ""}`);
}

/* =======================
   ПОДКЛЮЧЕНИЕ КНОПОК
======================= */
function bindMenu(){
  qs("#btnQuickDuel").onclick  = () => startDuel({mode:"quick"});
  qs("#btnTopics").onclick     = () => uiTopics();
  qs("#btnTickets").onclick    = () => uiTickets();
  qs("#btnMarkup").onclick     = () => uiMarkup();
  qs("#btnPenalties").onclick  = () => uiPenalties();
  qs("#btnStats").onclick      = () => toast("📊 Статистика покажется при открытии через Telegram WebApp");
}

/* =======================
   ЗАГРУЗКА ДАННЫХ
======================= */

/** Загружаем 40 билетов: questions/A_B/tickets/Билет 1.json ... Билет 40.json */
async function loadTicketsAndBuildTopics(){
  const questions = [];
  for(let i=1;i<=40;i++){
    const file = encodeURIComponent(`Билет ${i}.json`);
    const path = `questions/A_B/tickets/${file}`;
    try{
      const res = await fetch(path, { cache: "no-store" });
      if(!res.ok) { console.warn("Билет не найден:", path); continue; }
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.questions || []);
      // проставим ticket_number, если вдруг не задан в файле
      for(const q of list){ if(q.ticket_number == null) q.ticket_number = i; }
      questions.push(...list);
    }catch(e){ console.warn("Ошибка загрузки билета:", path, e); }
  }

  // нормализация и раскладка по билетам/темам
  const norm = normalizeQuestions(questions);
  for(const q of norm){
    State.pool.push(q);
    // билеты
    if(q.ticket != null){
      const arr = State.byTicket.get(q.ticket) || [];
      arr.push(q); State.byTicket.set(q.ticket, arr);
    }
    // темы (строим из поля topic самого вопроса)
    for(const t of q.topics){
      const arr = State.topics.get(t) || [];
      arr.push(q); State.topics.set(t, arr);
    }
  }
}

/** penalties/penalties.json */
async function loadPenalties(){
  try{
    const res = await fetch("penalties/penalties.json", { cache: "no-store" });
    if(!res.ok) return;
    const data = await res.json();
    // ожидаем массив объектов со штрафами; если структура иная — подстроимся
    State.penalties = Array.isArray(data) ? data : (data.penalties || data.items || []);
  }catch(e){ /* отсутствие — ок */ }
}

/** markup/markup.json */
async function loadMarkup(){
  try{
    const res = await fetch("markup/markup.json", { cache: "no-store" });
    if(!res.ok) return;
    const data = await res.json();
    const arr = Array.isArray(data) ? data : (data.items || data.markup || []);
    // нормализуем минимально: {id, title, image}
    State.markup = arr.map((x,idx)=>({
      id: x.id ?? idx+1,
      title: x.title || x.name || x.caption || `Элемент ${idx+1}`,
      image: x.image || x.src || x.path || ""
    }));
  }catch(e){ /* отсутствие — ок */ }
}

/* Приводим входные форматы к единому виду */
function normalizeQuestions(raw){
  const out = [];
  for(const q of raw){
    // ответы/правильный вариант
    const answers = (q.answers || []).map(a => a.answer_text ?? a.text ?? String(a));
    const correctIndex = (q.answers || []).findIndex(a => a.is_correct === true || a.correct === true || a.isRight === true);
    // тема (одна или массив)
    const topics = Array.isArray(q.topic) ? q.topic
                 : (q.topic ? [q.topic] : []);
    out.push({
      id: q.id ?? crypto.randomUUID(),
      question: q.question ?? q.title ?? "Вопрос",
      answers: answers.length ? answers : ["Да","Нет","Не знаю"],
      correctIndex: correctIndex >= 0 ? correctIndex : 0,
      ticket: q.ticket_number ?? q.ticket ?? null,
      topics,
      image: q.image ?? q.img ?? null,
      tip: q.answer_tip ?? q.tip ?? null
    });
  }
  return out;
}

/* =======================
   ВИКТОРИНА / ДУЭЛЬ
======================= */
function startDuel({mode, topic=null}){
  const src = topic ? (State.topics.get(topic)||[]) : State.pool;
  if(!src.length){ toast("⚠️ Данные не найдены"); return; }

  const q = shuffle(src).slice(0, 20); // всегда 20 вопросов
  State.duel = { mode, topic, i:0, me:0, ai:0, q, timerMs:25000 };
  renderQuestion();
}

function renderQuestion(){
  const d = State.duel, q = d.q[d.i];
  const s = qs("#screen");
  s.innerHTML = `
    <div class="card">
      <div class="meta">
        <div>Вопрос ${d.i+1}/${d.q.length}${q.ticket!=null ? " • Билет "+escape(q.ticket) : ""}${d.topic ? " • Тема: "+escape(d.topic) : ""}</div>
        <div class="badge">⏱️ 25c</div>
      </div>
      <h3>${escape(q.question)}</h3>
      ${q.image ? `<img class="qimg" src="${resolveQuestionImage(q.image)}" alt=""/>` : ""}
      <div class="grid">
        ${q.answers.map((a,idx)=>`<div class="answer" data-i="${idx}">${escape(a)}</div>`).join("")}
      </div>
      ${q.tip ? `<div class="meta" style="margin-top:8px"><span class="badge">💡 Подсказка</span><span>${escape(q.tip)}</span></div>` : ""}
      <div class="meta" style="margin-top:10px"><div>Ты: <b>${d.me}</b></div><div>ИИ: <b>${d.ai}</b></div></div>
    </div>
  `;

  // обработка кликов
  qsa(".answer").forEach(el => el.onclick = () => finishAnswer(+el.dataset.i));

  function finishAnswer(my){
    const correct = q.correctIndex ?? 0;
    qsa(".answer").forEach((el, i) => {
      el.classList.add(i===correct ? "correct" : (i===my ? "wrong" : ""));
      el.style.pointerEvents = "none";
    });
    if(my === correct){ State.duel.me++; toast("✅ Верно!"); } else { toast("❌ Ошибка"); }

    // ИИ отвечает с 88% точностью
    const ai = Math.random() < 0.88 ? correct : pickWrong(correct, q.answers.length);
    if(ai === correct) State.duel.ai++;

    setTimeout(()=> {
      State.duel.i++;
      if(State.duel.i < State.duel.q.length) renderQuestion(); else finishDuel();
    }, 650);
  }
}

function finishDuel(){
  const d = State.duel;
  qs("#screen").innerHTML = `
    <div class="card">
      <h3>${d.me>d.ai ? "🏆 Победа!" : (d.me<d.ai ? "💀 Поражение" : "🤝 Ничья")}</h3>
      <p style="margin:6px 0 0">Ты: <b>${d.me}</b> • ИИ: <b>${d.ai}</b> • Всего: ${d.q.length}</p>
      <div class="grid two" style="margin-top:10px">
        <button class="btn btn-primary" id="again">Ещё раз</button>
        <button class="btn" id="home">На главную</button>
      </div>
    </div>
  `;
  qs("#again").onclick = () => startDuel({mode:d.mode, topic:d.topic});
  qs("#home").onclick  = () => (qs("#screen").innerHTML = "");
}

/* =======================
   UI: ТЕМЫ / БИЛЕТЫ / РАЗМЕТКА / ШТРАФЫ
======================= */
function uiTopics(){
  const list = [...State.topics.keys()].sort((a,b)=> a.localeCompare(b,'ru'));
  if(!list.length){ toast("❌ Темы не найдены"); return; }
  qs("#screen").innerHTML = `
    <div class="card">
      <h3>Выбери тему</h3>
      <div class="grid auto" style="margin-top:10px">
        ${list.map(t=>`<div class="answer" data-t="${escape(t)}">${escape(t)}</div>`).join("")}
      </div>
    </div>`;
  qsa("[data-t]").forEach(el => el.onclick = () => startDuel({mode:"topic", topic:el.dataset.t}));
}

function uiTickets(){
  const names = [...new Set(State.pool.map(q => q.ticket).filter(v=>v!=null))].sort((a,b)=>a-b);
  if(!names.length){ toast("❌ Билеты не найдены"); return; }
  qs("#screen").innerHTML = `
    <div class="card">
      <h3>Билеты</h3>
      <div class="grid auto" style="margin-top:10px">
        ${names.map(n=>`<div class="answer" data-n="${n}">Билет ${n}</div>`).join("")}
      </div>
    </div>`;
  qsa("[data-n]").forEach(el => el.onclick = () => startTicket(+el.dataset.n));
}

function startTicket(n){
  const arr = State.byTicket.get(n) || [];
  if(!arr.length){ toast("Нет вопросов для билета"); return; }
  State.duel = { mode:"ticket", topic:null, i:0, me:0, ai:0, q: shuffle(arr).slice(0,20), timerMs:25000 };
  renderQuestion();
}

function uiMarkup(){
  if(!State.markup || !State.markup.length){ toast("⚠️ Разметка не найдена"); return; }
  qs("#screen").innerHTML = `
    <div class="card">
      <h3>Дорожная разметка</h3>
      <div class="grid auto" style="margin-top:10px">
        ${State.markup.map(it=>`
          <div class="row">
            <div style="display:flex;gap:10px;align-items:center">
              ${it.image ? `<img src="${resolveMarkupImage(it.image)}" alt="" style="width:64px;height:40px;object-fit:contain;background:#0b1021;border-radius:8px;border:1px solid rgba(255,255,255,.06)"/>` : ""}
              <div>
                <div style="font-weight:700">${escape(it.title)}</div>
                <div style="font-size:12px;color:var(--muted)">ID: ${escape(it.id)}</div>
              </div>
            </div>
          </div>`).join("")}
      </div>
    </div>
  `;
}

function uiPenalties(){
  if(!State.penalties || !State.penalties.length){ toast("⚠️ Штрафы не найдены"); return; }
  qs("#screen").innerHTML = `
    <div class="card">
      <h3>Штрафы</h3>
      <input id="penq" placeholder="Поиск по описанию..." class="row" style="width:100%;outline:none"/>
      <div id="penlist" class="grid" style="margin-top:10px"></div>
    </div>`;
  const list = qs("#penlist");
  const draw = (q="")=>{
    const f = String(q).trim().toLowerCase();
    const items = State.penalties.filter(p=> !f || String(p.title||p.name||p.description||"").toLowerCase().includes(f));
    list.innerHTML = items.map(p=>`
      <div class="row">
        <div style="display:flex;flex-direction:column;gap:4px;flex:1">
          <div style="font-weight:700">${escape(p.title||p.name||"Нарушение")}</div>
          ${p.article ? `<div class="badge">📜 Статья: ${escape(p.article)}</div>` : ""}
        </div>
        <div class="badge" title="Размер штрафа">💸 ${escape(p.fine||p.amount||p.penalty||"—")}</div>
      </div>
    `).join("");
  };
  draw();
  qs("#penq").oninput = e => draw(e.target.value);
}

/* =======================
   УТИЛИТЫ
======================= */
const qs  = s => document.querySelector(s);
const qsa = s => [...document.querySelectorAll(s)];
function toast(text){ const t=qs("#toast"); t.innerHTML=`<div class="toast">${escape(text)}</div>`; t.style.opacity=1; setTimeout(()=>t.style.opacity=0,1500); }
function shuffle(a){ return a.map(x=>[Math.random(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]); }
function pickWrong(c,n){ const arr=[...Array(n).keys()].filter(i=>i!==c); return arr[Math.floor(Math.random()*arr.length)]; }
function escape(s){ return String(s).replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;","&gt;":"&gt;","\"":"&quot;","'":"&#39;"}[m])); }

/** Картинка вопроса: ожидается имя файла; берём из images/A_B/ */
function resolveQuestionImage(img){
  let name = String(img).replace(/^\.?\//,'');
  // если уже указан путь images/..., оставляем как есть
  if(/^images\//i.test(name)) return name;
  // иначе считаем, что файл лежит в images/A_B/
  return `images/A_B/${name}`;
}

/** Картинка разметки: svg/png в images/markup/ */
function resolveMarkupImage(img){
  let name = String(img).replace(/^\.?\//,'');
  if(/^images\//i.test(name)) return name;
  return `images/markup/${name}`;
}
