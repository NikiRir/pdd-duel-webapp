import sqlite3
import os
from typing import Optional, List, Tuple

class Database:
    def __init__(self, db_path: str = None):
        # Для Vercel используем /tmp директорию (эпиhemeral, но работает для запроса)
        # Для продакшена лучше использовать внешнюю БД
        if db_path is None:
            import os
            if os.environ.get('VERCEL'):
                # На Vercel используем /tmp
                self.db_path = "/tmp/pdd_duel.db"
            else:
                self.db_path = "pdd_duel.db"
        else:
            self.db_path = db_path
        self.init_db()
    
    def get_connection(self):
        """Получить соединение с базой данных"""
        return sqlite3.connect(self.db_path)
    
    def init_db(self):
        """Инициализировать таблицы базы данных"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Таблица пользователей
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY,
                username TEXT,
                first_name TEXT,
                photo_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Добавляем колонку photo_url если её нет (для существующих баз)
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN photo_url TEXT")
        except sqlite3.OperationalError:
            pass  # Колонка уже существует
        
        # Добавляем колонку hide_username если её нет (для существующих баз)
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN hide_username INTEGER DEFAULT 0")
        except sqlite3.OperationalError:
            pass  # Колонка уже существует
        
        # Добавляем колонку hide_from_top если её нет (для существующих баз)
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN hide_from_top INTEGER DEFAULT 0")
        except sqlite3.OperationalError:
            pass  # Колонка уже существует
        
        # Добавляем колонку nickname если её нет (для существующих баз)
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN nickname TEXT UNIQUE")
        except sqlite3.OperationalError:
            pass  # Колонка уже существует
        
        # Таблица игр
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS games (
                game_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                opponent_id INTEGER,
                user_score INTEGER,
                opponent_score INTEGER,
                winner_id INTEGER,
                game_type TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id),
                FOREIGN KEY (opponent_id) REFERENCES users(user_id)
            )
        """)
        
        conn.commit()
        conn.close()
    
    def get_or_create_user(self, user_id: int, username: Optional[str] = None, first_name: Optional[str] = None, photo_url: Optional[str] = None, nickname: Optional[str] = None):
        """Получить пользователя или создать нового"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Проверяем, существует ли пользователь
        cursor.execute("SELECT * FROM users WHERE user_id = ?", (user_id,))
        user = cursor.fetchone()
        
        if not user:
            # Создаем нового пользователя
            cursor.execute(
                "INSERT INTO users (user_id, username, first_name, photo_url, hide_username, hide_from_top, nickname) VALUES (?, ?, ?, ?, 0, 0, ?)",
                (user_id, username, first_name, photo_url, nickname)
            )
            conn.commit()
        else:
            # Обновляем данные пользователя если они изменились
            update_fields = []
            update_values = []
            
            if username is not None:
                update_fields.append("username = COALESCE(?, username)")
                update_values.append(username)
            if first_name is not None:
                update_fields.append("first_name = COALESCE(?, first_name)")
                update_values.append(first_name)
            if photo_url is not None:
                update_fields.append("photo_url = COALESCE(?, photo_url)")
                update_values.append(photo_url)
            if nickname is not None:
                update_fields.append("nickname = ?")
                update_values.append(nickname)
            
            if update_fields:
                update_values.append(user_id)
                cursor.execute(
                    f"UPDATE users SET {', '.join(update_fields)} WHERE user_id = ?",
                    update_values
                )
                conn.commit()
        
        conn.close()
        return user_id
    
    def check_nickname_available(self, nickname: str, exclude_user_id: Optional[int] = None) -> bool:
        """Проверить, доступен ли nickname"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        if exclude_user_id:
            cursor.execute("SELECT COUNT(*) FROM users WHERE nickname = ? AND user_id != ?", (nickname, exclude_user_id))
        else:
            cursor.execute("SELECT COUNT(*) FROM users WHERE nickname = ?", (nickname,))
        
        count = cursor.fetchone()[0]
        conn.close()
        return count == 0
    
    def suggest_nicknames(self, base_nickname: str, limit: int = 5) -> List[str]:
        """Предложить похожие варианты nickname"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Получаем все занятые nickname
        cursor.execute("SELECT nickname FROM users WHERE nickname IS NOT NULL AND nickname != ''")
        taken_nicknames = {row[0] for row in cursor.fetchall()}
        
        suggestions = []
        base = base_nickname[:10]  # Максимум 10 символов
        
        # Генерируем варианты
        for i in range(1, 1000):
            if len(suggestions) >= limit:
                break
            
            # Вариант 1: base + число
            variant1 = f"{base}{i}"
            if variant1 not in taken_nicknames and len(variant1) <= 10:
                suggestions.append(variant1)
                taken_nicknames.add(variant1)
            
            # Вариант 2: base + подчеркивание + число
            if len(base) < 9:
                variant2 = f"{base}_{i}"
                if variant2 not in taken_nicknames and len(variant2) <= 10:
                    suggestions.append(variant2)
                    taken_nicknames.add(variant2)
            
            # Вариант 3: base + случайный суффикс
            if len(base) < 8:
                import random
                suffix = random.randint(100, 999)
                variant3 = f"{base}{suffix}"
                if variant3 not in taken_nicknames and len(variant3) <= 10:
                    suggestions.append(variant3)
                    taken_nicknames.add(variant3)
        
        conn.close()
        return suggestions[:limit]
    
    def update_user_setting(self, user_id: int, setting_name: str, setting_value: bool):
        """Обновить настройку пользователя"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        if setting_name == 'hide_username':
            cursor.execute(
                "UPDATE users SET hide_username = ? WHERE user_id = ?",
                (1 if setting_value else 0, user_id)
            )
            conn.commit()
        elif setting_name == 'hide_from_top':
            cursor.execute(
                "UPDATE users SET hide_from_top = ? WHERE user_id = ?",
                (1 if setting_value else 0, user_id)
            )
            conn.commit()
        
        conn.close()
        return True
    
    def get_top_users(self, limit: int = None) -> List[Tuple]:
        """Получить топ игроков по винрейту (все пользователи, даже без игр)"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Вычисляем статистику для каждого пользователя (включая тех, кто не играл)
        # Исключаем пользователей с hide_from_top = 1
        query = """
            SELECT 
                u.user_id,
                u.username,
                u.first_name,
                u.photo_url,
                COALESCE(u.hide_username, 0) as hide_username,
                COALESCE(COUNT(CASE WHEN g.winner_id = u.user_id THEN 1 END), 0) as wins,
                COALESCE(COUNT(CASE WHEN g.winner_id != u.user_id AND g.winner_id IS NOT NULL THEN 1 END), 0) as losses,
                COALESCE(COUNT(g.game_id), 0) as total_games,
                CASE 
                    WHEN COUNT(g.game_id) > 0 THEN 
                        ROUND(COUNT(CASE WHEN g.winner_id = u.user_id THEN 1 END) * 100.0 / COUNT(g.game_id), 2)
                    ELSE 0 
                END as win_rate
            FROM users u
            LEFT JOIN games g ON (g.user_id = u.user_id OR g.opponent_id = u.user_id)
            WHERE COALESCE(u.hide_from_top, 0) = 0
            GROUP BY u.user_id
            ORDER BY win_rate DESC, total_games DESC, u.user_id ASC
        """
        
        if limit:
            query += " LIMIT ?"
            cursor.execute(query, (limit,))
        else:
            cursor.execute(query)
        
        results = cursor.fetchall()
        conn.close()
        return results
    
    def add_game(self, user_id: int, opponent_id: Optional[int], 
                 user_score: int, opponent_score: int, 
                 winner_id: Optional[int], game_type: str = "duel"):
        """Добавить игру в базу данных"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO games (user_id, opponent_id, user_score, opponent_score, winner_id, game_type)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (user_id, opponent_id, user_score, opponent_score, winner_id, game_type))
        
        conn.commit()
        conn.close()
    
    def add_to_search_queue(self, user_id):
        """Добавить пользователя в очередь поиска противника"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Создаем таблицу очереди поиска если её нет (TEXT для поддержки временных ID)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS duel_search_queue (
                user_id TEXT PRIMARY KEY,
                timestamp INTEGER NOT NULL
            )
        """)
        
        # Удаляем старые записи (старше 30 секунд)
        import time
        now = int(time.time() * 1000)
        cursor.execute("DELETE FROM duel_search_queue WHERE timestamp < ?", (now - 30000,))
        
        # Добавляем или обновляем запись (конвертируем user_id в строку)
        user_id_str = str(user_id)
        cursor.execute("""
            INSERT OR REPLACE INTO duel_search_queue (user_id, timestamp)
            VALUES (?, ?)
        """, (user_id_str, now))
        
        conn.commit()
        conn.close()
    
    def remove_from_search_queue(self, user_id):
        """Удалить пользователя из очереди поиска"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        user_id_str = str(user_id)
        cursor.execute("DELETE FROM duel_search_queue WHERE user_id = ?", (user_id_str,))
        
        conn.commit()
        conn.close()
    
    def find_opponent(self, user_id):
        """Найти противника для пользователя"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Создаем таблицу если её нет (TEXT для поддержки временных ID)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS duel_search_queue (
                user_id TEXT PRIMARY KEY,
                timestamp INTEGER NOT NULL
            )
        """)
        
        # Удаляем старые записи
        import time
        now = int(time.time() * 1000)
        cursor.execute("DELETE FROM duel_search_queue WHERE timestamp < ?", (now - 30000,))
        
        # Ищем другого игрока (конвертируем user_id в строку для сравнения)
        user_id_str = str(user_id)
        cursor.execute("""
            SELECT user_id FROM duel_search_queue 
            WHERE user_id != ? 
            ORDER BY timestamp DESC 
            LIMIT 1
        """, (user_id_str,))
        
        result = cursor.fetchone()
        conn.close()
        
        return result[0] if result else None
    
    def update_duel_progress(self, user_id: int, opponent_id: int, current_question: int, user_score: int):
        """Обновить прогресс дуэли"""
        import time
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Создаем таблицу прогресса дуэлей если её нет
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS duel_progress (
                duel_id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                opponent_id INTEGER NOT NULL,
                user_current_question INTEGER NOT NULL,
                opponent_current_question INTEGER NOT NULL,
                user_score INTEGER NOT NULL,
                opponent_score INTEGER NOT NULL,
                timestamp INTEGER NOT NULL
            )
        """)
        
        # Создаем уникальный ID дуэли (меньший ID идет первым)
        duel_id = f"{min(user_id, opponent_id)}_{max(user_id, opponent_id)}"
        now = int(time.time() * 1000)
        
        # Получаем текущий прогресс
        cursor.execute("SELECT * FROM duel_progress WHERE duel_id = ?", (duel_id,))
        existing = cursor.fetchone()
        
        if existing:
            # Обновляем прогресс для текущего пользователя
            if existing[1] == user_id:
                cursor.execute("""
                    UPDATE duel_progress 
                    SET user_current_question = ?, user_score = ?, timestamp = ?
                    WHERE duel_id = ?
                """, (current_question, user_score, now, duel_id))
            else:
                cursor.execute("""
                    UPDATE duel_progress 
                    SET opponent_current_question = ?, opponent_score = ?, timestamp = ?
                    WHERE duel_id = ?
                """, (current_question, user_score, now, duel_id))
        else:
            # Создаем новую запись
            cursor.execute("""
                INSERT INTO duel_progress 
                (duel_id, user_id, opponent_id, user_current_question, opponent_current_question, user_score, opponent_score, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (duel_id, user_id, opponent_id, current_question, 0, user_score, 0, now))
        
        conn.commit()
        conn.close()
    
    def get_opponent_progress(self, user_id: int, opponent_id: int) -> Optional[dict]:
        """Получить прогресс противника"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        duel_id = f"{min(user_id, opponent_id)}_{max(user_id, opponent_id)}"
        
        cursor.execute("SELECT * FROM duel_progress WHERE duel_id = ?", (duel_id,))
        result = cursor.fetchone()
        
        conn.close()
        
        if not result:
            return None
        
        # Определяем, кто есть кто
        if result[1] == user_id:
            return {
                'current_question': result[4],  # opponent_current_question
                'score': result[6]  # opponent_score
            }
        else:
            return {
                'current_question': result[3],  # user_current_question
                'score': result[5]  # user_score
            }

