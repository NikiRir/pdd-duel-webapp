 /* =======================
    Telegram + Глобальное состояние
 ======================= */
 // Сразу убираем загрузчик, если он есть
if (document.body) {
  document.body.classList.remove("is-loading");
  const loader = document.getElementById("loader");
  if (loader) loader.remove();
}

 const TG = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
try {
  if (TG && typeof TG.ready === "function") TG.ready();
  if (TG && typeof TG.expand === "function") TG.expand();
} catch(_) {}

// Отладочная информация для проверки Telegram API
if (typeof console !== 'undefined') {
  console.log("Telegram WebApp доступен:", !!TG);
  console.log("window.Telegram доступен:", !!window.Telegram);
  if (TG) {
    console.log("TG.initDataUnsafe:", TG.initDataUnsafe);
    console.log("TG.initData:", TG.initData);
  }
}

// Получаем ID пользователя Telegram
function getTelegramUserId() {
  try {
    // Пробуем разные способы получения ID
    if (TG?.initDataUnsafe?.user?.id) {
      return TG.initDataUnsafe.user.id;
    }
    if (TG?.initData?.user?.id) {
      return TG.initData.user.id;
    }
    // Пробуем через window напрямую
    if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
      return window.Telegram.WebApp.initDataUnsafe.user.id;
    }
    if (window.Telegram?.WebApp?.initData?.user?.id) {
      return window.Telegram.WebApp.initData.user.id;
    }
    return null;
  } catch(e) {
    console.warn("Ошибка получения Telegram ID:", e);
    return null;
  }
}

// Получаем данные пользователя из Telegram
function getTelegramUser() {
  try {
    const user = TG?.initDataUnsafe?.user || TG?.initData?.user || null;
    if (user) {
      return {
        id: user.id,
        username: user.username || `User${user.id}`,
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        photoUrl: user.photo_url || null
      };
    }
    return null;
  } catch(e) {
    return null;
  }
}

// Получаем ключ для localStorage с учетом ID пользователя
function getStorageKey(baseKey) {
  const userId = getTelegramUserId();
  if (userId) {
    return `${baseKey}-${userId}`;
  }
  return baseKey; // Fallback для тестирования вне Telegram
}
 
 const State = {
   pool: [],
   byTicket: new Map(),
   topics: new Map(),
   duel: null,
   lock: false,
   lastTouchTs: 0,
   markup: null,
   penalties: null,
   tap: null,
   ignoreClickUntil: 0,
   advanceTimer: null,
   usedFallback: false,
   penaltiesLoading: false,
   markupLoading: false,
   // Статистика
   stats: {
     gamesPlayed: 0,
     experience: 0,
     level: 1,
     topPlace: null,
     ticketsProgress: {},
     topicsProgress: {}
   },
   onlineCount: 0,
   // Настройки пользователя
   settings: {
     showDifficulty: false,
     hideCompletedTickets: false,
     hideFromTop: false
   },
   // Глобальная статистика по билетам для расчета сложности
   ticketsDifficultyStats: {},
  // Состояние поиска противника для дуэли
  duelSearch: {
    active: false,
    startTime: null,
    searchInterval: null,
    opponentId: null,
    isBot: false
  },
  // Прогресс соперника в текущей дуэли
  opponentProgress: {
    currentQuestion: 0,
    score: 0
  },
  // Интервал для обновления прогресса соперника
  opponentProgressInterval: null
};
 
 let delegationBound = false;
 let menuBound = false;
 const scheduleFrame = typeof requestAnimationFrame === "function" ? requestAnimationFrame : (fn)=>setTimeout(fn, 16);
 
 const MANIFEST_URL = "questions/index.json";
 const MARKUP_URL = "markup/markup.json";
 const PENALTIES_URL = "penalties/penalties.json";
const FALLBACK_MANIFEST = {
  tickets: []
};

const FALLBACK_QUESTION_BANK = [
  {
    question: "Пример вопроса ПДД",
    answers: [
      { text: "Правильный ответ", is_correct: true },
      { text: "Неправильный ответ 1", is_correct: false },
      { text: "Неправильный ответ 2", is_correct: false }
    ],
    tip: "Это демонстрационный вопрос"
  }
];
 
 /* =======================
    Лоадер
======================= */
function showLoader() {
  const overlay = qs("#loader-overlay");
  if(overlay) {
    overlay.classList.add("active");
  }
}

function hideLoader() {
  const overlay = qs("#loader-overlay");
  if(overlay) {
    overlay.classList.remove("active");
    setTimeout(() => {
      const progress = qs("#loader-progress");
      if(progress) progress.style.width = "0%";
    }, 300);
  }
}

function updateLoaderProgress(percent) {
  const progress = qs("#loader-progress");
  if(progress) progress.style.width = `${Math.min(100, Math.max(0, percent))}%`;
}

 /* =======================
    Запуск
======================= */
function initApp(){
  try {
    bindMenu();
    bindDelegation();
  } catch(err){
    console.error("Ошибка инициализации интерфейса:", err);
  }
  boot();
}

// Улучшенная логика запуска
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp, { once: true });
} else {
  // DOM уже готов
  if (document.body) {
    setTimeout(initApp, 0);
  } else {
    // Ждем body
    const checkBody = setInterval(() => {
      if (document.body) {
        clearInterval(checkBody);
        initApp();
      }
    }, 10);
    // На всякий случай запускаем через 100мс
    setTimeout(() => {
      clearInterval(checkBody);
      if (document.body) initApp();
    }, 100);
  }
}
 
async function boot(){
  console.log("🚀 boot() запущен");
  
  // Предзагружаем штрафы и разметку параллельно в фоне
  Promise.all([
    loadPenalties().catch(() => {}),
    loadMarkup().catch(() => {})
  ]).catch(() => {});
  
  showLoader();
  
  // Добавляем общий таймаут для boot (максимум 35 секунд)
  const bootTimeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Таймаут загрузки приложения")), 35000);
  });

  const bootTask = async () => {
    let hasQuestions = false;
    
    // Сразу загружаем fallback данные для быстрого отклика
    try {
      console.log("📦 Загружаем fallback данные немедленно...");
      hydrateFallback({ reset: true });
      hasQuestions = State.pool.length > 0;
      console.log("✓ Fallback данные загружены, вопросов:", State.pool.length);
      // Если fallback загружен, сразу рендерим интерфейс
      if (hasQuestions) {
        try {
          renderHome();
          updateStatsCounters();
          initCarousel();
        } catch(e) {
          console.error("Ошибка рендеринга:", e);
        }
      }
    } catch(err) {
      console.error("Ошибка загрузки fallback данных:", err);
    }

    // Загружаем билеты с таймаутом (максимум 20 секунд)
    try {
      const loadTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Таймаут загрузки билетов")), 20000);
      });

      try {
        console.log("📥 Начинаем загрузку билетов...");
        updateLoaderProgress(20);
        await Promise.race([loadTickets(), loadTimeout]);
        updateLoaderProgress(90);
        console.log("✓ Билеты загружены, вопросов:", State.pool.length);
        hasQuestions = State.pool.length > 0;
      } catch(e) {
        console.error("Ошибка загрузки билетов:", e);
        hasQuestions = State.pool.length > 0;
      }
    } catch(e) {
      console.error("Критическая ошибка в boot():", e);
    }

    // Гарантируем, что данные есть
    if (!State.pool.length) {
      try {
        console.log("📦 Применяем fallback данные в finally...");
        hydrateFallback();
        console.log("✓ Fallback применен, вопросов:", State.pool.length);
      } catch(err) {
        console.error("Ошибка применения fallback в finally:", err);
      }
    }
    hasQuestions = State.pool.length > 0;
    
    // Рендерим интерфейс
    try {
      loadUserStats();
      updateStatsDisplay();
      startStatsRotation();
      renderHome();
      updateStatsCounters();
    } catch(err) {
      console.error("Ошибка при рендеринге:", err);
    }
    
    if(!hasQuestions) {
      setTimeout(()=>notifyDataIssue(), 350);
    }
  };

  try {
    await Promise.race([bootTask(), bootTimeout]);
  } catch(err) {
    console.error("⚠️ Критическая ошибка или таймаут в boot():", err);
    // В случае критической ошибки гарантируем, что есть хотя бы fallback данные
    if (!State.pool.length) {
      try {
        hydrateFallback();
        loadUserStats();
        updateStatsDisplay();
        startStatsRotation();
        renderHome();
        updateStatsCounters();
      } catch(finalErr) {
        console.error("Критическая ошибка применения fallback:", finalErr);
      }
    }
  } finally {
    updateLoaderProgress(100);
    setTimeout(() => {
      hideLoader();
    }, 500);
    console.log("✅ boot() завершен");
  }
}
 
 
 /* =======================
    Навигация
 ======================= */
 function toggleSubpage(isSub){
   const appRoot = qs(".app");
   const isSubpage = !!isSub;
  if (appRoot) appRoot.classList.toggle("app--subpage", isSubpage);
   setActive(null);
   // Убрали scrollIntoView - теперь контент показывается как полноэкранная страница
 }
 
 function setView(html, { subpage = true, title = "", showSettings = false, settingsContext = null } = {}){
   const host = document.getElementById("screen");
   if(!host) return;
   
   if (subpage) {
     toggleSubpage(true);
     
     // Добавляем кнопку настроек в header если нужно
     const settingsBtn = showSettings ? `<button type="button" class="subpage-settings-btn" id="subpage-settings-btn" data-settings data-settings-context="${settingsContext || ''}">⚙️</button>` : '';
     
     // Сохраняем контекст настроек в data-атрибуте
     if (settingsContext) {
       host.setAttribute('data-settings-context', settingsContext);
     } else {
       host.removeAttribute('data-settings-context');
     }
     
     // Создаем структуру правильно: заголовок отдельно, контент отдельно
     host.innerHTML = `
       <header class="subpage-header">
         <button type="button" class="back-btn" data-back>Назад</button>
         <h2 class="subpage-title">${esc((title || "ПДД ДУЭЛИ").trim())}</h2>
         ${settingsBtn}
       </header>
       <div class="view-content-wrapper">
         <div class="view-content">
           ${html || ""}
         </div>
       </div>
     `;
     host.className = "screen";
     // Скроллим только контент, не весь экран
     const wrapper = host.querySelector(".view-content-wrapper");
     if(wrapper) {
       wrapper.scrollTop = 0;
     }
     
     // Привязываем кнопку настроек если есть
     if (showSettings) {
       scheduleFrame(() => {
         const settingsBtn = qs("#subpage-settings-btn");
         if (settingsBtn) {
           settingsBtn.addEventListener("click", (e) => {
             e.preventDefault();
             e.stopPropagation();
             const context = host.getAttribute('data-settings-context');
             uiSettings(context);
           }, { passive: true });
         }
       });
     }
   } else {
     toggleSubpage(false);
     host.className = "screen screen--hidden";
     host.innerHTML = "";
     host.removeAttribute('data-settings-context');
   }
 }
function renderHome(){
  clearAdvanceTimer();
  setActive(null);
  setView("", { subpage: false });
  switchTab('home');
 }
 
 function setActive(id){
   qsa("[data-action]").forEach(b=>b.classList.remove("active"));
  if(id){
    const el = qs("#"+id);
    if (el) el.classList.add("active");
  }
 }
 
 /* =======================
    Меню
 ======================= */
