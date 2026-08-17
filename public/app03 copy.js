if (!sessionStorage.getItem('token')) {
  window.location.replace('login.html');
}

const API_URL = "/api";

// State to manage independent pagination for both tables
const paginationState = {
  modelo: { currentPage: 1, pageSize: 10, data: [] },
  steam: { currentPage: 1, pageSize: 10, data: [] },
  estudiantes: { currentPage: 1, pageSize: 10, data: [] }
};

// ==========================================
// ROL Y PERMISOS DE NAVEGACIÓN
// ==========================================

function obtenerRolUsuario() {
  const userStr = sessionStorage.getItem('user') || localStorage.getItem('currentUser');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      const role = user.userRole || user.rol || user.role;
      if (role) return role;
    } catch (e) {
      console.error("Error al parsear usuario:", e);
    }
  }

  const token = sessionStorage.getItem('token');
  if (token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(window.atob(base64));
      
      const tokenRole = payload.userRole || payload.rol || payload.role;
      if (tokenRole) return tokenRole;
    } catch (e) {
      console.error("Error al decodificar JWT token:", e);
    }
  }

  return 'admin';
}

function applyRolePermissions() {
  const userRole = obtenerRolUsuario();

  if (userRole.toLowerCase() === 'juez') {
    const hiddenTabIds = ['nav-estudiantes', 'nav-jueces', 'nav-proyectos'];
    hiddenTabIds.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.style.display = 'none';
    });

    const titleEl = document.getElementById('panel-title');
    if (titleEl) titleEl.textContent = '⚖️ Panel Juez';
  }
}

function switchTab(tabName) {
  const userRole = obtenerRolUsuario();
  const adminOnlyTabs = ['estudiantes', 'jueces', 'proyectos'];

  if (userRole.toLowerCase() === 'juez' && adminOnlyTabs.includes(tabName)) {
    console.warn('Acceso denegado: Tu perfil de Juez no tiene acceso a este módulo.');
    return;
  }

  document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  
  const targetSec = document.getElementById(`sec-${tabName}`);
  const targetBtn = document.getElementById(`nav-${tabName}`);

  if (targetSec) targetSec.classList.add('active');
  if (targetBtn) targetBtn.classList.add('active');

  if (tabName === 'leaderboard') {
    loadLeaderboardData();
  } else if (tabName === 'estudiantes') {
    cargarOpcionesProyectos();
    cargarEstudiantes();
  } else if (tabName === 'jueces') {
    // Resetear formulario para limpiar cualquier valor autocompletado por el navegador
    const form = document.getElementById('form-juez');
    if (form) form.reset();

    // Resetear ID oculto y estado del botón si venías de una edición cancelada
    document.getElementById('juez-id').value = '';
    document.getElementById('btn-submit-juez').textContent = 'Agregar Juez';
    document.getElementById('btn-cancel-juez').style.display = 'none';

    //Carga las opciones de proyectos disponibles
    cargarOpcionesProyectosJuez();

    // Carga la lista de jueces
    cargarJueces();
  }else if (tabName === 'proyectos') {
    cargarProyectos();
  } else if (tabName === 'evaluaciones') {
    if (typeof cargarEvaluaciones === 'function') {
      cargarEvaluaciones();
    }
  }
}

function logout() {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  sessionStorage.removeItem('role');
  localStorage.removeItem('currentUser');
  localStorage.removeItem('userRole');
  window.location.replace('login.html');
}

