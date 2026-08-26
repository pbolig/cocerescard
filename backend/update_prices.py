"""Punto de entrada para el cron de referencias. Requiere configurar fuentes y términos de uso."""
from pathlib import Path
import os
import sqlite3
import requests
from scrapers.mercadolibre import search_listings
from supabase import create_client
from scrapers.rosario_garage import search_listings as search_rosario_garage

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
local_matches = 0
local_rosario_matches = 0
for vehicle_id, title, brand, model, year in db.execute('SELECT id, title, brand, model, year FROM vehicles'):
    query = f'{brand} {model} {year}'
    meli_ok = True
    try:
        listings = search_listings(query, limit=3)
    except requests.RequestException as error:
        print(f'No se pudo consultar Mercado Libre para {query}: {error}')
        listings = []
        meli_ok = False
    local_matches += len(listings)
    if meli_ok:
        db.execute("DELETE FROM price_references WHERE vehicle_id = ? AND source = 'mercadolibre'", (vehicle_id,))
        for listing in listings:
            db.execute('INSERT INTO price_references (vehicle_id, source, source_label, price_ars, url) VALUES (?, ?, ?, ?, ?)', (vehicle_id, listing['source'], 'Mercado Libre', listing['price_ars'], listing['url']))
    try:
        rosario_listings = search_rosario_garage(query, limit=3)
    except requests.RequestException as error:
        print(f'No se pudo consultar Rosario Garage para {query}: {error}')
        rosario_listings = []
    local_rosario_matches += len(rosario_listings)
    db.execute("DELETE FROM price_references WHERE vehicle_id = ? AND source = 'rosario_garage'", (vehicle_id,))
    for listing in rosario_listings:
        db.execute('INSERT INTO price_references (vehicle_id, source, source_label, price_ars, url) VALUES (?, ?, ?, ?, ?)', (vehicle_id, listing['source'], 'Rosario Garage', listing['price_ars'], listing['url']))
db.commit()
db.close()
print(f'Referencias locales obtenidas desde Mercado Libre: {local_matches}')
print(f'Referencias locales obtenidas desde Rosario Garage: {local_rosario_matches}')


if os.getenv('SUPABASE_URL') and os.getenv('SUPABASE_SERVICE_ROLE_KEY'):
    client = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
    vehicles = client.table('vehicles').select('id, title, brand, model, year').execute().data or []
    remote_matches = 0
    remote_rosario_matches = 0
    for vehicle in vehicles:
        query = f"{vehicle['brand']} {vehicle['model']} {vehicle['year']}"
        meli_ok = True
        try:
            listings = search_listings(query, limit=3)
        except requests.RequestException as error:
            print(f"No se pudo consultar Mercado Libre para {query}: {error}")
            listings = []
            meli_ok = False
        remote_matches += len(listings)
        if meli_ok:
            client.table('price_references').delete().eq('vehicle_id', vehicle['id']).eq('source', 'mercadolibre').execute()
            references = [{'vehicle_id': vehicle['id'], 'source': listing['source'], 'source_label': 'Mercado Libre', 'price_ars': listing['price_ars'], 'url': listing['url']} for listing in listings]
            if references:
                client.table('price_references').insert(references).execute()
        try:
            rosario_listings = search_rosario_garage(query, limit=3)
        except requests.RequestException as error:
            print(f"No se pudo consultar Rosario Garage para {query}: {error}")
            rosario_listings = []
        remote_rosario_matches += len(rosario_listings)
        client.table('price_references').delete().eq('vehicle_id', vehicle['id']).eq('source', 'rosario_garage').execute()
        rosario_references = [{'vehicle_id': vehicle['id'], 'source': listing['source'], 'source_label': 'Rosario Garage', 'price_ars': listing['price_ars'], 'url': listing['url']} for listing in rosario_listings]
        if rosario_references:
            client.table('price_references').insert(rosario_references).execute()
    print(f'Referencias sincronizadas en Supabase desde Mercado Libre: {remote_matches}')
    print(f'Referencias sincronizadas en Supabase desde Rosario Garage: {remote_rosario_matches}')
