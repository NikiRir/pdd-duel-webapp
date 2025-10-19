let tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

let currentQuestions = [];
let currentQuestionIndex = 0;
let userScore = 0;
let timerInterval = null;
let currentTimeLeft = 30;

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    console.log("🚀 WebApp загружен!");
    initApp();
});

function initApp() {
    loadTickets();
    loadTopics();
    createParticles();
    console.log("✅ Приложение инициализировано");
}

// Создание частиц для фона
function createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    
    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.cssText = `
            position: absolute;
            width: ${Math.random() * 3 + 1}px;
            height: ${Math.random() * 3 + 1}px;
            background: rgba(255, 255, 255, ${Math.random() * 0.3 + 0.1});
            border-radius: 50%;
            top: ${Math.random() * 100}%;
            left: ${Math.random() * 100}%;
            animation: particleFloat ${Math.random() * 20 + 10}s infinite linear;
        `;
        container.appendChild(particle);
    }
    
    // Добавляем стили для анимации частиц
    const style = document.createElement('style');
    style.textContent = `
        @keyframes particleFloat {
            0% { transform: translateY(100vh) translateX(0); }
            100% { transform: translateY(-100px) translateX(${Math.random() * 100 - 50}px); }
        }
    `;
    document.head.appendChild(style);
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

function backToTopics() {
    showScreen('topicsScreen');
}

// Загрузка билетов
function loadTickets() {
    const grid = document.getElementById('ticketGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    for (let i = 1; i <= 40; i++) {
        const button = document.createElement('button');
        button.className = 'ticket-btn';
        button.textContent = i;
        button.onclick = () => startTicketDuel(i);
        grid.appendChild(button);
    }
    console.log("✅ Билеты загружены");
}

// Загрузка тем
function loadTopics() {
    const container = document.getElementById('topicsContainer');
    if (!container) return;
    
    const topics = [
        { id: 'road_signs', name: '🚸 Дорожные знаки', description: 'Все виды дорожных знаков и их значения', questions: 20 },
        { id: 'markings', name: '📏 Дорожная разметка', description: 'Горизонтальная и вертикальная разметка', questions: 15 },
        { id: 'intersections', name: '🔄 Проезд перекрестков', description: 'Нерегулируемые и регулируемые перекрестки', questions: 25 },
        { id: 'overtaking', name: '⚡ Обгон и опережение', description: 'Правила обгона, встречного разъезда', questions: 18 },
        { id: 'parking', name: '🅿️ Остановка и стоянка', description: 'Правила остановки и стоянки ТС', questions: 16 },
        { id: 'pedestrians', name: '🚶 Пешеходные переходы', description: 'Правила проезда пешеходных переходов', questions: 12 }
    ];
    
    container.innerHTML = '';
    
    topics.forEach(topic => {
        const topicElement = document.createElement('div');
        topicElement.className = 'topic-item';
        topicElement.onclick = () => showTopic(topic);
        topicElement.innerHTML = `
            <div class="topic-name">${topic.name}</div>
            <div class="topic-description">${topic.description}</div>
            <div class="topic-stats">${topic.questions} вопросов</div>
        `;
        container.appendChild(topicElement);
    });
    
    console.log("✅ Темы загружены");
}

// Показ темы
function showTopic(topic) {
    document.getElementById('topicTitle').textContent = topic.name;
    document.getElementById('topicDescription').textContent = topic.description;
    document.getElementById('topicQuestionsCount').textContent = topic.questions;
    
    // Сохраняем текущую тему в data-атрибутах кнопок
    const practiceBtn = document.querySelector('.btn-topic-action:first-child');
    const duelBtn = document.querySelector('.btn-topic-action:last-child');
    
    practiceBtn.setAttribute('data-topic', topic.id);
    duelBtn.setAttribute('data-topic', topic.id);
    
    showScreen('topicScreen');
}

// Основные функции
function showDuelModes() {
    showScreen('duelModeScreen');
}

