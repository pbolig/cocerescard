# Coceres Card

MVP de compra y venta de vehículos para Rosario y alrededores.

## Desarrollo local

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python local_api.py
```

Abrir `frontend/index.html` o servir `frontend` con un servidor estático. La app intenta primero `http://127.0.0.1:5000/api/vehicles`; para producción se configura `SUPABASE_URL` en `frontend/config.js`.

## Supabase y GitHub Actions

1. Ejecutar `supabase_schema.sql` en el SQL Editor de Supabase.
2. Crear secretos de repositorio `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
3. Cada push a `main` sincroniza SQLite mediante `sync.yml`.
4. `update_prices.yml` actualiza referencias diariamente. Revisar términos, límites y permisos de cada fuente antes de activar scraping.
5. Para activar registro, recuperación de contraseña y publicación de vehículos, volver a ejecutar `supabase_schema.sql` en el SQL Editor. En Authentication → URL Configuration, agregar la URL de GitHub Pages como Site URL y Redirect URL.

## Fotos de vehículos

El esquema crea el bucket público `vehicle-images`. Para subir fotos propias, crear `backend/.env` (no subirlo a Git) con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`, preparar una carpeta con fotos cuyo nombre sea el ID del vehículo (`1.jpg`, `2.jpg`, etc.) y ejecutar:

```powershell
backend/.venv/Scripts/python.exe backend/upload_vehicle_images.py fotos
```

El script sube cada archivo a Storage y actualiza `image_url` en SQLite. Después ejecutar `sync_to_supabase.py` para replicar esas URLs en Supabase.

El service role key solo vive en GitHub Actions; nunca debe llegar al frontend.
