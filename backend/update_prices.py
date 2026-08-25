"""Punto de entrada para el cron de referencias. Requiere configurar fuentes y términos de uso."""
from pathlib import Path
import os
import sqlite3
from scrapers.mercadolibre import search_listings
from supabase import create_client

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


if os.getenv('SUPABASE_URL') and os.getenv('SUPABASE_SERVICE_ROLE_KEY'):
    client = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
    vehicles = client.table('vehicles').select('id, title').execute().data or []
    for vehicle in vehicles:
        listings = search_listings(vehicle['title'], limit=3)
        client.table('price_references').delete().eq('vehicle_id', vehicle['id']).eq('source', 'mercadolibre').execute()
        references = [{'vehicle_id': vehicle['id'], 'source': listing['source'], 'source_label': 'Mercado Libre', 'price_ars': listing['price_ars'], 'url': listing['url']} for listing in listings]
        if references:
            client.table('price_references').insert(references).execute()
