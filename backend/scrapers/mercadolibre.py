"""Consulta de referencias vía API oficial de Mercado Libre."""
import os
import requests
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(ROOT / '.env')
load_dotenv(ROOT / 'backend' / '.env')

_access_token = None


def get_access_token():
    global _access_token
    if _access_token:
        return _access_token
    
    client_id = os.getenv('MELI_CLIENT_ID')
    client_secret = os.getenv('MELI_CLIENT_SECRET')
    refresh_token = os.getenv('MELI_REFRESH_TOKEN')

    if client_id and client_secret:
        if refresh_token:
            response = requests.post('https://api.mercadolibre.com/oauth/token', data={
                'grant_type': 'refresh_token',
                'client_id': client_id,
                'client_secret': client_secret,
                'refresh_token': refresh_token,
            }, timeout=20)
            if response.status_code == 200:
                data = response.json()
                _access_token = data.get('access_token')
                new_refresh_token = data.get('refresh_token')
                if new_refresh_token:
                    os.environ['MELI_REFRESH_TOKEN'] = new_refresh_token
                    try:
                        env_path = ROOT / 'backend' / '.env'
                        if not env_path.exists():
                            env_path = ROOT / '.env'
                        if env_path.exists():
                            lines = env_path.read_text(encoding='utf-8').splitlines()
                            new_lines = []
                            found = False
                            for line in lines:
                                if line.startswith('MELI_REFRESH_TOKEN='):
                                    new_lines.append(f'MELI_REFRESH_TOKEN={new_refresh_token}')
                                    found = True
                                else:
                                    new_lines.append(line)
                            if not found:
                                new_lines.append(f'MELI_REFRESH_TOKEN={new_refresh_token}')
                            env_path.write_text('\n'.join(new_lines) + '\n', encoding='utf-8')
                    except Exception:
                        pass
                return _access_token

    _access_token = os.getenv('MELI_ACCESS_TOKEN')
    return _access_token


def search_listings(query, site='MLA', limit=10):
    url = f'https://api.mercadolibre.com/sites/{site}/search'
    headers = {}
    access_token = get_access_token()
    if not access_token:
        raise requests.HTTPError('Mercado Libre: falta un access token de usuario')
    headers['Authorization'] = f'Bearer {access_token}'
    user_response = requests.get('https://api.mercadolibre.com/users/me', headers=headers, timeout=20)
    user_response.raise_for_status()
    response = requests.get(url, params={'q': query, 'limit': limit}, headers=headers, timeout=20)
    if response.status_code == 403:
        raise requests.HTTPError(f'Mercado Libre: HTTP 403 forbidden; token válido en /users/me. Revisar IP permitida, scopes y estado de la aplicación')
    response.raise_for_status()
    return [{'title': item['title'], 'price_ars': item['price'], 'url': item['permalink'], 'source': 'mercadolibre'} for item in response.json().get('results', [])]


if __name__ == '__main__':
    print(search_listings(os.getenv('MELI_QUERY', 'Toyota Corolla 2022')))
