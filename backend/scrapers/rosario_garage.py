"""Consulta avisos públicos de Rosario Garage."""
import re
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE_URL = 'https://www.rosariogarage.com'
HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36'}


def parse_price(value):
    match = re.search(r'\d[\d.]*', value)
    return int(match.group().replace('.', '')) if match else None


def fetch_listings(url):
    response = requests.get(url, headers=HEADERS, timeout=20)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, 'html.parser')
    listings = []
    for card in soup.select('.box_aviso_premium_base, .box_aviso_base'):
        title_node = card.select_one('.list_type_anuncio')
        price_node = card.select_one('.precio a, .precio')
        link_node = card.select_one('a[href*="showProduct"]')
        if not title_node or not price_node or not link_node:
            continue
        price = parse_price(price_node.get_text(' ', strip=True))
        if price is None:
            continue
        listings.append({'title': title_node.get_text(' ', strip=True), 'price_ars': price, 'url': urljoin(BASE_URL, link_node.get('href', '')), 'source': 'rosario_garage'})
    return listings


def search_listings(query, limit=3):
    section = 'Motos' if any(token in query.lower() for token in ('moto', 'himalayan', 'enfield', 'honda', 'yamaha', 'kawasaki', 'suzuki', 'ktm', 'benelli')) else 'Autos'
    listings = fetch_listings(f'{BASE_URL}/{section}')
    tokens = {token for token in re.findall(r'[a-z0-9]+', query.lower()) if len(token) > 2}
    ranked = sorted(listings, key=lambda item: len(tokens & set(re.findall(r'[a-z0-9]+', item['title'].lower()))), reverse=True)
    return [item for item in ranked if tokens & set(re.findall(r'[a-z0-9]+', item['title'].lower()))][:limit]
