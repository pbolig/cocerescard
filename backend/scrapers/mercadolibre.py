"""Consulta de referencias vía API oficial de Mercado Libre."""
import os
import requests

_access_token = None


def get_access_token():
    global _access_token
    if _access_token:
        return _access_token
    
    client_id = os.getenv('MELI_CLIENT_ID')
    client_secret = os.getenv('MELI_CLIENT_SECRET')
    refresh_token = os.getenv('MELI_REFRESH_TOKEN')

    if client_id and client_secret:
        try:
            # Prioritize client_credentials as it is stateless and doesn't expire/require updates
            response = requests.post('https://api.mercadolibre.com/oauth/token', data={
                'grant_type': 'client_credentials',
                'client_id': client_id,
                'client_secret': client_secret,
            }, timeout=20)
            if response.status_code == 200:
                _access_token = response.json()['access_token']
                return _access_token
        except requests.RequestException:
            pass

        if refresh_token:
            try:
                response = requests.post('https://api.mercadolibre.com/oauth/token', data={
                    'grant_type': 'refresh_token',
                    'client_id': client_id,
                    'client_secret': client_secret,
                    'refresh_token': refresh_token,
                }, timeout=20)
                if response.status_code == 200:
                    _access_token = response.json()['access_token']
                    return _access_token
            except requests.RequestException:
                pass

    _access_token = os.getenv('MELI_ACCESS_TOKEN')
    return _access_token


def search_listings(query, site='MLA', limit=10):
    url = f'https://api.mercadolibre.com/sites/{site}/search'
    headers = {}
    access_token = get_access_token()
    if access_token:
        headers['Authorization'] = f'Bearer {access_token}'
    response = requests.get(url, params={'q': query, 'limit': limit}, headers=headers, timeout=20)
    response.raise_for_status()
    return [{'title': item['title'], 'price_ars': item['price'], 'url': item['permalink'], 'source': 'mercadolibre'} for item in response.json().get('results', [])]


if __name__ == '__main__':
    print(search_listings(os.getenv('MELI_QUERY', 'Toyota Corolla 2022')))
