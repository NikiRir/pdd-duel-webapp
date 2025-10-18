let tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

let currentUser = null;
let currentQuestions = [];
let currentQuestionIndex = 0;
let userScore = 0;
let selectedAnswers = [];
let timerInterval = null;

document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

function initApp() {
    currentUser = tg.initDataUnsafe.user;
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
    for (let i = 1; i <= 40; i++) {
        const button = document.createElement('button');
        button.className = 'ticket-btn';
        button.textContent = i;
        button.onclick = () => createDuel('ticket', 20, i);
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
    startGameSession('training', 'random', 10);
}

function createDuel(mode, questionCount, ticketNumber = null) {
    const duelId = Math.random().toString(36).substr(2, 9).toUpperCase();
    
    document.getElementById('duelId').textContent = duelId;
    showScreen('waitingScreen');
    
    setTimeout(() => {
        startGameSession('duel', mode, questionCount, ticketNumber, duelId);
    }, 3000);
}

function copyDuelId() {
    const duelId = document.getElementById('duelId').textContent;
    navigator.clipboard.writeText(duelId).then(() => {
        tg.showPopup({
            title: 'Скопировано!',
            message: 'ID дуэли скопирован в буфер обмена'
        });
    });
}

function cancelDuel() {
    showScreen('duelModeScreen');
}

function showStats() {
    tg.showPopup({
        title: 'Статистика',
        message: 'Функция в разработке...'
    });
}

function showTop() {
    tg.showPopup({
        title: 'Топ игроков',
        message: 'Функция в разработке...'
    });
}

function startGameSession(type, mode, questionCount, ticketNumber = null, duelId = null) {
    const questions = generateMockQuestions(questionCount);
    currentQuestions = questions;
    currentQuestionIndex = 0;
    userScore = 0;
    selectedAnswers = [];
    
    showScreen('questionScreen');
    displayQuestion();
}

function generateMockQuestions(count) {
    const questions = [];
    const questionTexts = [
        "Разрешено ли Вам выполнить разворот в указанном месте?",
        "Что означает этот дорожный знак?",
        "С какой скоростью разрешено движение в населенном пункте?",
        "Обязаны ли Вы включить указатели поворота в данной ситуации?",
        "Кто имеет преимущество в движении?",
        "Разрешена ли остановка в указанном месте?",
        "Что должен сделать водитель в этой ситуации?",
        "Разрешено ли Вам обогнать грузовой автомобиль?",
        "Какой знак показывает главную дорогу?",
        "Что означает мигающий зеленый сигнал светофора?"
    ];
    
    for (let i = 0; i < count; i++) {
        questions.push({
            id: i + 1,
            text: questionTexts[i % questionTexts.length],
            image: null,
            options: [
                { id: 1, text: "Разрешено" },
                { id: 2, text: "Разрешено, если не будут созданы помехи" },
                { id: 3, text: "Запрещено" },
                { id: 4, text: "Запрещено, кроме случаев..." }
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
    
    const imageContainer = document.getElementById('questionImage');
    imageContainer.innerHTML = '';
    
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
    
    selectedAnswers.push({
        questionIndex: currentQuestionIndex,
        selectedAnswer: optionId,
        isCorrect: isCorrect
    });
    
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
    selectedAnswers.push({
        questionIndex: currentQuestionIndex,
        selectedAnswer: null,
        isCorrect: false
    });
    
    currentQuestionIndex++;
    if (currentQuestionIndex < currentQuestions.length) {
        displayQuestion();
    } else {
        showResults();
    }
}

function showResults() {
    document.getElementById('playerScore').textContent = userScore;
    document.getElementById('opponentScore').textContent = Math.floor(Math.random() * 10);
    
    const resultMessage = document.getElementById('resultMessage');
    if (userScore > 5) {
        resultMessage.textContent = '🎉 Победа! Отличный результат!';
        resultMessage.style.background = 'linear-gradient(45deg, #4ECDC4, #44A08D)';
    } else if (userScore > 3) {
        resultMessage.textContent = '👍 Хорошо! Можно лучше!';
        resultMessage.style.background = 'linear-gradient(45deg, #FFA726, #FFB74D)';
    } else {
        resultMessage.textContent = '😔 Поражение. Тренируйся больше!';
        resultMessage.style.background = 'linear-gradient(45deg, #FF6B6B, #FF8E53)';
    }
    
    showScreen('resultsScreen');
}