// ==========================================
// FUNCIÓN CENTRALIZADA PARA POST Y PUT
// ==========================================
async function enviarDatosAPI(endpoint, payload, reloadCallback, recordId = null) {
  const token = sessionStorage.getItem('token');
  
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
// CARGAR DROPDOWN DE PROYECTOS PARA ESTUDIANTES
// ==========================================
async function cargarOpcionesProyectos() {
  const select = document.getElementById('est-proid');
  if (!select) return;

  select.innerHTML = '<option value="">Cargando proyectos...</option>';

  const proyectos = await fetchDatosAPI('proyectos');
  select.innerHTML = '<option value="">-- Seleccionar Proyecto --</option>';

  if (proyectos && proyectos.length > 0) {
    proyectos.forEach(proy => {
      const option = document.createElement('option');
      option.value = proy._id;
      option.textContent = proy.title || proy.tituloProyecto || 'Sin título';
      select.appendChild(option);
    });
  } else {
    select.innerHTML = '<option value="">No hay proyectos disponibles</option>';
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
    email: document.getElementById('est-correo').value
  };

  await enviarDatosAPI('estudiantes', payload, cargarEstudiantes, id);
}

/*
async function guardarJuez(event) {
  event.preventDefault();
  const id = document.getElementById('juez-id').value;

  const payload = {
    name: document.getElementById('juez-nombre').value,
    email: document.getElementById('juez-correo').value,
    specialty: document.getElementById('juez-esp').value
  };

  await enviarDatosAPI('jueces', payload, cargarJueces, id);
}
  */
// Guardar o actualizar Juez enviando proyectos seleccionados y contraseña
async function guardarJuez(event) {
  event.preventDefault();
  const id = document.getElementById('juez-id').value;

  const selectProyectos = document.getElementById('juez-proyectos');
  
  // Extraer SOLO el valor del ID (cadena de texto), ignorando opciones vacías
  const selectedProjects = Array.from(selectProyectos.selectedOptions)
    .map(opt => opt.value)
    .filter(val => val.trim() !== '');

  const payload = {
    name: document.getElementById('juez-nombre').value,
    email: document.getElementById('juez-correo').value,
    assignedProjects: selectedProjects // Envia ["id1", "id2", ...]
  };

  const passwordVal = document.getElementById('juez-password').value;
  if (passwordVal.trim() !== '') {
    payload.password = passwordVal;
  }

  await enviarDatosAPI('jueces', payload, cargarJueces, id);
}


/*
async function guardarProyecto(event) {
  event.preventDefault();
  const id = document.getElementById('proy-id').value;

  const payload = {
    title: document.getElementById('proy-nombre').value,
    description: document.getElementById('proy-desc').value,
    teamMembers: document.getElementById('proy-integ').value
  };

  await enviarDatosAPI('proyectos', payload, cargarProyectos, id);
}
*/

async function guardarProyecto(event) {
  event.preventDefault();
  const id = document.getElementById('proy-id').value;

  // Base payload from user inputs
  const payload = {
    tituloProyecto: document.getElementById('proy-nombre').value,
    centroEducativo: document.getElementById('proy-centro').value,
    categoria: document.getElementById('proy-cat').value,
    ejeTematico: document.getElementById('proy-eje').value
  };

  // When creating a NEW project, supply default empty structure matching sample
  if (!id) {
    payload.estudiante = [
      {
        idEstudiante: "",
        nombre: ""
      }
    ];
    payload.puntajeTotal = 0;
    payload.evaluacion = [];
    payload.puntajeEscrito = 0;
  }

  await enviarDatosAPI('proyectos', payload, cargarProyectos, id);
}

// ==========================================
// PREPARAR EDICIÓN (Cargar datos en el form)
// ==========================================

function prepararEdicionEstudiante(est) {
  document.getElementById('est-id').value = est._id;
  const projIdValue = typeof est.projectId === 'object' ? est.projectId?._id : est.projectId;
  document.getElementById('est-proid').value = projIdValue || '';
  document.getElementById('est-nombre').value = est.name || '';
  document.getElementById('est-correo').value = est.email || '';

  document.getElementById('btn-submit-est').textContent = '✏️ Actualizar Estudiante';
  document.getElementById('btn-cancel-est').style.display = 'inline-block';
}
/*
function prepararEdicionJuez(juez) {
  document.getElementById('juez-id').value = juez._id;
  document.getElementById('juez-nombre').value = juez.name || '';
  document.getElementById('juez-correo').value = juez.email || '';
  document.getElementById('juez-esp').value = juez.specialty || '';

  document.getElementById('btn-submit-juez').textContent = '✏️ Actualizar Juez';
  document.getElementById('btn-cancel-juez').style.display = 'inline-block';
}
*/

function prepararEdicionJuez(juez) {
  document.getElementById('juez-id').value = juez._id;
  document.getElementById('juez-nombre').value = juez.name || juez.nombre || '';
  document.getElementById('juez-correo').value = juez.email || '';
  document.getElementById('juez-password').value = ''; // Vacío por seguridad

  // Marcar los proyectos previamente asignados
  const assignedIds = (juez.assignedProjects || []).map(p => (typeof p === 'string' ? p : p.id || p._id));
  const selectEl = document.getElementById('juez-proyectos');
  if (selectEl) {
    Array.from(selectEl.options).forEach(opt => {
      opt.selected = assignedIds.includes(opt.value);
    });
  }

  document.getElementById('btn-submit-juez').textContent = '✏️ Actualizar Juez';
  document.getElementById('btn-cancel-juez').style.display = 'inline-block';
}

/*
function prepararEdicionProyecto(proy) {
  document.getElementById('proy-id').value = proy._id;
  document.getElementById('proy-nombre').value = proy.title || '';
  document.getElementById('proy-desc').value = proy.description || '';
  document.getElementById('proy-integ').value = proy.teamMembers || '';

  document.getElementById('btn-submit-proy').textContent = '✏️ Actualizar Proyecto';
  document.getElementById('btn-cancel-proy').style.display = 'inline-block';
}
*/

function prepararEdicionProyecto(proy) {
  document.getElementById('proy-id').value = proy._id;
  document.getElementById('proy-nombre').value = proy.tituloProyecto || proy.title || '';
  document.getElementById('proy-centro').value = proy.centroEducativo || '';
  document.getElementById('proy-cat').value = proy.categoria || '';
  document.getElementById('proy-eje').value = proy.ejeTematico || '';

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
  
  if (!data || data.length === 0) {
    paginationState.estudiantes.data = [];
    renderEstudiantesPage();
    return;
  }

  paginationState.estudiantes.data = data;
  renderEstudiantesPage();
}

function renderEstudiantesPage() {
  const state = paginationState.estudiantes;
  const tbody = document.getElementById('tbl-estudiantes');
  if (!tbody) return;

  const totalItems = state.data.length;
  const totalPages = Math.ceil(totalItems / state.pageSize) || 1;

  // Boundary checks
  if (state.currentPage > totalPages) state.currentPage = totalPages;
  if (state.currentPage < 1) state.currentPage = 1;

  const start = (state.currentPage - 1) * state.pageSize;
  const end = start + Number(state.pageSize);
  const pageData = state.data.slice(start, end);

  // Update UI Pagination Bar
  const pageInfo = document.getElementById('page-info-estudiantes');
  const btnPrev = document.getElementById('btn-prev-estudiantes');
  const btnNext = document.getElementById('btn-next-estudiantes');

  if (pageInfo) pageInfo.textContent = `Página ${state.currentPage} de ${totalPages}`;
  if (btnPrev) btnPrev.disabled = state.currentPage <= 1;
  if (btnNext) btnNext.disabled = state.currentPage >= totalPages || totalPages === 0;

  // Render Rows
  tbody.innerHTML = '';

  if (!pageData || pageData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">No hay estudiantes registrados.</td></tr>';
    return;
  }

  pageData.forEach(item => {
    const nombreProyecto = typeof item.projectId === 'object' && item.projectId 
      ? (item.projectId.title || item.projectId.tituloProyecto || 'Sin título') 
      : 'Sin asignación';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item._id.substring(0,6)}...</td>
      <td>${item.name}</td>
      <td>${item.email}</td>
      <td>${nombreProyecto}</td>
      <td>
        <button class="btn-action btn-edit" id="btn-edit-est-${item._id}">Editar</button>
      </td>
    `;
    tbody.appendChild(tr);

    document.getElementById(`btn-edit-est-${item._id}`).addEventListener('click', () => prepararEdicionEstudiante(item));
  });
}
/*
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
*/

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
    const nombre = item.name || item.nombre || item.email || 'Sin nombre';

    // Format assigned projects into a readable list
    let proyectosTexto = 'Ninguno';
    if (Array.isArray(item.assignedProjects) && item.assignedProjects.length > 0) {
      proyectosTexto = item.assignedProjects
        .map(p => (typeof p === 'object' && p !== null) ? (p.tituloProyecto || p.title || 'Sin título') : p)
        .join(', ');
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item._id.substring(0,6)}...</td>
      <td>${nombre}</td>
      <td>${item.email}</td>
      <td>${proyectosTexto}</td>
      <td>
        <button class="btn-action btn-edit" id="btn-edit-juez-${item._id}">Editar</button>
      </td>
    `;
    tbody.appendChild(tr);

    document.getElementById(`btn-edit-juez-${item._id}`).addEventListener('click', () => prepararEdicionJuez(item));
  });
}