function showTopics() {
    showScreen('topicsScreen');
}

function showTicketSelection() {
    showScreen('ticketScreen');
}

function startQuickDuel() {
    console.log("🎯 Быстрая дуэль");
    showScreen('matchmakingScreen');
    
    // Имитация поиска соперника
    setTimeout(() => {
        document.getElementById('searchStatus').textContent = 'Соперник не найден. Играем с ИИ-ботом!';
        
        setTimeout(() => {
            startAIDuel();
        }, 2000);
    }, 3000);
}

function startTicketDuel(ticketNumber) {
    console.log(`🎫 Дуэль по билету ${ticketNumber}`);
    startGameSession('duel', 'ticket', 5, ticketNumber);
}

function startTopicPractice() {
    const topic = document.querySelector('.btn-topic-action:first-child').getAttribute('data-topic');
    console.log(`📚 Тренировка по теме: ${topic}`);
    startGameSession('training', 'topic', 10, topic);
}

function startTopicDuel() {
    const topic = document.querySelector('.btn-topic-action:last-child').getAttribute('data-topic');
    console.log(`⚔️ Дуэль по теме: ${topic}`);
    startGameSession('duel', 'topic', 5, topic);
}

function startAIDuel() {
    showScreen('aiDuelScreen');
}

function startAIDuelGame() {
    const questionCount = parseInt(document.getElementById('questionCount').value);
    const difficulty = parseFloat(document.getElementById('aiDifficulty').value);
    
    console.log(`🤖 Дуэль с ИИ: ${questionCount} вопросов, сложность ${difficulty}`);
    startGameSession('ai_duel', 'random', questionCount, null, difficulty);
}

function cancelMatchmaking() {
    console.log("❌ Отмена поиска");
    showScreen('mainScreen');
}

