// public/app02.js

if (!sessionStorage.getItem('token')) {
  window.location.replace('login.html');
}

const API_URL = "/api";

// Navegación entre pestañas
function switchTab(tabName) {
  document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  
  document.getElementById(`sec-${tabName}`).classList.add('active');
  event.target.classList.add('active');

  if (tabName === 'leaderboard') {
    loadLeaderboardData();
  } else if (tabName === 'estudiantes') {
    cargarEstudiantes();
  } else if (tabName === 'jueces') {
    cargarJueces();
  } else if (tabName === 'proyectos') {
    cargarProyectos();
  }
}

function logout() {
  sessionStorage.removeItem('token');
  window.location.replace('login.html');
}

// ==========================================
// FUNCIÓN CENTRALIZADA PARA POST Y PUT
// ==========================================
async function enviarDatosAPI(endpoint, payload, formElement, reloadCallback, recordId = null) {
  const token = sessionStorage.getItem('token');
  
  // Decide entre PUT (actualizar) y POST (crear)
  const isUpdate = Boolean(recordId);
  const url = isUpdate ? `${API_URL}/${endpoint}/${recordId}` : `${API_URL}/${endpoint}`;
  const method = isUpdate ? 'PUT' : 'POST';

  try {
    const response = await fetch(url, {
      method: method,
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const resData = await response.json();
    if (response.ok) {
      alert(`✅ ${isUpdate ? 'Actualizado' : 'Guardado'} correctamente en ${endpoint}`);
      formElement.reset();
      
      // Limpia campos ocultos y restaura botones
      const prefix = endpoint === 'estudiantes' ? 'est' : endpoint === 'jueces' ? 'juez' : 'proy';
      cancelarEdicion(prefix);

      if (reloadCallback) reloadCallback();
    } else {
      alert('❌ Error: ' + (resData.message || 'No se pudo procesar la solicitud'));
    }
  } catch (err) {
    console.error(err);
    alert('❌ Error de conexión con el servidor.');
  }
}

// ==========================================
// GUARDAR / ACTUALIZAR REGISTROS
// ==========================================

async function guardarEstudiante(event) {
  event.preventDefault();
  const id = document.getElementById('est-id').value;
  
  const payload = {
    projectId: document.getElementById('est-proid').value,
    name: document.getElementById('est-nombre').value,
    email: document.getElementById('est-correo').value,
    major: document.getElementById('est-carrera').value
  };

  await enviarDatosAPI('estudiantes', payload, event.target, cargarEstudiantes, id);
}

async function guardarJuez(event) {
  event.preventDefault();
  const id = document.getElementById('juez-id').value;

  const payload = {
    name: document.getElementById('juez-nombre').value,
    email: document.getElementById('juez-correo').value,
    specialty: document.getElementById('juez-esp').value
  };

  await enviarDatosAPI('jueces', payload, event.target, cargarJueces, id);
}

async function guardarProyecto(event) {
  event.preventDefault();
  const id = document.getElementById('proy-id').value;

  const payload = {
    title: document.getElementById('proy-nombre').value,
    description: document.getElementById('proy-desc').value,
    teamMembers: document.getElementById('proy-integ').value
  };

  await enviarDatosAPI('proyectos', payload, event.target, cargarProyectos, id);
}

// ==========================================
// PREPARAR EDICIÓN (Cargar datos en el form)
// ==========================================

function prepararEdicionEstudiante(est) {
  document.getElementById('est-id').value = est._id;
  document.getElementById('est-proid').value = est.projectId || '';
  document.getElementById('est-nombre').value = est.name || '';
  document.getElementById('est-correo').value = est.email || '';
  document.getElementById('est-carrera').value = est.major || '';

  document.getElementById('btn-submit-est').textContent = '✏️ Actualizar Estudiante';
  document.getElementById('btn-cancel-est').style.display = 'inline-block';
}

function prepararEdicionJuez(juez) {
  document.getElementById('juez-id').value = juez._id;
  document.getElementById('juez-nombre').value = juez.name || '';
  document.getElementById('juez-correo').value = juez.email || '';
  document.getElementById('juez-esp').value = juez.specialty || '';

  document.getElementById('btn-submit-juez').textContent = '✏️ Actualizar Juez';
  document.getElementById('btn-cancel-juez').style.display = 'inline-block';
}

function prepararEdicionProyecto(proy) {
  document.getElementById('proy-id').value = proy._id;
  document.getElementById('proy-nombre').value = proy.title || '';
  document.getElementById('proy-desc').value = proy.description || '';
  document.getElementById('proy-integ').value = proy.teamMembers || '';

  document.getElementById('btn-submit-proy').textContent = '✏️ Actualizar Proyecto';
  document.getElementById('btn-cancel-proy').style.display = 'inline-block';
}

function cancelarEdicion(prefix) {
  document.getElementById(`${prefix}-id`).value = '';
  document.getElementById(`form-${prefix === 'est' ? 'estudiante' : prefix === 'juez' ? 'juez' : 'proyecto'}`).reset();
  
  const submitBtn = document.getElementById(`btn-submit-${prefix}`);
  const cancelBtn = document.getElementById(`btn-cancel-${prefix}`);
  
  if (prefix === 'est') submitBtn.textContent = 'Agregar Estudiante';
  if (prefix === 'juez') submitBtn.textContent = 'Agregar Juez';
  if (prefix === 'proy') submitBtn.textContent = 'Agregar Proyecto';
  
  cancelBtn.style.display = 'none';
}

// ==========================================
// MÉTODOS DE OBTENCIÓN Y RENDERIZADO (GET)
// ==========================================

async function fetchDatosAPI(endpoint) {
  const token = sessionStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL}/${endpoint}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(err);
    return null;
  }
}

