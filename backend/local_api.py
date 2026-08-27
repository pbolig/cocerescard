from pathlib import Path
import sqlite3
import re
from datetime import datetime
import requests
from bs4 import BeautifulSoup
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from scrapers.mercadolibre import search_listings
from scrapers.rosario_garage import search_listings as search_rosario_garage

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / 'db' / 'local.sqlite3'
SCHEMA_PATH = ROOT / 'db' / 'schema.sql'
SEED_PATH = ROOT / 'db' / 'seed.sql'
app = Flask(__name__)
CORS(app)
FRONTEND_PATH = ROOT / 'frontend'
DOLLAR_SOURCES = {
    'bna': 'https://www.bna.com.ar/Personas',
    'dolarhoy': 'https://dolarhoy.com/cotizacion-dolar-oficial'
}


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


def parse_price(value):
    match = re.search(r'\d+(?:[.\s]\d{3})*(?:,\d{1,2})?', value)
    if not match:
        return None
    return float(match.group().replace('.', '').replace(' ', '').replace(',', '.'))


def scrape_dollar(source, url):
    response = requests.get(url, headers={'User-Agent': 'CoceresCard/1.0'}, timeout=10)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, 'html.parser')
    text = soup.get_text(' ', strip=True)
    if source == 'bna':
        marker = re.search(r'Dolar\s+U\.S\.A\s+([\d.,]+)\s+([\d.,]+)', text, re.IGNORECASE)
    else:
        marker = re.search(r'D[oó]lar\s+Oficial\s+Compra\s+\$?\s*([\d.,]+)\s+Venta\s+\$?\s*([\d.,]+)', text, re.IGNORECASE)
    if not marker:
        raise ValueError(f'No se encontraron valores en {source}')
    prices = [parse_price(value) for value in marker.groups()]
    if len(prices) < 2:
        raise ValueError(f'No se encontraron valores en {source}')
    return {'buy': prices[0], 'sell': prices[1]}


@app.get('/api/dolar')
def dollar_rates():
    rates = []
    for source, url in DOLLAR_SOURCES.items():
        try:
            rates.append({'source': source, **scrape_dollar(source, url)})
        except (requests.RequestException, ValueError) as error:
            app.logger.warning('No se pudo consultar %s: %s', source, error)
    if not rates:
        return jsonify({'error': 'No se pudieron consultar las cotizaciones'}), 503
    return jsonify({'updated_at': datetime.now().isoformat(timespec='minutes'), 'rates': rates})


@app.post('/api/vehicles/<int:vehicle_id>/refresh-references')
def refresh_references(vehicle_id):
    db = connection()
    vehicle = db.execute('SELECT id, brand, model, year FROM vehicles WHERE id = ?', (vehicle_id,)).fetchone()
    if vehicle is None:
        db.close()
        return jsonify({'error': 'Vehículo no encontrado'}), 404
    query = f"{vehicle['brand']} {vehicle['model']} {vehicle['year']}"
    results = []
    for source, scraper, label in (('mercadolibre', search_listings, 'Mercado Libre'), ('rosario_garage', search_rosario_garage, 'Rosario Garage')):
        try:
            listings = scraper(query, limit=3)
            db.execute('DELETE FROM price_references WHERE vehicle_id = ? AND source = ?', (vehicle_id, source))
            for listing in listings:
                db.execute('INSERT INTO price_references (vehicle_id, source, source_label, price_ars, url) VALUES (?, ?, ?, ?, ?)', (vehicle_id, source, label, listing['price_ars'], listing['url']))
            results.append({'source': source, 'status': 'ok', 'count': len(listings), 'prices': [item['price_ars'] for item in listings]})
        except (requests.RequestException, ValueError) as error:
            results.append({'source': source, 'status': 'error', 'message': str(error)})
    db.commit()
    db.close()
    return jsonify({'vehicle_id': vehicle_id, 'query': query, 'results': results})


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
