"""Punto de entrada para el cron de referencias. Requiere configurar fuentes y términos de uso."""
from pathlib import Path
import sqlite3
from scrapers.mercadolibre import search_listings

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / 'db' / 'local.sqlite3'
db = sqlite3.connect(DB_PATH)
for vehicle_id, query in db.execute('SELECT id, title FROM vehicles'):
    listings = search_listings(query, limit=3)
    for listing in listings:
        db.execute('INSERT INTO price_references (vehicle_id, source, source_label, price_ars, url) VALUES (?, ?, ?, ?, ?)', (vehicle_id, listing['source'], 'Mercado Libre', listing['price_ars'], listing['url']))
db.commit()
db.close()