// Cargar opciones de proyectos en el selector múltiple de Jueces
async function cargarOpcionesProyectosJuez() {
  const select = document.getElementById('juez-proyectos');
  if (!select) return;

  select.innerHTML = '<option value="">Cargando proyectos...</option>';
  const proyectos = await fetchDatosAPI('proyectos');
  select.innerHTML = '';

  if (proyectos && proyectos.length > 0) {
    proyectos.forEach(proy => {
      const option = document.createElement('option');
      option.value = proy._id;
      option.textContent = `${proy.tituloProyecto || proy.title || 'Sin título'} (${proy.centroEducativo || 'Sin Centro'})`;
      select.appendChild(option);
    });
  } else {
    select.innerHTML = '<option value="">No hay proyectos disponibles</option>';
  }
}

/*
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
      <td>${item.title || item.tituloProyecto}</td>
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

*/

async function cargarProyectos() {
  const tbody = document.getElementById('tbl-proyectos');
  tbody.innerHTML = '<tr><td colspan="6">Cargando datos...</td></tr>';
  
  const data = await fetchDatosAPI('proyectos');
  tbody.innerHTML = '';
  
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6">No hay proyectos registrados.</td></tr>';
    return;
  }

  data.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item._id.substring(0,6)}...</td>
      <td>${item.tituloProyecto || item.title || '-'}</td>
      <td>${item.centroEducativo || '-'}</td>
      <td>${item.categoria || '-'}</td>
      <td>${item.ejeTematico || '-'}</td>
      <td>
        <button class="btn-action btn-edit" id="btn-edit-proy-${item._id}">Editar</button>
      </td>
    `;
    tbody.appendChild(tr);

    document.getElementById(`btn-edit-proy-${item._id}`).addEventListener('click', () => prepararEdicionProyecto(item));
  });
}

// ==========================================
// LEADERBOARD POR CATEGORÍAS Y PAGINACIÓN
// ==========================================

async function loadLeaderboardData() {
  const tbodyModelo = document.getElementById('tbl-leaderboard-modelo');
  const tbodySteam = document.getElementById('tbl-leaderboard-steam');

  if (tbodyModelo) tbodyModelo.innerHTML = '<tr><td colspan="6">Cargando puntuaciones...</td></tr>';
  if (tbodySteam) tbodySteam.innerHTML = '<tr><td colspan="6">Cargando puntuaciones...</td></tr>';
  
  const data = await fetchDatosAPI('proyectos');

  if (!data || data.length === 0) {
    if (tbodyModelo) tbodyModelo.innerHTML = '<tr><td colspan="6">Aún no hay proyectos registrados.</td></tr>';
    if (tbodySteam) tbodySteam.innerHTML = '<tr><td colspan="6">Aún no hay proyectos registrados.</td></tr>';
    document.getElementById('kpi-top-modelo').textContent = '-';
    document.getElementById('kpi-top-steam').textContent = '-';
    document.getElementById('kpi-total-votes').textContent = '0';
    return;
  }

  // Filter and sort datasets
  paginationState.modelo.data = data
    .filter(p => !p.categoria || p.categoria.toUpperCase() !== 'STEAM')
    .sort((a, b) => (b.latestScore || b.puntajeTotal || 0) - (a.latestScore || a.puntajeTotal || 0));

  paginationState.steam.data = data
    .filter(p => p.categoria && p.categoria.toUpperCase() === 'STEAM')
    .sort((a, b) => (b.latestScore || b.puntajeTotal || 0) - (a.latestScore || a.puntajeTotal || 0));

  // Compute total evaluations
  const totalVotes = data.reduce((acc, curr) => acc + (curr.scores ? curr.scores.length : (curr.evaluacion ? curr.evaluacion.length : 0)), 0);
  document.getElementById('kpi-total-votes').textContent = totalVotes;

  // Update Top KPIs
  if (paginationState.modelo.data.length > 0) {
    const topM = paginationState.modelo.data[0];
    const scoreM = topM.latestScore || topM.puntajeTotal || 0;
    document.getElementById('kpi-top-modelo').textContent = `${topM.title || topM.tituloProyecto} (${scoreM} pts)`;
  } else {
    document.getElementById('kpi-top-modelo').textContent = '-';
  }

  if (paginationState.steam.data.length > 0) {
    const topS = paginationState.steam.data[0];
    const scoreS = topS.latestScore || topS.puntajeTotal || 0;
    document.getElementById('kpi-top-steam').textContent = `${topS.title || topS.tituloProyecto} (${scoreS} pts)`;
  } else {
    document.getElementById('kpi-top-steam').textContent = '-';
  }

  // Render paginated tables
  renderLeaderboardPage('modelo');
  renderLeaderboardPage('steam');
}

// Render a specific category page
function renderLeaderboardPage(category) {
  const state = paginationState[category];
  const tbody = document.getElementById(`tbl-leaderboard-${category}`);
  if (!tbody) return;

  const totalItems = state.data.length;
  const totalPages = Math.ceil(totalItems / state.pageSize) || 1;

  // Boundary checks
  if (state.currentPage > totalPages) state.currentPage = totalPages;
  if (state.currentPage < 1) state.currentPage = 1;

  const start = (state.currentPage - 1) * state.pageSize;
  const end = start + Number(state.pageSize);
  const pageData = state.data.slice(start, end);

  // Update UI Pagination Bar
  const pageInfo = document.getElementById(`page-info-${category}`);
  const btnPrev = document.getElementById(`btn-prev-${category}`);
  const btnNext = document.getElementById(`btn-next-${category}`);

  if (pageInfo) pageInfo.textContent = `Página ${state.currentPage} de ${totalPages}`;
  if (btnPrev) btnPrev.disabled = state.currentPage <= 1;
  if (btnNext) btnNext.disabled = state.currentPage >= totalPages || totalPages === 0;

  // Populate Rows
  tbody.innerHTML = '';

  if (!pageData || pageData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6">No hay proyectos registrados en esta categoría.</td></tr>';
    return;
  }

  pageData.forEach((item, index) => {
    // Preserve true rank index across pages
    const rank = start + index + 1;
    const badgeClass = rank === 1 ? 'badge-1' : rank === 2 ? 'badge-2' : rank === 3 ? 'badge-3' : 'badge-other';
    const votesCount = item.scores ? item.scores.length : (item.evaluacion ? item.evaluacion.length : 0);
    
    let avgScore = 0;
    if (item.scores && item.scores.length > 0) {
      avgScore = (item.scores.reduce((sum, scoreObj) => sum + scoreObj.score, 0) / votesCount).toFixed(1);
    } else if (item.evaluacion && item.evaluacion.length > 0) {
      avgScore = (item.evaluacion.reduce((sum, ev) => sum + (ev.Total || 0), 0) / votesCount).toFixed(1);
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="badge ${badgeClass}">${rank}</span></td>
      <td><strong>${item.title || item.tituloProyecto}</strong></td>
      <td>${item.centroEducativo || 'N/A'}</td>
      <td>${votesCount} Juez(ces)</td>
      <td>${avgScore} pts prom.</td>
      <td class="score-cell">${item.latestScore || item.puntajeTotal || 0} pts</td>
    `;
    tbody.appendChild(tr);
  });
}

