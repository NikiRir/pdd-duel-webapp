/*
  Источник данных: etspring/pdd_russia
  — вопросы/темы: questions/*.json
  — справочники: signs/signs.json, markup/markup.json
  — изображения: img/**/*
*/

const RAW = (path) => `https://raw.githubusercontent.com/etspring/pdd_russia/master/${path}`;

// JSON-источники (при необходимости расширь)
const DATA_SOURCES = {
  tickets: [
    'questions/tickets.json',
    'questions/tickets_A_B.json',
    'questions/tickets_C_D.json'
  ],
  topics: [
    'questions/topic.json'
  ],
  signs: ['signs/signs.json'],
  markup: ['markup/markup.json'],
  penalties: ['penalties/penalties.json']
};

/* =========================
   ГЛОБАЛЬНОЕ СОСТОЯНИЕ
   ========================= */
const State = {
  user: null,
  pool: [],
  topics: new Map(),   // topic -> вопросы
  byTicket: new Map(), // ticket -> вопросы
  signs: {},
  markup: {},
  duel: null
};

/* =========================
   БЕЗОПАСНЫЙ СТАРТ ПРИ ГОТОВОМ DOM
   ========================= */
document.addEventListener('DOMContentLoaded', () => {
  initApp().catch(err => {
    console.error('init error', err);
    showToast('Ошибка инициализации');
  });
});

async function initApp(){
  revealHero();
  await loadAllData();
  mountHome();
  tryInitTelegram();   // необязательно: кнопки работают и без него
}

/* =========================
   ЗАГРУЗКА ДАННЫХ
   ========================= */
async function loadAllData(){
  showToast('Загружаю данные ПДД...');

  // Вопросы по билетам
  try{
    const ticketsRaw = await loadFirstAvailable(DATA_SOURCES.tickets);
    const normalized = normalizeQuestions(Array.isArray(ticketsRaw) ? ticketsRaw : ticketsRaw?.tickets || ticketsRaw?.data || []);
    for(const q of normalized){
      State.pool.push(q);
      if(q.ticket){
        const arr = State.byTicket.get(q.ticket) || [];
        arr.push(q); State.byTicket.set(q.ticket, arr);
      }
      for(const t of q.topics){
        const arr = State.topics.get(t) || [];
        arr.push(q); State.topics.set(t, arr);
      }
    }
  }catch(e){ console.warn('tickets load failed', e); }

  // Вопросы по темам (добавляем в пул)
  try{
    const topicsRaw = await loadFirstAvailable(DATA_SOURCES.topics);
    const normalized = normalizeQuestions(Array.isArray(topicsRaw) ? topicsRaw : topicsRaw?.topic || topicsRaw?.data || []);
    for(const q of normalized){
      if(!State.pool.find(x => x.id === q.id)) State.pool.push(q);
      for(const t of q.topics){
        const arr = State.topics.get(t) || [];
        if(!arr.find(x => x.id === q.id)) arr.push(q);
        State.topics.set(t, arr);
      }
    }
  }catch(e){ console.info('topics load skipped', e.message); }

  // Справочники
  try{ State.signs = await loadFirstAvailable(DATA_SOURCES.signs); }catch{ State.signs = {}; }
  try{ State.markup = await loadFirstAvailable(DATA_SOURCES.markup); }catch{ State.markup = {}; }

  showToast(`Готово! Вопросов: ${State.pool.length}`);
}

async function loadFirstAvailable(paths){
  for(const p of paths){
    try{
      const res = await fetch(RAW(p), { cache: 'no-store' });
      if(res.ok) return await res.json();
    }catch(e){ /* пробуем следующий */ }
  }
  throw new Error('Не удалось загрузить данные. Проверьте пути в DATA_SOURCES.');
}

/* Приводим вопросы к единому формату */
function normalizeQuestions(raw){
  const out = [];
  for(const q of raw){
    const answers = (q.answers || []).map(a => a.answer_text);
    const correctIndex = (q.answers || []).findIndex(a => a.is_correct === true);
    out.push({
      id: q.id || crypto.randomUUID(),
      question: q.question || q.title || 'Вопрос',
      answers: answers.length ? answers : ['Да','Нет','Не знаю'],
      correctIndex: correctIndex >= 0 ? correctIndex : 0,
      ticket: q.ticket_number || null,
      topics: Array.isArray(q.topic) ? q.topic : (q.topic ? [q.topic] : []),
      image: q.image || null,
      tip: q.answer_tip || null,
      category: q.ticket_category || null
    });
  }
  return out;
}

