const localApi = 'http://127.0.0.1:5000/api/vehicles';
const config = window.APP_CONFIG || {};
const grid = document.querySelector('#vehicle-grid');
const status = document.querySelector('#status');
const search = document.querySelector('#search');
const dollarRates = document.querySelector('#dollar-rates');
const supabaseClient = window.supabase && config.supabaseUrl && config.supabaseAnonKey ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;
const userStatus = document.querySelector('#user-status');
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

// Elementos del modal de consultas
const inquiryModal = document.querySelector('#inquiry-modal');
const inquiryForm = document.querySelector('#inquiry-form');
const inquiryVehicleId = document.querySelector('#inquiry-vehicle-id');
const inquiryVehicleTitle = document.querySelector('#inquiry-vehicle-title');
const inquiryMessage = document.querySelector('#inquiry-message');
const inquiryStatus = document.querySelector('#inquiry-status');

let currentStatus = 'available';
let allVehicles = [];
let authMode = 'login';
let currentUserProfile = null;

const money = value => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
const sourceName = source => ({ mercadolibre: 'Mercado Libre', rosario_garage: 'Rosario Garage', official: 'Oficial' }[source] || source);

async function getVehicles() {
  const params = new URLSearchParams({ status: currentStatus });
  if (search.value) params.set('q', search.value);
  
  // Condición inteligente: si estamos interactuando de forma local, leemos de la API local
  const isLocal = !window.location.hostname || ['127.0.0.1', 'localhost'].includes(window.location.hostname);
  
  if (!isLocal && config.supabaseUrl && config.supabaseAnonKey) {
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
  authStatus.textContent = '';
  
  if (mode === 'signup') {
    authTitle.textContent = 'Crear cuenta';
    authSwitch.textContent = 'Iniciar sesión';
    authSwitch.hidden = false;
    authPasswordLabel.style.display = '';
    authPassword.required = true;
    authEmail.closest('label').style.display = '';
    forgotPassword.hidden = true;
  } else if (mode === 'forgot') {
    authTitle.textContent = 'Recuperar contraseña';
    authSwitch.textContent = 'Iniciar sesión';
    authSwitch.hidden = false;
    authPasswordLabel.style.display = 'none';
    authPassword.required = false;
    authEmail.closest('label').style.display = '';
    forgotPassword.hidden = true;
  } else if (mode === 'recovery') {
    authTitle.textContent = 'Nueva contraseña';
    authSwitch.hidden = true;
    authPasswordLabel.style.display = '';
    authPassword.required = true;
    authEmail.closest('label').style.display = 'none';
    authPasswordLabel.querySelector('input').autocomplete = 'new-password';
    forgotPassword.hidden = true;
  } else {
    authTitle.textContent = 'Ingresar';
    authSwitch.textContent = 'Crear cuenta';
    authSwitch.hidden = false;
    authPasswordLabel.style.display = '';
    authPassword.required = true;
    authEmail.closest('label').style.display = '';
    forgotPassword.hidden = false;
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

async function fetchUserProfile(userId) {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  if (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
  return data;
}

const adminPanel = document.querySelector('#admin-panel');
const inquiriesPanel = document.querySelector('#inquiries-panel');

async function updateRoleBasedUI(profile) {
  if (!profile) {
    if (adminPanel) adminPanel.hidden = true;
    if (inquiriesPanel) inquiriesPanel.hidden = true;
    publishPanel.hidden = true;
    return;
  }

  const role = profile.role;
  
  if (role === 'admin') {
    if (adminPanel) {
      adminPanel.hidden = false;
      loadAdminUsers();
    }
    if (inquiriesPanel) {
      inquiriesPanel.hidden = false;
      loadReceivedInquiries(true); // true = todas las consultas
    }
    publishPanel.hidden = false;
  } else if (role === 'vendedor') {
    if (adminPanel) adminPanel.hidden = true;
    if (inquiriesPanel) {
      inquiriesPanel.hidden = false;
      loadReceivedInquiries(false); // false = sólo sus consultas
    }
    publishPanel.hidden = false;
  } else {
    // comprador
    if (adminPanel) adminPanel.hidden = true;
    if (inquiriesPanel) inquiriesPanel.hidden = true;
    publishPanel.hidden = true;
  }
}

async function loadAdminUsers() {
  if (!supabaseClient) return;
  const { data: profiles, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true });
    
  if (error) {
    console.error('Error loading profiles:', error);
    return;
  }
  
  const tbody = document.querySelector('#admin-users-table');
  if (!tbody) return;
  
  tbody.innerHTML = profiles.map(user => `
    <tr style="border-bottom:1px solid var(--line);">
      <td style="padding:10px; font-weight:500;">${user.email}</td>
      <td style="padding:10px;"><span class="badge ${user.role}" style="padding:3px 8px; border-radius:4px; font-weight:bold; font-size:10px; background:${user.role === 'admin' ? '#ffe8d6' : user.role === 'vendedor' ? '#d8f3dc' : '#ece4db'}; color:var(--ink);">${user.role.toUpperCase()}</span></td>
      <td style="padding:10px; text-align:right;">
        <select onchange="changeUserRole('${user.id}', this.value)" style="padding:4px 8px; font-size:11px; border:1px solid var(--line); font-family:'DM Sans';">
          <option value="comprador" ${user.role === 'comprador' ? 'selected' : ''}>Comprador</option>
          <option value="vendedor" ${user.role === 'vendedor' ? 'selected' : ''}>Vendedor</option>
          <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrador</option>
        </select>
      </td>
    </tr>
  `).join('');
}

window.changeUserRole = async function(userId, newRole) {
  if (!supabaseClient) return;
  try {
    const { error } = await supabaseClient
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);
      
    if (error) throw error;
    
    loadAdminUsers();
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session && session.user.id === userId) {
      const profile = await fetchUserProfile(userId);
      updateRoleBasedUI(profile);
    }
  } catch (error) {
    alert('Error al actualizar rol: ' + error.message);
  }
};

async function loadReceivedInquiries(all = false) {
  if (!supabaseClient) return;
  const inquiriesList = document.querySelector('#inquiries-list');
  if (!inquiriesList) return;
  
  inquiriesList.innerHTML = '<p class="status">Cargando consultas...</p>';
  
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;
    
    // Consulta flexible para incluir consultas históricas donde el vehículo original se eliminó
    let query = supabaseClient
      .from('inquiries')
      .select('*, vehicles(title, seller_id), profiles:buyer_id(email)');
      
    if (!all) {
      // Filtrar por ID de vendedor (dueño del auto activo u dueño del cache guardado)
      query = query.or(`seller_id_cache.eq.${session.user.id},vehicles.seller_id.eq.${session.user.id}`);
    }
    
    const { data: inquiries, error } = await query.order('created_at', { ascending: false });
    
    if (error) throw error;
    
    if (!inquiries || inquiries.length === 0) {
      inquiriesList.innerHTML = '<p class="status" style="font-style:italic; color:var(--muted); margin:0;">No se han recibido consultas todavía.</p>';
      return;
    }
    
    inquiriesList.innerHTML = inquiries.map(inq => {
      const date = new Date(inq.created_at).toLocaleString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      const buyerEmail = inq.profiles?.email || 'Comprador';
      
      // Si el vehículo ya no existe, usamos el caché histórico
      const isDeleted = !inq.vehicles;
      const vehicleTitle = isDeleted 
        ? `${inq.vehicle_title_cache || 'Vehículo'} [Anuncio dado de baja]` 
        : (inq.vehicles?.title || 'Vehículo');
        
      const sellerId = isDeleted ? inq.seller_id_cache : inq.vehicles?.seller_id;
      
      return `
        <article class="inquiry-card" style="background:var(--paper); border:1px solid var(--line); padding:20px; display:grid; gap:12px; ${isDeleted ? 'opacity:0.8; border-color:#f5c2c2;' : ''}">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
            <h4 style="font-family:\'Space Grotesk\', sans-serif; font-size:16px; margin:0; color:${isDeleted ? '#bd4c38' : 'var(--ink)'}; font-weight:700;">${vehicleTitle}</h4>
            <span style="font-size:11px; padding:3px 8px; border-radius:4px; font-weight:bold; background:${isDeleted ? '#fbebeb' : '#e8efe8'}; color:${isDeleted ? '#bd4c38' : 'var(--ink)'}">${date}</span>
          </div>
          <div style="font-size:11px; color:var(--muted); display:flex; gap:15px; border-bottom:1px solid #edf0ec; padding-bottom:8px;">
            <span><b>Por:</b> ${buyerEmail}</span>
            <span><b>Publicador:</b> ${sellerId === session.user.id ? 'Tuyo' : 'Consignado'}</span>
          </div>
          <p style="font-size:13px; line-height:1.4; color:var(--ink); background:rgba(23,32,30,.03); padding:10px; border-left:3px solid ${isDeleted ? '#bd4c38' : 'var(--orange)'}; margin:0;">
            ${inq.message}
          </p>
        </article>
      `;
    }).join('');
    
  } catch (err) {
    console.error('Error loading inquiries:', err);
    inquiriesList.innerHTML = '<p class="status error">No se pudieron cargar las consultas.</p>';
  }
}

