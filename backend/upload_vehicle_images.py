import mimetypes
import os
import sqlite3
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / 'db' / 'local.sqlite3'
BUCKET = 'vehicle-images'


def main():
    if len(sys.argv) < 2:
        raise SystemExit('Uso: python backend/upload_vehicle_images.py carpeta-de-fotos')
    folder = Path(sys.argv[1]).resolve()
    if not folder.is_dir():
        raise SystemExit(f'No existe la carpeta: {folder}')
    if not os.getenv('SUPABASE_URL') or not os.getenv('SUPABASE_SERVICE_ROLE_KEY'):
        raise SystemExit('Configurá SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en backend/.env')

    client = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    allowed = {'.jpg', '.jpeg', '.png', '.webp'}
    for image in sorted(folder.iterdir()):
        if image.suffix.lower() not in allowed:
            continue
        try:
            vehicle_id = int(image.stem)
        except ValueError:
            print(f'Ignorada {image.name}: el nombre debe ser el ID del vehículo')
            continue
        vehicle = db.execute('SELECT id FROM vehicles WHERE id = ?', (vehicle_id,)).fetchone()
        if vehicle is None:
            print(f'Ignorada {image.name}: no existe el vehículo {vehicle_id}')
            continue
        path = f'vehicles/{vehicle_id}/{image.name}'
        content_type = mimetypes.guess_type(image.name)[0] or 'application/octet-stream'
        with image.open('rb') as file:
            client.storage.from_(BUCKET).upload(path, file.read(), {'content-type': content_type, 'upsert': 'true'})
        public_url = f"{os.environ['SUPABASE_URL'].rstrip('/')}/storage/v1/object/public/{BUCKET}/{path}"
        db.execute('UPDATE vehicles SET image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', (public_url, vehicle_id))
        print(f'{vehicle_id}: {public_url}')
    db.commit()
    db.close()


if __name__ == '__main__':
    main()