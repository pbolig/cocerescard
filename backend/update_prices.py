"""Punto de entrada para el cron de referencias. Requiere configurar fuentes y términos de uso."""
from pathlib import Path
import sqlite3
from scrapers.mercadolibre import search_listings

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / 'db' / 'local.sqlite3'
SCHEMA_PATH = ROOT / 'db' / 'schema.sql'
SEED_PATH = ROOT / 'db' / 'seed.sql'


def init_db():
    DB_PATH.parent.mkdir(exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.executescript(SCHEMA_PATH.read_text(encoding='utf-8'))
    if db.execute('SELECT COUNT(*) FROM vehicles').fetchone()[0] == 0:
        db.executescript(SEED_PATH.read_text(encoding='utf-8'))
    db.commit()
    db.close()


init_db()
db = sqlite3.connect(DB_PATH)
for vehicle_id, query in db.execute('SELECT id, title FROM vehicles'):
    listings = search_listings(query, limit=3)
    for listing in listings:
        db.execute('INSERT INTO price_references (vehicle_id, source, source_label, price_ars, url) VALUES (?, ?, ?, ?, ?)', (vehicle_id, listing['source'], 'Mercado Libre', listing['price_ars'], listing['url']))
db.commit()
db.close()
