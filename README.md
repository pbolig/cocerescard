# Coceres Card

MVP de compra y venta de vehículos para Rosario y alrededores.

## Sitio en producción

La aplicación web en producción está disponible en el siguiente enlace de GitHub Pages:

👉 **[https://pbolig.github.io/cocerescard/](https://pbolig.github.io/cocerescard/)**

## Desarrollo local (Paso a paso)

Para ejecutar la aplicación localmente, sigue estas instrucciones paso a paso:

### Paso 1: Levantar la API local (Backend)
1. Abre una terminal de PowerShell en la carpeta raíz del proyecto.
2. Navega al directorio del backend e inicializa el entorno virtual de Python:
   ```powershell
   cd backend
   python -m venv .venv
   .venv\Scripts\Activate.ps1
   ```
3. Instala las dependencias necesarias indicadas en [backend/requirements.txt](backend/requirements.txt):
   ```powershell
   pip install -r requirements.txt
   ```
4. Inicia el servidor de desarrollo Flask ejecutando el archivo [backend/local_api.py](backend/local_api.py):
   ```powershell
   python local_api.py
   ```
   *Esto iniciará la API local en `http://127.0.0.1:5000`.*

### Paso 2: Abrir y ejecutar el frontend
Para ver la interfaz y el catálogo, debes servir o abrir la carpeta del frontend. Hay dos formas sencillas de hacerlo:

*   **Opción recomendada (Servidor local):**
    Abre una segunda terminal en la raíz del proyecto y ejecuta un servidor estático rápido con Python:
    ```powershell
    cd frontend
    python -m http.server 8000
    ```
    Luego, abre tu navegador web favorito e ingresa a: **`http://localhost:8000`**

*   **Opción alternativa (Abrir archivo directamente):**
    Simplemente navega con el explorador de archivos de tu sistema operativo hasta la carpeta del frontend y haz doble clic sobre el archivo [frontend/index.html](frontend/index.html) para abrirlo directamente en el navegador.

La aplicación local intentará conectarse primero con la API local configurada en `http://127.0.0.1:5000/api/vehicles`. Para su uso en producción, se configura el cliente de base de datos mediante el archivo [frontend/config.js](frontend/config.js).

## Supabase y GitHub Actions

1. Ejecutar `supabase_schema.sql` en el SQL Editor de Supabase.
2. Crear secretos de repositorio `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
3. Cada push a `main` sincroniza SQLite mediante `sync.yml`.
4. `update_prices.yml` actualiza referencias diariamente. Revisar términos, límites y permisos de cada fuente antes de activar scraping.
5. Para activar registro, recuperación de contraseña y publicación de vehículos, volver a ejecutar `supabase_schema.sql` en el SQL Editor. En Authentication → URL Configuration, agregar la URL de GitHub Pages como Site URL y Redirect URL.
6. Para consultar Mercado Libre, crear los secrets `MELI_CLIENT_ID`, `MELI_CLIENT_SECRET` y `MELI_REFRESH_TOKEN` obtenidos mediante el flujo OAuth de usuario. `MELI_ACCESS_TOKEN` puede mantenerse como respaldo. `client_credentials` no autoriza la búsqueda de publicaciones y no debe usarse para este endpoint.
7. Configurar esos mismos secrets en Supabase Edge Functions y desplegar la función después de cada cambio: `supabase secrets set MELI_CLIENT_ID=... MELI_CLIENT_SECRET=... MELI_REFRESH_TOKEN=... --project-ref <PROJECT_REF>` y `supabase functions deploy refresh-references --project-ref <PROJECT_REF>`. Los secrets de GitHub Actions no se copian automáticamente a Supabase.
8. Si después del deploy aparece `Token válido en /users/me` junto con `HTTP 403`, el token funciona y Mercado Libre está bloqueando la búsqueda por permisos, IP permitida o estado de la aplicación. Revisar la sección de IPs permitidas y scopes en DevCenter; la IP de una Edge Function puede no ser fija, por lo que debe quitarse una restricción de IP o solicitar a Mercado Libre una configuración compatible.

## Fotos de vehículos

El esquema crea el bucket público `vehicle-images`. Para subir fotos propias, crear `backend/.env` (no subirlo a Git) con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`, preparar una carpeta con fotos cuyo nombre sea el ID del vehículo (`1.jpg`, `2.jpg`, etc.) y ejecutar:

```powershell
backend/.venv/Scripts/python.exe backend/upload_vehicle_images.py fotos
```

El script sube cada archivo a Storage y actualiza `image_url` en SQLite. Después ejecutar `sync_to_supabase.py` para replicar esas URLs en Supabase.

El service role key solo vive en GitHub Actions; nunca debe llegar al frontend.
