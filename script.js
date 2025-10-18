let tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

let currentQuestions = [];
let currentQuestionIndex = 0;
let userScore = 0;
let timerInterval = null;

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    console.log("🚀 WebApp загружен!");
    initApp();
});

function initApp() {
    loadTickets();
    console.log("✅ Приложение инициализировано");
}

// Навигация
function showScreen(screenId) {
    console.log(`🔄 Переход на экран: ${screenId}`);
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function backToMain() {
    showScreen('mainScreen');
}

function backToDuelModes() {
    showScreen('duelModeScreen');
}

// Загрузка билетов
function loadTickets() {
    const grid = document.getElementById('ticketGrid');
    grid.innerHTML = '';
    
    for (let i = 1; i <= 20; i++) {
        const button = document.createElement('button');
        button.className = 'ticket-btn';
        button.textContent = i;
        button.onclick = () => createDuel('ticket', 5, i);
        grid.appendChild(button);
    }
    console.log("✅ Билеты загружены");
}

function showTicketSelection() {
    showScreen('ticketScreen');
}

// Основные функции
function startDuel() {
    console.log("🎮 Начало дуэли");
    showScreen('duelModeScreen');
}

function startTraining() {
    console.log("📚 Начало тренировки");
    startGameSession('training', 'random', 5);
}

function createDuel(mode, questionCount, ticketNumber = null) {
    console.log(`🎯 Создание дуэли: ${mode}, вопросов: ${questionCount}, билет: ${ticketNumber}`);
    
    const duelId = Math.random().toString(36).substr(2, 6).toUpperCase();
    document.getElementById('duelId').textContent = duelId;
    showScreen('waitingScreen');
    
    // Имитация ожидания соперника
    setTimeout(() => {
        startGameSession('duel', mode, questionCount, ticketNumber, duelId);
    }, 3000);
}

function copyDuelId() {
    const duelId = document.getElementById('duelId').textContent;
    navigator.clipboard.writeText(duelId);
    
    if (tg.showPopup) {
        tg.showPopup({
            title: 'Скопировано!',
            message: 'ID дуэли скопирован в буфер обмена'
        });
    } else {
        alert('ID скопирован: ' + duelId);
    }
}

function cancelDuel() {
    console.log("❌ Дуэль отменена");
    showScreen('duelModeScreen');
}

// Статистика и топ
function showStats() {
    console.log("📊 Показ статистики");
    
    const statsText = `
📊 ВАША СТАТИСТИКА:

🎮 Сыграно дуэлей: 15
✅ Побед: 10
❌ Поражений: 5
📈 Винрейт: 67%

🎯 Правильных ответов: 85%
⭐ Рейтинг: 1250
🏅 Позиция в топе: #3

Продолжайте в том же духе! 💪
    `;
    
    if (tg.showPopup) {
        tg.showPopup({
            title: '📊 Статистика',
            message: statsText
        });
    } else {
        alert(statsText);
    }
}

function showTop() {
    console.log("🏆 Показ топа");
    
    const topText = `
🏆 ТОП ИГРОКОВ:

🥇 1. Алексей - 1500 ⭐ (25 побед)
🥈 2. Мария - 1420 ⭐ (22 победы)  
🥉 3. ВЫ - 1250 ⭐ (10 побед) 👈
🔸 4. Дмитрий - 1180 ⭐ (8 побед)
🔸 5. Анна - 1150 ⭐ (7 побед)

Сражайтесь за первое место! ⚔️
    `;
    
    if (tg.showPopup) {
        tg.showPopup({
            title: '🏆 Топ игроков',
            message: topText
        });
    } else {
        alert(topText);
    }
}

// Игровая логика
function startGameSession(type, mode, questionCount, ticketNumber = null, duelId = null) {
    console.log(`🎲 Начало игры: ${type}, ${mode}, ${questionCount} вопросов`);
    
    let questions = [];
    
    if (mode === 'ticket' && ticketNumber) {
        // В реальном приложении здесь будет запрос за вопросами билета
        questions = generateMockQuestions(questionCount);
    } else {
        questions = generateMockQuestions(questionCount);
    }
    
    currentQuestions = questions;
    currentQuestionIndex = 0;
    userScore = 0;
    
    showScreen('questionScreen');
    displayQuestion();
}

function generateMockQuestions(count) {
    console.log(`🎲 Генерация ${count} вопросов`);
    
    const questions = [];
    const questionTemplates = [
        "Разрешено ли Вам выполнить разворот в указанном месте?",
        "Что означает этот дорожный знак?",
        "С какой максимальной скоростью разрешено движение в населенном пункте?",
        "Обязаны ли Вы включить указатели поворота при перестроении?",
        "Кто имеет преимущество на нерегулируемом перекрестке?",
        "Разрешена ли остановка в указанном месте?",
        "Что должен сделать водитель при приближении к пешеходному переходу?",
        "Разрешено ли Вам обогнать грузовой автомобиль?",
        "Какой знак информирует о начале населенного пункта?",
        "Что означает мигающий зеленый сигнал светофора?"
    ];
    
    for (let i = 1; i <= count; i++) {
        const template = questionTemplates[i % questionTemplates.length];
        
        questions.push({
            id: i,
            text: `${template} (Вопрос ${i})`,
            options: [
                { id: 1, text: "Первый вариант ответа" },
                { id: 2, text: "Второй вариант ответа" },
                { id: 3, text: "Третий вариант ответа" }
            ],
            correctAnswer: Math.floor(Math.random() * 3) + 1
        });
    }
    
    return questions;
}

function displayQuestion() {
    const question = currentQuestions[currentQuestionIndex];
    if (!question) {
        console.log("❌ Нет вопроса для отображения");
        return;
    }
    
    console.log(`📝 Вопрос ${currentQuestionIndex + 1}/${currentQuestions.length}`);
    
    // Прогресс
    const progress = ((currentQuestionIndex) / currentQuestions.length) * 100;
    document.getElementById('progressFill').style.width = progress + '%';
    
    // Номер вопроса и таймер
    document.getElementById('questionNumber').textContent = 
        `${currentQuestionIndex + 1}/${currentQuestions.length}`;
    
    // Текст вопроса
    document.getElementById('questionText').textContent = question.text;
    
    // Варианты ответов
    const optionsContainer = document.getElementById('optionsContainer');
    optionsContainer.innerHTML = '';
    
    question.options.forEach(option => {
        const button = document.createElement('button');
        button.className = 'option-btn';
        button.textContent = option.text;
        button.onclick = () => selectAnswer(option.id);
        optionsContainer.appendChild(button);
    });
    
    // Запуск таймера
    startTimer(30);
}

function startTimer(seconds) {
    let timeLeft = seconds;
    const timerElement = document.getElementById('timer');
    
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    timerInterval = setInterval(() => {
        timeLeft--;
        timerElement.textContent = timeLeft + 's';
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            handleTimeUp();
        }
    }, 1000);
}

