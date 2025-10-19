// URL-ы данных из etspring/pdd_russia
const RAW = (path) => `https://raw.githubusercontent.com/etspring/pdd_russia/master/${path}`;

document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ WebApp инициализация...");
  initApp();
});

async function initApp() {
  bindButtons();
  await loadData();
  showToast("Готово! Вопросы загружены.");
}

/* ======================
   КНОПКИ
====================== */
function bindButtons() {
  document.getElementById("btnQuickDuel").onclick = () => startQuickDuel();
  document.getElementById("btnTopics").onclick = () => listTopics();
  document.getElementById("btnTickets").onclick = () => listTickets();
  document.getElementById("btnStats").onclick = () => showToast("Открой в Telegram, чтобы увидеть статистику!");
}

/* ======================
   ЗАГРУЗКА ДАННЫХ
====================== */
let allTickets = [];
let topicsMap = new Map();

async function loadData() {
  showToast("Загружаю вопросы ПДД...");
  const res = await fetch(RAW("questions/tickets_A_B.json"));
  const data = await res.json();

  // билеты
  allTickets = data.tickets || [];
  // темы
  const topicRes = await fetch(RAW("questions/topics.json")).catch(() => null);
  if (topicRes && topicRes.ok) {
    const topicData = await topicRes.json();
    for (const t of topicData) topicsMap.set(t.topic, t);
  }
  console.log(`📗 Загружено ${allTickets.length} вопросов, ${topicsMap.size} тем`);
}

/* ======================
   ДУЭЛЬ
====================== */
function startQuickDuel() {
  if (!allTickets.length) return showToast("Данные ещё не загружены");
  const questions = shuffle(allTickets).slice(0, 20);
  renderQuestion(questions, 0, 0);
}

function renderQuestion(questions, index, score) {
  if (index >= questions.length) {
    showToast(`Дуэль окончена! Результат: ${score}/${questions.length}`);
    document.getElementById("screen").innerHTML =
      `<div class="card">🎯 Твой результат: <b>${score}</b> из ${questions.length}</div>`;
    return;
  }
  const q = questions[index];
  const img = q.image ? `<img src="${RAW(q.image.replace(/^\.\/|^\//,''))}" class="qimg"/>` : "";
  document.getElementById("screen").innerHTML = `
    <div class="card">
      <div class="qhead">Вопрос ${index + 1}/${questions.length}</div>
      <div class="qtext">${q.question}</div>
      ${img}
      <div class="answers">
        ${q.answers.map((a, i) => `<div class="answer" data-i="${i}">${a.answer_text}</div>`).join("")}
      </div>
    </div>
  `;
  document.querySelectorAll(".answer").forEach(el =>
    el.addEventListener("click", () => {
      const i = +el.dataset.i;
      const correct = q.answers.findIndex(a => a.is_correct);
      if (i === correct) {
        el.classList.add("correct");
        showToast("✅ Верно!");
        score++;
      } else {
        el.classList.add("wrong");
        showToast("❌ Ошибка!");
      }
      setTimeout(() => renderQuestion(questions, index + 1, score), 600);
    })
  );
}

/* ======================
   СПИСКИ ТЕМ / БИЛЕТОВ
====================== */
function listTopics() {
  const container = document.getElementById("screen");
  if (topicsMap.size === 0) return showToast("Темы не найдены");
  container.innerHTML = `
    <div class="card"><h3>Темы</h3>
    ${[...topicsMap.keys()]
      .map(t => `<div class="answer" data-topic="${t}">${t}</div>`)
      .join("")}</div>`;
  document.querySelectorAll("[data-topic]").forEach(el =>
    el.addEventListener("click", () => startTopic(el.dataset.topic))
  );
}

function listTickets() {
  const container = document.getElementById("screen");
  if (allTickets.length === 0) return showToast("Билеты не найдены");
  const uniqueTickets = [...new Set(allTickets.map(q => q.ticket_number))];
  container.innerHTML = `
    <div class="card"><h3>Билеты</h3>
    ${uniqueTickets.map(t => `<div class="answer" data-ticket="${t}">Билет ${t}</div>`).join("")}</div>`;
  document.querySelectorAll("[data-ticket]").forEach(el =>
    el.addEventListener("click", () => startTicket(+el.dataset.ticket))
  );
}

function startTopic(topic) {
  const t = topicsMap.get(topic);
  if (!t) return showToast("Нет данных по теме");
  renderQuestion(t.questions, 0, 0);
}

function startTicket(num) {
  const questions = allTickets.filter(q => q.ticket_number === num);
  renderQuestion(questions, 0, 0);
}

/* ======================
   УТИЛИТЫ
====================== */
function shuffle(a) {
  return a.map(x => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
}
function showToast(text) {
  const el = document.getElementById("toast");
  el.innerHTML = `<div class="toast">${text}</div>`;
  el.style.opacity = 1;
  setTimeout(() => (el.style.opacity = 0), 1400);
}
