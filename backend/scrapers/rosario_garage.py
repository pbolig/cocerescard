"""Adapter inicial para Rosario Garage.

Usar solo endpoints y contenido permitidos por sus términos y robots.txt.
La salida se normaliza para que el pipeline pueda guardarla en price_references.
"""
import requests
from bs4 import BeautifulSoup


def fetch_listings(url):
    response = requests.get(url, timeout=20, headers={'User-Agent': 'CoceresCard price research/1.0'})
    response.raise_for_status()
    soup = BeautifulSoup(response.text, 'html.parser')
    return [{'title': node.get_text(' ', strip=True), 'source': 'rosario_garage'} for node in soup.select('[data-vehicle-title]')]
