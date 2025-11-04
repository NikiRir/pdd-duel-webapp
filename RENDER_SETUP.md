# Настройка API сервера на Render.com

## Команды для Render.com

### Build Command:
```bash
pip install -r requirements.txt
```

### Start Command:
```bash
gunicorn api_server:app --bind 0.0.0.0:$PORT
```

**Важно:** 
- Render автоматически устанавливает переменную окружения `$PORT`
- Используйте именно `$PORT`, а не конкретный номер порта
- `api_server:app` означает: файл `api_server.py`, переменная `app` (экземпляр Flask)

## Настройка на Render.com

1. **Environment**: Python 3
2. **Build Command**: `pip install -r requirements.txt`
3. **Start Command**: `gunicorn api_server:app --bind 0.0.0.0:$PORT`
4. **Root Directory**: оставьте пустым (если весь проект в репозитории)

## После развертывания

✅ **API сервер развернут:** `https://pdd-duel-webapp.onrender.com`

URL уже обновлен в `script.js`. Если нужно изменить, найдите строку:
```javascript
const API_BASE_URL = "https://pdd-duel-webapp.onrender.com";
```

## Проверка работы

После развертывания проверьте:
1. Health check: `https://ваш-сервер.onrender.com/health`
2. Должен вернуть: `{"status": "ok", "timestamp": ...}`

## Примечания

- Render может "засыпать" бесплатные сервисы после 15 минут бездействия
- Первый запрос после пробуждения может занять 30-60 секунд
- Для постоянной работы рекомендуется платный план или другой хостинг

