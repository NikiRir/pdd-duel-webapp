# Настройка API сервера для поиска противника

## Описание

API сервер (`api_server.py`) предоставляет HTTP endpoints для:
- Поиска противника для дуэлей
- Синхронизации прогресса между игроками во время дуэли

## Установка

1. Установите зависимости:
```bash
pip install -r requirements.txt
```

2. Запустите API сервер:
```bash
python api_server.py
```

Сервер запустится на порту 8080 (или порту из переменной окружения `PORT`).

## Настройка URL в веб-приложении

Откройте `script.js` и обновите `API_BASE_URL`:

```javascript
// Для разработки (локально):
const API_BASE_URL = "http://localhost:8080";

// Для продакшена (замените на ваш домен):
const API_BASE_URL = "https://your-domain.com";
```

## Endpoints

### POST `/api/duel/search/join`
Добавить пользователя в очередь поиска противника.

**Request:**
```json
{
  "user_id": 123456789
}
```

**Response:**
```json
{
  "success": true,
  "message": "Добавлен в очередь поиска"
}
```

### POST `/api/duel/search/check`
Проверить наличие противника в очереди.

**Request:**
```json
{
  "user_id": 123456789
}
```

**Response (если противник найден):**
```json
{
  "success": true,
  "found": true,
  "opponent_id": 987654321
}
```

**Response (если противник не найден):**
```json
{
  "success": true,
  "found": false
}
```

### POST `/api/duel/search/leave`
Покинуть очередь поиска.

**Request:**
```json
{
  "user_id": 123456789
}
```

### POST `/api/duel/progress/update`
Обновить прогресс дуэли.

**Request:**
```json
{
  "user_id": 123456789,
  "opponent_id": 987654321,
  "current_question": 5,
  "user_score": 3
}
```

### POST `/api/duel/progress/get`
Получить прогресс противника.

**Request:**
```json
{
  "user_id": 123456789,
  "opponent_id": 987654321
}
```

**Response:**
```json
{
  "success": true,
  "progress": {
    "current_question": 4,
    "score": 2
  }
}
```

## Развертывание на продакшене

1. Используйте WSGI сервер (например, Gunicorn):
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:8080 api_server:app
```

2. Настройте reverse proxy (nginx) для проксирования запросов к API.

3. Обновите `API_BASE_URL` в `script.js` на ваш продакшен URL.

## Примечания

- API сервер использует ту же базу данных (`pdd_duel.db`), что и Telegram бот.
- Очередь поиска автоматически очищается от записей старше 30 секунд.
- Прогресс дуэлей хранится в таблице `duel_progress` и обновляется каждые 2 секунды.