function selectAnswer(optionId) {
    console.log(`🎯 Выбран ответ: ${optionId}`);
    
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    const question = currentQuestions[currentQuestionIndex];
    const isCorrect = optionId === question.correctAnswer;
    
    // Подсветка правильного/неправильного
    const options = document.querySelectorAll('.option-btn');
    options.forEach(btn => {
        btn.disabled = true; // Блокируем кнопки после выбора
        
        const btnText = btn.textContent;
        const correspondingOption = question.options.find(opt => opt.text === btnText);
        
        if (correspondingOption) {
            if (correspondingOption.id === question.correctAnswer) {
                btn.classList.add('correct');
            } else if (correspondingOption.id === optionId && !isCorrect) {
                btn.classList.add('incorrect');
            }
        }
    });
    
    if (isCorrect) {
        userScore++;
        console.log("✅ Правильный ответ!");
    } else {
        console.log("❌ Неправильный ответ!");
    }
    
    // Следующий вопрос через 2 секунды
    setTimeout(() => {
        currentQuestionIndex++;
        if (currentQuestionIndex < currentQuestions.length) {
            displayQuestion();
        } else {
            showResults();
        }
    }, 2000);
}

function handleTimeUp() {
    console.log("⏰ Время вышло!");
    
    currentQuestionIndex++;
    if (currentQuestionIndex < currentQuestions.length) {
        displayQuestion();
    } else {
        showResults();
    }
}

function showResults() {
    console.log(`🎯 Результаты: ${userScore}/${currentQuestions.length}`);
    
    document.getElementById('playerScore').textContent = userScore;
    document.getElementById('opponentScore').textContent = Math.floor(Math.random() * currentQuestions.length);
    
    const resultMessage = document.getElementById('resultMessage');
    if (userScore >= currentQuestions.length * 0.8) {
        resultMessage.textContent = '🎉 БЛЕСТЯЩАЯ ПОБЕДА! ТЫ ГЕНИЙ ПДД! 🎉';
    } else if (userScore >= currentQuestions.length * 0.5) {
        resultMessage.textContent = '👍 ХОРОШИЙ РЕЗУЛЬТАТ! МОЖНО ЛУЧШЕ! 💪';
    } else {
        resultMessage.textContent = '😔 ПОРА ТРЕНИРОВАТЬСЯ! НЕ СДАВАЙСЯ! 📚';
    }
    
    showScreen('resultsScreen');
}

// Добавляем обработчики для дебага
console.log("🔧 Debug: Все функции загружены");
