#!/usr/bin/env python3
"""
HTTP API сервер для поиска противника и синхронизации прогресса дуэлей
Запускается на порту 8080 (или переменной окружения PORT)
"""
import os
import time
from flask import Flask, request, jsonify
from flask_cors import CORS
from database import Database

app = Flask(__name__)
CORS(app)  # Разрешаем CORS для веб-приложения

db = Database()

@app.route('/api/duel/search/join', methods=['POST'])
def join_search():
    """Добавить пользователя в очередь поиска"""
    try:
        data = request.get_json()
        user_id = int(data.get('user_id'))
        
        db.add_to_search_queue(user_id)
        
        return jsonify({
            'success': True,
            'message': 'Добавлен в очередь поиска'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400

@app.route('/api/duel/search/check', methods=['POST'])
def check_opponent():
    """Проверить наличие противника"""
    try:
        data = request.get_json()
        user_id = int(data.get('user_id'))
        
        opponent_id = db.find_opponent(user_id)
        
        if opponent_id:
            # Удаляем обоих из очереди
            db.remove_from_search_queue(user_id)
            db.remove_from_search_queue(opponent_id)
            
            return jsonify({
                'success': True,
                'found': True,
                'opponent_id': opponent_id
            })
        else:
            return jsonify({
                'success': True,
                'found': False
            })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400

@app.route('/api/duel/search/leave', methods=['POST'])
def leave_search():
    """Покинуть очередь поиска"""
    try:
        data = request.get_json()
        user_id = int(data.get('user_id'))
        
        db.remove_from_search_queue(user_id)
        
        return jsonify({
            'success': True,
            'message': 'Покинул очередь поиска'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400

@app.route('/api/duel/progress/update', methods=['POST'])
def update_progress():
    """Обновить прогресс дуэли"""
    try:
        data = request.get_json()
        user_id = int(data.get('user_id'))
        opponent_id = int(data.get('opponent_id'))
        current_question = int(data.get('current_question', 0))
        user_score = int(data.get('user_score', 0))
        
        db.update_duel_progress(user_id, opponent_id, current_question, user_score)
        
        return jsonify({
            'success': True,
            'message': 'Прогресс обновлен'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400

@app.route('/api/duel/progress/get', methods=['POST'])
def get_progress():
    """Получить прогресс противника"""
    try:
        data = request.get_json()
        user_id = int(data.get('user_id'))
        opponent_id = int(data.get('opponent_id'))
        
        progress = db.get_opponent_progress(user_id, opponent_id)
        
        if progress:
            return jsonify({
                'success': True,
                'progress': progress
            })
        else:
            return jsonify({
                'success': True,
                'progress': None
            })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'timestamp': int(time.time())
    })

if __name__ == '__main__':
    port = int(os.getenv('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)