function bindMenu(){
  if (menuBound) return;
  
  // Навигация по табам
  qsa("[data-tab]").forEach(btn=>{
    btn.addEventListener("click", e=>{
      const tab = e.currentTarget.dataset.tab;
      switchTab(tab);
    }, { passive:true });
  });
  
  // Кнопки действий
  qsa("[data-action]").forEach(btn=>{
    btn.addEventListener("click", e=>{
      const act = e.currentTarget.dataset.action;
      setActive(e.currentTarget.id);
      if (act==="quick")    startDuel({mode:"quick"});
      if (act==="duels")    startDuelSearch();
      if (act==="topics")   uiTopics();
      if (act==="tickets")  uiTickets();
      if (act==="markup")   uiMarkup();
      if (act==="penalties")uiPenalties();
      if (act==="favorites") toast("⭐ Избранное пока в разработке");
    }, { passive:true });
  });
  
  // Кнопка настроек в главном меню
  const settingsBtn = qs("#settings-btn");
  if (settingsBtn) {
    settingsBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      uiMainSettings();
    }, { passive: true });
  }
  
  // Кнопка "Место в топе" обрабатывается в handleTap
  
  menuBound = true;
}

/* =======================
   Навигация по табам
======================= */
function switchTab(tabName) {
  // Скрываем все табы
  qsa(".tab-content").forEach(tab => {
    tab.classList.remove("active");
  });
  
  // Показываем выбранный таб
  const tab = qs(`#${tabName}-tab`);
  if (tab) {
    tab.classList.add("active");
  }
  
  // Обновляем активную кнопку в нижней навигации
  qsa(".bottom-nav-item").forEach(item => {
    item.classList.toggle("active", item.dataset.tab === tabName);
  });
  
  // Скрываем экран если он открыт
  const screen = qs("#screen");
  if (screen) {
    screen.classList.add("screen--hidden");
  }
}

/* =======================
   Статистика пользователя
======================= */
function loadUserStats() {
  try {
    const key = getStorageKey("pdd-duel-stats");
    const saved = localStorage.getItem(key);
    if (saved) {
      const stats = JSON.parse(saved);
      State.stats = {
        gamesPlayed: stats.gamesPlayed || 0,
        experience: stats.experience || 0,
        level: stats.level || 1,
        topPlace: stats.topPlace || null,
        ticketsProgress: stats.ticketsProgress || {},
        topicsProgress: stats.topicsProgress || {}
      };
    } else {
      State.stats.ticketsProgress = {};
      State.stats.topicsProgress = {};
    }
  } catch(e) {
    console.error("Ошибка загрузки статистики:", e);
    State.stats.ticketsProgress = {};
    State.stats.topicsProgress = {};
  }
  
  // Загружаем настройки
  try {
    const settingsKey = getStorageKey("pdd-duel-settings");
    const savedSettings = localStorage.getItem(settingsKey);
    if (savedSettings) {
      State.settings = JSON.parse(savedSettings);
    }
  } catch(e) {
    console.error("Ошибка загрузки настроек:", e);
  }
  
  // Загружаем глобальную статистику сложности билетов
  loadTicketsDifficultyStats();
}

function saveUserSettings() {
  try {
    const key = getStorageKey("pdd-duel-settings");
    localStorage.setItem(key, JSON.stringify(State.settings));
  } catch(e) {
    console.error("Ошибка сохранения настроек:", e);
  }
}

function loadTicketsDifficultyStats() {
  try {
    const key = getStorageKey("pdd-duel-tickets-difficulty");
    const saved = localStorage.getItem(key);
    if (saved) {
      State.ticketsDifficultyStats = JSON.parse(saved);
    } else {
      State.ticketsDifficultyStats = {};
    }
  } catch(e) {
    console.error("Ошибка загрузки статистики сложности:", e);
    State.ticketsDifficultyStats = {};
  }
}

function saveTicketsDifficultyStats() {
  try {
    const key = getStorageKey("pdd-duel-tickets-difficulty");
    localStorage.setItem(key, JSON.stringify(State.ticketsDifficultyStats));
  } catch(e) {
    console.error("Ошибка сохранения статистики сложности:", e);
  }
}

// Обновляет статистику сложности билета на основе ответов пользователя
function updateTicketDifficultyStats(ticketLabel, correctCount, totalCount) {
  if (!State.ticketsDifficultyStats[ticketLabel]) {
    State.ticketsDifficultyStats[ticketLabel] = {
      totalAttempts: 0,
      totalCorrect: 0,
      totalQuestions: 0
    };
  }
  
  const stats = State.ticketsDifficultyStats[ticketLabel];
  stats.totalAttempts += 1;
  stats.totalCorrect += correctCount;
  stats.totalQuestions += totalCount;
  
  saveTicketsDifficultyStats();
}

// Вычисляет уровень сложности билета на основе статистики
function getTicketDifficulty(ticketLabel) {
  const stats = State.ticketsDifficultyStats[ticketLabel];
  
  // Если нет статистики, возвращаем случайный уровень сложности
  if (!stats || stats.totalAttempts === 0) {
    const difficulties = [
      { text: "Легко", level: "easy" },
      { text: "Средне", level: "medium" },
      { text: "Сложно", level: "hard" },
      { text: "Невозможно", level: "impossible" }
    ];
    // Используем хеш от названия билета для стабильного "случайного" выбора
    let hash = 0;
    for (let i = 0; i < ticketLabel.length; i++) {
      hash = ((hash << 5) - hash) + ticketLabel.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    const randomIndex = Math.abs(hash) % difficulties.length;
    return difficulties[randomIndex];
  }
  
  // Процент правильных ответов
  const correctPercent = (stats.totalCorrect / stats.totalQuestions) * 100;
  
  if (correctPercent >= 75) {
    return { text: "Легко", level: "easy" };
  } else if (correctPercent >= 50) {
    return { text: "Средне", level: "medium" };
  } else if (correctPercent >= 25) {
    return { text: "Сложно", level: "hard" };
  } else {
    return { text: "Невозможно", level: "impossible" };
  }
}

function saveUserStats() {
  try {
    const key = getStorageKey("pdd-duel-stats");
    localStorage.setItem(key, JSON.stringify(State.stats));
  } catch(e) {
    console.error("Ошибка сохранения статистики:", e);
  }
}

function saveTicketProgress(ticketKey, correctCount, totalCount, answeredCount = null, currentIndex = null, answers = null, questionOrder = null) {
  if (!State.stats.ticketsProgress) {
    State.stats.ticketsProgress = {};
  }
  // Используем answeredCount если передан, иначе correctCount
  const progressCount = answeredCount !== null ? answeredCount : correctCount;
  const percent = (progressCount / totalCount) * 100;
  State.stats.ticketsProgress[ticketKey] = {
    correct: correctCount,
    answered: answeredCount !== null ? answeredCount : progressCount,
    total: totalCount,
    percent: percent,
    completed: percent === 100 && correctCount === totalCount,
    currentIndex: currentIndex !== null ? currentIndex : 0,
    answers: answers || [],
    questionOrder: questionOrder || []
  };
  saveUserStats();
}

function getTicketProgress(ticketKey) {
  return State.stats.ticketsProgress?.[ticketKey] || null;
}

function saveTopicProgress(topicKey, correctCount, totalCount, answeredCount = null, currentIndex = null, answers = null, questionOrder = null) {
  if (!State.stats.topicsProgress) {
    State.stats.topicsProgress = {};
  }
  // Используем answeredCount если передан, иначе correctCount
  const progressCount = answeredCount !== null ? answeredCount : correctCount;
  const percent = (progressCount / totalCount) * 100;
  State.stats.topicsProgress[topicKey] = {
    correct: correctCount,
    answered: answeredCount !== null ? answeredCount : progressCount,
    total: totalCount,
    percent: percent,
    completed: percent === 100 && correctCount === totalCount,
    currentIndex: currentIndex !== null ? currentIndex : 0,
    answers: answers || [],
    questionOrder: questionOrder || []
  };
  saveUserStats();
}

function getTopicProgress(topicKey) {
  return State.stats.topicsProgress?.[topicKey] || null;
}

function getTicketsCompletedCount() {
  if (!State.stats.ticketsProgress) return 0;
  return Object.values(State.stats.ticketsProgress).filter(t => t.completed).length;
}

let statsRotationInterval = null;
let currentStatsView = 0; // 0 = games, 1 = tickets

function updateStatsDisplay() {
  // Сохраняем данные для топа при обновлении статистики
  saveUserTopData();
  
  // Вычисляем место в топе
  const players = getAllPlayersTopData();
  const currentUserId = getTelegramUserId();
  if (currentUserId) {
    const userPlace = players.findIndex(p => p.userId === currentUserId) + 1;
    State.stats.topPlace = userPlace > 0 ? userPlace : null;
  }
  
  const gamesEl = qs("#games-played");
  const levelEl = qs("#experience-level");
  const topPlaceEl = qs("#top-place");
  const gamesLabelEl = gamesEl?.parentElement?.querySelector('.stat-label');
  
  if (gamesEl) {
    if (currentStatsView === 0) {
      gamesEl.textContent = State.stats.gamesPlayed;
      if (gamesLabelEl) gamesLabelEl.textContent = "игр сыграно";
    } else {
      const ticketsCompleted = getTicketsCompletedCount();
      gamesEl.textContent = ticketsCompleted;
      if (gamesLabelEl) gamesLabelEl.textContent = "билетов решено";
    }
  }
  
  if (levelEl) {
    // Вычисляем уровень на основе опыта (1 уровень = 100 опыта)
    const level = Math.floor(State.stats.experience / 100) + 1;
    State.stats.level = level;
    levelEl.textContent = `${State.stats.experience}/${level}`;
  }
  
  if (topPlaceEl) {
    topPlaceEl.textContent = State.stats.topPlace || "-";
  }
  
  // Делаем карточку "Место в топе" кликабельной
  const topPlaceCard = topPlaceEl?.closest('.stat-card-large');
  if (topPlaceCard) {
    topPlaceCard.style.cursor = 'pointer';
    topPlaceCard.setAttribute('data-action', 'top');
    // Обработчик клика уже есть в handleTap через делегацию
  }
}

function startStatsRotation() {
  if (statsRotationInterval) {
    clearInterval(statsRotationInterval);
  }
  statsRotationInterval = setInterval(() => {
    currentStatsView = currentStatsView === 0 ? 1 : 0;
    updateStatsDisplay();
  }, 3000); // Переключаем каждые 3 секунды
}

function addExperience(amount) {
  State.stats.experience += amount;
  updateStatsDisplay();
  saveUserStats();
}

function incrementGamesPlayed() {
  State.stats.gamesPlayed++;
  updateStatsDisplay();
  saveUserStats();
  // Сохраняем данные пользователя для топа
  saveUserTopData();
}

// Сохраняет данные пользователя для отображения в топе
function saveUserTopData() {
  try {
    const user = getTelegramUser();
    if (!user) return;
    
    const userId = user.id;
    const key = `pdd-duel-topdata-${userId}`;
    const stats = State.stats;
    
    // Вычисляем винрейт (процент правильных ответов)
    let winRate = 0;
    if (stats.gamesPlayed > 0) {
      // Подсчитываем общее количество правильных ответов
      let totalCorrect = 0;
      let totalQuestions = 0;
      
      // Из билетов
      if (stats.ticketsProgress) {
        Object.values(stats.ticketsProgress).forEach(progress => {
          if (progress.completed) {
            totalCorrect += progress.correct || 0;
            totalQuestions += progress.total || 0;
          }
        });
      }
      
      // Из тем
      if (stats.topicsProgress) {
        Object.values(stats.topicsProgress).forEach(progress => {
          if (progress.completed) {
            totalCorrect += progress.correct || 0;
            totalQuestions += progress.total || 0;
          }
        });
      }
      
      if (totalQuestions > 0) {
        winRate = Math.round((totalCorrect / totalQuestions) * 100);
      }
    }
    
    const topData = {
      userId: userId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      photoUrl: user.photoUrl,
      gamesPlayed: stats.gamesPlayed,
      winRate: winRate,
      experience: stats.experience,
      level: stats.level,
      lastUpdate: Date.now()
    };
    
    localStorage.setItem(key, JSON.stringify(topData));
  } catch(e) {
    console.error("Ошибка сохранения данных для топа:", e);
  }
}

// Собирает данные всех игроков для топа
function getAllPlayersTopData() {
  const players = [];
  try {
    // Проходим по всем ключам в localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('pdd-duel-topdata-')) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          if (data && data.userId && data.gamesPlayed > 0) {
            // Проверяем, не скрыт ли пользователь из топа
            const settingsKey = `pdd-duel-settings-${data.userId}`;
            const settings = localStorage.getItem(settingsKey);
            if (settings) {
              const userSettings = JSON.parse(settings);
              if (userSettings.hideFromTop) {
                continue; // Пропускаем этого пользователя
              }
            }
            players.push(data);
          }
        } catch(e) {
          console.warn("Ошибка парсинга данных игрока:", e);
        }
      }
    }
    
    // Сортируем по количеству выигранных игр (по убыванию)
    players.sort((a, b) => b.gamesPlayed - a.gamesPlayed);
    
    return players;
  } catch(e) {
    console.error("Ошибка сбора данных топа:", e);
    return [];
  }
}

