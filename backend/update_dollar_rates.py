import json
from datetime import datetime, timezone
from pathlib import Path

from local_api import DOLLAR_SOURCES, scrape_dollar

ROOT = Path(__file__).resolve().parent.parent
OUTPUT_PATH = ROOT / 'frontend' / 'dollar-rates.json'
rates = []

for source, url in DOLLAR_SOURCES.items():
    try:
        rates.append({'source': source, **scrape_dollar(source, url)})
    except Exception as error:
        print(f'No se pudo consultar {source}: {error}')

if not rates:
    raise SystemExit('No se pudo consultar ninguna fuente de dólar')

OUTPUT_PATH.write_text(json.dumps({
    'updated_at': datetime.now(timezone.utc).isoformat(timespec='minutes'),
    'rates': rates,
}, ensure_ascii=True, indent=2) + '\n', encoding='utf-8')
print(f'Cotizaciones guardadas en {OUTPUT_PATH}')