// Статистика
function showStats() {
    console.log("📊 Показ статистики");
    
    // В реальном приложении здесь будет запрос к боту за статистикой
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

// Игровая логика
function startGameSession(type, mode, questionCount, specific = null, difficulty = null) {
    console.log(`🎲 Начало игры: ${type}, ${mode}, ${questionCount} вопросов`);
    
    let questions = [];
    
    if (mode === 'ticket' && specific) {
        questions = generateTicketQuestions(questionCount, specific);
    } else if (mode === 'topic' && specific) {
        questions = generateTopicQuestions(questionCount, specific);
    } else {
        questions = generateRandomQuestions(questionCount);
    }
    
    currentQuestions = questions;
    currentQuestionIndex = 0;
    userScore = 0;
    currentTimeLeft = 30;
    
    showScreen('questionScreen');
    displayQuestion();
}

function generateTicketQuestions(count, ticketNumber) {
    console.log(`🎲 Генерация ${count} вопросов для билета ${ticketNumber}`);
    return generateMockQuestions(count, `Билет ${ticketNumber}`);
}

function generateTopicQuestions(count, topic) {
    console.log(`🎲 Генерация ${count} вопросов по теме ${topic}`);
    return generateMockQuestions(count, `Тема ${topic}`);
}

function generateRandomQuestions(count) {
    console.log(`🎲 Генерация ${count} случайных вопросов`);
    return generateMockQuestions(count, 'Случайные');
}

function generateMockQuestions(count, source = '') {
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
    
    const answerTemplates = [
        ["Да, разрешено", "Разрешено только при видимости дороги более 100 м", "Запрещено"],
        ["Предупреждает об опасности", "Запрещает движение", "Указывает направление"],
        ["60 км/ч", "90 км/ч", "Не более 40 км/ч"],
        ["Да, обязательно", "Только при наличии других ТС", "Не обязательно"],
        ["Транспортное средство справа", "Транспортное средство слева", "Трамвай"],
        ["Разрешена", "Запрещена", "Разрешена только для посадки"],
        ["Снизить скорость", "Уступить дорогу пешеходам", "Подать звуковой сигнал"],
        ["Разрешен", "Запрещен", "Разрешен, если нет знаков"],
        ["Синий прямоугольник с названием", "Белый прямоугольник с черной полосой", "Квадрат с изображением"],
        ["Разрешает движение", "Запрещает движение", "Предупреждает о смене сигнала"]
    ];
    
    for (let i = 1; i <= count; i++) {
        const templateIndex = i % questionTemplates.length;
        
        questions.push({
            id: i,
            text: `${questionTemplates[templateIndex]} ${source ? `(${source})` : ''}`,
            options: answerTemplates[templateIndex].map((text, index) => ({
                id: index + 1,
                text: text
            })),
            correctAnswer: Math.floor(Math.random() * 3) + 1,
            explanation: "Объяснение правильного ответа будет здесь..."
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
    
    // Номер вопроса
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
    currentTimeLeft = seconds;
    const timerElement = document.getElementById('timer');
    
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    timerElement.textContent = currentTimeLeft + 's';
    
    timerInterval = setInterval(() => {
        currentTimeLeft--;
        timerElement.textContent = currentTimeLeft + 's';
        
        if (currentTimeLeft <= 0) {
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
        btn.disabled = true;
        
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
    
    const options = document.querySelectorAll('.option-btn');
    options.forEach(btn => {
        btn.disabled = true;
        btn.classList.add('incorrect');
    });
    
    // Показываем правильный ответ
    const question = currentQuestions[currentQuestionIndex];
    const correctOption = question.options.find(opt => opt.id === question.correctAnswer);
    if (correctOption) {
        const correctBtn = Array.from(options).find(btn => btn.textContent === correctOption.text);
        if (correctBtn) {
            correctBtn.classList.add('correct');
        }
    }
    
    setTimeout(() => {
        currentQuestionIndex++;
        if (currentQuestionIndex < currentQuestions.length) {
            displayQuestion();
        } else {
            showResults();
        }
    }, 2000);
}

function showResults() {
    console.log(`🎯 Результаты: ${userScore}/${currentQuestions.length}`);
    
    document.getElementById('playerScore').textContent = userScore;
    
    // Генерируем случайный счет для оппонента (ИИ или реального игрока)
    const opponentScore = Math.min(
        currentQuestions.length,
        Math.max(0, userScore + Math.floor(Math.random() * 3) - 1)
    );
    document.getElementById('opponentScore').textContent = opponentScore;
    
    const resultMessage = document.getElementById('resultMessage');
    const correctAnswers = document.getElementById('correctAnswers');
    const ratingChange = document.getElementById('ratingChange');
    
    correctAnswers.textContent = `${userScore}/${currentQuestions.length}`;
    
    if (userScore > opponentScore) {
        resultMessage.textContent = '🎉 ПОБЕДА! ТЫ МОЛОДЕЦ! 🎉';
        ratingChange.textContent = '+20';
        ratingChange.style.color = '#4ecdc4';
    } else if (userScore < opponentScore) {
        resultMessage.textContent = '😔 ПОРАЖЕНИЕ! НЕ РАССТРАИВАЙСЯ! 💪';
        ratingChange.textContent = '-10';
        ratingChange.style.color = '#ff6b6b';
    } else {
        resultMessage.textContent = '🤝 НИЧЬЯ! ХОРОШАЯ ИГРА! 👍';
        ratingChange.textContent = '+0';
        ratingChange.style.color = '#718096';
    }
    
    showScreen('resultsScreen');
}

function playAgain() {
    if (currentQuestions.length > 0) {
        currentQuestionIndex = 0;
        userScore = 0;
        showScreen('questionScreen');
        displayQuestion();
    } else {
        showScreen('mainScreen');
    }
}

// Добавляем обработчики для дебага
console.log("🔧 Debug: Все функции загружены");

// Обработка закрытия WebApp
tg.onEvent('viewportChanged', function() {
    console.log('📱 Viewport changed');
});

tg.onEvent('themeChanged', function() {
    console.log('🎨 Theme changed');
});