async function updateOnlineCount() {
  // Онлайн счетчик отключен - нужен реальный API
}

/* =======================
   Карусель
======================= */
let carouselInitialized = false;
let currentCarouselSlide = 0;
let carouselAutoPlayInterval = null;

function initCarousel() {
  if (carouselInitialized) return;
  
  const slides = qsa(".carousel-slide");
  const dots = qsa(".carousel-dot");
  const prevBtn = qs(".carousel-arrow-prev");
  const nextBtn = qs(".carousel-arrow-next");
  
  if (!slides.length || !dots.length) return;
  
  function updateCarousel(index) {
    // Обновляем слайды
    slides.forEach((slide, i) => {
      slide.classList.toggle("active", i === index);
    });
    
    // Обновляем точки
    dots.forEach((dot, i) => {
      dot.classList.toggle("active", i === index);
    });
    
    currentCarouselSlide = index;
  }
  
  function nextSlide() {
    const next = (currentCarouselSlide + 1) % slides.length;
    updateCarousel(next);
  }
  
  function prevSlide() {
    const prev = (currentCarouselSlide - 1 + slides.length) % slides.length;
    updateCarousel(prev);
  }
  
  // Обработчики для стрелок
  if (prevBtn) {
    prevBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      prevSlide();
      resetAutoPlay();
    }, { passive: false });
  }
  
  if (nextBtn) {
    nextBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      nextSlide();
      resetAutoPlay();
    }, { passive: false });
  }
  
  // Обработчики для точек
  dots.forEach((dot, index) => {
    dot.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      updateCarousel(index);
      resetAutoPlay();
    }, { passive: false });
  });
  
  // Автоматическое листание (каждые 5 секунд)
  function startAutoPlay() {
    carouselAutoPlayInterval = setInterval(() => {
      nextSlide();
    }, 5000);
  }
  
  function resetAutoPlay() {
    if (carouselAutoPlayInterval) {
      clearInterval(carouselAutoPlayInterval);
    }
    startAutoPlay();
  }
  
  // Свайпы для мобильных устройств
  let touchStartX = 0;
  let touchEndX = 0;
  
  const carouselContainer = qs(".carousel-container");
  if (carouselContainer) {
    carouselContainer.addEventListener("touchstart", (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    carouselContainer.addEventListener("touchend", (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
      resetAutoPlay();
    }, { passive: true });
  }
  
  function handleSwipe() {
    const swipeThreshold = 50;
    if (touchEndX < touchStartX - swipeThreshold) {
      nextSlide();
    }
    if (touchEndX > touchStartX + swipeThreshold) {
      prevSlide();
    }
  }
  
  // Инициализация
  updateCarousel(0);
  startAutoPlay();
  carouselInitialized = true;
}
 
 /* =======================
    Делегация событий
 ======================= */
function bindDelegation(){
  if (delegationBound) return;
  document.addEventListener("click", handleClick, { passive: false });
  document.addEventListener("pointerdown", handlePointerDown, { passive: true });
  document.addEventListener("pointermove", handlePointerMove, { passive: true });
  document.addEventListener("pointerup", handlePointerUp, { passive: true });
  document.addEventListener("pointercancel", handlePointerCancel, { passive: true });
  delegationBound = true;
}

function handleTap(e){
  // Проверяем клик на "Место в топе" (data-action="top")
  const topCard = e.target.closest('[data-action="top"]');
  if (topCard) {
    e.preventDefault();
    e.stopPropagation();
    uiTopPlayers();
    return;
  }
  
  // Проверяем темы ПЕРВЫМИ, до проверки ответов
  const topic = e.target.closest("[data-t]");
  if (topic && !topic.hasAttribute("data-i")){ 
    e.preventDefault(); 
    e.stopPropagation();
    startDuel({mode:"topic", topic: topic.dataset.t}); 
    return; 
  }
  const ticket = e.target.closest("[data-ticket]");
  if (ticket){ 
    e.preventDefault(); 
    e.stopPropagation();
    startTicket(ticket.dataset.ticket); 
    return; 
  }
  const back = e.target.closest("[data-back]");
  if (back){ 
    e.preventDefault(); 
    e.stopPropagation();
    // Проверяем, где мы находимся
    const d = State.duel;
    const titleEl = qs(".subpage-title");
    const currentTitle = titleEl ? titleEl.textContent.trim() : "";
    
    // Проверяем, есть ли элементы вопроса на экране (значит мы в активном вопросе билета)
    const hasQuestionElements = qs(".question-progress") || qs(".question-tracker");
    
    // Если мы в активном вопросе билета (режим ticket + есть элементы вопроса), возвращаемся к списку билетов
    if (d && d.mode === "ticket" && hasQuestionElements) {
      uiTickets();
    }
    // Если мы в активном вопросе темы (режим topic + есть элементы вопроса), возвращаемся к списку тем
    else if (d && d.mode === "topic" && hasQuestionElements) {
      uiTopics();
    }
    // Если мы в настройках, проверяем контекст
    else if (currentTitle === "Настройки") {
      const host = qs("#screen");
      const context = host?.getAttribute('data-settings-context');
      if (context === "tickets") {
        uiTickets();
      } else {
        renderHome();
      }
    }
    // Если мы в списке билетов (title = "Билеты" и нет элементов вопроса), возвращаемся на главную
    else if (currentTitle === "Билеты" && !hasQuestionElements) {
      renderHome();
    }
    // Если мы в списке тем (title = "Темы" и нет элементов вопроса), возвращаемся на главную
    else if (currentTitle === "Темы" && !hasQuestionElements) {
      renderHome();
    }
    // Если мы в топе игроков, возвращаемся на главную
    else if (currentTitle === "Топ игроков") {
      renderHome();
    }
    // Во всех остальных случаях возвращаемся на главную
    else {
      renderHome();
    }
    return; 
  }
  const dot = e.target.closest("[data-question]");
  if (dot){
    e.preventDefault();
    e.stopPropagation();
    if (dot.disabled) return;
    goToQuestion(+dot.dataset.question);
    return;
  }
  if (e.target.closest("[data-prev]")){
    e.preventDefault();
    e.stopPropagation();
    previousQuestion();
    return;
  }
  if (e.target.closest("[data-next]")){
    e.preventDefault();
    e.stopPropagation();
    nextQuestion();
    return;
  }
  if (e.target.closest("[data-finish]")){
    e.preventDefault();
    e.stopPropagation();
    finishDuel();
    return;
  }
  if (e.target.id === "again"){ 
    e.preventDefault();
    e.stopPropagation();
    const currentDuel = State.duel;
    if (currentDuel && currentDuel.mode === "duel") {
      // Если это была дуэль, возвращаемся к поиску
      startDuelSearch();
    } else if (currentDuel && currentDuel.topic){
      startDuel({ mode: "topic", topic: currentDuel.topic });
    } else {
      startDuel({ mode: "quick" });
    }
    return;
  }
  if (e.target.id === "home"){ 
    e.preventDefault(); 
    e.stopPropagation();
    renderHome(); 
    return; 
  }
  // Проверяем ответы ТОЛЬКО если есть data-i
  const answer = e.target.closest("button.answer[data-i]");
  if (answer && answer.hasAttribute("data-i") && !answer.hasAttribute("data-t")){
    e.preventDefault();
    e.stopPropagation();
    const index = parseInt(answer.dataset.i);
    if (!isNaN(index)){
      onAnswer(index);
    }
    return;
  }
}
 
 function handlePointerDown(e){
   if (e.pointerType !== "touch") return;
   State.tap = {
     pointerId: e.pointerId,
     target: getActionTarget(e.target),
     startX: e.clientX,
     startY: e.clientY,
     moved: false,
   };
 }
 
 function handlePointerMove(e){
   const tap = State.tap;
   if (!tap || e.pointerId !== tap.pointerId) return;
   if (Math.abs(e.clientX - tap.startX) > 12 || Math.abs(e.clientY - tap.startY) > 12) {
     tap.moved = true;
   }
 }
 
 function handlePointerUp(e){
  if (e.pointerType !== "touch") return;
  const tap = State.tap;
  if (!tap || e.pointerId !== tap.pointerId) return;
  if (!tap.moved && tap.target) {
    handleTap({ target: tap.target, preventDefault: ()=>{}, currentTarget: tap.target });
  }
  State.tap = null;
}

function handlePointerCancel(){
  State.tap = null;
}

function handleClick(e){
   if (State.ignoreClickUntil && Date.now() < State.ignoreClickUntil) {
     return;
   }
   // Проверяем клик на "Место в топе" ПЕРЕД handleTap
   const topCard = e.target.closest('[data-action="top"]');
   if (topCard) {
     e.preventDefault();
     e.stopPropagation();
     uiTopPlayers();
     return;
   }
   handleTap(e);
 }
 
 function getActionTarget(el){
   if (!el) return null;
   return el.closest("button.answer,[data-ticket],[data-t],[data-question],[data-prev],[data-next],[data-finish],#again,#home");
 }
 
 /* =======================
    Загрузка билетов
 ======================= */
async function loadTickets(){
  // Общий таймаут для всей функции (30 секунд максимум)
  const overallTimeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Общий таймаут загрузки билетов")), 30000);
  });

  const loadTask = async () => {
    let manifest = null;
    try {
      manifest = await fetchJson(MANIFEST_URL);
    } catch(err){
      console.warn("⚠️ Не удалось загрузить manifest, используем запасной список", err);
    }

    const manifestTickets = (manifest && Array.isArray(manifest.tickets)) ? manifest.tickets : [];
    const ticketFiles = uniqueStrings([
      ...manifestTickets,
      ...FALLBACK_MANIFEST.tickets
    ]);
    if(!ticketFiles.length){
      console.warn("⚠️ Нет списка билетов для загрузки");
      return;
    }

    const raw = [];
    let loaded = 0;
    let successes = 0;
    let failures = 0;
    const total = ticketFiles.length;
    const maxFailures = Math.ceil(total * 0.7); // Если больше 70% файлов не загрузилось, прекращаем

    // Обновляем прогресс загрузки
    const updateProgress = () => {
      const percent = 20 + Math.floor((loaded / total) * 70);
      updateLoaderProgress(percent);
    };

    // Ограничиваем количество одновременных загрузок
    const maxConcurrent = 5;
    const chunks = [];
    for (let i = 0; i < ticketFiles.length; i += maxConcurrent) {
      chunks.push(ticketFiles.slice(i, i + maxConcurrent));
    }

    for (const chunk of chunks) {
      if(failures > maxFailures && raw.length === 0){
        console.warn("⚠️ Слишком много ошибок загрузки, переключаемся на fallback");
        break;
      }

      // Загружаем чанк параллельно, но с ограничением
      await Promise.allSettled(chunk.map(async (file) => {
        const url = `questions/${encodePath(file)}`;
        try {
          const response = await fetchWithTimeout(url, { cache:"no-store" }, 2000); // Уменьшил таймаут до 2 секунд
          if(!response.ok) throw new Error(`HTTP ${response.status}`);

          const payload = await response.json();
          const list = Array.isArray(payload) ? payload : (payload.questions || payload.list || payload.data || []);
          const ticketLabel = extractTicketLabel(file);
          for(const item of list){
            raw.push({ ...item, __ticketLabel: ticketLabel });
          }
          successes++;
          loaded++;
          updateProgress();
        } catch(err) {
          console.warn("Не удалось загрузить " + file + ":", err);
          failures++;
          loaded++;
          updateProgress();
        }
      }));
    }

    if (raw.length > 0) {
      const normalized = normalizeQuestions(raw);
      applyQuestions(normalized, "remote");
    } else {
      // Если ничего не загрузилось, используем fallback
      console.log("📦 Ничего не загружено, применяем fallback данные");
    }
  };

  try {
    await Promise.race([loadTask(), overallTimeout]);
  } catch(err) {
    console.warn("⚠️ Превышен общий таймаут загрузки билетов:", err);
  }
}

