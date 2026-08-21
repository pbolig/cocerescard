from pathlib import Path
import sqlite3
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / 'db' / 'local.sqlite3'
SCHEMA_PATH = ROOT / 'db' / 'schema.sql'
SEED_PATH = ROOT / 'db' / 'seed.sql'
app = Flask(__name__)
CORS(app)
FRONTEND_PATH = ROOT / 'frontend'


def connection():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    return db


def init_db():
    DB_PATH.parent.mkdir(exist_ok=True)
    db = connection()
    db.executescript(SCHEMA_PATH.read_text(encoding='utf-8'))
    if db.execute('SELECT COUNT(*) FROM vehicles').fetchone()[0] == 0:
        db.executescript(SEED_PATH.read_text(encoding='utf-8'))
    db.commit()
    db.close()


def vehicle_payload(row, references):
    vehicle = dict(row)
    vehicle['price_references'] = [dict(item) for item in references]
    return vehicle


@app.get('/')
def frontend():
    return send_from_directory(FRONTEND_PATH, 'index.html')


@app.get('/<path:filename>')
def frontend_assets(filename):
    if filename.startswith('api/'):
        return jsonify({'error': 'Ruta no encontrada'}), 404
    return send_from_directory(FRONTEND_PATH, filename)


@app.get('/api/health')
def health():
    return jsonify({'status': 'ok', 'environment': 'local'})


@app.get('/api/vehicles')
def vehicles():
    query = request.args.get('q', '').strip()
    status = request.args.get('status', 'available')
    db = connection()
    sql = 'SELECT * FROM vehicles WHERE 1=1'
    params = []
    if status != 'all':
        sql += ' AND status = ?'
        params.append(status)
    if query:
        sql += ' AND (title LIKE ? OR brand LIKE ? OR model LIKE ? OR location LIKE ?)'
        params.extend([f'%{query}%'] * 4)
    rows = db.execute(sql + ' ORDER BY updated_at DESC', params).fetchall()
    result = []
    for row in rows:
        refs = db.execute('SELECT * FROM price_references WHERE vehicle_id = ? ORDER BY source', (row['id'],)).fetchall()
        result.append(vehicle_payload(row, refs))
    db.close()
    return jsonify(result)


@app.get('/api/vehicles/<int:vehicle_id>')
def vehicle(vehicle_id):
    db = connection()
    row = db.execute('SELECT * FROM vehicles WHERE id = ?', (vehicle_id,)).fetchone()
    if row is None:
        return jsonify({'error': 'Vehículo no encontrado'}), 404
    refs = db.execute('SELECT * FROM price_references WHERE vehicle_id = ? ORDER BY source', (vehicle_id,)).fetchall()
    db.close()
    return jsonify(vehicle_payload(row, refs))


if __name__ == '__main__':
    init_db()
    app.run(host='127.0.0.1', port=5000, debug=True)