// Handler for changing records per page (10, 15, 20)
function changePageSize(category, newSize) {
  paginationState[category].pageSize = parseInt(newSize, 10);
  paginationState[category].currentPage = 1; // Reset to page 1 on page size change
  if (category === 'estudiantes') {
    renderEstudiantesPage();
  } else {
    renderLeaderboardPage(category);
  }
}

// Handler for Previous / Next buttons
function changePage(category, delta) {
  paginationState[category].currentPage += delta;
  if (category === 'estudiantes') {
    renderEstudiantesPage();
  } else {
    renderLeaderboardPage(category);
  }
}

// ==========================================
// Cargando Proyectos Asignados al Juez
// ==========================================
let proyectosCargados = [];

async function cargarEvaluaciones() {
  const selectEl = document.getElementById('select-eval-proyecto');
  if (!selectEl) return;

  selectEl.innerHTML = '<option value="">Cargando proyectos...</option>';

  const todosProyectos = await fetchDatosAPI('proyectos');
  if (!todosProyectos || todosProyectos.length === 0) {
    selectEl.innerHTML = '<option value="">No hay proyectos disponibles</option>';
    return;
  }

  proyectosCargados = todosProyectos;
  const userRole = obtenerRolUsuario();
  let proyectosMostrados = todosProyectos;

  if (userRole.toLowerCase() === 'juez') {
    const userStr = sessionStorage.getItem('user') || localStorage.getItem('currentUser');
    let assignedIds = [];
    
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        assignedIds = (user.assignedProjects || []).map(p => (typeof p === 'string' ? p : p.id || p._id));
      } catch (e) {
        console.error("Error al parsear assignedProjects:", e);
      }
    }

    if (assignedIds.length > 0) {
      proyectosMostrados = todosProyectos.filter(p => assignedIds.includes(p._id));
    }
  }

  selectEl.innerHTML = '<option value="">-- Seleccione un proyecto --</option>';

  if (proyectosMostrados.length === 0) {
    selectEl.innerHTML = '<option value="">No tiene proyectos asignados</option>';
    return;
  }

  proyectosMostrados.forEach(proy => {
    const option = document.createElement('option');
    option.value = proy._id;
    option.textContent = `${proy.tituloProyecto || proy.title} (${proy.centroEducativo || 'Sin Centro'}) [${proy.categoria || 'Sin Cat.'}]`;
    selectEl.appendChild(option);
  });
}