async function cargarEstudiantes() {
  const tbody = document.getElementById('tbl-estudiantes');
  tbody.innerHTML = '<tr><td colspan="5">Cargando datos...</td></tr>';
  
  const data = await fetchDatosAPI('estudiantes');
  tbody.innerHTML = '';
  
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">No hay estudiantes registrados.</td></tr>';
    return;
  }

  data.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item._id.substring(0,6)}...</td>
      <td>${item.name}</td>
      <td>${item.email}</td>
      <td>${item.major || item.carrera || 'N/A'}</td>
      <td>
        <button class="btn-action btn-edit" id="btn-edit-est-${item._id}">Editar</button>
      </td>
    `;
    tbody.appendChild(tr);

    // Event listener seguro para pasar el objeto completo al form
    document.getElementById(`btn-edit-est-${item._id}`).addEventListener('click', () => prepararEdicionEstudiante(item));
  });
}

async function cargarJueces() {
  const tbody = document.getElementById('tbl-jueces');
  tbody.innerHTML = '<tr><td colspan="5">Cargando datos...</td></tr>';
  
  const data = await fetchDatosAPI('jueces');
  tbody.innerHTML = '';
  
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">No hay jueces registrados.</td></tr>';
    return;
  }

  data.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item._id.substring(0,6)}...</td>
      <td>${item.name}</td>
      <td>${item.email}</td>
      <td>${item.specialty || 'N/A'}</td>
      <td>
        <button class="btn-action btn-edit" id="btn-edit-juez-${item._id}">Editar</button>
      </td>
    `;
    tbody.appendChild(tr);

    document.getElementById(`btn-edit-juez-${item._id}`).addEventListener('click', () => prepararEdicionJuez(item));
  });
}

