if (!sessionStorage.getItem('token')) {
  window.location.replace('login.html');
}

const API_URL = "/api";

// State to manage independent pagination for tables
const paginationState = {
  modelo: { currentPage: 1, pageSize: 10, data: [] },
  steam: { currentPage: 1, pageSize: 10, data: [] },
  estudiantes: { currentPage: 1, pageSize: 10, data: [] }
};

// ==========================================
// ROL Y PERMISOS DE NAVEGACIÓN
// ==========================================

function obtenerUsuarioActual() {
  const userStr = sessionStorage.getItem('user') || localStorage.getItem('currentUser');
  if (userStr) {
    try { return JSON.parse(userStr); } catch (e) {}
  }
  return null;
}

function obtenerRolUsuario() {
  const user = obtenerUsuarioActual();
  if (user) {
    const role = user.userRole || user.rol || user.role;
    if (role) return role;
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

  // Reset evaluation form state whenever switching tabs
  resetearVistaEvaluaciones();

  if (tabName === 'leaderboard') {
    loadLeaderboardData();
  } else if (tabName === 'estudiantes') {
    cargarOpcionesProyectos();
    cargarEstudiantes();
  } else if (tabName === 'jueces') {
    const form = document.getElementById('form-juez');
    if (form) form.reset();

    document.getElementById('juez-id').value = '';
    document.getElementById('btn-submit-juez').textContent = 'Agregar Juez';
    document.getElementById('btn-cancel-juez').style.display = 'none';

    cargarOpcionesProyectosJuez();
    cargarJueces();
  } else if (tabName === 'proyectos') {
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
// ESTUDIANTES, JUECES, PROYECTOS (CRUD)
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

async function guardarJuez(event) {
  event.preventDefault();
  const id = document.getElementById('juez-id').value;
  const selectProyectos = document.getElementById('juez-proyectos');
  
  const selectedProjects = Array.from(selectProyectos.selectedOptions)
    .map(opt => opt.value)
    .filter(val => val.trim() !== '');

  const payload = {
    name: document.getElementById('juez-nombre').value,
    email: document.getElementById('juez-correo').value,
    assignedProjects: selectedProjects
  };

  const passwordVal = document.getElementById('juez-password').value;
  if (passwordVal.trim() !== '') {
    payload.password = passwordVal;
  }

  await enviarDatosAPI('jueces', payload, cargarJueces, id);
}

async function guardarProyecto(event) {
  event.preventDefault();
  const id = document.getElementById('proy-id').value;

  const payload = {
    tituloProyecto: document.getElementById('proy-nombre').value,
    centroEducativo: document.getElementById('proy-centro').value,
    categoria: document.getElementById('proy-cat').value,
    ejeTematico: document.getElementById('proy-eje').value
  };

  if (!id) {
    payload.estudiante = [{ idEstudiante: "", nombre: "" }];
    payload.puntajeTotal = 0;
    payload.evaluacion = [];
    payload.puntajeEscrito = 0;
  }

  await enviarDatosAPI('proyectos', payload, cargarProyectos, id);
}

function prepararEdicionEstudiante(est) {
  document.getElementById('est-id').value = est._id;
  const projIdValue = typeof est.projectId === 'object' ? est.projectId?._id : est.projectId;
  document.getElementById('est-proid').value = projIdValue || '';
  document.getElementById('est-nombre').value = est.name || '';
  document.getElementById('est-correo').value = est.email || '';

  document.getElementById('btn-submit-est').textContent = '✏️ Actualizar Estudiante';
  document.getElementById('btn-cancel-est').style.display = 'inline-block';
}

function prepararEdicionJuez(juez) {
  document.getElementById('juez-id').value = juez._id;
  document.getElementById('juez-nombre').value = juez.name || juez.nombre || '';
  document.getElementById('juez-correo').value = juez.email || '';
  document.getElementById('juez-password').value = '';

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

  if (state.currentPage > totalPages) state.currentPage = totalPages;
  if (state.currentPage < 1) state.currentPage = 1;

  const start = (state.currentPage - 1) * state.pageSize;
  const end = start + Number(state.pageSize);
  const pageData = state.data.slice(start, end);

  const pageInfo = document.getElementById('page-info-estudiantes');
  const btnPrev = document.getElementById('btn-prev-estudiantes');
  const btnNext = document.getElementById('btn-next-estudiantes');

  if (pageInfo) pageInfo.textContent = `Página ${state.currentPage} de ${totalPages}`;
  if (btnPrev) btnPrev.disabled = state.currentPage <= 1;
  if (btnNext) btnNext.disabled = state.currentPage >= totalPages || totalPages === 0;

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

  paginationState.modelo.data = data
    .filter(p => !p.categoria || p.categoria.toUpperCase() !== 'STEAM')
    .sort((a, b) => (b.latestScore || b.puntajeTotal || 0) - (a.latestScore || a.puntajeTotal || 0));

  paginationState.steam.data = data
    .filter(p => p.categoria && p.categoria.toUpperCase() === 'STEAM')
    .sort((a, b) => (b.latestScore || b.puntajeTotal || 0) - (a.latestScore || a.puntajeTotal || 0));

  const totalVotes = data.reduce((acc, curr) => acc + (curr.scores ? curr.scores.length : (curr.evaluacion ? curr.evaluacion.length : 0)), 0);
  document.getElementById('kpi-total-votes').textContent = totalVotes;

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

  renderLeaderboardPage('modelo');
  renderLeaderboardPage('steam');
}

function renderLeaderboardPage(category) {
  const state = paginationState[category];
  const tbody = document.getElementById(`tbl-leaderboard-${category}`);
  if (!tbody) return;

  const totalItems = state.data.length;
  const totalPages = Math.ceil(totalItems / state.pageSize) || 1;

  if (state.currentPage > totalPages) state.currentPage = totalPages;
  if (state.currentPage < 1) state.currentPage = 1;

  const start = (state.currentPage - 1) * state.pageSize;
  const end = start + Number(state.pageSize);
  const pageData = state.data.slice(start, end);

  const pageInfo = document.getElementById(`page-info-${category}`);
  const btnPrev = document.getElementById(`btn-prev-${category}`);
  const btnNext = document.getElementById(`btn-next-${category}`);

  if (pageInfo) pageInfo.textContent = `Página ${state.currentPage} de ${totalPages}`;
  if (btnPrev) btnPrev.disabled = state.currentPage <= 1;
  if (btnNext) btnNext.disabled = state.currentPage >= totalPages || totalPages === 0;

  tbody.innerHTML = '';

  if (!pageData || pageData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6">No hay proyectos registrados en esta categoría.</td></tr>';
    return;
  }

  pageData.forEach((item, index) => {
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

function changePageSize(category, newSize) {
  paginationState[category].pageSize = parseInt(newSize, 10);
  paginationState[category].currentPage = 1;
  if (category === 'estudiantes') {
    renderEstudiantesPage();
  } else {
    renderLeaderboardPage(category);
  }
}

function changePage(category, delta) {
  paginationState[category].currentPage += delta;
  if (category === 'estudiantes') {
    renderEstudiantesPage();
  } else {
    renderLeaderboardPage(category);
  }
}

// ==========================================
// EVALUACIONES Y RÚBRICA
// ==========================================

let proyectosCargados = [];

const PREGUNTAS_MODELO_NEGOCIO = [
  { id: 'a', label: 'a. Define de forma precisa la operación básica de la potencial empresa.' },
  { id: 'b', label: 'b. Plantea las alternativas de solución que la empresa brindará al problema o necesidad detectada.' },
  { id: 'c', label: 'c. Describe los productos o servicios ofrecidos que brindan valor a los clientes.' },
  { id: 'd', label: 'd. Evidencia el impacto la potencial empresa desde diversos ámbitos, tanto a corto, como a largo plazo.' },
  { id: 'e', label: 'e. Argumenta las diferencias que ofrece la potencial empresa con la competencia.' },
  { id: 'f', label: 'f. Demuestra un buen entendimiento del mercado, la competencia y aspectos financieros.' },
  { id: 'g', label: 'g. Argumenta con solidez qué hace único al negocio y por qué constituye una buena oportunidad.' },
  { id: 'h', label: 'h. Demuestra gestión de los recursos de forma sostenible y responsable.' },
  { id: 'i', label: 'i. Demuestra claridad y coherencia en la exposición del modelo de negocio ante el panel de jueces.' },
  { id: 'j', label: 'j. Utiliza lenguaje técnico acorde con el nivel académico y el campo del negocio.' },
  { id: 'k', label: 'k. Evidencia capacidad de comunicación oral y dominio de la propuesta de valor.' },
  { id: 'l', label: 'l. Define los canales mediante los cuales hará llegar a los clientes la propuesta de valor.' },
  { id: 'm', label: 'm. Caracteriza el segmento de clientes (necesidades - comportamientos - atributos).' },
  { id: 'n', label: 'n. Expone una propuesta innovadora y creativa con respecto al mercado.' },
  { id: 'o', label: 'o. Describe las demandas del segmento de clientes y el seguimiento para asegurar la calidad de los bienes o servicios ofrecidos.' },
  { id: 'p', label: 'p. Expone las fuentes de ingresos y estructura de costos.' },
  { id: 'q', label: 'q. Describe las alianzas estratégicas de su propuesta de valor.' }
];

const PREGUNTAS_STEM = [
  { id: '1', label: '1. Delimita los antecedentes del problema o necesidad por solventar.' },
  { id: '2', label: '2. Evidencia claridad en la definición del problema.' },
  { id: '3', label: '3. Fundamenta la relevancia o utilidad potencial del proyecto.' },
  { id: '4', label: '4. Define los criterios técnicos utilizados para la solución del problema.' },
  { id: '5', label: '5. Evidencia la viabilidad del proyecto.' },
  { id: '6', label: '6. Emplea variedad de fuentes de información confiables para sustentar el proyecto (tesis, libros, artículos, entrevistas, repositorios y páginas Web, entre otros).' },
  { id: '7', label: '7. Incluye citas bibliográficas relevantes, de forma crítica dentro del texto, que documentan la investigación y desarrollo del proyecto.' },
  { id: '8', label: '8. Emplea fuentes bibliográficas actualizadas, según el tema abordado en el proyecto.' },
  { id: '9', label: '9. Define términos o conceptos relevantes para la investigación y desarrollo del proyecto.' },
  { id: '10', label: '10. Sintetiza la información existente del tema en estudio.' },
  { id: '11', label: '11. Evidencia la organización lógica de la información recopilada.' },
  { id: '12', label: '12. Presenta el objetivo general y al menos dos objetivos específicos.' },
  { id: '13', label: '13. Se plantean de forma clara, precisa y según estructura requerida: verbo en infinitivo, contenido y condición técnica.' },
  { id: '14', label: '14. Evidencia relación con la propuesta de solución planteada.' },
  { id: '15', label: '15. Presenta las etapas del proyecto en el cronograma.' },
  { id: '16', label: '16. Cumple con las etapas establecidas en el cronograma.' },
  { id: '17', label: '17. Describe paso a paso los procedimientos y técnicas utilizadas para la investigación y desarrollo.' },
  { id: '18', label: '18. Describe los recursos utilizados para la implementación del proyecto.' },
  { id: '19', label: '19. Evidencia procesos de mejora continua durante la investigación y desarrollo del proyecto.' },
  { id: '20', label: '20. Evidencia el desarrollo de ideas novedosas o la aplicación creativa de conocimientos.' },
  { id: '21', label: '21. Fundamenta los cálculos requeridos para las demostraciones.' },
  { id: '22', label: '22. Incluye diseños y esquemas claros en relación con el desarrollo del prototipo.' },
  { id: '23', label: '23. Muestra concordancia entre los resultados obtenidos y los objetivos planteados.' },
  { id: '24', label: '24. Presenta los datos mediante tablas, diagramas, figuras, gráficos, entre otros, que sustenten los resultados obtenidos.' },
  { id: '25', label: '25. Evidencia la interpretación de los resultados desde una visión analítica y reflexiva, sin delimitarse a describirlos.' },
  { id: '26', label: '26. Demuestra resultados (producto) aplicables y útiles en la vida real.' },
  { id: '27', label: '27. Presenta coherencia entre los diseños y esquemas con respecto al prototipo desarrollado.' },
  { id: '28', label: '28. Plantea conclusiones relevantes en relación con los objetivos trazados, análisis de datos y prototipado.' },
  { id: '29', label: '29. Concluye sobre el impacto ambiental, social o económico de la implementación del proyecto.' },
  { id: '30', label: '30. Presenta una organización clara y lógica, en congruencia con la estructura dada en los lineamientos.' },
  { id: '31', label: '31. Presenta el documento en formato de doble columna (IEEE, artículo de revista).' },
  { id: '32', label: '32. Presenta el listado de referencias citadas en el documento, según formato APA vigente.' },
  { id: '33', label: '33. Evidencia el proceso de investigación y desarrollo realizado.' },
  { id: '34', label: '34. Cumple con el formato solicitado, según los lineamientos de la ExpoTÉCNICA.' },
  { id: '35', label: '35. Presenta relación con el informe escrito.' }
];

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
    const user = obtenerUsuarioActual();
    let assignedIds = [];
    if (user) {
      assignedIds = (user.assignedProjects || []).map(p => (typeof p === 'string' ? p : p.id || p._id));
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

function resetearVistaEvaluaciones() {
  const select = document.getElementById('select-eval-proyecto');
  if (select) select.value = '';
  cancelarEdicionEvaluacion();
  alSeleccionarProyecto('');
}

function alSeleccionarProyecto(proyectoId) {
  const formContainer = document.getElementById('container-form-evaluacion');
  const questionsContainer = document.getElementById('eval-questions-container');

  if (!proyectoId) {
    if (formContainer) formContainer.style.display = 'none';
    mostrarDetalleEvaluacion(proyectoId);
    return;
  }

  const proyecto = proyectosCargados.find(p => p._id === proyectoId);
  const cat = proyecto && proyecto.categoria ? proyecto.categoria.toUpperCase() : '';
  const esStem = cat.includes('STEM') || cat.includes('STEAM');

  if (questionsContainer) {
    questionsContainer.innerHTML = '';
    const rubricQuestions = esStem ? PREGUNTAS_STEM : PREGUNTAS_MODELO_NEGOCIO;
    const maxPts = esStem ? 3 : 5;

    rubricQuestions.forEach(q => {
      const row = document.createElement('div');
      row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #475569; padding: 8px 0; gap: 12px;';
      row.innerHTML = `
        <label for="eval-preg-${q.id}" style="flex: 1; font-size: 0.9rem; font-weight: 500;">${q.label}</label>
        <input type="number" class="eval-score-input" id="eval-preg-${q.id}" data-id="${q.id}" data-text="${q.label}" min="0" max="${maxPts}" value="0" style="width: 80px; text-align: center; font-weight: bold;" oninput="calcularPuntajeTotalEval()" required>
      `;
      questionsContainer.appendChild(row);
    });
  }

  document.getElementById('eval-total').value = 0;
  if (formContainer) formContainer.style.display = 'block';

  mostrarDetalleEvaluacion(proyectoId);
}

function calcularPuntajeTotalEval() {
  const scoreInputs = document.querySelectorAll('.eval-score-input');
  let sum = 0;
  scoreInputs.forEach(input => {
    sum += Number(input.value) || 0;
  });
  document.getElementById('eval-total').value = sum;
}

// 1. Display evaluations table with conditional Edit button based on role/ownership
function mostrarDetalleEvaluacion(proyectoId) {
  const tbody = document.getElementById('tbl-evaluaciones');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!proyectoId) {
    tbody.innerHTML = '<tr><td colspan="3">Seleccione un proyecto de la lista superior para ver sus evaluaciones.</td></tr>';
    return;
  }

  const proyecto = proyectosCargados.find(p => p._id === proyectoId);

  if (!proyecto || !proyecto.evaluacion || proyecto.evaluacion.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3">Este proyecto aún no cuenta con evaluaciones registradas.</td></tr>';
    return;
  }

  const userRole = obtenerRolUsuario();
  const currentUser = obtenerUsuarioActual();
  const currentUserId = currentUser ? (currentUser.id || currentUser._id || '') : '';
  const isAdmin = userRole.toLowerCase() === 'admin';

  proyecto.evaluacion.forEach(ev => {
    const esDuenio = ev.juez && String(ev.juez.id) === String(currentUserId);
    const puedeEditar = isAdmin || esDuenio;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${ev.juez ? (ev.juez.nombre || 'Juez') : 'Juez'}</td>
      <td class="score-cell">${ev.Total || 0} pts</td>
      <td>
        ${puedeEditar ? `
          <button class="btn-action btn-edit" onclick="prepararEdicionEvaluacion('${ev.id}')">Editar</button>
          <button class="btn-action btn-delete" onclick="eliminarEvaluacion('${ev.id}')">Eliminar</button>
        ` : '-'}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// New function to handle evaluation deletion request
async function eliminarEvaluacion(evalId) {
  const proyectoId = document.getElementById('select-eval-proyecto').value;
  if (!proyectoId) return;

  if (!confirm('¿Está seguro de que desea eliminar esta evaluación?')) return;

  const userRole = obtenerRolUsuario();
  const currentUser = obtenerUsuarioActual();
  const juezId = currentUser ? (currentUser.id || currentUser._id || '') : '';
  const token = sessionStorage.getItem('token');

  try {
    const res = await fetch(`${API_URL}/proyectos/${proyectoId}/evaluaciones/${evalId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ juezId, userRole })
    });

    const data = await res.json();

    if (res.ok) {
      alert('✅ Evaluación eliminada con éxito');

      const proyectoIdx = proyectosCargados.findIndex(p => p._id === proyectoId);
      if (proyectoIdx !== -1) {
        proyectosCargados[proyectoIdx] = data.proyecto;
      }

      cancelarEdicionEvaluacion();
      resetearVistaEvaluaciones();
    } else {
      alert('❌ Error: ' + (data.message || 'No se pudo eliminar la evaluación'));
    }
  } catch (err) {
    console.error(err);
    alert('❌ Error de conexión con el servidor');
  }
}

// 2. Load evaluation answers into form for editing
function prepararEdicionEvaluacion(evalId) {
  const proyectoId = document.getElementById('select-eval-proyecto').value;
  const proyecto = proyectosCargados.find(p => p._id === proyectoId);
  if (!proyecto || !proyecto.evaluacion) return;

  const evaluacion = proyecto.evaluacion.find(e => String(e.id) === String(evalId));
  if (!evaluacion) return;

  document.getElementById('eval-id').value = evaluacion.id;

  if (evaluacion.preguntas) {
    Object.keys(evaluacion.preguntas).forEach(qKey => {
      const input = document.getElementById(`eval-preg-${qKey}`);
      if (input) {
        const item = evaluacion.preguntas[qKey];
        input.value = typeof item === 'object' ? (item.puntos || 0) : item;
      }
    });
  }

  calcularPuntajeTotalEval();

  const submitBtn = document.getElementById('btn-submit-eval');
  const cancelBtn = document.getElementById('btn-cancel-eval');
  if (submitBtn) submitBtn.textContent = '✏️ Actualizar Evaluación';
  if (cancelBtn) cancelBtn.style.display = 'block';

  const formContainer = document.getElementById('container-form-evaluacion');
  if (formContainer) formContainer.style.display = 'block';
}

function cancelarEdicionEvaluacion() {
  const evalIdInput = document.getElementById('eval-id');
  if (evalIdInput) evalIdInput.value = '';

  const form = document.getElementById('form-evaluacion');
  if (form) form.reset();

  const totalEl = document.getElementById('eval-total');
  if (totalEl) totalEl.value = 0;

  const submitBtn = document.getElementById('btn-submit-eval');
  const cancelBtn = document.getElementById('btn-cancel-eval');
  if (submitBtn) submitBtn.textContent = '💾 Guardar Evaluación';
  if (cancelBtn) cancelBtn.style.display = 'none';
}

// 3. Handle both POST (Create) and PUT (Edit) submissions
async function guardarEvaluacion(event) {
  event.preventDefault();

  const proyectoId = document.getElementById('select-eval-proyecto').value;
  const evalId = document.getElementById('eval-id').value;

  if (!proyectoId) {
    alert('Por favor seleccione un proyecto.');
    return;
  }

  const total = Number(document.getElementById('eval-total').value) || 0;
  const userRole = obtenerRolUsuario();
  const currentUser = obtenerUsuarioActual();

  let nombreJuez = currentUser ? (currentUser.nombre || currentUser.email || 'Juez') : 'Juez';
  let juezId = currentUser ? (currentUser.id || currentUser._id || '') : '';

  const payload = {
    total: total,
    nombreJuez: nombreJuez,
    juezId: juezId,
    userRole: userRole,
    preguntasDetalle: {}
  };

  const inputs = document.querySelectorAll('.eval-score-input');
  inputs.forEach(inp => {
    const qKey = inp.getAttribute('data-id');
    const qText = inp.getAttribute('data-text') || qKey;
    const scoreVal = Number(inp.value) || 0;

    payload.preguntasDetalle[qKey] = {
      texto: qText,
      puntos: scoreVal
    };
  });

  const token = sessionStorage.getItem('token');
  const isUpdate = Boolean(evalId);
  const url = isUpdate 
    ? `${API_URL}/proyectos/${proyectoId}/evaluaciones/${evalId}` 
    : `${API_URL}/proyectos/${proyectoId}/evaluaciones`;
  const method = isUpdate ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (res.ok) {
      alert(`✅ Evaluación ${isUpdate ? 'actualizada' : 'agregada'} con éxito`);

      const proyectoIdx = proyectosCargados.findIndex(p => p._id === proyectoId);
      if (proyectoIdx !== -1) {
        proyectosCargados[proyectoIdx] = data.proyecto;
      }

      cancelarEdicionEvaluacion();
      resetearVistaEvaluaciones();
    } else {
      alert('❌ Error: ' + (data.message || 'No se pudo guardar la evaluación'));
    }
  } catch (err) {
    console.error(err);
    alert('❌ Error de conexión con el servidor');
  }
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