async function loadPenalties(){
  let text = "";
  try {
    const response = await fetchWithTimeout(PENALTIES_URL, { cache:"no-store" }, 10000);
    if(response.ok) {
      text = await response.text();
    }
  } catch(err) {
    console.warn("Не удалось загрузить штрафы:", err);
  }
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
    const answersRaw = Array.isArray(q.answers) ? q.answers : (Array.isArray(q.variants) ? q.variants : (Array.isArray(q.options) ? q.options : []));
    const answers = answersRaw.map(a => {
      if (a && typeof a === "object"){
        if (Object.prototype.hasOwnProperty.call(a, "answer_text") && a.answer_text != null) return a.answer_text;
        if (Object.prototype.hasOwnProperty.call(a, "text") && a.text != null) return a.text;
        if (Object.prototype.hasOwnProperty.call(a, "title") && a.title != null) return a.title;
      }
      return String(a != null ? a : "");
    });
 
    let correctIndex = answersRaw.findIndex(a => a && typeof a === "object" && a.is_correct === true);
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
 
function resetQuestionState(){
  State.pool.length = 0;
  State.byTicket.clear();
  State.topics.clear();
}

function hydrateFallback(options = {}){
  if (options.reset) {
    resetQuestionState();
  }
  
  if (!FALLBACK_QUESTION_BANK || !Array.isArray(FALLBACK_QUESTION_BANK) || FALLBACK_QUESTION_BANK.length === 0) {
    console.warn("FALLBACK_QUESTION_BANK не определен или пуст");
    return;
  }
  
  const normalized = normalizeQuestions(FALLBACK_QUESTION_BANK);
  applyQuestions(normalized, "fallback");
  return normalized;
}

function applyQuestions(norm, source = "remote"){
  // Не очищаем данные, если новых данных нет или их меньше
  if (!norm || norm.length === 0) {
    console.warn("⚠️ Попытка применить пустые данные, пропускаем");
    return;
  }
  // Если уже есть fallback данные и новые данные не лучше, не заменяем
  if (source === "remote" && State.usedFallback && norm.length < State.pool.length) {
    console.warn("⚠️ Новые данные меньше текущих, сохраняем существующие");
    return;
  }
  resetQuestionState();
  ingestQuestions(norm);
  State.usedFallback = source === "fallback";
}
 
 function ingestQuestions(norm){
   for(const q of norm){
     State.pool.push(q);
     const bucketKey = q.ticketKey;
     if (!State.byTicket.has(bucketKey)){
      const orderValue = Number.isFinite(q.ticketNumber) ? q.ticketNumber : Number.MAX_SAFE_INTEGER;
      State.byTicket.set(bucketKey, { label: q.ticketLabel, order: orderValue, questions: [] });
     }
     const bucket = State.byTicket.get(bucketKey);
     bucket.order = Math.min(bucket.order, Number.isFinite(q.ticketNumber) ? q.ticketNumber : Number.MAX_SAFE_INTEGER);
     bucket.questions.push(q);
 
     for(const t of q.topics){
       if (!State.topics.has(t)) State.topics.set(t, []);
       State.topics.get(t).push(q);
     }
   }
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
 
 function uniqueStrings(items){
   const seen = new Set();
   const out = [];
   for(const item of items){
     if (typeof item !== "string") continue;
     const normalized = item.trim();
     if(!normalized || seen.has(normalized)) continue;
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
 
async function fetchWithTimeout(url, options = {}, timeoutMs = 10000){
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch(err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Request timeout: ${url}`);
    }
    throw err;
  }
}

async function fetchJson(url){
  const response = await fetchWithTimeout(url, { cache:"no-store" }, 3000); // Уменьшил таймаут до 3 секунд
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
 
 function normalizeImagePath(path){
  const raw = path == null ? "" : path.toString().trim();
   if(!raw) return "";
   const withoutDots = raw.replace(/^\.\//, "").replace(/^\/+/, "");
   if(/^https?:/i.test(raw)) return raw;
   if(/^https?:/i.test(withoutDots)) return withoutDots;
   if(!withoutDots) return "";
   if(withoutDots.startsWith("images/")) return withoutDots;
   return `images/${withoutDots}`;
 }
 
/* =======================
   Экраны
======================= */
function uiMainSettings(){
  const hideFromTop = State.settings.hideFromTop || false;
  
  setView(`
    <div class="card">
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <label style="display: flex; align-items: center; justify-content: space-between; padding: 16px; border: 1px solid var(--border); border-radius: var(--radius-md); cursor: pointer; background: var(--bg-card); transition: all var(--transition);" for="setting-hide-from-top" class="settings-toggle-label-main">
          <span style="font-weight: 500; font-size: 15px; color: var(--text);">Не показывать меня в топе</span>
          <div style="position: relative; width: 48px; height: 26px; background: ${hideFromTop ? 'var(--accent)' : 'var(--border)'}; border-radius: 13px; transition: all var(--transition); cursor: pointer;">
            <div style="position: absolute; top: 2px; left: ${hideFromTop ? '24px' : '2px'}; width: 22px; height: 22px; background: white; border-radius: 50%; transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>
          </div>
          <input type="checkbox" id="setting-hide-from-top" ${hideFromTop ? 'checked' : ''} style="position: absolute; opacity: 0; pointer-events: none;" />
        </label>
      </div>
    </div>
  `, { subpage: true, title: "Настройки" });
  
  scheduleFrame(() => {
    const checkbox = qs("#setting-hide-from-top");
    const label = qs(".settings-toggle-label-main");
    
    if (checkbox && label) {
      label.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        checkbox.checked = !checkbox.checked;
        State.settings.hideFromTop = checkbox.checked;
        saveUserSettings();
        
        const toggle = label.querySelector("div > div");
        const bg = label.querySelector("div");
        if (toggle && bg) {
          toggle.style.left = checkbox.checked ? '24px' : '2px';
          bg.style.background = checkbox.checked ? 'var(--accent)' : 'var(--border)';
        }
        
        // Обновляем место в топе
        updateStatsDisplay();
      }, { passive: true });
    }
  });
}

function uiTopPlayers(){
  const players = getAllPlayersTopData();
  
  if (!players.length) {
    setView(`
      <div class="card">
        <p style="text-align: center; color: var(--muted);">Пока нет игроков в топе</p>
      </div>
    `, { subpage: true, title: "Топ игроков" });
    return;
  }
  
  const currentUserId = getTelegramUserId();
  
  const playersHtml = players.map((player, index) => {
    const isCurrentUser = currentUserId && player.userId === currentUserId;
    const place = index + 1;
    const medal = place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : `${place}.`;
    
    // Получаем имя пользователя
    const displayName = player.username || 
                       (player.firstName ? `${player.firstName} ${player.lastName || ''}`.trim() : `User${player.userId}`) ||
                       `User${player.userId}`;
    
    return `
      <div class="card" style="${isCurrentUser ? 'border: 2px solid var(--accent); background: rgba(0, 149, 246, 0.05);' : ''}">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="font-size: 24px; font-weight: 700; min-width: 40px; text-align: center;">${medal}</div>
          ${player.photoUrl ? 
            `<img src="${esc(player.photoUrl)}" alt="${esc(displayName)}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border);" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />` : 
            ''
          }
          <div style="display: ${player.photoUrl ? 'none' : 'flex'}; width: 48px; height: 48px; border-radius: 50%; background: var(--accent-transparent); align-items: center; justify-content: center; font-size: 20px; font-weight: 700; color: var(--accent);">
            ${displayName.charAt(0).toUpperCase()}
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; font-size: 15px; color: var(--text); margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${esc(displayName)}${isCurrentUser ? ' (Вы)' : ''}</div>
            <div style="display: flex; gap: 16px; font-size: 13px; color: var(--muted);">
              <span>Винрейт: <strong style="color: var(--text);">${player.winRate}%</strong></span>
              <span>Игр: <strong style="color: var(--text);">${player.gamesPlayed}</strong></span>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  setView(playersHtml, { subpage: true, title: "Топ игроков" });
}

function uiSettings(context = null){
  const showDifficulty = State.settings.showDifficulty || false;
  const hideCompleted = State.settings.hideCompletedTickets || false;
  
  setView(`
    <div class="card">
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <label style="display: flex; align-items: center; justify-content: space-between; padding: 16px; border: 1px solid var(--border); border-radius: var(--radius-md); cursor: pointer; background: var(--bg-card); transition: all var(--transition);" for="setting-show-difficulty" class="settings-toggle-label">
          <span style="font-weight: 500; font-size: 15px; color: var(--text);">Показывать уровень сложности</span>
          <div style="position: relative; width: 48px; height: 26px; background: ${showDifficulty ? 'var(--accent)' : 'var(--border)'}; border-radius: 13px; transition: all var(--transition); cursor: pointer;">
            <div style="position: absolute; top: 2px; left: ${showDifficulty ? '24px' : '2px'}; width: 22px; height: 22px; background: white; border-radius: 50%; transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>
          </div>
          <input type="checkbox" id="setting-show-difficulty" ${showDifficulty ? 'checked' : ''} style="position: absolute; opacity: 0; pointer-events: none;" />
        </label>
        <label style="display: flex; align-items: center; justify-content: space-between; padding: 16px; border: 1px solid var(--border); border-radius: var(--radius-md); cursor: pointer; background: var(--bg-card); transition: all var(--transition);" for="setting-hide-completed" class="settings-toggle-label-2">
          <span style="font-weight: 500; font-size: 15px; color: var(--text);">Скрыть решенные билеты</span>
          <div style="position: relative; width: 48px; height: 26px; background: ${hideCompleted ? 'var(--accent)' : 'var(--border)'}; border-radius: 13px; transition: all var(--transition); cursor: pointer;">
            <div style="position: absolute; top: 2px; left: ${hideCompleted ? '24px' : '2px'}; width: 22px; height: 22px; background: white; border-radius: 50%; transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>
          </div>
          <input type="checkbox" id="setting-hide-completed" ${hideCompleted ? 'checked' : ''} style="position: absolute; opacity: 0; pointer-events: none;" />
        </label>
      </div>
    </div>
  `, { subpage: true, title: "Настройки", settingsContext: context });
  
  scheduleFrame(() => {
    const checkbox1 = qs("#setting-show-difficulty");
    const label1 = qs(".settings-toggle-label");
    const checkbox2 = qs("#setting-hide-completed");
    const label2 = qs(".settings-toggle-label-2");
    
    // Обработчик для первого переключателя
    if (checkbox1 && label1) {
      label1.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        checkbox1.checked = !checkbox1.checked;
        State.settings.showDifficulty = checkbox1.checked;
        saveUserSettings();
        
        const toggle = label1.querySelector("div > div");
        const bg = label1.querySelector("div");
        if (toggle && bg) {
          toggle.style.left = checkbox1.checked ? '24px' : '2px';
          bg.style.background = checkbox1.checked ? 'var(--accent)' : 'var(--border)';
        }
      }, { passive: true });
    }
    
    // Обработчик для второго переключателя
    if (checkbox2 && label2) {
      label2.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        checkbox2.checked = !checkbox2.checked;
        State.settings.hideCompletedTickets = checkbox2.checked;
        saveUserSettings();
        
        const toggle = label2.querySelector("div > div");
        const bg = label2.querySelector("div");
        if (toggle && bg) {
          toggle.style.left = checkbox2.checked ? '24px' : '2px';
          bg.style.background = checkbox2.checked ? 'var(--accent)' : 'var(--border)';
        }
      }, { passive: true });
    }
  });
}

function uiTopics(){
   // Очищаем состояние дуэли при возврате к списку тем
   clearAdvanceTimer();
   State.duel = null;
   
   const list=[...State.topics.keys()].sort((a,b)=>a.localeCompare(b,'ru'));
   const listId = "topics-list";
   
   if(!list.length){ 
     setView(`<div class="card"><p>❌ Темы не найдены</p></div>`, { subpage: true, title: "Темы" }); 
     return; 
   }
   
   const html = `
     <div class="card">
       <input type="text" id="search-topics" class="search-input" placeholder="Поиск тем..." data-search-target="${listId}" />
     </div>
     <div class="card"><div class="grid auto topics-grid" id="${listId}">
       ${list.map(t=>{
         const progress = getTopicProgress(t);
         const progressPercent = progress ? progress.percent : 0;
         const isCompleted = progress && progress.completed;
         const borderClass = isCompleted ? 'topic-completed' : progressPercent > 0 ? 'topic-partial' : '';
         // Добавляем style с CSS переменной для процента прогресса
         const progressStyle = progressPercent > 0 && !isCompleted ? `style="--progress-width: ${progressPercent}%"` : '';
         return `<button type="button" class="btn topic-btn ${borderClass}" data-search-text="${esc(t.toLowerCase())}" data-t="${esc(t)}" ${progressStyle}>${esc(t)}</button>`;
       }).join("")}
     </div></div>
   `;
   
   setView(html, { subpage: true, title: "Темы" });
   
   scheduleFrame(() => {
     const searchInput = qs("#search-topics");
     const listContainer = qs(`#${listId}`);
     if(searchInput && listContainer) {
       bindSearch("search-topics", listId);
     }
   });
 }
 
 function uiTickets(){
   // Очищаем состояние дуэли при возврате к списку билетов
   clearAdvanceTimer();
   State.duel = null;
   
   let tickets = [...State.byTicket.entries()].map(([key, meta]) => ({
     key,
     label: meta.label || key,
     order: Number.isFinite(meta.order) ? meta.order : Number.MAX_SAFE_INTEGER,
     questions: meta.questions
   })).sort((a,b)=> a.order - b.order || a.label.localeCompare(b.label,'ru'));
   
   // Фильтруем решенные билеты, если включена настройка
   const hideCompleted = State.settings.hideCompletedTickets || false;
   if (hideCompleted) {
     tickets = tickets.filter(t => {
       const progress = getTicketProgress(t.label);
       return !(progress && progress.completed);
     });
   }
   
   if(!tickets.length){
     const message = hideCompleted ? 
       `<div class="card"><p>✅ Все билеты решены!</p></div>` : 
       `<div class="card"><p>❌ Билеты не найдены</p></div>`;
     setView(message, { subpage: true, title: "Билеты", showSettings: true });
     return;
   }
   
   const showDifficulty = State.settings.showDifficulty || false;
   
   setView(`
     <div class="card"><div class="grid auto">
       ${tickets.map(t=>{
         const progress = getTicketProgress(t.label);
         const progressPercent = progress ? progress.percent : 0;
         const isCompleted = progress && progress.completed;
         const borderClass = isCompleted ? 'ticket-completed' : progressPercent > 0 ? 'ticket-partial' : '';
         // Добавляем style с CSS переменной для процента прогресса
         const progressStyle = progressPercent > 0 && !isCompleted ? `style="--progress-width: ${progressPercent}%"` : '';
         
         // Получаем уровень сложности (всегда показываем, если включена настройка)
         let difficultyHtml = '';
         if (showDifficulty) {
           const difficulty = getTicketDifficulty(t.label);
           if (difficulty) {
             difficultyHtml = `<span class="ticket-difficulty difficulty-${difficulty.level}">${esc(difficulty.text)}</span>`;
           }
         }
         
         return `<button type="button" class="answer ticket-btn ${borderClass}" data-ticket="${esc(t.key)}" ${progressStyle}>
           <span class="ticket-label">${esc(t.label)}</span>
           ${difficultyHtml}
         </button>`;
       }).join("")}
     </div></div>
     `, { subpage: true, title: "Билеты", showSettings: true, settingsContext: "tickets" });
 }
 
async function loadMarkup(){
  if (State.markup) return State.markup;
  try {
    const response = await fetchWithTimeout(MARKUP_URL, { cache:"no-store" }, 10000);
    if(response.ok) {
      const data = await response.json();
      State.markup = data;
      return data;
    }
  } catch(err) {
    console.warn("Не удалось загрузить разметку:", err);
  }
  return null;
}

async function uiMarkup(){
  // Если данные уже загружены, показываем сразу
  if(!State.markup) {
    // Показываем placeholder сразу для мгновенного отклика
    setView(`<div class="card"><input type="text" class="search-input" placeholder="🔍 Поиск разметки..." disabled /></div><div><div class="card"><h3>Загрузка...</h3></div></div>`, { subpage: true, title: "Разметка" });
    
    // Загружаем в фоне
    if(!State.markupLoading) {
      State.markupLoading = true;
      await loadMarkup();
      State.markupLoading = false;
    } else {
      // Ждем завершения текущей загрузки
      while(State.markupLoading) {
        await new Promise(r => setTimeout(r, 50));
      }
    }
  }
  
  const markup = State.markup;
  
  if(!markup || typeof markup !== "object") {
    setView(`<div class="card"><p>❌ Данные разметки не найдены</p></div>`, { subpage: true, title: "Разметка" });
    return;
  }

  const categories = Object.keys(markup);
  const listId = "markup-list";
  let html = `
    <div class="card">
      <input type="text" id="search-markup" class="search-input" placeholder="🔍 Поиск разметки..." data-search-target="${listId}" />
    </div>
    <div id="${listId}">
  `;

  for(const category of categories) {
    const items = markup[category];
    if(!items || typeof items !== "object") continue;

    const itemKeys = Object.keys(items).sort((a,b)=>{
      const numA = parseFloat(a) || 0;
      const numB = parseFloat(b) || 0;
      return numA - numB;
    });

    html += `
      <div class="markup-category">
        <div class="card">
          <h3>${esc(category)}</h3>
        </div>
        <div class="markup-list">
          ${itemKeys.map(key => {
            const item = items[key];
            if(!item) return "";
            const number = item.number || key;
            const image = item.image || "";
            const description = item.description || "";
            const imagePath = image.startsWith("./") ? image.substring(2) : image;
            const searchText = `${number} ${description} ${category}`.toLowerCase();
            return `
              <div class="markup-item" data-search-text="${esc(searchText)}">
                <div class="markup-item__head">
                  <h4>${esc(number)}</h4>
                  <span class="markup-item__badge">${esc(number)}</span>
                </div>
                ${image ? `<img src="${esc(imagePath)}" class="markup-item__image" alt="${esc(number)}" onerror="this.style.display='none'">` : ""}
                <p>${esc(description)}</p>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }
  
  html += `</div>`;
  setView(html, { subpage: true, title: "Разметка" });
  bindSearch("search-markup", listId);
}

function uiStats(){
  const questionsCount = State.pool.length;
  const topicsCount = State.topics.size;
  const ticketsCount = State.byTicket.size;
  
  setView(`
    <div class="card">
      <div class="grid auto">
        <div class="stat-item">
          <div class="stat-value">${formatNumber(questionsCount)}</div>
          <div class="stat-label">Вопросов</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${formatNumber(topicsCount)}</div>
          <div class="stat-label">Тем</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${formatNumber(ticketsCount)}</div>
          <div class="stat-label">Билетов</div>
        </div>
      </div>
    </div>
  `, { subpage: true, title: "Статистика" });
}

async function uiPenalties(){
  // Если данные уже загружены, показываем сразу
  if(!State.penalties || State.penalties.length === 0) {
    // Показываем placeholder сразу для мгновенного отклика
    setView(`<div class="card"><input type="text" class="search-input" placeholder="🔍 Поиск штрафов..." disabled /></div><div class="penalties-grid"><div class="penalty"><h4>Загрузка...</h4></div></div>`, { subpage: true, title: "Штрафы" });
    
    // Загружаем в фоне
    if(!State.penaltiesLoading) {
      State.penaltiesLoading = true;
      await loadPenalties();
      State.penaltiesLoading = false;
    } else {
      // Ждем завершения текущей загрузки
      while(State.penaltiesLoading) {
        await new Promise(r => setTimeout(r, 50));
      }
    }
  }

  const items = State.penalties || [];
  const listId = "penalties-list";
  
  if(!items.length) {
    setView(`<div class="card"><p>❌ Данные о штрафах не найдены</p></div>`, { subpage: true, title: "Штрафы" });
    return;
  }

  const html = `
    <div class="card">
      <input type="text" id="search-penalties" class="search-input" placeholder="🔍 Поиск штрафов..." data-search-target="${listId}" />
    </div>
    <div class="penalties-grid" id="${listId}">
      ${items.map(item => {
        const searchText = `${item.articlePart || ""} ${item.text || ""} ${item.penalty || ""}`.toLowerCase();
        return `
          <div class="penalty" data-search-text="${esc(searchText)}">
            <h4>Статья ${esc(item.articlePart || "—")}</h4>
            <p>${esc(item.text || "")}</p>
            <p class="penalty__fine">${esc(item.penalty || "—")}</p>
          </div>
        `;
      }).join("")}
    </div>
  `;

  setView(html, { subpage: true, title: "Штрафы" });
  bindSearch("search-penalties", listId);
}
 
 /* =======================
    Поиск противника для дуэли
 ======================= */
const DUEL_SEARCH_KEY = "pdd-duel-search-queue";
const DUEL_SEARCH_TIMEOUT = 20000; // 20 секунд
// URL API сервера (замените на ваш URL)
// Для разработки используйте: const API_BASE_URL = "http://localhost:8080";
// Для продакшена замените на ваш домен:
const API_BASE_URL = "http://localhost:8080";  // TODO: Замените на ваш API URL

function startDuelSearch() {
  // Пробуем получить Telegram ID несколько раз (API может загружаться асинхронно)
  let currentUserId = getTelegramUserId();
  
  console.log("🔍 Поиск Telegram ID:", currentUserId);
  
  // Если ID не найден, пробуем еще раз через небольшую задержку
  if (!currentUserId) {
    // Пробуем получить через window напрямую
    try {
      if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
        currentUserId = window.Telegram.WebApp.initDataUnsafe.user.id;
        console.log("✅ Telegram ID найден через window.Telegram.WebApp.initDataUnsafe");
      } else if (window.Telegram?.WebApp?.initData?.user?.id) {
        currentUserId = window.Telegram.WebApp.initData.user.id;
        console.log("✅ Telegram ID найден через window.Telegram.WebApp.initData");
      }
    } catch(e) {
      console.warn("Ошибка при получении Telegram ID:", e);
    }
  }
  
  // Если все еще нет ID, используем временный ID (без ошибок!)
  if (!currentUserId) {
    console.log("⚠️ Telegram ID не найден, используем временный ID");
    // Проверяем, есть ли уже сохраненный временный ID
    const savedTempId = localStorage.getItem('pdd-duel-temp-user-id');
    if (savedTempId) {
      currentUserId = savedTempId;
    } else {
      currentUserId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('pdd-duel-temp-user-id', currentUserId);
    }
  }
  
  console.log("🎮 Начинаем поиск противника с ID:", currentUserId);
  
  // Останавливаем предыдущий поиск если есть
  stopDuelSearch();
  
  State.duelSearch.active = true;
  State.duelSearch.startTime = Date.now();
  State.duelSearch.opponentId = null;
  State.duelSearch.isBot = false;
  
  // Добавляем себя в очередь поиска (async)
  addToSearchQueue(currentUserId).catch(e => console.error("Ошибка добавления в очередь:", e));
  
  // Показываем экран поиска
  showDuelSearchScreen();
  
  // Начинаем проверку каждую секунду
  const searchInterval = setInterval(() => {
    if (!State.duelSearch.active) {
      clearInterval(searchInterval);
      return;
    }
    
    checkForOpponent(currentUserId).catch(e => console.error("Ошибка проверки противника:", e));
    
    // Обновляем экран с новым временем
    updateDuelSearchScreen();
    
    // Проверяем, прошло ли 20 секунд
    const elapsed = Date.now() - State.duelSearch.startTime;
    if (elapsed >= DUEL_SEARCH_TIMEOUT && !State.duelSearch.opponentId) {
      showBotButton();
    }
  }, 1000);
  
  State.duelSearch.searchInterval = searchInterval;
}

