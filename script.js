let tg = window.Telegram.WebApp;
tg.expand();

let currentQuestions = [];
let currentQuestionIndex = 0;
let userScore = 0;
let timerInterval = null;

document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

function initApp() {
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
        message: 'ID дуэли скопирован'
    });
}

function cancelDuel() {
    showScreen('duelModeScreen');
}

function showStats() {
    tg.showPopup({
        title: 'Статистика',
        message: 'Функция скоро будет доступна!'
    });
}

function showTop() {
    tg.showPopup({
        title: 'Топ игроков',
        message: 'Функция скоро будет доступна!'
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
    for (let i = 1; i <= count; i++) {
        questions.push({
            id: i,
            text: `Вопрос ${i}: Что означает этот дорожный знак?`,
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
        resultMessage.textContent = '🎉 Победа! Отличный результат!';
    } else if (userScore >= 2) {
        resultMessage.textContent = '👍 Хорошо! Можно лучше!';
    } else {
        resultMessage.textContent = '😔 Поражение. Тренируйся больше!';
    }
    
    showScreen('resultsScreen');
}