/* Нормализация пути к картинкам */
function normalizeImagePath(path){
  if(!path) return null;
  // убираем возможные префиксы './' или '/'
  const clean = String(path).replace(/^\.\//, '').replace(/^\//, '');
  return RAW(clean);
}

/* =========================
   UI: Дом, Дуэли, Темы, Билеты, Знаки
   ========================= */

const $ = (sel) => document.querySelector(sel);
const screen = $('#screen');

function revealHero(){
  if (window.gsap) {
    gsap.from('#hero', { opacity:0, y:30, duration:0.6, ease:'power2.out' });
  }
}

function mountHome(){
  screen.innerHTML = `
    <div class="grid md:grid-cols-2 gap-6">
      <div class="card card-hover">
        <h3 class="text-xl font-semibold mb-2">Быстрая дуэль</h3>
        <p class="text-slate-300/90 mb-3">Сразись с ИИ (90% точность) — 5 вопросов из общего пула.</p>
        <button class="btn-primary" id="startQuick">Старт</button>
      </div>
      <div class="card card-hover">
        <h3 class="text-xl font-semibold mb-2">Дуэль по теме</h3>
        <p class="text-slate-300/90 mb-3">Выбери тему ПДД и сыграй 1×1 (20 вопросов).</p>
        <button class="btn-secondary" id="chooseTopic">Выбрать тему</button>
      </div>
      <div class="card card-hover">
        <h3 class="text-xl font-semibold mb-2">Билеты 1–40</h3>
        <p class="text-slate-300/90 mb-3">Тренируйся по билетам (20 вопросов).</p>
        <button class="btn-secondary" id="openTickets">Открыть</button>
      </div>
      <div class="card card-hover">
        <h3 class="text-xl font-semibold mb-2">Знаки и разметка</h3>
        <p class="text-slate-300/90 mb-3">Справочник с быстрым поиском.</p>
        <button class="btn-secondary" id="openSigns">Открыть</button>
      </div>
    </div>
  `;
  // обработчики (работают и в браузере)
  $('#startQuick').onclick = () => startDuel({ mode:'quick' });
  $('#chooseTopic').onclick = () => pickTopic();
  $('#openTickets').onclick = () => listTickets();
  $('#openSigns').onclick = () => openSigns();

  if (window.gsap) {
    gsap.from('.card', { opacity:0, y:20, stagger:0.05, duration:0.35, ease:'power2.out' });
  }
}

/* ---- Дуэль ---- */
function startDuel({mode, topic=null}){
  const source = topic ? (State.topics.get(topic) || []) : State.pool;
  const count = mode === 'quick' ? 5 : 20;
  const questions = shuffle(source).slice(0, count);
  State.duel = {
    id: crypto.randomUUID(),
    mode, topic,
    me: { score:0 },
    ai: { score:0 },
    q: questions,
    i: 0,
    timerMs: 25000
  };
  renderQuestion();
}

function renderQuestion(){
  const d = State.duel;
  const q = d.q[d.i];
  screen.innerHTML = `
    <div class="card">
      <div class="flex items-center justify-between mb-3">
        <div>
          <div class="text-sm opacity-70">Вопрос ${d.i+1}/${d.q.length}${d.topic? ' • Тема: '+escapeHtml(d.topic):''}</div>
          ${q.ticket? `<div class="text-xs opacity-60">${escapeHtml(q.ticket)}</div>`:''}
        </div>
        <div class="timer w-40"><div id="tbar"></div></div>
      </div>
      <h3 class="text-xl font-semibold mb-3">${escapeHtml(q.question)}</h3>
      ${q.image? `<img src="${normalizeImagePath(q.image)}" class="rounded-xl border border-white/10 mb-3 max-h-64 object-contain mx-auto"/>`:''}
      <div class="grid gap-3">
        ${q.answers.map((a,idx)=>`<div class="answer" data-idx="${idx}">${escapeHtml(a)}</div>`).join('')}
      </div>
      ${q.tip? `<p class="mt-4 text-sm text-slate-300/80">Подсказка: ${escapeHtml(q.tip)}</p>`:''}
      <div class="mt-4 flex items-center justify-between text-sm">
        <div>Ты: <b>${d.me.score}</b></div>
        <div>ИИ: <b>${d.ai.score}</b></div>
      </div>
    </div>
  `;

  if (window.gsap) gsap.from('.answer', { opacity:0, y:6, stagger:0.05, duration:0.25 });

  let left = d.timerMs;
  const step = 50;
  const bar = $('#tbar');
  const timer = setInterval(()=>{
    left -= step;
    const x = Math.max(0, left/d.timerMs);
    bar.style.width = (x*100).toFixed(1)+'%';
    if(left<=0){ clearInterval(timer); lockAndScore(-1); }
  }, step);

  for(const el of document.querySelectorAll('.answer')){
    el.onclick = () => { clearInterval(timer); lockAndScore(parseInt(el.dataset.idx,10)); };
  }

  function lockAndScore(my){
    const correct = q.correctIndex;
    document.querySelectorAll('.answer').forEach((el,i)=>{
      el.classList.add(i===correct?'correct': (i===my ? 'wrong' : ''));
      el.style.pointerEvents = 'none';
    });

    if(my===correct) d.me.score++, showToast('Верно!'); else showToast('Увы :(');

    // AI (90% точности)
    const ai = (Math.random()<0.9)? correct : pickWrong(correct, q.answers.length);
    if(ai===correct) d.ai.score++;

    setTimeout(()=>{
      d.i++;
      if(d.i<d.q.length) renderQuestion(); else finishDuel();
    }, 600);
  }
}

function finishDuel(){
  const d = State.duel;
  const win = d.me.score > d.ai.score ? 'Победа' : (d.me.score<d.ai.score?'Поражение':'Ничья');
  screen.innerHTML = `
    <div class="card text-center">
      <h3 class="text-2xl font-bold mb-2">${win}</h3>
      <p class="opacity-80 mb-4">Ты: <b>${d.me.score}</b> • ИИ: <b>${d.ai.score}</b></p>
      <div class="flex gap-3 justify-center">
        <button class="btn-primary" id="again">Ещё раз</button>
        <button class="btn-secondary" id="home">На главную</button>
      </div>
    </div>
  `;
  $('#again').onclick = ()=> startDuel({mode:d.mode, topic:d.topic});
  $('#home').onclick = mountHome;

  // Отправка результатов в бота (если открыт через Telegram)
  trySendToBot({
    type: 'duel_result',
    payload: {
      duelId: d.id,
      mode: d.mode,
      topic: d.topic,
      me: d.me.score,
      ai: d.ai.score,
      total: d.q.length
    }
  });
}

/* ---- Темы ---- */
function pickTopic(){
  const topics = [...State.topics.keys()].sort();
  screen.innerHTML = `
    <div class="card">
      <h3 class="text-xl font-semibold mb-3">Выбери тему</h3>
      <div class="grid md:grid-cols-2 gap-3">
        ${topics.map(t=>`<button class="answer" data-t="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('')}
      </div>
      <div class="mt-4 flex gap-3"><button class="btn-secondary" id="back">Назад</button></div>
    </div>
  `;
  document.querySelectorAll('[data-t]').forEach(b=> b.onclick = ()=> startDuel({mode:'topic', topic: b.dataset.t}));
  $('#back').onclick = mountHome;
}

/* ---- Билеты ---- */
function listTickets(){
  const names = [...State.byTicket.keys()];
  screen.innerHTML = `
    <div class="card">
      <h3 class="text-xl font-semibold mb-3">Билеты</h3>
      <div class="grid md:grid-cols-2 gap-3">
        ${names.map(n=>`<button class="answer" data-n="${escapeHtml(n)}">${escapeHtml(n)}</button>`).join('')}
      </div>
      <div class="mt-4 flex gap-3"><button class="btn-secondary" id="back">Назад</button></div>
    </div>
  `;
  document.querySelectorAll('[data-n]').forEach(b=> b.onclick = ()=> trainTicket(b.dataset.n));
  $('#back').onclick = mountHome;
}

function trainTicket(name){
  const arr = State.byTicket.get(name) || [];
  let i = 0, score = 0;
  render();
  function render(){
    const q = arr[i];
    screen.innerHTML = `
      <div class="card">
        <div class="mb-2 text-sm opacity-70">${escapeHtml(name)} • ${i+1}/${arr.length}</div>
        <h3 class="text-xl font-semibold mb-3">${escapeHtml(q.question)}</h3>
        ${q.image? `<img src="${normalizeImagePath(q.image)}" class="rounded-xl border border-white/10 mb-3 max-h-64 object-contain mx-auto"/>`:''}
        <div class="grid gap-3">${q.answers.map((a,idx)=>`<div class="answer" data-idx="${idx}">${escapeHtml(a)}</div>`).join('')}</div>
        <div class="mt-4 flex items-center justify-between text-sm">
          <div>Счёт: <b>${score}</b></div>
          <div class="flex gap-3"><button class="btn-secondary" id="back">Назад</button></div>
        </div>
      </div>`;
    document.querySelectorAll('.answer').forEach(el=> el.onclick = ()=>{
      const correct = q.correctIndex;
      const my = parseInt(el.dataset.idx,10);
      if(my===correct) score++;
      i++; if(i<arr.length) render(); else mountHome();
    });
    $('#back').onclick = listTickets;
  }
}

/* ---- Знаки ---- */
function openSigns(){
  const signs = State.signs || {};
  const cats = Object.keys(signs);
  screen.innerHTML = `
    <div class="card">
      <h3 class="text-xl font-semibold mb-3">Дорожные знаки</h3>
      <input id="q" class="w-full mb-3 px-3 py-2 rounded-lg bg-white/5 border border-white/10" placeholder="Поиск по названию..." />
      <div id="list" class="grid md:grid-cols-3 gap-3 max-h-[65vh] overflow-auto pr-1"></div>
      <div class="mt-4"><button class="btn-secondary" id="back">Назад</button></div>
    </div>`;
  const list = $('#list');
  function render(filter=''){
    let html = '';
    for(const cat of cats){
      const items = Object.values(signs[cat]||{});
      for(const it of items){
        if(filter && !String(it.title||'').toLowerCase().includes(filter.toLowerCase())) continue;
        html += `
          <div class="answer">
            <img src="${normalizeImagePath(it.image)}" class="w-full h-32 object-contain mb-2"/>
            <div class="text-sm font-medium">${escapeHtml(it.number||'')}</div>
            <div class="text-sm opacity-80">${escapeHtml(it.title||'')}</div>
          </div>`;
      }
    }
    list.innerHTML = html || '<div class="opacity-70">Ничего не найдено</div>';
  }
  render();
  $('#q').oninput = (e)=> render(e.target.value);
  $('#back').onclick = mountHome;
}

/* =========================
   TELEGRAM WEBAPP (опционально)
   ========================= */
function tryInitTelegram(){
  try{
    if(window.Telegram && window.Telegram.WebApp){
      const tg = window.Telegram.WebApp;
      tg.ready();
      State.user = tg.initDataUnsafe?.user || null;

      // Эти кнопки также назначены в браузере — дублирование не страшно
      document.getElementById('btnStats').onclick = ()=>{
        trySendToBot({ type:'stats_request' });
        showToast('Запросил статистику у бота');
      };
      document.getElementById('btnQuickDuel').onclick = ()=> startDuel({mode:'quick'});
      document.getElementById('btnTopics').onclick = pickTopic;
      document.getElementById('btnTickets').onclick = listTickets;
      document.getElementById('btnSigns').onclick = openSigns;
    } else {
      // Браузерный режим
      if(document.getElementById('btnStats')){
        document.getElementById('btnStats').onclick = ()=> showToast('Открой через Telegram для синхронизации статистики');
      }
    }
  }catch(e){
    console.warn('Telegram init failed', e);
  }
}

function trySendToBot(message){
  try{
    if(window.Telegram && window.Telegram.WebApp){
      window.Telegram.WebApp.sendData(JSON.stringify(message));
    }
  }catch(e){ console.warn('sendData failed', e); }
}

/* =========================
   УТИЛИТЫ
   ========================= */
function shuffle(a){ return a.map(x=>[Math.random(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]); }
function pickWrong(correct, n){ const opts = [...Array(n).keys()].filter(i=>i!==correct); return opts[Math.floor(Math.random()*opts.length)] }
function showToast(text){
  const el = document.getElementById('toast');
  el.innerHTML = `<div class="toast">${escapeHtml(text)}</div>`;
  el.style.opacity = 1; setTimeout(()=> el.style.opacity=0, 1400);
}
function escapeHtml(s){ return String(s).replace(/[&<>\"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m])); }