function stopDuelSearch() {
  if (State.duelSearch.searchInterval) {
    clearInterval(State.duelSearch.searchInterval);
    State.duelSearch.searchInterval = null;
  }
  State.duelSearch.active = false;
  removeFromSearchQueue();
}

async function addToSearchQueue(userId) {
  try {
    if (!userId) {
      // Если userId не передан, используем временный
      const savedTempId = localStorage.getItem('pdd-duel-temp-user-id');
      userId = savedTempId || `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      if (!savedTempId) {
        localStorage.setItem('pdd-duel-temp-user-id', userId);
      }
    }
    
    // Используем API сервер для добавления в очередь
    try {
      const response = await fetch(`${API_BASE_URL}/api/duel/search/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: parseInt(userId) || userId })
      });
      
      if (response.ok) {
        console.log("✅ Добавлен в очередь поиска через API");
      } else {
        console.warn("⚠️ Не удалось добавить в очередь через API, используем localStorage");
        // Fallback на localStorage
        const queue = getSearchQueue();
        const now = Date.now();
        const activeQueue = queue.filter(entry => now - entry.timestamp < 30000);
        if (!activeQueue.find(entry => entry.userId === userId)) {
          activeQueue.push({ userId: userId, timestamp: now });
          localStorage.setItem(DUEL_SEARCH_KEY, JSON.stringify(activeQueue));
        }
      }
    } catch(apiError) {
      console.warn("⚠️ API недоступен, используем localStorage:", apiError);
      // Fallback на localStorage
      const queue = getSearchQueue();
      const now = Date.now();
      const activeQueue = queue.filter(entry => now - entry.timestamp < 30000);
      if (!activeQueue.find(entry => entry.userId === userId)) {
        activeQueue.push({ userId: userId, timestamp: now });
        localStorage.setItem(DUEL_SEARCH_KEY, JSON.stringify(activeQueue));
      }
    }
  } catch(e) {
    console.error("Ошибка добавления в очередь:", e);
  }
}