async function refreshAuth(session) {
  if (!session) {
    if (userStatus) userStatus.textContent = 'No hay usuario activo';
    authButton.textContent = 'Ingresar';
    currentUserProfile = null;
    updateRoleBasedUI(null);
    render(allVehicles); // Volver a renderizar para ocultar botones de administración en las tarjetas si existían
    return;
  }
  const email = session.user?.email || 'Usuario activo';
  if (userStatus) userStatus.textContent = email;
  authButton.textContent = 'Cerrar sesión';
  
  currentUserProfile = await fetchUserProfile(session.user.id);
  updateRoleBasedUI(currentUserProfile);
  render(allVehicles); // Re-renderizar para mostrar los botones de edición/borrado de tarjetas según el rol
}

async function handleAuth(event) {
  event.preventDefault();
  if (!supabaseClient) return showAuthStatus('Autenticación no disponible.', true);
  try {
    if (authMode === 'recovery') {
      await supabaseClient.auth.updateUser({ password: authPassword.value });
      showAuthStatus('Contraseña actualizada.');
      setTimeout(closeAuth, 1200);
    } else if (authMode === 'forgot') {
      if (!authEmail.value) return showAuthStatus('Ingresá tu correo electrónico.', true);
      const { error } = await supabaseClient.auth.resetPasswordForEmail(authEmail.value, { redirectTo: window.location.href });
      if (error) throw error;
      showAuthStatus('Te enviamos un enlace para recuperar la contraseña.');
    } else if (authMode === 'signup') {
      const { data, error } = await supabaseClient.auth.signUp({ email: authEmail.value, password: authPassword.value, options: { emailRedirectTo: window.location.href } });
      if (error) throw error;
      if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        showAuthStatus('El correo ya está registrado. Por favor, iniciá sesión.', true);
        return;
      }
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

// Función para comprimir una imagen usando Canvas API en el navegador, reduciendo y optimizando al máximo
async function compressImage(file, maxWidth = 800, maxHeight = 500, quality = 0.65) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = event => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Escalamos las fotos de manera estricta para reducir los píxeles (ideal para el tamaño del card 260px)
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Suavizado de imagen para evitar pixelado al reducir
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(blob => {
          if (blob) {
            resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
              type: 'image/webp',
              lastModified: Date.now()
            }));
          } else {
            resolve(file); // Fallback al original si falla blob
          }
        }, 'image/webp', quality);
      };
      img.onerror = err => reject(err);
    };
    reader.onerror = err => reject(err);
  });
}