async function cargarProyectos() {
  const tbody = document.getElementById('tbl-proyectos');
  tbody.innerHTML = '<tr><td colspan="5">Cargando datos...</td></tr>';
  
  const data = await fetchDatosAPI('proyectos');
  tbody.innerHTML = '';
  
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">No hay proyectos registrados.</td></tr>';
    return;
  }

  data.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item._id.substring(0,6)}...</td>
      <td>${item.title}</td>
      <td>${item.description || '-'}</td>
      <td>${item.teamMembers || 'N/A'}</td>
      <td>
        <button class="btn-action btn-edit" id="btn-edit-proy-${item._id}">Editar</button>
      </td>
    `;
    tbody.appendChild(tr);

    document.getElementById(`btn-edit-proy-${item._id}`).addEventListener('click', () => prepararEdicionProyecto(item));
  });
}

// ==========================================
// ESTADO DE PAGINACIÓN LEADERBOARD
// ==========================================
let leaderboardData = [];
let currentPage = 1;
let itemsPerPage = 10;

// Cargar Leaderboard desde la API
async function loadLeaderboardData() {
  const tbody = document.getElementById('tbl-leaderboard');
  tbody.innerHTML = '<tr><td colspan="5">Cargando puntuaciones...</td></tr>';
  
  const data = await fetchDatosAPI('proyectos');

  if (!data || data.length === 0) {
    leaderboardData = [];
    tbody.innerHTML = '<tr><td colspan="5">Aún no hay proyectos registrados.</td></tr>';
    document.getElementById('kpi-top-project').textContent = '-';
    document.getElementById('kpi-top-score').textContent = '-';
    document.getElementById('kpi-total-votes').textContent = '0';
    document.getElementById('page-info').textContent = 'Página 0 de 0';
    document.getElementById('btn-prev-page').disabled = true;
    document.getElementById('btn-next-page').disabled = true;
    return;
  }

  // Ordenar de mayor a menor puntuación
  leaderboardData = data.sort((a, b) => (b.latestScore || 0) - (a.latestScore || 0));
  
  // Calcular KPIs con TODOS los datos antes de paginar
  const totalVotes = leaderboardData.reduce((acc, curr) => acc + (curr.scores ? curr.scores.length : 0), 0);
  document.getElementById('kpi-top-project').textContent = leaderboardData[0].title;
  document.getElementById('kpi-top-score').textContent = `${leaderboardData[0].latestScore || 0} pts`;
  document.getElementById('kpi-total-votes').textContent = totalVotes;

  // Renderizar la primera página
  currentPage = 1;
  renderLeaderboardTable();
}

// Renderizar la tabla con la página actual
function renderLeaderboardTable() {
  const tbody = document.getElementById('tbl-leaderboard');
  tbody.innerHTML = '';

  const totalItems = leaderboardData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const pageItems = leaderboardData.slice(startIndex, endIndex);

  pageItems.forEach((item, index) => {
    // La posición mantiene el ranking global real (ej: pág 2 muestra ranking 11, 12, etc)
    const rank = startIndex + index + 1;
    const badgeClass = rank === 1 ? 'badge-1' : rank === 2 ? 'badge-2' : rank === 3 ? 'badge-3' : 'badge-other';
    const votesCount = item.scores ? item.scores.length : 0;
    
    const avgScore = votesCount > 0 
      ? (item.scores.reduce((sum, scoreObj) => sum + scoreObj.score, 0) / votesCount).toFixed(1) 
      : 0;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="badge ${badgeClass}">${rank}</span></td>
      <td><strong>${item.title}</strong></td>
      <td>${votesCount} Juez(ces)</td>
      <td>${avgScore} / pts prom.</td>
      <td class="score-cell">${item.latestScore || 0} pts</td>
    `;
    tbody.appendChild(tr);
  });

  // Actualizar controles UI
  document.getElementById('page-info').textContent = `Página ${currentPage} de ${totalPages}`;
  document.getElementById('btn-prev-page').disabled = currentPage === 1;
  document.getElementById('btn-next-page').disabled = currentPage >= totalPages;
}

// Cambiar de página (Anterior / Siguiente)
function cambiarPagina(direction) {
  currentPage += direction;
  renderLeaderboardTable();
}

// Cambiar tamaño de página (10, 20, 50)
function cambiarTamanoPagina(newSize) {
  itemsPerPage = parseInt(newSize, 10);
  currentPage = 1;
  renderLeaderboardTable();
}

window.addEventListener('DOMContentLoaded', () => loadLeaderboardData());