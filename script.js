// Добавляем эти функции в script.js

// Показ реальной статистики
function showRealStats() {
    // В реальном приложении здесь будет запрос к боту за статистикой
    // Пока используем демо-данные
    const stats = {
        rating: 1250,
        rank: 3,
        wins: 10,
        accuracy: '85%',
        totalGames: 15,
        winsCount: 10,
        losses: 5,
        winRate: '67%',
        correct: '85/100'
    };
    
    // Заполняем статистику
    document.getElementById('statRating').textContent = stats.rating;
    document.getElementById('statRank').textContent = stats.rank;
    document.getElementById('statWins').textContent = stats.wins;
    document.getElementById('statAccuracy').textContent = stats.accuracy;
    document.getElementById('statTotalGames').textContent = stats.totalGames;
    document.getElementById('statWinsCount').textContent = stats.winsCount;
    document.getElementById('statLosses').textContent = stats.losses;
    document.getElementById('statWinRate').textContent = stats.winRate;
    document.getElementById('statCorrect').textContent = stats.correct;
    
    showScreen('statsScreen');
}

// Показ реального топа
function showRealTop() {
    // В реальном приложении здесь будет запрос к боту за топом
    const topPlayers = [
        {position: 1, name: "Алексей", rating: 1500, accuracy: "92%", wins: 25, you: false},
        {position: 2, name: "Мария", rating: 1420, accuracy: "88%", wins: 22, you: false},
        {position: 3, name: "Вы", rating: 1250, accuracy: "85%", wins: 10, you: true},
        {position: 4, name: "Дмитрий", rating: 1180, accuracy: "82%", wins: 8, you: false},
        {position: 5, name: "Анна", rating: 1150, accuracy: "80%", wins: 7, you: false},
        {position: 6, name: "Иван", rating: 1100, accuracy: "78%", wins: 6, you: false},
        {position: 7, name: "Ольга", rating: 1050, accuracy: "75%", wins: 5, you: false}
    ];
    
    renderTopList(topPlayers);
    showScreen('topScreen');
}

function switchTab(tabType) {
    // Переключение между "по рейтингу" и "по победам"
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // В реальном приложении здесь будет загрузка соответствующего топа
    const topPlayers = tabType === 'rating' ? [
        {position: 1, name: "Алексей", rating: 1500, accuracy: "92%", wins: 25, you: false},
        {position: 2, name: "Мария", rating: 1420, accuracy: "88%", wins: 22, you: false},
        {position: 3, name: "Вы", rating: 1250, accuracy: "85%", wins: 10, you: true}
    ] : [
        {position: 1, name: "Алексей", rating: 1500, accuracy: "92%", wins: 25, you: false},
        {position: 2, name: "Мария", rating: 1420, accuracy: "88%", wins: 22, you: false},
        {position: 