async function publishVehicle(event) {
  event.preventDefault();
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return showAuthStatus('Iniciá sesión para publicar.', true);
  const formData = new FormData(vehicleForm);
  const values = Object.fromEntries(formData);
  const fileInput = vehicleForm.querySelector('input[type="file"]');
  const files = fileInput && fileInput.files ? Array.from(fileInput.files) : [];
  
  if (files.length === 0) return showAuthStatus('Debe seleccionar al menos una fotografía.', true);
  
  formStatus.textContent = 'Optimizando e instalando imágenes (0%)...';
  formStatus.classList.remove('error');
  
  try {
    const uploadedUrls = [];
    
    for (let i = 0; i < files.length; i++) {
      formStatus.textContent = `Comprimiendo y optimizando imagen ${i + 1} de ${files.length}...`;
      const compressedFile = await compressImage(files[i]);
      
      const extension = 'webp';
      const path = `${session.user.id}/${crypto.randomUUID()}.${extension}`;
      
      formStatus.textContent = `Subiendo imagen ${i + 1} de ${files.length}...`;
      const { error: uploadError } = await supabaseClient.storage
        .from('vehicle-images')
        .upload(path, compressedFile, { contentType: 'image/webp', upsert: false });
        
      if (uploadError) throw uploadError;
      
      const { data: imageData } = supabaseClient.storage.from('vehicle-images').getPublicUrl(path);
      uploadedUrls.push(imageData.publicUrl);
    }

    formStatus.textContent = 'Registrando publicación...';
    
    const isLocal = !window.location.hostname || ['127.0.0.1', 'localhost'].includes(window.location.hostname);
    
    const primaryUrl = uploadedUrls[0];
    const payload = {
      seller_id: session.user.id,
      title: values.title,
      brand: values.brand,
      model: values.model,
      year: Number(values.year),
      price_ars: Number(values.price_ars),
      mileage_km: Number(values.mileage_km),
      location: values.location,
      image_url: primaryUrl,
      image_urls: uploadedUrls,
      description: values.description,
      status: 'available'
    };

    if (isLocal) {
      const response = await fetch(localApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Error al registrar publicación de manera local');
    } else {
      const { error: insertError } = await supabaseClient.from('vehicles').insert(payload);
      if (insertError) throw insertError;
    }

    vehicleForm.reset();
    formStatus.textContent = '¡Vehículo publicado con éxito! Las referencias se actualizarán en la próxima corrida.';
    load(); // Recargar grilla
  } catch (error) {
    formStatus.textContent = error.message || 'No se pudo publicar el vehículo.';
    formStatus.classList.add('error');
  }
}

async function refreshReferences(vehicleId, button, output) {
  const isLocal = ['127.0.0.1', 'localhost'].includes(window.location.hostname);
  const baseUrl = isLocal ? `${localApi}/${vehicleId}/refresh-references` : config.referenceApiUrl ? `${config.referenceApiUrl}/refresh-references` : '';
  if (!baseUrl) {
    output.textContent = 'Refresco manual no disponible en producción todavía.';
    return;
  }
  button.disabled = true;
  button.textContent = 'Actualizando...';
  output.innerHTML = '<span class="reference-status pending">Consultando fuentes...</span>';
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) throw new Error('Iniciá sesión para actualizar referencias');
    const targetVehicle = allVehicles.find(v => String(v.id) === String(vehicleId));
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, apikey: config.supabaseAnonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehicle_id: Number(vehicleId),
        brand: targetVehicle?.brand,
        model: targetVehicle?.model,
        year: targetVehicle?.year
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo actualizar');

    let updatedVehicle = null;
    try {
      if (!isLocal && config.supabaseUrl && config.supabaseAnonKey) {
        const url = `${config.supabaseUrl}/rest/v1/vehicles?select=*,price_references(*)&id=eq.${vehicleId}`;
        const res = await fetch(url, { cache: 'no-store', headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${session.access_token}` } });
        if (res.ok) {
          const list = await res.json();
          if (list && list.length > 0) updatedVehicle = list[0];
        }
      } else {
        const res = await fetch(`${localApi}/${vehicleId}`);
        if (res.ok) updatedVehicle = await res.json();
      }
    } catch (e) {
      console.error('Error fetching updated references:', e);
    }

    output.innerHTML = data.results.filter(result => result.source !== 'official').map(result => {
      const label = result.source === 'mercadolibre' ? 'Mercado Libre' : result.source === 'rosario_garage' ? 'Rosario Garage' : 'Oficial';
      const detail = result.status === 'ok' ? `OK · ${result.count} avisos` : result.status === 'no_results' ? 'Sin resultados' : result.status === 'unavailable' ? 'No configurado' : 'Error';
      const copy = result.status === 'error' ? `<button class="copy-error" type="button" data-error="${encodeURIComponent(result.message)}">Copiar error</button>` : '';
      
      let refsHtml = '';
      if (updatedVehicle) {
        const sourceRefs = (updatedVehicle.price_references || []).filter(r => r.source === result.source);
        if (sourceRefs.length > 0) {
          refsHtml = '<div style="margin-top: 4px; padding-left: 15px; display: flex; flex-direction: column; gap: 4px;">' + 
            sourceRefs.map(r => `<span class="reference-price"><b>${money(r.price_ars)}</b>${r.url ? `<a href="${r.url}" target="_blank" rel="noopener">Ver aviso</a>` : ''}</span>`).join('') +
            '</div>';
        }
      }

      return `<div style="margin-bottom: 8px;"><span class="reference-status ${result.status}"><i class="dot ${result.source}"></i>${label}<b>${detail}</b>${copy}</span>${refsHtml}</div>`;
    }).join('');

    if (updatedVehicle) {
      const index = allVehicles.findIndex(v => String(v.id) === String(updatedVehicle.id));
      if (index !== -1) {
        allVehicles[index] = updatedVehicle;
      }
      const reference = updatedVehicle.price_references?.length ? updatedVehicle.price_references.reduce((sum, item) => sum + item.price_ars, 0) / updatedVehicle.price_references.length : updatedVehicle.price_ars;
      const difference = Math.round(((updatedVehicle.price_ars - reference) / reference) * 100);
      const card = document.querySelector(`.vehicle-card[data-vehicle-id="${vehicleId}"]`);
      if (card) {
        const referencesOutput = card.querySelector('[data-reference-values]');
        if (referencesOutput) referencesOutput.innerHTML = renderReferenceValues(updatedVehicle);
        const diffSpan = card.querySelector('.price-diff');
        if (diffSpan) {
          diffSpan.className = `price-diff ${difference <= 0 ? 'good' : ''}`;
          diffSpan.textContent = difference <= 0 ? `${Math.abs(difference)}% bajo ref.` : `+${difference}% vs ref.`;
        }
      }
    }
  } catch (error) {
    output.innerHTML = `<span class="reference-status error">Error: ${error.message} <button class="copy-error" type="button" data-error="${encodeURIComponent(error.message)}">Copiar error</button></span>`;
  } finally {
    button.disabled = false;
    button.textContent = 'Actualizar comparación';
  }
}

function renderReferenceValues(vehicle) {
  const referencesBySource = Object.groupBy?.(vehicle.price_references || [], item => item.source) || (vehicle.price_references || []).reduce((groups, item) => ({ ...groups, [item.source]: [...(groups[item.source] || []), item] }), {});
  return ['mercadolibre', 'rosario_garage'].map(source => {
    const items = referencesBySource[source] || [];
    const content = items.length ? items.map(item => `<span class="reference-price"><b>${money(item.price_ars)}</b>${item.url ? `<a href="${item.url}" target="_blank" rel="noopener">Ver aviso</a>` : ''}</span>`).join('') : `<span class="references-pending">Pendiente de actualización</span>`;
    return `<div class="reference-source"><span><i class="dot ${source}"></i>${sourceName(source)}</span><div>${content}</div></div>`;
  }).join('');
}

function render(vehicles) {
  status.textContent = `${vehicles.length} vehículos encontrados`;
  
  const userId = supabaseClient?.auth?.session?.()?.user?.id || supabaseClient?.auth?.user?.()?.id; // Intento rápido
  // Pero más seguro mediante getSession o nuestra variable global currentUserProfile

  grid.innerHTML = vehicles.map(vehicle => {
    const reference = vehicle.price_references?.length ? vehicle.price_references.reduce((sum, item) => sum + item.price_ars, 0) / vehicle.price_references.length : vehicle.price_ars;
    const difference = Math.round(((vehicle.price_ars - reference) / reference) * 100);
    
    // Validar si el usuario logeado es el dueño o admin para poder modificar/eliminar
    const isOwner = currentUserProfile && vehicle.seller_id === currentUserProfile.id;
    const isAdmin = currentUserProfile && currentUserProfile.role === 'admin';
    const isSeller = currentUserProfile && currentUserProfile.role === 'vendedor';
    
    let adminCardActionsHtml = '';
    if (isAdmin || (isSeller && isOwner)) {
      adminCardActionsHtml = `
        <div class="card-admin-actions" style="margin-top:10px; display:flex; gap:8px; border-top:1px solid var(--line); padding-top:10px;">
          <button class="edit-vehicle-btn button" data-vehicle-id="${vehicle.id}" style="padding:6px 12px; font-size:10px; background:#eef2ee; border:1px solid var(--line); cursor:pointer; width:100%; justify-content:center;">Editar ✎</button>
          <button class="delete-vehicle-btn button" data-vehicle-id="${vehicle.id}" data-vehicle-title="${vehicle.title}" style="padding:6px 12px; font-size:10px; background:#fbebeb; color:#bd4c38; border:1px solid #f5c2c2; cursor:pointer; width:100%; justify-content:center;">Eliminar 🗑</button>
        </div>
      `;
    }

    // Armado del Carrusel de Fotos
    let images = [];
    if (vehicle.image_urls && Array.isArray(vehicle.image_urls) && vehicle.image_urls.length > 0) {
      images = vehicle.image_urls;
    } else if (vehicle.image_url) {
      images = [vehicle.image_url];
    } else {
      images = ['data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 800 500%22%3E%3Crect width=%22800%22 height=%22500%22 fill=%22%23d8ded7%22/%3E%3Ctext x=%22400%22 y=%22260%22 text-anchor=%22middle%22 font-family=%22sans-serif%22 font-size=%2230%22 fill=%22%2317201e%22%3EImagen no disponible%3C/text%3E%3C/svg%3E'];
    }

    let carouselSlidesHtml = images.map((img, i) => `
      <img src="${img}" alt="${vehicle.title}" class="carousel-slide ${i === 0 ? 'active' : ''}" style="width:100%; height:100%; object-fit:cover; display:${i === 0 ? 'block' : 'none'}; position:absolute; inset:0; transition:opacity 0.4s ease;" loading="lazy" onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 800 500%22%3E%3Crect width=%22800%22 height=%22500%22 fill=%22%23d8ded7%22/%3E%3Ctext x=%22400%22 y=%22260%22 text-anchor=%22middle%22 font-family=%22sans-serif%22 font-size=%2230%22 fill=%22%2317201e%22%3EImagen no disponible%3C/text%3E%3C/svg%3E'""">
    `).join('');

    let carouselControlsHtml = '';
    if (images.length > 1) {
      carouselControlsHtml = `
        <button class="carousel-btn prev" onclick="changeSlide(this, -1)" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); background:rgba(23,32,30,0.6); color:#fff; border:0; width:28px; height:28px; border-radius:50%; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0; z-index:2; font-size:12px;">⟨</button>
        <button class="carousel-btn next" onclick="changeSlide(this, 1)" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:rgba(23,32,30,0.6); color:#fff; border:0; width:28px; height:28px; border-radius:50%; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0; z-index:2; font-size:12px;">⟩</button>
        <div class="carousel-indicator" style="position:absolute; bottom:10px; right:10px; background:rgba(23,32,30,0.6); color:#fff; font-size:9px; font-weight:700; padding:3px 8px; border-radius:10px; z-index:2;">1 de ${images.length}</div>
      `;
    }

    return `<article class="vehicle-card" data-vehicle-id="${vehicle.id}"><div class="vehicle-image" style="position:relative; height:260px; overflow:hidden;">${carouselSlidesHtml}${carouselControlsHtml}<span class="card-status ${vehicle.status}">${vehicle.status === 'reserved' ? 'Reservado' : 'Disponible'}</span><button class="heart" aria-label="Guardar ${vehicle.title}" style="z-index:2;">♡</button></div><div class="vehicle-info"><div class="vehicle-meta"><span>${vehicle.year}</span><span>${vehicle.mileage_km.toLocaleString('es-AR')} km</span><span>${vehicle.location.split(',')[0]}</span></div><h3>${vehicle.title}</h3><div class="price-row"><strong>${money(vehicle.price_ars)}</strong><span class="price-diff ${difference <= 0 ? 'good' : ''}">${difference <= 0 ? `${Math.abs(difference)}% bajo ref.` : `+${difference}% vs ref.`}</span></div><details class="references-dropdown"><summary>Comparar referencias</summary><div class="references" data-reference-values>${renderReferenceValues(vehicle)}</div></details><button class="refresh-references" type="button" data-refresh-id="${vehicle.id}">Actualizar comparación</button><div class="refresh-result" data-refresh-output aria-live="polite"></div><button class="contact-seller button button-dark" type="button" data-vehicle-id="${vehicle.id}" data-vehicle-title="${vehicle.title}" style="border:0; cursor:pointer; margin-top:14px; width:100%; justify-content:center; padding:10px; font-size:11px;">Contactar Vendedor <span>✉</span></button>${adminCardActionsHtml}</div></article>`;
  }).join('');
}

// Ventana global para manejar el cambio de slides del carrusel en el browser
window.changeSlide = function(button, dir) {
  const container = button.closest('.vehicle-image');
  const slides = Array.from(container.querySelectorAll('.carousel-slide'));
  const indicator = container.querySelector('.carousel-indicator');
  if (slides.length <= 1) return;
  
  let activeIndex = slides.findIndex(s => s.style.display === 'block');
  
  // Ocultar anterior
  slides[activeIndex].style.display = 'none';
  
  // Calcular nuevo índice circular
  activeIndex = (activeIndex + dir + slides.length) % slides.length;
  
  // Mostrar nueva imagen
  slides[activeIndex].style.display = 'block';
  
  // Actualizar indicador númerico
  if (indicator) {
    indicator.textContent = `${activeIndex + 1} de ${slides.length}`;
  }
};

async function load() { try { allVehicles = await getVehicles(); render(allVehicles); } catch (error) { status.textContent = 'Modo demo: iniciá la API local para ver datos actualizados.'; grid.innerHTML = ''; } }
search.addEventListener('input', load);
document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', () => { document.querySelector('.filter.active').classList.remove('active'); button.classList.add('active'); currentStatus = button.dataset.status; load(); }));
grid.addEventListener('click', async event => {
  const refreshButton = event.target.closest('[data-refresh-id]');
  if (refreshButton) refreshReferences(refreshButton.dataset.refreshId, refreshButton, refreshButton.nextElementSibling);
  const copyButton = event.target.closest('.copy-error');
  if (copyButton) navigator.clipboard.writeText(decodeURIComponent(copyButton.dataset.error)).then(() => { copyButton.textContent = 'Copiado'; });
  
  // Manejador del botón Contactar Vendedor
  const contactButton = event.target.closest('.contact-seller');
  if (contactButton) {
    const { data: { session } } = supabaseClient ? await supabaseClient.auth.getSession() : { data: { session: null } };
    if (!session) {
      showAuth();
      showAuthStatus('Iniciá sesión para contactar al vendedor.', true);
      return;
    }
    const vehicleId = contactButton.dataset.vehicleId;
    const vehicleTitle = contactButton.dataset.vehicleTitle;
    showInquiryModal(vehicleId, vehicleTitle);
  }

  // Manejador del botón Editar Vehículo
  const editButton = event.target.closest('.edit-vehicle-btn');
  if (editButton) {
    const vehicleId = editButton.dataset.vehicleId;
    const vehicle = allVehicles.find(v => String(v.id) === String(vehicleId));
    if (vehicle) showEditModal(vehicle);
  }

  // Manejador del botón Eliminar Vehículo
  const deleteButton = event.target.closest('.delete-vehicle-btn');
  if (deleteButton) {
    const vehicleId = deleteButton.dataset.vehicleId;
    const vehicleTitle = deleteButton.dataset.vehicleTitle;
    if (confirm(`¿Estás seguro de que deseas eliminar permanentemente el vehículo: "${vehicleTitle}"?`)) {
      await handleDeleteVehicle(vehicleId);
    }
  }
});

const editVehicleModal = document.querySelector('#edit-vehicle-modal');
const editVehicleForm = document.querySelector('#edit-vehicle-form');
const editVehicleId = document.querySelector('#edit-vehicle-id');
const editTitle = document.querySelector('#edit-title');
const editBrand = document.querySelector('#edit-brand');
const editModel = document.querySelector('#edit-model');
const editYear = document.querySelector('#edit-year');
const editPrice = document.querySelector('#edit-price');
const editMileage = document.querySelector('#edit-mileage');
const editStatusSel = document.querySelector('#edit-status');
const editLocation = document.querySelector('#edit-location');
const editDescription = document.querySelector('#edit-description');
const editFormStatus = document.querySelector('#edit-form-status');
const editPhotosContainer = document.querySelector('#edit-photos-container');
const editPhotosUpload = document.querySelector('#edit-photos-upload');

let currentEditingImageUrls = []; // Almacenará las URLs de las fotos del vehículo que estamos editando actualmente

function showEditModal(vehicle) {
  if (!editVehicleModal) return;
  editVehicleModal.hidden = false;
  editVehicleId.value = vehicle.id;
  editTitle.value = vehicle.title;
  editBrand.value = vehicle.brand;
  editModel.value = vehicle.model;
  editYear.value = vehicle.year;
  editPrice.value = vehicle.price_ars;
  editMileage.value = vehicle.mileage_km;
  editStatusSel.value = vehicle.status;
  editLocation.value = vehicle.location;
  editDescription.value = vehicle.description || '';
  editFormStatus.textContent = '';
  if (editPhotosUpload) editPhotosUpload.value = ''; // Resetear el input de archivos nuevos
  
  // Clonar/guardar la lista actual de fotos
  if (vehicle.image_urls && Array.isArray(vehicle.image_urls) && vehicle.image_urls.length > 0) {
    currentEditingImageUrls = [...vehicle.image_urls];
  } else if (vehicle.image_url) {
    currentEditingImageUrls = [vehicle.image_url];
  } else {
    currentEditingImageUrls = [];
  }
  
  renderEditingPhotos();
}

function renderEditingPhotos() {
  if (!editPhotosContainer) return;
  
  if (currentEditingImageUrls.length === 0) {
    editPhotosContainer.innerHTML = '<p style="font-size:11px; font-style:italic; color:var(--muted); margin:0;">No hay fotos cargadas.</p>';
    return;
  }
  
  editPhotosContainer.innerHTML = currentEditingImageUrls.map((url, index) => `
    <div class="editing-photo-wrapper" style="position:relative; width:80px; height:60px; border:1px solid var(--line); border-radius:3px; overflow:hidden; background:#000;">
      <img src="${url}" style="width:100%; height:100%; object-fit:cover; opacity: 0.85;">
      <button type="button" onclick="removePhotoFromCurrentEditing(${index})" style="position:absolute; top:2px; right:2px; background:rgba(189,76,56,0.9); color:#fff; border:0; width:18px; height:18px; border-radius:50%; font-size:10px; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0; line-height:1;" title="Quitar fotografía">×</button>
    </div>
  `).join('');
}

window.removePhotoFromCurrentEditing = function(index) {
  const isLocal = !window.location.hostname || ['127.0.0.1', 'localhost'].includes(window.location.hostname);
  const urlToRemove = currentEditingImageUrls[index];
  
  // En producción (Supabase), eliminamos dinámicamente del Storage para mantener todo limpio de inmediato
  if (!isLocal && supabaseClient && confirm('¿Deseas eliminar permanentemente esta foto del almacenamiento?')) {
    const parts = urlToRemove.split('/vehicle-images/');
    if (parts.length > 1) {
      const storagePath = decodeURIComponent(parts[1]);
      supabaseClient.storage
        .from('vehicle-images')
        .remove([storagePath])
        .then(({ error }) => {
          if (error) console.error('Error al borrar la foto del Storage:', error);
        });
    }
  }
  
  currentEditingImageUrls.splice(index, 1);
  renderEditingPhotos();
};

function closeEdit() {
  if (editVehicleModal) {
    editVehicleModal.hidden = true;
    editVehicleForm.reset();
  }
}

if (document.querySelector('#edit-close')) {
  document.querySelector('#edit-close').addEventListener('click', closeEdit);
}

if (editVehicleForm) {
  editVehicleForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!supabaseClient) return;
    editFormStatus.textContent = 'Procesando imágenes...';
    editFormStatus.classList.remove('error');
    
    const vId = editVehicleId.value;
    const isLocal = !window.location.hostname || ['127.0.0.1', 'localhost'].includes(window.location.hostname);
    
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) throw new Error('Iniciá sesión para realizar cambios.');
      
      const files = editPhotosUpload && editPhotosUpload.files ? Array.from(editPhotosUpload.files) : [];
      const newUploadedUrls = [];
      
      // 1. Si el usuario subió fotos nuevas al editar, las comprimimos y subimos al Storage
      if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          editFormStatus.textContent = `Comprimiendo y subiendo nueva foto ${i + 1} de ${files.length}...`;
          const compressed = await compressImage(files[i]);
          
          const extension = 'webp';
          const path = `${session.user.id}/${crypto.randomUUID()}.${extension}`;
          
          const { error: uploadError } = await supabaseClient.storage
            .from('vehicle-images')
            .upload(path, compressed, { contentType: 'image/webp', upsert: false });
            
          if (uploadError) throw uploadError;
          
          const { data: imageData } = supabaseClient.storage.from('vehicle-images').getPublicUrl(path);
          newUploadedUrls.push(imageData.publicUrl);
        }
      }
      
      // Amalgamar las fotos actuales (después de posibles eliminaciones con la X) con las nuevas
      const finalImageUrls = [...currentEditingImageUrls, ...newUploadedUrls];
      
      const payload = {
        title: editTitle.value,
        brand: editBrand.value,
        model: editModel.value,
        year: Number(editYear.value),
        price_ars: Number(editPrice.value),
        mileage_km: Number(editMileage.value),
        status: editStatusSel.value,
        location: editLocation.value,
        description: editDescription.value,
        image_url: finalImageUrls[0] || '', // Fallback portada
        image_urls: finalImageUrls,
        updated_at: new Date().toISOString()
      };
      
      editFormStatus.textContent = 'Guardando cambios del vehículo...';
      
      if (isLocal) {
        // En local actualizamos la API local (SQLite)
        const response = await fetch(`${localApi}/${vId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error('Error al actualizar en API Local');
      } else {
        // En producción actualizamos en Supabase directamente
        const { error } = await supabaseClient
          .from('vehicles')
          .update(payload)
          .eq('id', Number(vId));
        if (error) throw error;
      }
      
      editFormStatus.textContent = '¡Vehículo actualizado correctamente!';
      setTimeout(() => {
        closeEdit();
        load(); // Volver a cargar catálogo para ver los datos frescos modificados
      }, 1200);
      
    } catch (e) {
      editFormStatus.textContent = e.message || 'Error al guardar los cambios.';
      editFormStatus.classList.add('error');
    }
  });
}

