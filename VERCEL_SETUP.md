# Настройка API сервера на Vercel

## Текущий статус

✅ **API сервер развернут на Vercel:** `https://pdd-duel-webapp.vercel.app`

## Настройка

### Для Serverless Functions (рекомендуется)

Если вы используете Vercel Serverless Functions, создайте структуру:

```
api/
  duel/
    search/
      join.py
      check.py
      leave.py
    progress/
      update.py
      get.py
```

Или используйте единый файл `api/index.py` который обрабатывает все маршруты.

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