async function removeFromSearchQueue() {
  try {
    let currentUserId = getTelegramUserId();
    if (!currentUserId) {
      // Используем сохраненный временный ID если есть
      currentUserId = localStorage.getItem('pdd-duel-temp-user-id');
      if (!currentUserId) return;
    }
    
    // Используем API сервер для удаления из очереди
    try {
      const response = await fetch(`${API_BASE_URL}/api/duel/search/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: parseInt(currentUserId) || currentUserId })
      });
      
      if (response.ok) {
        console.log("✅ Удален из очереди через API");
      } else {
        // Fallback на localStorage
        const queue = getSearchQueue();
        const filtered = queue.filter(entry => entry.userId !== currentUserId);
        localStorage.setItem(DUEL_SEARCH_KEY, JSON.stringify(filtered));
      }
    } catch(apiError) {
      console.warn("⚠️ API недоступен, используем localStorage:", apiError);
      // Fallback на localStorage
      const queue = getSearchQueue();
      const filtered = queue.filter(entry => entry.userId !== currentUserId);
      localStorage.setItem(DUEL_SEARCH_KEY, JSON.stringify(filtered));
    }
  } catch(e) {
    console.error("Ошибка удаления из очереди:", e);
  }
}

function getSearchQueue() {
  try {
    const data = localStorage.getItem(DUEL_SEARCH_KEY);
    return data ? JSON.parse(data) : [];
  } catch(e) {
    return [];
  }
}

async function checkForOpponent(currentUserId) {
  try {
    // Используем API сервер для поиска противника
    try {
      const response = await fetch(`${API_BASE_URL}/api/duel/search/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: parseInt(currentUserId) || currentUserId })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.found && data.opponent_id) {
          // Найден противник через API!
          State.duelSearch.opponentId = data.opponent_id;
          State.duelSearch.isBot = false;
          stopDuelSearch();
          startRealDuel(data.opponent_id);
          return;
        }
      }
    } catch(apiError) {
      console.warn("⚠️ API недоступен, используем localStorage:", apiError);
    }
    
    // Fallback на localStorage
    const queue = getSearchQueue();
    const now = Date.now();
    
    // Ищем другого игрока (не себя и не старше 30 секунд)
    const opponent = queue.find(entry => 
      entry.userId !== currentUserId && 
      (now - entry.timestamp) < 30000
    );
    
    if (opponent) {
      // Найден противник через localStorage!
      State.duelSearch.opponentId = opponent.userId;
      State.duelSearch.isBot = false;
      stopDuelSearch();
      startRealDuel(opponent.userId);
    }
  } catch(e) {
    console.error("Ошибка проверки противника:", e);
  }
}

function showDuelSearchScreen() {
  updateDuelSearchScreen();
  
  // Привязываем обработчики
  scheduleFrame(() => {
    const botBtn = qs("#duel-bot-btn");
    if (botBtn) {
      botBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        startBotDuel();
      }, { passive: true });
    }
    
    const cancelBtn = qs("#cancel-duel-search");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        stopDuelSearch();
        renderHome();
      }, { passive: true });
    }
  });
}

function updateDuelSearchScreen() {
  if (!State.duelSearch.active) return;
  
  const elapsed = Math.floor((Date.now() - State.duelSearch.startTime) / 1000);
  const timeLeft = Math.max(0, Math.floor(DUEL_SEARCH_TIMEOUT / 1000) - elapsed);
  const showBotButton = timeLeft <= 0;
  
  setView(`
    <div class="card" style="text-align: center; padding: 40px 20px;">
      <div style="font-size: 48px; margin-bottom: 20px;">⚔️</div>
      <h3 style="margin-bottom: 12px;">Поиск противника...</h3>
      <p style="color: var(--muted); margin-bottom: 24px;">
        Ищем для вас соперника
      </p>
      <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 24px;">
        <div class="search-dot" style="animation-delay: 0s;"></div>
        <div class="search-dot" style="animation-delay: 0.2s;"></div>
        <div class="search-dot" style="animation-delay: 0.4s;"></div>
      </div>
      <div id="search-timer" style="font-size: 14px; color: var(--muted); margin-bottom: 20px;">
        Прошло: ${elapsed} сек
      </div>
      ${showBotButton ? `
        <button class="btn btn-primary" id="duel-bot-btn" style="width: 100%; margin-top: 20px;">
          🤖 Играть против робота
        </button>
      ` : ''}
      <button class="btn" id="cancel-duel-search" style="width: 100%; margin-top: 12px;">
        Отмена
      </button>
    </div>
  `, { subpage: true, title: "Дуэль" });
  
  // Привязываем обработчики после обновления
  scheduleFrame(() => {
    const botBtn = qs("#duel-bot-btn");
    if (botBtn && !botBtn.hasAttribute("data-listener")) {
      botBtn.setAttribute("data-listener", "true");
      botBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        startBotDuel();
      }, { passive: true });
    }
    
    const cancelBtn = qs("#cancel-duel-search");
    if (cancelBtn && !cancelBtn.hasAttribute("data-listener")) {
      cancelBtn.setAttribute("data-listener", "true");
      cancelBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        stopDuelSearch();
        renderHome();
      }, { passive: true });
    }
  });
}

function showBotButton() {
  // Обновляем экран, чтобы показать кнопку бота
  const elapsed = Math.floor((Date.now() - State.duelSearch.startTime) / 1000);
  
  const searchContent = qs(".view-content");
  if (searchContent) {
    const botBtnHtml = `
      <button class="btn btn-primary" id="duel-bot-btn" style="width: 100%; margin-top: 20px;">
        🤖 Играть против робота
      </button>
    `;
    
    const existingBtn = qs("#duel-bot-btn");
    if (!existingBtn) {
      const card = searchContent.querySelector(".card");
      if (card) {
        card.insertAdjacentHTML("beforeend", botBtnHtml);
        const botBtn = qs("#duel-bot-btn");
        if (botBtn) {
          botBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            startBotDuel();
          }, { passive: true });
        }
      }
    }
  }
}

function startBotDuel() {
  stopDuelSearch();
  State.duelSearch.isBot = true;
  State.duelSearch.opponentId = null;
  
  // Запускаем обычную дуэль, но помечаем как против бота
  startDuel({ mode: "duel", isBot: true });
}

function startRealDuel(opponentId) {
  State.duelSearch.isBot = false;
  State.duelSearch.opponentId = opponentId;
  
  // Запускаем дуэль против реального игрока
  startDuel({ mode: "duel", opponentId: opponentId, isBot: false });
  
  // Начинаем отслеживать прогресс соперника
  startOpponentProgressTracking(opponentId);
}

// Начать отслеживание прогресса соперника
function startOpponentProgressTracking(opponentId) {
  // Останавливаем предыдущий интервал если есть
  if (State.opponentProgressInterval) {
    clearInterval(State.opponentProgressInterval);
  }
  
  // Обновляем прогресс каждые 2 секунды
  State.opponentProgressInterval = setInterval(() => {
    updateOpponentProgress(opponentId);
  }, 2000);
  
  // Первое обновление сразу
  updateOpponentProgress(opponentId);
}

// Остановить отслеживание прогресса соперника
function stopOpponentProgressTracking() {
  if (State.opponentProgressInterval) {
    clearInterval(State.opponentProgressInterval);
    State.opponentProgressInterval = null;
  }
}

