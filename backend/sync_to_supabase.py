import os
import sqlite3
from pathlib import Path
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()
ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / 'db' / 'local.sqlite3'
required = ('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY')
missing = [key for key in required if not os.getenv(key)]
if missing:
    raise RuntimeError(f'Faltan variables de entorno: {", ".join(missing)}')

client = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
db = sqlite3.connect(DB_PATH)
db.row_factory = sqlite3.Row
for table in ('vehicles', 'price_references'):
    rows = [dict(row) for row in db.execute(f'SELECT * FROM {table}').fetchall()]
    if rows:
        client.table(table).upsert(rows).execute()
    print(f'Sincronizados {len(rows)} registros de {table}')
db.close()
