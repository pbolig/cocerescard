"""Consulta de referencias vía API oficial de Mercado Libre."""
import os
import requests


def search_listings(query, site='MLA', limit=10):
    url = f'https://api.mercadolibre.com/sites/{site}/search'
    headers = {}
    if os.getenv('MELI_ACCESS_TOKEN'):
        headers['Authorization'] = f"Bearer {os.environ['MELI_ACCESS_TOKEN']}"
    response = requests.get(url, params={'q': query, 'limit': limit}, headers=headers, timeout=20)
    response.raise_for_status()
    return [{'title': item['title'], 'price_ars': item['price'], 'url': item['permalink'], 'source': 'mercadolibre'} for item in response.json().get('results', [])]


if __name__ == '__main__':
    print(search_listings(os.getenv('MELI_QUERY', 'Toyota Corolla 2022')))
