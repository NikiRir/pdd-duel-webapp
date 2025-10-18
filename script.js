let tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

let currentQuestions = [];
let currentQuestionIndex = 0;
let userScore = 0;
let timerInterval = null;

// Создание частиц
function createParticles() {
    const container = document.getElementById('particles');
    for (let i = 0; i < 15; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 6 + 's';
        container.appendChild(particle);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

function initApp() {
    createParticles();
    loadTickets();
}

function showScreen(screenId) {
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

function loadTickets() {
    const grid = document.getElementById('ticketGrid');
    for (let i = 1; i <= 20; i++) {
        const button = document.createElement('button');
        button.className = 'ticket-btn';
        button.textContent = i;
        button.onclick = () => createDuel('ticket', 5, i);
        grid.appendChild(button);
    }
}

function showTicketSelection() {
    showScreen('ticketScreen');
}

function startDuel() {
    showScreen('duelModeScreen');
}

function startTraining() {
    startGameSession('training', 'random', 5);
}

function createDuel(mode, questionCount, ticketNumber = null) {
    const duelId = Math.random().toString(36).substr(2, 6).toUpperCase();
    document.getElementById('duelId').textContent = duelId;
    showScreen('waitingScreen');
    
    setTimeout(() => {
        startGameSession('duel', mode, questionCount, ticketNumber, duelId);
    }, 2000);
}

function copyDuelId() {
    const duelId = document.getElementById('duelId').textContent;
    navigator.clipboard.writeText(duelId);
    tg.showPopup({
        title: 'Скопировано!',
        message: 'ID дуэли скопирован в буфер обмена'
    });
}

function cancelDuel() {
    showScreen('duelModeScreen');
}

function showStats() {
    tg.showPopup({
        title: '📊 Статистика',
        message: 'Эта функция скоро будет доступна!\n\nСледи за обновлениями 👀'
    });
}

function showTop() {
    tg.showPopup({
        title: '🏆 Топ игроков',
        message: 'Рейтинги появятся в следующем обновлении!\n\nГотовься к битве! ⚔️'
    });
}

function startGameSession(type, mode, questionCount, ticketNumber = null, duelId = null) {
    const questions = generateMockQuestions(questionCount);
    currentQuestions = questions;
    currentQuestionIndex = 0;
    userScore = 0;
    
    showScreen('questionScreen');
    displayQuestion();
}

function generateMockQuestions(count) {
    const questions = [];
    const questionTexts = [
        "Разрешено ли Вам выполнить разворот в указанном месте?",
        "Что означает этот дорожный знак 'Главная дорога'?",
        "С какой максимальной скоростью разрешено движение в населенном пункте?",
        "Обязаны ли Вы включить указатели поворота при перестроении?",
        "Кто имеет преимущество на нерегулируемом перекрестке?",
        "Разрешена ли остановка в указанном месте?",
        "Что должен сделать водитель при приближении к пешеходному переходу?",
        "Разрешено ли Вам обогнать грузовой автомобиль в данной ситуации?",
        "Какой знак информирует о начале населенного пункта?",
        "Что означает мигающий зеленый сигнал светофора?"
    ];
    
    for (let i = 0; i < count; i++) {
        questions.push({
            id: i + 1,
            text: questionTexts[i % questionTexts.length],
            options: [
                { id: 1, text: "Разрешено" },
                { id: 2, text: "Разрешено, если не будут созданы помехи" },
                { id: 3, text: "Запрещено" },
                { id: 4, text: "Запрещено, кроме случаев предусмотренных ПДД" }
            ].slice(0, 3),
            correctAnswer: Math.floor(Math.random() * 3) + 1
        });
    }
    return questions;
}

function displayQuestion() {
    const question = currentQuestions[currentQuestionIndex];
    if (!question) return;
    
    const progress = ((currentQuestionIndex) / currentQuestions.length) * 100;
    document.getElementById('progressFill').style.width = progress + '%';
    
    document.getElementById('questionNumber').textContent = 
        `${currentQuestionIndex + 1}/${currentQuestions.length}`;
    
    document.getElementById('questionText').textContent = question.text;
    
    const optionsContainer = document.getElementById('optionsContainer');
    optionsContainer.innerHTML = '';
    
    question.options.forEach(option => {
        const button = document.createElement('button');
        button.className = 'option-btn';
        button.textContent = option.text;
        button.onclick = () => selectAnswer(option.id);
        optionsContainer.appendChild(button);
    });
    
    startTimer(30);
}

function startTimer(seconds) {
    let timeLeft = seconds;
    const timerElement = document.getElementById('timer');
    
    if (timerInterval) clearInterval(timerInterval);
    
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
    if (timerInterval) clearInterval(timerInterval);
    
    const question = currentQuestions[currentQuestionIndex];
    const isCorrect = optionId === question.correctAnswer;
    
    const options = document.querySelectorAll('.option-btn');
    options.forEach(btn => {
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
    }
    
    setTimeout(() => {
        currentQuestionIndex++;
        if (currentQuestionIndex < currentQuestions.length) {
            displayQuestion();
        } else {
            showResults();
        }
    }, 1500);
}

function handleTimeUp() {
    currentQuestionIndex++;
    if (currentQuestionIndex < currentQuestions.length) {
        displayQuestion();
    } else {
        showResults();
    }
}

function showResults() {
    document.getElementById('playerScore').textContent = userScore;
    document.getElementById('opponentScore').textContent = Math.floor(Math.random() * 5);
    
    const resultMessage = document.getElementById('resultMessage');
    if (userScore >= 4) {
        resultMessage.textContent = '🎉 БЛЕСТЯЩАЯ ПОБЕДА! ТЫ ГЕНИЙ ПДД! 🎉';
        resultMessage.style.background = 'linear-gradient(45deg, rgba(76, 175, 80, 0.3), rgba(56, 142, 60, 0.3))';
    } else if (userScore >= 2) {
        resultMessage.textContent = '👍 ХОРОШИЙ РЕЗУЛЬТАТ! МОЖНО ЛУЧШЕ! 💪';
        resultMessage.style.background = 'linear-gradient(45deg, rgba(255, 193, 7, 0.3), rgba(255, 152, 0, 0.3))';
    } else {
        resultMessage.textContent = '😔 ПОРА ТРЕНИРОВАТЬСЯ! НЕ СДАВАЙСЯ! 📚';
        resultMessage.style.background = 'linear-gradient(45deg, rgba(244, 67, 54, 0.3), rgba(211, 47, 47, 0.3))';
    }
    
    showScreen('resultsScreen');
}