async function handleDeleteVehicle(vehicleId) {
  try {
    const isLocal = !window.location.hostname || ['127.0.0.1', 'localhost'].includes(window.location.hostname);
    
    // Buscar datos locales del vehículo para remover fotos de storage en producción si existen
    const targetVehicle = allVehicles.find(v => String(v.id) === String(vehicleId));
    
    if (isLocal) {
      // Borrar de API local
      const response = await fetch(`${localApi}/${vehicleId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('No se pudo eliminar de la base de datos local');
    } else {
      // Intentar borrar las fotos asociadas de Supabase Storage de manera limpia
      if (supabaseClient && targetVehicle) {
        let filesToDelete = [];
        const imageUrls = targetVehicle.image_urls || [];
        if (imageUrls.length > 0) {
          filesToDelete = imageUrls;
        } else if (targetVehicle.image_url) {
          filesToDelete = [targetVehicle.image_url];
        }
        
        // Mapear URLs a paths relativos de storage bucket (ej: de https://.../vehicle-images/userId/UUID.webp obtener userId/UUID.webp)
        const paths = filesToDelete.map(url => {
          const parts = url.split('/vehicle-images/');
          return parts.length > 1 ? decodeURIComponent(parts[1]) : null;
        }).filter(p => p !== null);
        
        if (paths.length > 0) {
          const { error: storageError } = await supabaseClient.storage
            .from('vehicle-images')
            .remove(paths);
          if (storageError) {
            console.error('Error al remover fotos de Storage:', storageError);
          }
        }
      }

      // Borrar de Supabase Database
      const { error } = await supabaseClient
        .from('vehicles')
        .delete()
        .eq('id', Number(vehicleId));
      if (error) throw error;
    }
    
    alert('Vehículo y sus fotografías asociadas eliminados con éxito.');
    load(); // Recargar el catálogo
  } catch (e) {
    alert('Error al intentar eliminar el vehículo: ' + e.message);
  }
}

function showInquiryModal(vehicleId, vehicleTitle) {
  if (!inquiryModal) return;
  inquiryModal.hidden = false;
  inquiryVehicleId.value = vehicleId;
  inquiryVehicleTitle.textContent = vehicleTitle;
  inquiryMessage.value = '';
  inquiryStatus.textContent = '';
}

function closeInquiry() {
  if (inquiryModal) {
    inquiryModal.hidden = true;
    inquiryForm.reset();
  }
}

if (document.querySelector('#inquiry-close')) {
  document.querySelector('#inquiry-close').addEventListener('click', closeInquiry);
}

if (inquiryForm) {
  inquiryForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!supabaseClient) return;
    inquiryStatus.textContent = 'Enviando consulta...';
    inquiryStatus.classList.remove('error');
    
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) throw new Error('No hay sesión activa');
      
      const vId = Number(inquiryVehicleId.value);
      const targetVehicle = allVehicles.find(v => Number(v.id) === vId);
      const vehicleTitle = targetVehicle ? targetVehicle.title : 'Vehículo';
      const sellerId = targetVehicle ? targetVehicle.seller_id : null;
      
      const { error } = await supabaseClient
        .from('inquiries')
        .insert({
          vehicle_id: vId,
          vehicle_title_cache: vehicleTitle, // Guardamos copia estática del título en caso de delete futuro
          seller_id_cache: sellerId, // Guardamos copia estática de quién era su vendedor
          buyer_id: session.user.id,
          message: inquiryMessage.value
        });
        
      if (error) throw error;
      
      inquiryStatus.textContent = '¡Consulta registrada con éxito! El vendedor se contactará a la brevedad.';
      
      // Recargar consultas si somos vendedor/admin para que aparezcan en tiempo real
      const profile = await fetchUserProfile(session.user.id);
      if (profile && (profile.role === 'admin' || profile.role === 'vendedor')) {
        updateRoleBasedUI(profile);
      }
      
      setTimeout(closeInquiry, 2000);
    } catch (e) {
      inquiryStatus.textContent = e.message || 'Error al enviar la consulta.';
      inquiryStatus.classList.add('error');
    }
  });
}
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
forgotPassword.addEventListener('click', () => showAuth('forgot'));
authForm.addEventListener('submit', handleAuth);
vehicleForm.addEventListener('submit', publishVehicle);
if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    refreshAuth(session);
    if (_event === 'PASSWORD_RECOVERY') showAuth('recovery');
  });
  supabaseClient.auth.getSession().then(({ data: { session } }) => refreshAuth(session));
}
