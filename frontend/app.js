const localApi = 'http://127.0.0.1:5000/api/vehicles';
const config = window.APP_CONFIG || {};
const grid = document.querySelector('#vehicle-grid');
const status = document.querySelector('#status');
const search = document.querySelector('#search');
const dollarRates = document.querySelector('#dollar-rates');
const supabaseClient = window.supabase && config.supabaseUrl && config.supabaseAnonKey ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;
const authButton = document.querySelector('#auth-button');
const authModal = document.querySelector('#auth-modal');
const authForm = document.querySelector('#auth-form');
const authTitle = document.querySelector('#auth-title');
const authEmail = document.querySelector('#auth-email');
const authPassword = document.querySelector('#auth-password');
const authPasswordLabel = document.querySelector('#auth-password-label');
const authSwitch = document.querySelector('#auth-switch');
const forgotPassword = document.querySelector('#forgot-password');
const authStatus = document.querySelector('#auth-status');
const publishPanel = document.querySelector('#publish-panel');
const vehicleForm = document.querySelector('#vehicle-form');
const formStatus = document.querySelector('#form-status');
let currentStatus = 'available';
let allVehicles = [];
let authMode = 'login';

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
    const isLocal = !window.location.hostname || ['127.0.0.1', 'localhost'].includes(window.location.hostname);
    const response = await fetch(isLocal ? 'http://127.0.0.1:5000/api/dolar' : 'dollar-rates.json?v=20260825');
    if (!response.ok) throw new Error('Cotizaciones no disponibles');
    const data = await response.json();
    const rates = data.rates;
    dollarRates.innerHTML = rates.map(rate => `<span title="${rate.source === 'bna' ? 'Banco Nación' : rate.source === 'dolarhoy' ? 'DolarHoy' : 'Referencia oficial'}"><b>${rate.source === 'bna' ? 'BNA' : rate.source === 'dolarhoy' ? 'DH' : 'Oficial'}</b> ${dollarMoney(rate.buy)} / ${dollarMoney(rate.sell)}</span>`).join('');
  } catch (error) {
    dollarRates.innerHTML = '<span class="dollar-unavailable">No disponible</span>';
  }
}

function showAuth(mode = 'login') {
  authMode = mode;
  authModal.hidden = false;
  authTitle.textContent = mode === 'signup' ? 'Crear cuenta' : mode === 'reset' ? 'Nueva contraseña' : 'Ingresar';
  authPasswordLabel.hidden = mode === 'recovery';
  authPassword.required = mode !== 'recovery';
  authEmail.hidden = mode === 'recovery';
  authSwitch.hidden = mode === 'recovery';
  forgotPassword.hidden = mode !== 'login';
  authStatus.textContent = '';
  if (mode === 'recovery') {
    authPasswordLabel.hidden = false;
    authPassword.required = true;
    authEmail.closest('label').hidden = true;
    authPasswordLabel.querySelector('input').autocomplete = 'new-password';
  } else {
    authEmail.closest('label').hidden = false;
  }
}

function closeAuth() {
  authModal.hidden = true;
  authForm.reset();
}

function showAuthStatus(message, error = false) {
  authStatus.textContent = message;
  authStatus.classList.toggle('error', error);
}

async function refreshAuth(session) {
  if (!session) {
    authButton.textContent = 'Ingresar';
    publishPanel.hidden = true;
    return;
  }
  authButton.textContent = 'Cerrar sesión';
  publishPanel.hidden = false;
}

async function handleAuth(event) {
  event.preventDefault();
  if (!supabaseClient) return showAuthStatus('Autenticación no disponible.', true);
  try {
    if (authMode === 'recovery') {
      await supabaseClient.auth.updateUser({ password: authPassword.value });
      showAuthStatus('Contraseña actualizada.');
      setTimeout(closeAuth, 1200);
    } else if (authMode === 'signup') {
      const { error } = await supabaseClient.auth.signUp({ email: authEmail.value, password: authPassword.value, options: { emailRedirectTo: window.location.href } });
      if (error) throw error;
      showAuthStatus('Revisá tu correo para confirmar la cuenta.');
    } else {
      const { error } = await supabaseClient.auth.signInWithPassword({ email: authEmail.value, password: authPassword.value });
      if (error) throw error;
      closeAuth();
    }
  } catch (error) {
    showAuthStatus(error.message || 'No se pudo completar la operación.', true);
  }
}

async function sendPasswordRecovery() {
  if (!supabaseClient) return showAuthStatus('Autenticación no disponible.', true);
  if (!authEmail.value) return showAuthStatus('Ingresá tu correo electrónico.', true);
  const { error } = await supabaseClient.auth.resetPasswordForEmail(authEmail.value, { redirectTo: window.location.href });
  showAuthStatus(error ? error.message : 'Te enviamos un enlace para recuperar la contraseña.');
}

async function publishVehicle(event) {
  event.preventDefault();
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return showAuthStatus('Iniciá sesión para publicar.', true);
  const values = Object.fromEntries(new FormData(vehicleForm));
  const photo = values.photo;
  formStatus.textContent = 'Publicando...';
  try {
    const extension = photo.name.split('.').pop().toLowerCase();
    const path = `${session.user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabaseClient.storage.from('vehicle-images').upload(path, photo, { contentType: photo.type, upsert: false });
    if (uploadError) throw uploadError;
    const { data: imageData } = supabaseClient.storage.from('vehicle-images').getPublicUrl(path);
    const { error: insertError } = await supabaseClient.from('vehicles').insert({ seller_id: session.user.id, title: values.title, brand: values.brand, model: values.model, year: Number(values.year), price_ars: Number(values.price_ars), mileage_km: Number(values.mileage_km), location: values.location, image_url: imageData.publicUrl, description: values.description, status: 'available' });
    if (insertError) throw insertError;
    vehicleForm.reset();
    formStatus.textContent = 'Vehículo publicado. Las referencias de mercado se actualizarán en la próxima corrida.';
    await load();
  } catch (error) {
    formStatus.textContent = error.message || 'No se pudo publicar el vehículo.';
    formStatus.classList.add('error');
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

authButton.addEventListener('click', async () => {
  const { data: { session } } = supabaseClient ? await supabaseClient.auth.getSession() : { data: { session: null } };
  if (session) await supabaseClient.auth.signOut();
  else showAuth();
});
document.querySelector('#auth-close').addEventListener('click', closeAuth);
authSwitch.addEventListener('click', () => showAuth(authMode === 'login' ? 'signup' : 'login'));
forgotPassword.addEventListener('click', sendPasswordRecovery);
authForm.addEventListener('submit', handleAuth);
vehicleForm.addEventListener('submit', publishVehicle);
if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    refreshAuth(session);
    if (_event === 'PASSWORD_RECOVERY') showAuth('recovery');
  });
  supabaseClient.auth.getSession().then(({ data: { session } }) => refreshAuth(session));
}