// ==========================================
// EVALUACIONES: Selección y Guardado
// ==========================================

function alSeleccionarProyecto(proyectoId) {
  const formContainer = document.getElementById('container-form-evaluacion');
  
  if (!proyectoId) {
    if (formContainer) formContainer.style.display = 'none';
    mostrarDetalleEvaluacion(proyectoId);
    return;
  }

  const proyecto = proyectosCargados.find(p => p._id === proyectoId);
  const esSteam = proyecto && proyecto.categoria && proyecto.categoria.toUpperCase() === 'STEAM';

  // Update Form Labels
  document.getElementById('lbl-eval-preg-a').textContent = esSteam ? 'Pregunta X (Puntos)' : 'Pregunta A (Puntos)';
  document.getElementById('lbl-eval-preg-b').textContent = esSteam ? 'Pregunta Y (Puntos)' : 'Pregunta B (Puntos)';
  document.getElementById('lbl-eval-preg-c').textContent = esSteam ? 'Pregunta Z (Puntos)' : 'Pregunta C (Puntos)';

  // Update Table Headers
  document.getElementById('th-eval-preg-a').textContent = esSteam ? 'Pregunta X' : 'Pregunta A';
  document.getElementById('th-eval-preg-b').textContent = esSteam ? 'Pregunta Y' : 'Pregunta B';
  document.getElementById('th-eval-preg-c').textContent = esSteam ? 'Pregunta Z' : 'Pregunta C';

  if (formContainer) formContainer.style.display = 'block';

  mostrarDetalleEvaluacion(proyectoId);
}

