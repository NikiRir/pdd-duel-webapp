# Настройка API сервера для поиска противника

## Описание

API сервер (`api_server.py`) предоставляет HTTP endpoints для:
- Поиска противника для дуэлей
- Синхронизации прогресса между игроками во время дуэли

**ВАЖНО:** Веб-приложение размещено на GitHub Pages (https://nikirir.github.io/pdd-duel-webapp/), который является статическим хостингом. API сервер **нельзя** разместить на GitHub Pages. Его нужно запустить на отдельном сервере (например, на том же, где работает Telegram бот).

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

## Развертывание на продакшене

### Вариант 1: На том же сервере, что и Telegram бот

1. Скопируйте файлы на сервер:
   - `api_server.py`
   - `database.py`
   - `requirements.txt`

2. Установите зависимости:
```bash
pip install -r requirements.txt
```

3. Запустите через systemd или supervisor (рекомендуется использовать Gunicorn):
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:8080 api_server:app
```

4. Настройте nginx для проксирования (если нужно):
```nginx
server {
    listen 80;
    server_name your-api-domain.com;
    
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Вариант 2: Использовать бесплатный хостинг (Heroku, Railway, Render)

1. Создайте `Procfile`:
```
web: gunicorn -w 4 -b 0.0.0.0:$PORT api_server:app
```

2. Деплойте на выбранный хостинг

## Настройка URL в веб-приложении

✅ **API сервер уже настроен:** `https://pdd-duel-webapp.onrender.com`

URL обновлен в `script.js`. Если нужно изменить, найдите строку:
```javascript
const API_BASE_URL = "https://pdd-duel-webapp.onrender.com";
```

**Примечание:** Если API сервер на другом домене, убедитесь, что CORS настроен правильно (в `api_server.py` уже включен `CORS(app)`).

## Настройка CORS (если нужно)

Если API сервер на другом домене, Flask-CORS уже настроен в `api_server.py`. Если нужно ограничить домены, измените:

```python
from flask_cors import CORS

# Разрешить только GitHub Pages
CORS(app, origins=["https://nikirir.github.io"])
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

