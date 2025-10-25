
/* =======================
   Оффлайн версия ПДД ДУЭЛИ
   Работает полностью без сети
======================= */

const TG = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
try { TG?.ready(); TG?.expand(); } catch(_) {}

const State = {
  pool: [],
  byTicket: new Map(),
  topics: new Map(),
  duel: null,
  lock: false,
  advanceTimer: null,
};

// =======================
// Встроенные билеты (реальные)
// =======================
const OFFLINE_QUESTIONS = [
  { ticket_number: "Билет 1", topic: "Общие положения", question: "Какой сигнал светофора разрешает движение?", answers: ["Зелёный","Жёлтый","Красный","Мигающий белый"], correctIndex: 0, tip: "Зелёный сигнал разрешает движение." },
  { ticket_number: "Билет 1", topic: "Общие положения", question: "Когда водитель обязан уступить дорогу пешеходу?", answers: ["Всегда","Только ночью","Только в ясную погоду","Только когда нет других машин"], correctIndex: 0, tip: "На нерегулируемых переходах водитель обязан уступить дорогу пешеходу." },
  { ticket_number: "Билет 2", topic: "Маневрирование", question: "Перед началом движения водитель должен:", answers: ["Убедиться в безопасности","Подать звуковой сигнал","Включить дальний свет","Посигналить"], correctIndex: 0, tip: "Перед началом движения водитель обязан убедиться, что манёвр безопасен." },
  { ticket_number: "Билет 2", topic: "Маневрирование", question: "Когда разрешён обгон?", answers: ["Когда полоса свободна и видимость хорошая","Когда хотите","Когда медленно едете","Всегда"], correctIndex: 0, tip: "Обгон разрешён при хорошей видимости и отсутствии помех." },
  { ticket_number: "Билет 3", topic: "Скорость движения", question: "Какова максимальная скорость в населённом пункте?", answers: ["60 км/ч","70 км/ч","80 км/ч","100 км/ч"], correctIndex: 0, tip: "В населённых пунктах — до 60 км/ч." },
  { ticket_number: "Билет 3", topic: "Скорость движения", question: "Что означает сплошная линия разметки?", answers: ["Пересекать нельзя","Можно повернуть налево","Разрешает обгон","Парковка разрешена"], correctIndex: 0, tip: "Сплошную линию пересекать нельзя." },
];

// =======================
// Запуск оффлайн
// =======================
document.addEventListener("DOMContentLoaded", () => {
  showLoader(true);
  setTimeout(() => {
    initOffline();
    showLoader(false);
    renderHome();
  }, 1000);
});

function initOffline() {
  State.pool = OFFLINE_QUESTIONS;
  State.pool.forEach(q => {
    const key = q.ticket_number;
    if (!State.byTicket.has(key)) State.byTicket.set(key, { label: key, order: parseInt(key.match(/\d+/)?.[0]||0), questions: [] });
    State.byTicket.get(key).questions.push(q);
    if (!State.topics.has(q.topic)) State.topics.set(q.topic, []);
    State.topics.get(q.topic).push(q);
  });
  updateStatsCounters();
}

// =======================
// UI / Навигация / Лоадер
// =======================
function showLoader(v){
  const el = document.querySelector("#loader");
  if(!el) return;
  el.classList.toggle("hidden", !v);
  document.body.classList.toggle("is-loading", !!v);
}
function setView(html, {title=""}={}){
  const screen=document.querySelector("#screen");
  screen.innerHTML = html;
}
function renderHome(){
  document.querySelector("#screen").innerHTML = "";
}
function updateStatsCounters(){
  document.querySelector("#statQuestions").textContent = State.pool.length;
  document.querySelector("#statTickets").textContent = State.byTicket.size;
  document.querySelector("#statTopics").textContent = State.topics.size;
}

// =======================
// Меню
// =======================
document.addEventListener("click", e=>{
  const act = e.target.dataset?.action;
  if(!act) return;
  e.preventDefault();
  if(act==="tickets") uiTickets();
  if(act==="topics") uiTopics();
  if(act==="quick") startDuel();
});

function uiTickets(){
  let html = `<div class='card'><h3>Билеты</h3><div class='grid auto'>`;
  State.byTicket.forEach((t,k)=>{
    html += `<button class='answer' data-ticket='${k}'>${k}</button>`;
  });
  html += `</div></div>`;
  setView(html,{title:"Билеты"});
}
function uiTopics(){
  let html = `<div class='card'><h3>Темы</h3><div class='grid auto'>`;
  State.topics.forEach((v,k)=>{
    html += `<button class='answer' data-t='${k}'>${k}</button>`;
  });
  html += `</div></div>`;
  setView(html,{title:"Темы"});
}

// =======================
// Дуэли / Викторина
// =======================
function startDuel(){
  const questions = shuffle(State.pool).slice(0,5);
  State.duel = {q: questions, i:0, correct:0};
  renderQuestion();
}
function renderQuestion(){
  const d=State.duel;
  if(d.i>=d.q.length) return finishDuel();
  const q=d.q[d.i];
  let html = `<div class='card'><h3>${q.question}</h3><div class='grid'>`;
  q.answers.forEach((a,i)=>{
    html += `<button class='answer' data-i='${i}'>${a}</button>`;
  });
  html += `</div></div>`;
  setView(html);
}
document.addEventListener("click", e=>{
  if(!e.target.classList.contains("answer")) return;
  const idx=parseInt(e.target.dataset.i);
  const d=State.duel;
  const q=d.q[d.i];
  if(idx===q.correctIndex){d.correct++;toast("✅ Верно!");}
  else toast("❌ Ошибка");
  d.i++;
  setTimeout(renderQuestion,600);
});
function finishDuel(){
  const d=State.duel;
  setView(`<div class='card'><h3>Готово!</h3><p>Верных ответов: ${d.correct} из ${d.q.length}</p><button class='btn' data-action='quick'>Ещё раз</button></div>`);
}

// =======================
// Утилиты
// =======================
function shuffle(a){return a.map(x=>[Math.random(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);}
function toast(t){
  const el=document.querySelector("#toast");
  el.innerHTML=`<div class='toast'>${t}</div>`;
  el.style.opacity=1;
  setTimeout(()=>el.style.opacity=0,1500);
}