function calcularPuntajeTotalEval() {
  const a = Number(document.getElementById('eval-preg-a').value) || 0;
  const b = Number(document.getElementById('eval-preg-b').value) || 0;
  const c = Number(document.getElementById('eval-preg-c').value) || 0;

  document.getElementById('eval-total').value = a + b + c;
}

async function guardarEvaluacion(event) {
  event.preventDefault();

  const proyectoId = document.getElementById('select-eval-proyecto').value;
  if (!proyectoId) {
    alert('Por favor seleccione un proyecto.');
    return;
  }

  const proyecto = proyectosCargados.find(p => p._id === proyectoId);
  const esSteam = proyecto && proyecto.categoria && proyecto.categoria.toUpperCase() === 'STEAM';

  const val1 = Number(document.getElementById('eval-preg-a').value) || 0;
  const val2 = Number(document.getElementById('eval-preg-b').value) || 0;
  const val3 = Number(document.getElementById('eval-preg-c').value) || 0;
  const total = val1 + val2 + val3;

  const userStr = sessionStorage.getItem('user') || localStorage.getItem('currentUser');
  let nombreJuez = 'Juez';
  let juezId = '';

  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      nombreJuez = user.nombre || user.email || 'Juez';
      juezId = user.id || user._id || '';
    } catch (e) {
      console.error('Error al leer datos de usuario:', e);
    }
  }

  const payload = {
    total: total,
    nombreJuez: nombreJuez,
    juezId: juezId
  };

  if (esSteam) {
    payload.preguntaX = val1;
    payload.preguntaY = val2;
    payload.preguntaZ = val3;
  } else {
    payload.preguntaA = val1;
    payload.preguntaB = val2;
    payload.preguntaC = val3;
  }

  const token = sessionStorage.getItem('token');

  try {
    const res = await fetch(`${API_URL}/proyectos/${proyectoId}/evaluaciones`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (res.ok) {
      alert('✅ Evaluación agregada con éxito');
      
      document.getElementById('form-evaluacion').reset();
      document.getElementById('eval-total').value = 0;

      const proyectoIdx = proyectosCargados.findIndex(p => p._id === proyectoId);
      if (proyectoIdx !== -1) {
        proyectosCargados[proyectoIdx] = data.proyecto;
      }
      
      mostrarDetalleEvaluacion(proyectoId);
    } else {
      alert('❌ Error: ' + (data.message || 'No se pudo guardar la evaluación'));
    }
  } catch (err) {
    console.error(err);
    alert('❌ Error de conexión con el servidor');
  }
}

