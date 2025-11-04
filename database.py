import sqlite3
import os
from typing import Optional, List, Tuple

class Database:
    def __init__(self, db_path: str = "pdd_duel.db"):
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
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
    
    def get_or_create_user(self, user_id: int, username: Optional[str] = None, first_name: Optional[str] = None):
        """Получить пользователя или создать нового"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Проверяем, существует ли пользователь
        cursor.execute("SELECT * FROM users WHERE user_id = ?", (user_id,))
        user = cursor.fetchone()
        
        if not user:
            # Создаем нового пользователя
            cursor.execute(
                "INSERT INTO users (user_id, username, first_name) VALUES (?, ?, ?)",
                (user_id, username, first_name)
            )
            conn.commit()
        
        conn.close()
        return user_id
    
    def get_top_users(self, limit: int = 10) -> List[Tuple]:
        """Получить топ игроков по винрейту"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Вычисляем статистику для каждого пользователя
        cursor.execute("""
            SELECT 
                u.user_id,
                u.username,
                u.first_name,
                COUNT(CASE WHEN g.winner_id = u.user_id THEN 1 END) as wins,
                COUNT(CASE WHEN g.winner_id != u.user_id AND g.winner_id IS NOT NULL THEN 1 END) as losses,
                COUNT(g.game_id) as total_games,
                CASE 
                    WHEN COUNT(g.game_id) > 0 THEN 
                        ROUND(COUNT(CASE WHEN g.winner_id = u.user_id THEN 1 END) * 100.0 / COUNT(g.game_id), 2)
                    ELSE 0 
                END as win_rate
            FROM users u
            LEFT JOIN games g ON (g.user_id = u.user_id OR g.opponent_id = u.user_id)
            GROUP BY u.user_id
            HAVING total_games >= 5
            ORDER BY win_rate DESC, total_games DESC
            LIMIT ?
        """, (limit,))
        
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

