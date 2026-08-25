const localApi = 'http://127.0.0.1:5000/api/vehicles';
const config = window.APP_CONFIG || {};
const grid = document.querySelector('#vehicle-grid');
const status = document.querySelector('#status');
const search = document.querySelector('#search');
const dollarRates = document.querySelector('#dollar-rates');
let currentStatus = 'available';
let allVehicles = [];

const money = value => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
const sourceName = source => ({ mercadolibre: 'Mercado Libre', rosario_garage: 'Rosario Garage', official: 'Oficial' }[source] || source);

async function getVehicles() {
  const params = new URLSearchParams({ status: currentStatus });
  if (search.value) params.set('q', search.value);
  if (config.supabaseUrl && config.supabaseAnonKey) {
    const statusFilter = currentStatus === 'all' ? 'status=neq.sold' : `status=eq.${currentStatus}`;
    const response = await fetch(`${config.supabaseUrl}/rest/v1/vehicles?select=*,price_references(*)&${statusFilter}&order=updated_at.desc`, { headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${config.supabaseAnonKey}` } });
    if (!response.ok) throw new Error('No se pudo conectar con Supabase');
    return response.json();
  }
  const response = await fetch(`${localApi}?${params}`);
  if (!response.ok) throw new Error('API local no disponible');
  return response.json();
}

const dollarMoney = value => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);

async function loadDollarRates() {
  try {
    const response = await fetch('http://127.0.0.1:5000/api/dolar');
    if (!response.ok) throw new Error('Cotizaciones no disponibles');
    const data = await response.json();
    dollarRates.innerHTML = data.rates.map(rate => `<span title="${rate.source === 'bna' ? 'Banco Nación' : 'DolarHoy'}"><b>${rate.source === 'bna' ? 'BNA' : 'DH'}</b> ${dollarMoney(rate.buy)} / ${dollarMoney(rate.sell)}</span>`).join('');
  } catch (error) {
    dollarRates.innerHTML = '<span class="dollar-unavailable">No disponible</span>';
  }
}

function render(vehicles) {
  status.textContent = `${vehicles.length} vehículos encontrados`;
  grid.innerHTML = vehicles.map(vehicle => {
    const reference = vehicle.price_references?.length ? vehicle.price_references.reduce((sum, item) => sum + item.price_ars, 0) / vehicle.price_references.length : vehicle.price_ars;
    const difference = Math.round(((vehicle.price_ars - reference) / reference) * 100);
    return `<article class="vehicle-card"><div class="vehicle-image"><img src="${vehicle.image_url}" alt="${vehicle.title}" loading="lazy" onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 800 500%22%3E%3Crect width=%22800%22 height=%22500%22 fill=%22%23d8ded7%22/%3E%3Ctext x=%22400%22 y=%22260%22 text-anchor=%22middle%22 font-family=%22sans-serif%22 font-size=%2230%22 fill=%22%2317201e%22%3EImagen no disponible%3C/text%3E%3C/svg%3E'"><span class="card-status ${vehicle.status}">${vehicle.status === 'reserved' ? 'Reservado' : 'Disponible'}</span><button class="heart" aria-label="Guardar ${vehicle.title}">♡</button></div><div class="vehicle-info"><div class="vehicle-meta"><span>${vehicle.year}</span><span>${vehicle.mileage_km.toLocaleString('es-AR')} km</span><span>${vehicle.location.split(',')[0]}</span></div><h3>${vehicle.title}</h3><div class="price-row"><strong>${money(vehicle.price_ars)}</strong><span class="price-diff ${difference <= 0 ? 'good' : ''}">${difference <= 0 ? `${Math.abs(difference)}% bajo ref.` : `+${difference}% vs ref.`}</span></div><div class="references">${vehicle.price_references?.slice(0, 3).map(item => `<span><i class="dot ${item.source}"></i>${sourceName(item.source)} <b>${money(item.price_ars)}</b></span>`).join('') || ''}</div></div></article>`;
  }).join('');
}

async function load() { try { allVehicles = await getVehicles(); render(allVehicles); } catch (error) { status.textContent = 'Modo demo: iniciá la API local para ver datos actualizados.'; grid.innerHTML = ''; } }
search.addEventListener('input', load);
document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', () => { document.querySelector('.filter.active').classList.remove('active'); button.classList.add('active'); currentStatus = button.dataset.status; load(); }));
load();
loadDollarRates();
setInterval(loadDollarRates, 15 * 60 * 1000);