function mostrarDetalleEvaluacion(proyectoId) {
  const tbody = document.getElementById('tbl-evaluaciones');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!proyectoId) {
    tbody.innerHTML = '<tr><td colspan="5">Seleccione un proyecto de la lista superior para ver sus evaluaciones.</td></tr>';
    return;
  }

  const proyecto = proyectosCargados.find(p => p._id === proyectoId);

  if (!proyecto || !proyecto.evaluacion || proyecto.evaluacion.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">Este proyecto aún no cuenta con evaluaciones registradas.</td></tr>';
    return;
  }

  const esSteam = proyecto && proyecto.categoria && proyecto.categoria.toUpperCase() === 'STEAM';

  proyecto.evaluacion.forEach(ev => {
    const valA = esSteam ? (ev.preguntaX !== undefined ? ev.preguntaX : ev.preguntaA || 0) : (ev.preguntaA || 0);
    const valB = esSteam ? (ev.preguntaY !== undefined ? ev.preguntaY : ev.preguntaB || 0) : (ev.preguntaB || 0);
    const valC = esSteam ? (ev.preguntaZ !== undefined ? ev.preguntaZ : ev.preguntaC || 0) : (ev.preguntaC || 0);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${ev.juez ? (ev.juez.nombre || 'Juez') : 'Juez'}</td>
      <td>${valA} pts</td>
      <td>${valB} pts</td>
      <td>${valC} pts</td>
      <td class="score-cell">${ev.Total || 0} pts</td>
    `;
    tbody.appendChild(tr);
  });
}

// ==========================================
// INICIALIZACIÓN
// ==========================================

function initApp() {
  applyRolePermissions();
  loadLeaderboardData();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}