// Обновить прогресс соперника
async function updateOpponentProgress(opponentId) {
  const d = State.duel;
  if (!d || !opponentId || d.isBot) return;
  
  const currentUserId = getTelegramUserId();
  if (!currentUserId) return;
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/duel/progress/get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        user_id: parseInt(currentUserId) || currentUserId,
        opponent_id: parseInt(opponentId) || opponentId
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.progress) {
        State.opponentProgress.currentQuestion = data.progress.current_question || 0;
        State.opponentProgress.score = data.progress.score || 0;
        
        // Обновляем отображение прогресса соперника
        updateOpponentProgressDisplay();
      }
    }
  } catch(e) {
    console.warn("Ошибка получения прогресса соперника:", e);
  }
}

// Обновить отображение прогресса соперника
function updateOpponentProgressDisplay() {
  const opponentProgressEl = qs("#opponent-progress");
  if (opponentProgressEl && State.opponentProgress) {
    opponentProgressEl.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: rgba(0, 149, 246, 0.05); border-radius: 8px; margin-bottom: 12px;">
        <span style="font-size: 12px; color: var(--muted);">Соперник:</span>
        <span style="font-size: 13px; font-weight: 600; color: var(--text);">
          Вопрос ${State.opponentProgress.currentQuestion + 1} | Очки: ${State.opponentProgress.score}
        </span>
      </div>
    `;
  }
}

// Отправить свой прогресс на сервер
async function syncDuelProgress() {
  const d = State.duel;
  if (!d || !d.opponentId || d.isBot) return;
  
  const currentUserId = getTelegramUserId();
  if (!currentUserId) return;
  
  try {
    await fetch(`${API_BASE_URL}/api/duel/progress/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        user_id: parseInt(currentUserId) || currentUserId,
        opponent_id: parseInt(d.opponentId) || d.opponentId,
        current_question: d.i || 0,
        user_score: d.me || 0
      })
    });
  } catch(e) {
    console.warn("Ошибка синхронизации прогресса:", e);
  }
}

 /* =======================
    Викторина
 ======================= */
 function startDuel({mode,topic=null,isBot=false,opponentId=null}){
   clearAdvanceTimer();
   const src = topic ? (State.topics.get(topic)||[]) : State.pool;
   if(!src.length){ setView(`<div class="card"><h3>Дуэль</h3><p>⚠️ Нет данных</p></div>`, { subpage: true, title: topic || "Дуэль" }); return; }
   
   // Проверяем, есть ли сохраненный прогресс для темы
   let savedProgress = null;
   let startIndex = 0;
   if (topic) {
     savedProgress = getTopicProgress(topic);
     if (savedProgress && !savedProgress.completed) {
       // Если есть сохраненный прогресс, начинаем с сохраненного индекса
       startIndex = savedProgress.currentIndex !== undefined ? savedProgress.currentIndex : 0;
       // Если индекс больше или равен количеству вопросов, начинаем сначала
       if (startIndex >= 20) startIndex = 0;
     }
   }
   
   // Если есть сохраненный прогресс, используем тот же порядок вопросов
   let q;
   if (savedProgress && savedProgress.questionOrder && savedProgress.questionOrder.length > 0 && !savedProgress.completed) {
     // Восстанавливаем порядок вопросов из сохраненного прогресса
     const questionMap = new Map(src.map((q) => [q.question || q.text || JSON.stringify(q), q]));
     q = savedProgress.questionOrder.map(qKey => questionMap.get(qKey)).filter(Boolean);
     if (q.length === 0) {
       q = shuffle(src).slice(0,20);
     }
   } else {
     q = shuffle(src).slice(0,20);
   }
   
   // Восстанавливаем ответы если есть сохраненный прогресс
   let answers = Array(q.length).fill(null);
   let me = 0;
   if (savedProgress && !savedProgress.completed) {
     if (savedProgress.answers && savedProgress.answers.length > 0) {
       // Обрезаем или расширяем массив ответов до нужной длины
       answers = Array(q.length).fill(null);
       for (let i = 0; i < Math.min(savedProgress.answers.length, q.length); i++) {
         if (savedProgress.answers[i]) {
           answers[i] = { ...savedProgress.answers[i] };
         }
       }
       me = savedProgress.correct || 0;
     }
     // Восстанавливаем индекс, на котором остановились
     startIndex = savedProgress.currentIndex !== undefined ? savedProgress.currentIndex : 0;
     // Если индекс больше или равен количеству вопросов, начинаем сначала
     if (startIndex >= q.length) startIndex = 0;
   }
   
   State.duel = {
     mode,
     topic,
     i: startIndex,
     me: me,
     q,
     answers: answers,
     furthest: Math.max(startIndex, answers.filter(a => a && a.status).length - 1),
     completed: false,
     isBot: isBot || false,
     opponentId: opponentId || null
   };
   renderQuestion(startIndex);
 }
 function startTicket(key){
   clearAdvanceTimer();
   const bucket = State.byTicket.get(key);
  const arr = (bucket && Array.isArray(bucket.questions)) ? bucket.questions : [];
  const label = bucket && bucket.label ? bucket.label : key;
  if(!arr.length){ setView(`<div class="card"><h3>${esc(label)}</h3><p>⚠️ Нет вопросов</p></div>`, { subpage: true, title: label || "Билет" }); return; }
  
  // Проверяем, есть ли сохраненный прогресс для билета
  const savedProgress = getTicketProgress(label);
  let startIndex = 0;
  
  // Если есть сохраненный прогресс, используем тот же порядок вопросов
  let q;
  if (savedProgress && savedProgress.questionOrder && savedProgress.questionOrder.length > 0 && !savedProgress.completed) {
    // Восстанавливаем порядок вопросов из сохраненного прогресса
    const questionMap = new Map(arr.map((q) => [q.question || q.text || JSON.stringify(q), q]));
    q = savedProgress.questionOrder.map(qKey => questionMap.get(qKey)).filter(Boolean);
    if (q.length === 0) {
      q = arr.length>20 ? shuffle(arr).slice(0,20) : arr.slice(0,20);
    }
  } else {
    q = arr.length>20 ? shuffle(arr).slice(0,20) : arr.slice(0,20);
  }
  
  // Восстанавливаем ответы и индекс если есть сохраненный прогресс
  let answers = Array(q.length).fill(null);
  let me = 0;
  if (savedProgress && !savedProgress.completed) {
    if (savedProgress.answers && savedProgress.answers.length > 0) {
      // Обрезаем или расширяем массив ответов до нужной длины
      answers = Array(q.length).fill(null);
      for (let i = 0; i < Math.min(savedProgress.answers.length, q.length); i++) {
        if (savedProgress.answers[i]) {
          answers[i] = { ...savedProgress.answers[i] };
        }
      }
      me = savedProgress.correct || 0;
    }
    // Восстанавливаем индекс, на котором остановились
    startIndex = savedProgress.currentIndex !== undefined ? savedProgress.currentIndex : 0;
    // Если индекс больше или равен количеству вопросов, начинаем сначала
    if (startIndex >= q.length) startIndex = 0;
  }
  
   State.duel = {
     mode:"ticket",
     topic:null,
     i: startIndex,
     me: me,
     q,
    ticketLabel: label,
     answers: answers,
     furthest: Math.max(startIndex, answers.filter(a => a && a.status).length - 1),
     completed: false
   };
   renderQuestion(startIndex);
 }
 
 function renderQuestion(targetIndex){
   const d = State.duel;
   if(!d || !Array.isArray(d.q)) return;
   clearAdvanceTimer();
   if(typeof targetIndex !== "number") targetIndex = d.i;
   if(targetIndex >= d.q.length){
     finishDuel();
     return;
   }
   d.i = Math.max(0, Math.min(targetIndex, d.q.length - 1));
   const q = d.q[d.i];
  const duelTicketLabel = d.ticketLabel ? d.ticketLabel : null;
  const ticketInfo = q.ticketLabel || duelTicketLabel || (q.ticketNumber ? `Билет ${q.ticketNumber}` : "Билет");
  const headerTitle = d.mode === "topic" && d.topic ? d.topic : (d.mode === "ticket" ? (duelTicketLabel || ticketInfo) : "Дуэль");
   const answerState = d.answers[d.i];
   const isAnswered = !!(answerState && answerState.status);
  const tipVisible = !!(answerState && answerState.status === "wrong");
   const tracker = renderTracker();
   const controls = renderQuestionControls(isAnswered);
   
   // Индикатор прогресса сверху
   const progressPercent = ((d.i+1)/d.q.length*100).toFixed(0);
   const progressIndicator = `<div class="question-progress"><div class="question-progress-bar" style="--progress-width: ${progressPercent}%"><div style="width: ${progressPercent}%"></div></div><span class="question-progress-text">${d.i+1}/${d.q.length}</span></div>`;
   
   // Прогресс соперника (только для дуэли с реальным игроком)
   const opponentProgressHtml = (d.mode === "duel" && d.opponentId && !d.isBot) ? `
     <div id="opponent-progress" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: rgba(0, 149, 246, 0.05); border-radius: 8px; margin-bottom: 12px;">
       <span style="font-size: 12px; color: var(--muted);">Соперник:</span>
       <span style="font-size: 13px; font-weight: 600; color: var(--text);">
         Вопрос ${State.opponentProgress.currentQuestion + 1} | Очки: ${State.opponentProgress.score}
       </span>
     </div>
   ` : '';
 
   setView(`
     ${progressIndicator}
     ${opponentProgressHtml}
     ${tracker}
     <div class="card">
       <div class="meta">${esc(ticketInfo)}</div>
       <h3>${esc(q.question)}</h3>
       ${q.image?`<img src="${q.image}" class="qimg" onerror="this.style.display='none'"/>`:""}
       <div class="grid">${q.answers.map((a,i)=>renderAnswerButton(a, i, q, answerState)).join("")}</div>
      <div id="tip" class="meta" style="${tipVisible ? "display:block" : "display:none"};margin-top:8px;color:#ccc">💡 ${esc(q.tip)}</div>
     </div>
     ${controls}
   `, { subpage: true, title: headerTitle });
   State.lock = false;
 }
 
 function onAnswer(i){
   if(State.lock) return;
   State.lock = true;
   const d = State.duel, q = d.q[d.i];
   const currentIndex = d.i;
   const correct = q.correctIndex;
   const prev = d.answers[d.i];
  if(prev && prev.status){
     State.lock = false;
     return;
   }
 
   const isCorrect = (i === correct);
   if(isCorrect) d.me++;
 
   d.answers[d.i] = { status: isCorrect ? "correct" : "wrong", selected: i };
   d.furthest = Math.min(d.q.length - 1, Math.max(d.furthest, d.i + 1));
   
   // Синхронизируем прогресс с сервером (для дуэли с реальным игроком)
   if (d.mode === "duel" && d.opponentId && !d.isBot) {
     syncDuelProgress();
   }
 
   // Улучшенные тосты с анимацией
   if(isCorrect){ 
     toast("✓");
   } else { 
     toast("✕");
   }
 
   // Обновляем UI без полной перерисовки для производительности
   const answerButtons = qsa("button.answer[data-i]");
   answerButtons.forEach((btn, idx) => {
     btn.classList.remove("correct", "wrong");
     if (idx === i) {
       btn.classList.add(isCorrect ? "correct" : "wrong");
     }
     if (idx === correct && !isCorrect) {
       btn.classList.add("correct");
     }
     btn.disabled = true;
   });
   
   // Обновляем трекер
   const trackerDot = qs(`[data-question="${currentIndex}"]`);
   if(trackerDot) {
     trackerDot.classList.remove("is-correct", "is-wrong");
     trackerDot.classList.add(isCorrect ? "is-correct" : "is-wrong");
   }
   
   // Обновляем индикатор прогресса
   const progressBar = qs(".question-progress-bar > div");
   const progressPercent = ((currentIndex+1)/d.q.length*100).toFixed(0);
   if(progressBar) {
     progressBar.style.width = `${progressPercent}%`;
   }
   const progressText = qs(".question-progress-text");
   if(progressText) {
     progressText.textContent = `${currentIndex+1}/${d.q.length}`;
   }

   // Показываем подсказку сразу, если ответ неправильный
   if(!isCorrect && q.tip) {
     const tipElement = qs("#tip");
     if(tipElement) {
       tipElement.style.display = "block";
       tipElement.textContent = `💡 ${q.tip}`;
     }
   }

   // Сохраняем прогресс билета или темы в реальном времени (с текущим индексом и ответами)
   // Сохраняем текущий индекс (до перехода), чтобы при возврате можно было продолжить
   if(d.mode === "ticket" && d.ticketLabel) {
     const answeredCount = d.answers.filter(a => a && a.status).length;
     // Сохраняем уникальные идентификаторы вопросов (используем текст вопроса как ключ)
     const questionOrder = d.q.map((q) => q.question || q.text || JSON.stringify(q));
     saveTicketProgress(d.ticketLabel, d.me, d.q.length, answeredCount, currentIndex, d.answers, questionOrder);
   } else if(d.mode === "topic" && d.topic) {
     const answeredCount = d.answers.filter(a => a && a.status).length;
     // Сохраняем уникальные идентификаторы вопросов (используем текст вопроса как ключ)
     const questionOrder = d.q.map((q) => q.question || q.text || JSON.stringify(q));
     saveTopicProgress(d.topic, d.me, d.q.length, answeredCount, currentIndex, d.answers, questionOrder);
   }

   // Активируем кнопку "Следующий" после любого ответа
   const nextBtn = qs("[data-next], [data-finish]");
   if(nextBtn) {
     nextBtn.disabled = false;
   }

   if(isCorrect){
     // Переходим к следующему вопросу без перерисовки текущего
     State.advanceTimer = setTimeout(()=>{
      const currentAnswer = d.answers[currentIndex];
      const isCurrentCorrect = currentAnswer && currentAnswer.status === "correct";
      if(State.duel === d && d.i === currentIndex && isCurrentCorrect){
         const newIndex = Math.min(d.i + 1, d.q.length);
         if(newIndex >= d.q.length){
           finishDuel();
         } else {
           d.i = newIndex;
           // Сохраняем прогресс после перехода к следующему вопросу
           if(d.mode === "ticket" && d.ticketLabel) {
             const answeredCount = d.answers.filter(a => a && a.status).length;
             const questionOrder = d.q.map((q) => q.question || q.text || JSON.stringify(q));
             saveTicketProgress(d.ticketLabel, d.me, d.q.length, answeredCount, d.i, d.answers, questionOrder);
           } else if(d.mode === "topic" && d.topic) {
             const answeredCount = d.answers.filter(a => a && a.status).length;
             const questionOrder = d.q.map((q) => q.question || q.text || JSON.stringify(q));
             saveTopicProgress(d.topic, d.me, d.q.length, answeredCount, d.i, d.answers, questionOrder);
           }
           // Синхронизируем прогресс с сервером (для дуэли с реальным игроком)
           if (d.mode === "duel" && d.opponentId && !d.isBot) {
             syncDuelProgress();
           }
           renderQuestion(d.i);
         }
       }
     }, 800);
   } else {
     // Если неправильно, разблокируем и позволяем перейти к следующему вопросу
     State.lock = false;
     // Автоматически переходим к следующему вопросу через небольшую задержку
     State.advanceTimer = setTimeout(()=>{
       if(State.duel === d && d.i === currentIndex){
         const newIndex = Math.min(d.i + 1, d.q.length);
         if(newIndex >= d.q.length){
           finishDuel();
         } else {
           d.i = newIndex;
           // Сохраняем прогресс после перехода к следующему вопросу
           if(d.mode === "ticket" && d.ticketLabel) {
             const answeredCount = d.answers.filter(a => a && a.status).length;
             const questionOrder = d.q.map((q) => q.question || q.text || JSON.stringify(q));
             saveTicketProgress(d.ticketLabel, d.me, d.q.length, answeredCount, d.i, d.answers, questionOrder);
           } else if(d.mode === "topic" && d.topic) {
             const answeredCount = d.answers.filter(a => a && a.status).length;
             const questionOrder = d.q.map((q) => q.question || q.text || JSON.stringify(q));
             saveTopicProgress(d.topic, d.me, d.q.length, answeredCount, d.i, d.answers, questionOrder);
           }
           // Синхронизируем прогресс с сервером (для дуэли с реальным игроком)
           if (d.mode === "duel" && d.opponentId && !d.isBot) {
             syncDuelProgress();
           }
           renderQuestion(d.i);
         }
       }
     }, 1500); // Чуть больше задержка для неправильного ответа, чтобы пользователь увидел подсказку
   }
 }
 
 function finishDuel(){
   const d=State.duel;
   if(!d || d.completed) return;
   clearAdvanceTimer();
   d.completed = true;
   
   // Останавливаем отслеживание прогресса соперника
   stopOpponentProgressTracking();
   
   const isBot = d.isBot || false;
   
   // Сохраняем финальный прогресс билета или темы (при завершении)
   if (d.mode === "ticket" && d.ticketLabel) {
     const questionOrder = d.q.map((q) => q.question || q.text || JSON.stringify(q));
     saveTicketProgress(d.ticketLabel, d.me, d.q.length, d.q.length, d.q.length, d.answers, questionOrder);
     // Обновляем статистику сложности билета
     updateTicketDifficultyStats(d.ticketLabel, d.me, d.q.length);
   } else if (d.mode === "topic" && d.topic) {
     const questionOrder = d.q.map((q) => q.question || q.text || JSON.stringify(q));
     saveTopicProgress(d.topic, d.me, d.q.length, d.q.length, d.q.length, d.answers, questionOrder);
   }
   
   // Обновляем статистику ТОЛЬКО если это не игра против бота
   let expGain = 0;
   if (!isBot) {
     // Против реального игрока - засчитываем в топ
     incrementGamesPlayed();
     const correctPercent = (d.me / d.q.length) * 100;
     // Начисляем опыт: 10 очков за игру + бонус за правильные ответы
     expGain = 10 + Math.floor(correctPercent / 10);
     addExperience(expGain);
   } else {
     // Для игры против бота только опыт, но не засчитываем в статистику для топа
     const correctPercent = (d.me / d.q.length) * 100;
     expGain = 5 + Math.floor(correctPercent / 10); // Меньше опыта за бота
     addExperience(expGain);
   }
   
   const headerTitle = d.mode === "ticket" ? (d.ticketLabel || "Билет") : (d.mode === "topic" && d.topic ? d.topic : (d.mode === "duel" ? "Дуэль" : "Дуэль"));
   const botNotice = isBot ? '<p style="color: var(--muted); font-size: 12px; margin-top: 8px;">⚠️ Игра против робота не засчитывается в топ</p>' : '';
   const opponentType = isBot ? '<p style="color: var(--muted); font-size: 12px;">🤖 Против робота</p>' : '<p style="color: var(--accent); font-size: 12px;">⚔️ Против игрока</p>';
   
   setView(`
     <div class="card">
       <h3>${d.me>=Math.ceil(d.q.length*0.6)?"🏆 Отлично!":"🏁 Завершено"}</h3>
       <p>Верных: <b>${d.me}</b> из ${d.q.length}</p>
       ${opponentType}
       <p style="color: var(--accent); margin-top: 8px;">+${expGain} опыта</p>
       ${botNotice}
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
 function toast(t){
   const el=qs("#toast");
   if(!el) return;
   el.innerHTML=`<div class="toast">${t}</div>`;
   el.style.opacity=1;
   el.style.transform="translateX(-50%) translateY(0)";
   setTimeout(()=>{
     el.style.opacity=0;
     el.style.transform="translateX(-50%) translateY(20px)";
   },2500);
 }
function esc(s){
  const base = s == null ? "" : s;
  return String(base).replace(/[&<>\"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
}
 function bindSearch(inputId, targetId){
   const input = document.getElementById(inputId);
   if(!input) return;
   const target = document.getElementById(targetId);
   if(!target) return;
   
   input.addEventListener("input", (e) => {
     const query = e.target.value.toLowerCase().trim();
     const items = target.querySelectorAll("[data-search-text]");
     
     items.forEach(item => {
       const searchText = item.getAttribute("data-search-text") || "";
       if(!query || searchText.includes(query)) {
         item.style.display = "";
         item.classList.add("fade-in");
       } else {
         item.style.display = "none";
       }
     });
     
     // Скрываем пустые категории для разметки
     if(targetId === "markup-list") {
       const categories = target.querySelectorAll(".markup-category");
       categories.forEach(cat => {
         const visibleItems = cat.querySelectorAll("[data-search-text]:not([style*='display: none'])");
         if(visibleItems.length === 0 && query) {
           cat.style.display = "none";
         } else {
           cat.style.display = "";
         }
       });
     }
   });
 }

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
 
 function clearAdvanceTimer(){
   if(State.advanceTimer){
     clearTimeout(State.advanceTimer);
     State.advanceTimer = null;
   }
 }
 
 function notifyDataIssue(){
   if (State.pool.length) return;
   toast("⚠️ Не удалось загрузить билеты. Проверьте соединение и обновите страницу.");
 }
 
 function renderTracker(){
   const d = State.duel;
   if(!d) return "";
   return `
     <nav class="question-tracker" aria-label="Прогресс вопросов">
       ${d.q.map((_, idx)=>{
         const info = d.answers[idx];
        const status = info && info.status;
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
  if(answerState && answerState.status){
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
   clearAdvanceTimer();
   const target = Math.max(0, Math.min(index, d.q.length - 1));
   if(target > d.furthest) return;
   renderQuestion(target);
 }
 
 function nextQuestion(){
   const d = State.duel;
   if(!d) return;
   clearAdvanceTimer();
   
   if(d.i >= d.q.length - 1){
    const current = d.answers[d.i];
    if(current && current.status){
       finishDuel();
     }
     return;
   }
  const activeAnswer = d.answers[d.i];
  if(!(activeAnswer && activeAnswer.status)) return;
   const nextIndex = d.i + 1;
   d.furthest = Math.min(d.q.length - 1, Math.max(d.furthest, nextIndex));
   
   // Сохраняем прогресс перед переходом к следующему вопросу
   if(d.mode === "ticket" && d.ticketLabel) {
     const answeredCount = d.answers.filter(a => a && a.status).length;
     const questionOrder = d.q.map((q) => q.question || q.text || JSON.stringify(q));
     saveTicketProgress(d.ticketLabel, d.me, d.q.length, answeredCount, nextIndex, d.answers, questionOrder);
   } else if(d.mode === "topic" && d.topic) {
     const answeredCount = d.answers.filter(a => a && a.status).length;
     const questionOrder = d.q.map((q) => q.question || q.text || JSON.stringify(q));
     saveTopicProgress(d.topic, d.me, d.q.length, answeredCount, nextIndex, d.answers, questionOrder);
   }
   
   renderQuestion(nextIndex);
 }
 
 function previousQuestion(){
   const d = State.duel;
   if(!d) return;
   clearAdvanceTimer();
   if(d.i <= 0) return;
   renderQuestion(d.i - 1);
 }
