# Настройка API сервера на Vercel

## Текущий статус

✅ **API сервер настроен для Vercel:** `https://pdd-duel-webapp.vercel.app`

## Настройка

### ✅ Serverless Function создан

Создан файл `api/index.py` который обрабатывает все API маршруты:
- `/api/duel/search/join` - добавление в очередь поиска
- `/api/duel/search/check` - проверка противника
- `/api/duel/search/leave` - выход из очереди
- `/api/duel/progress/update` - обновление прогресса
- `/api/duel/progress/get` - получение прогресса
- `/api/top/players` - получение топа игроков
- `/health` - проверка работы API

### Для Python Web App

Если вы развернули Flask приложение как обычный веб-сервис:

1. **Root Directory**: корень проекта
2. **Build Command**: `pip install -r requirements.txt`
3. **Start Command**: `gunicorn api_server:app --bind 0.0.0.0:$PORT`

### Environment Variables

Если нужно, настройте переменные окружения в Vercel:
- `PORT` - обычно устанавливается автоматически
- `BOT_TOKEN` - если используется
- `WEBAPP_URL` - URL веб-приложения

## Проверка работы

Проверьте health endpoint:
```
https://pdd-duel-webapp.vercel.app/health
```

Должен вернуть: `{"status": "ok", "timestamp": ...}`

## Обновление URL в веб-приложении

✅ **URL уже обновлен в `script.js`:**

```javascript
const API_BASE_URL = "https://pdd-duel-webapp.vercel.app";
```

## Примечания

- Vercel автоматически обрабатывает CORS для запросов с вашего домена
- Если используете Serverless Functions, убедитесь, что они правильно настроены
- Vercel может иметь ограничения на длительность выполнения функций (обычно 10 секунд для бесплатного плана)

