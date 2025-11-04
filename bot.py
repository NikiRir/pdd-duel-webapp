import asyncio
import logging
from aiogram import Bot, Dispatcher, types, F
from aiogram.types import Message, WebAppInfo, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.filters import CommandStart
from database import Database

logging.basicConfig(level=logging.INFO)

# Импортируем токен из config.py (если он там есть) или используем переменную окружения
import os
try:
    from config import BOT_TOKEN, WEBAPP_URL
except ImportError:
    # Если config.py не найден, используем переменные окружения
    BOT_TOKEN = os.getenv("BOT_TOKEN", "8390787038:AAHChRwHsSbDKHcXEqS8oJXhi0_ASUSq4P8")
    # URL веб-приложения на GitHub Pages
    WEBAPP_URL = os.getenv("WEBAPP_URL", "https://nikirir.github.io/pdd-duel-webapp")

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()
db = Database()

def get_main_keyboard():
    # Убираем слэш в конце если есть, и добавляем /index.html
    webapp_url = f"{WEBAPP_URL.rstrip('/')}/index.html"
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="🎮 Открыть приложение", 
            web_app=WebAppInfo(url=webapp_url)
        )],
        [InlineKeyboardButton(text="📊 Топ игроков", callback_data="top_players")],
        [InlineKeyboardButton(text="❓ Помощь", callback_data="help")]
    ])
    return keyboard

@dp.message(CommandStart())
async def cmd_start(message: Message):
    user = db.get_or_create_user(message.from_user.id, message.from_user.username, message.from_user.first_name)
    
    welcome_text = f"""🚗 Привет, {message.from_user.first_name or 'друг'}!

Добро пожаловать в **ПДД ДУЭЛИ**! 🎮

Подготовка к экзамену ГИБДД стала еще интереснее!

🎯 **Возможности:**
• 📚 Решение билетов ГИБДД
• 🎓 Тренировка по темам ПДД
• 🏆 Топ игроков по рейтингу
• 📊 Статистика и прогресс
• ⚡ Мгновенная проверка ответов

Нажми кнопку ниже, чтобы начать! 👇"""
    
    await message.answer(welcome_text, reply_markup=get_main_keyboard())

@dp.callback_query(F.data == "top_players")
async def show_top_players(callback: types.CallbackQuery):
    top_users = db.get_top_users(10)
    
    if not top_users:
        await callback.answer("Пока нет данных о игроках")
        return
    
    text = "🏆 Топ игроков по винрейту:\n\n"
    for i, user in enumerate(top_users, 1):
        user_id, username, first_name, wins, losses, total_games, win_rate = user
        name = first_name or username or f"Игрок {user_id}"
        text += f"{i}. {name} - {win_rate}% ({wins}/{total_games})\n"
    
    await callback.message.answer(text)

@dp.callback_query(F.data == "help")
async def show_help(callback: types.CallbackQuery):
    help_text = """
❓ Как играть:

1. Нажми "Открыть приложение"
2. Выбери режим игры:
   - 🤺 Дуэль: Соревнование с другим игроком
   - 📚 Тренировка: Практика без соперника
3. Отвечай на вопросы быстро и правильно
4. Поднимайся в рейтинге!

📊 Статистика:
• Винрейт = (Победы / Все игры) * 100%
• Минимум 5 игр для попадания в топ
    """
    await callback.message.answer(help_text)

async def main():
    logging.info("Бот запущен!")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
