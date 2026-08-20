if (!sessionStorage.getItem('token')) {
  window.location.replace('login.html');
}

const API_URL = "/api";

// State to manage independent pagination for tables
const paginationState = {
  modelo: { currentPage: 1, pageSize: 10, data: [] },
  steam: { currentPage: 1, pageSize: 10, data: [] },
  estudiantes: { currentPage: 1, pageSize: 10, data: [] },
  proyectos: { currentPage: 1, pageSize: 10, data: [] },
  jueces: { currentPage: 1, pageSize: 10, data: [] }
};

// ==========================================
// ROL Y PERMISOS DE NAVEGACIÓN
// ==========================================



function obtenerUsuarioActual() {
  const userStr = sessionStorage.getItem('user') || localStorage.getItem('currentUser');
  if (userStr) {
    try { 
      return JSON.parse(userStr); 
    } catch (e) {}
  }

  // Fallback: decode JWT payload if session storage object is missing
  const token = sessionStorage.getItem('token');
  if (token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(window.atob(base64));
    } catch (e) {
      console.error("Error al decodificar token de usuario:", e);
    }
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
    const hiddenTabIds = ['nav-leaderboard', 'nav-estudiantes', 'nav-jueces', 'nav-proyectos'];
    hiddenTabIds.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.style.display = 'none';
    });

    const dashBtn = document.getElementById('nav-juez-dashboard');
    if (dashBtn) dashBtn.style.display = 'flex';

    const titleEl = document.getElementById('panel-title');
    if (titleEl) titleEl.textContent = '⚖️ Panel Juez';
  } else {
    // Ocultar el Dashboard de Juez si el usuario es Admin
    const dashBtn = document.getElementById('nav-juez-dashboard');
    if (dashBtn) dashBtn.style.display = 'none';
  }


}


function switchTab(tabName) {
  const userRole = obtenerRolUsuario();
  const adminOnlyTabs = ['leaderboard', 'estudiantes', 'jueces', 'proyectos'];

  if (userRole.toLowerCase() === 'juez' && adminOnlyTabs.includes(tabName)) {
    console.warn('Acceso denegado: Tu perfil de Juez no tiene acceso a este módulo.');
    return;
  }

  if (userRole.toLowerCase() !== 'juez' && tabName === 'juez-dashboard') {
    console.warn('Acceso denegado: Este módulo solo está disponible para Jueces.');
    return;
  }

  document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  
  const targetSec = document.getElementById(`sec-${tabName}`);
  const targetBtn = document.getElementById(`nav-${tabName}`);

  if (targetSec) targetSec.classList.add('active');
  if (targetBtn) targetBtn.classList.add('active');

  resetearVistaEvaluaciones();

  if (tabName === 'leaderboard') {
    loadLeaderboardData();
  } else if (tabName === 'estudiantes') {
    cargarOpcionesProyectos();
    cargarEstudiantes();
  } else if (tabName === 'jueces') {
    cargarOpcionesProyectosJuez();
    cargarJueces();
  } else if (tabName === 'proyectos') {
    cargarProyectos();
  } else if (tabName === 'evaluaciones') {
    if (typeof cargarEvaluaciones === 'function') cargarEvaluaciones();
  } else if (tabName === 'juez-dashboard') {
    cargarJuezDashboard();
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

// 3. Función para cargar los datos del Juez y sus proyectos en modo SOLO LECTURA
async function cargarJuezDashboard() {
  const currentUser = obtenerUsuarioActual();
  if (!currentUser) return;

  const nameEl = document.getElementById('dash-juez-nombre');
  const emailEl = document.getElementById('dash-juez-correo');
  const totalEl = document.getElementById('dash-juez-total-proyectos');
  const tbody = document.getElementById('tbl-juez-dashboard');

  if (tbody) tbody.innerHTML = '<tr><td colspan="6">Cargando proyectos asignados...</td></tr>';

  // Fetch all judges from API to get full profile details (name and assigned projects)
  const todosJueces = await fetchDatosAPI('jueces');
  let juezProfile = null;

  if (todosJueces && todosJueces.length > 0) {
    juezProfile = todosJueces.find(j => 
      (currentUser.id && String(j._id) === String(currentUser.id)) ||
      (currentUser._id && String(j._id) === String(currentUser._id)) ||
      (currentUser.email && j.email && j.email.toLowerCase() === currentUser.email.toLowerCase())
    );
  }

  // Resolve full name prioritizing database profile > session user object > email
  const nombreCompleto = juezProfile?.name || juezProfile?.nombre || 
                         currentUser.name || currentUser.nombre || 
                         currentUser.email || 'Juez';

  if (nameEl) nameEl.textContent = nombreCompleto;
  if (emailEl) emailEl.textContent = currentUser.email || juezProfile?.email || '-';

  const todosProyectos = await fetchDatosAPI('proyectos');
  if (!todosProyectos || todosProyectos.length === 0) {
    if (totalEl) totalEl.textContent = '0';
    if (tbody) tbody.innerHTML = '<tr><td colspan="6">No hay proyectos registrados en el sistema.</td></tr>';
    return;
  }

  // Map assigned project IDs from either the DB profile or session user
  const assignedProjectsSource = juezProfile?.assignedProjects || currentUser.assignedProjects || [];
  const assignedIds = assignedProjectsSource.map(p => 
    typeof p === 'string' ? p : (p.id || p._id)
  );

  const misProyectos = todosProyectos.filter(p => assignedIds.includes(p._id));

  if (totalEl) totalEl.textContent = misProyectos.length;

  if (misProyectos.length === 0) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="6">No tiene proyectos asignados actualmente.</td></tr>';
    return;
  }

  if (tbody) tbody.innerHTML = '';

  misProyectos.forEach(proy => {
    const currentUserId = currentUser.id || currentUser._id || juezProfile?._id || '';
    const evaluacionExistente = (proy.evaluacion || []).find(e => 
      e.juez && String(e.juez.id) === String(currentUserId)
    );

    const estadoText = evaluacionExistente 
      ? '<span style="color: #4ade80; font-weight: bold;">✅ Evaluado</span>' 
      : '<span style="color: #f59e0b; font-weight: bold;">⏳ Pendiente</span>';

    const puntajeText = evaluacionExistente 
      ? `<strong class="score-cell">${evaluacionExistente.Total || 0} pts</strong>` 
      : '-';

    const comentariosText = evaluacionExistente 
      ? (evaluacionExistente.comentarios || '-') 
      : '-';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${proy.tituloProyecto || proy.title || 'Sin título'}</strong></td>
      <td>${proy.centroEducativo || 'N/A'}</td>
      <td>${proy.categoria || 'N/A'}</td>
      <td>${estadoText}</td>
      <td>${puntajeText}</td>
      <td style="max-width: 250px; word-break: break-word;">${comentariosText}</td>
    `;
    tbody.appendChild(tr);
  });
}



async function guardarEstudiante(event) {
  event.preventDefault();
  const id = document.getElementById('est-id').value;
  const selectedProjectId = document.getElementById('est-proid').value;

  // Obtener estudiantes actuales para validar el cupo por proyecto
  const estudiantes = await fetchDatosAPI('estudiantes');
  
  if (estudiantes) {
    // Filtrar los estudiantes pertenecientes al mismo proyecto (excluyendo al actual en caso de edición)
    const estudiantesEnProyecto = estudiantes.filter(est => {
      const pId = typeof est.projectId === 'object' && est.projectId ? est.projectId._id : est.projectId;
      return pId === selectedProjectId && String(est._id) !== String(id);
    });

    if (estudiantesEnProyecto.length >= 3) {
      alert('❌ No se puede asignar más estudiantes. El proyecto seleccionado ya tiene el máximo permitido (3 estudiantes).');
      return;
    }
  }

  const payload = {
    projectId: selectedProjectId,
    name: document.getElementById('est-nombre').value,
    email: document.getElementById('est-correo').value
  };

  await enviarDatosAPI('estudiantes', payload, cargarEstudiantes, id);
}
/*
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
*/

async function guardarJuez(event) {
  event.preventDefault();
  const id = document.getElementById('juez-id').value;
  const selectProyectos = document.getElementById('juez-proyectos');
  const emailInput = (document.getElementById('juez-correo')?.value || '').trim();


  
  const selectedProjects = Array.from(selectProyectos.selectedOptions)
    .map(opt => opt.value)
    .filter(val => val.trim() !== '');


  // Fetch current judges to validate capacity per project
  const jueces = await fetchDatosAPI('jueces');

  // Validate duplicate Juez email
  if (jueces) {
    const existeDuplicado = jueces.some(juez => {
      // Exclude the current judge when editing
      if (id && String(juez._id) === String(id)) return false;

      const emailExistente = (juez.email || '').toString().trim();
      return emailExistente.toLowerCase() === emailInput.toLowerCase();
    });

    if (existeDuplicado) {
      alert(`❌ Ya existe un juez registrado con el correo "${emailInput}". Por favor utilice un correo diferente.`);
      return;
    }
  }

  //Validates that no project has more than 3 judges assigned
  if (jueces) {
    for (const projId of selectedProjects) {
      // Filter judges assigned to projId, excluding the judge currently being edited
      const juecesEnProyecto = jueces.filter(j => {
        if (id && String(j._id) === String(id)) return false;

        const assignedIds = (j.assignedProjects || []).map(p => 
          typeof p === 'object' && p !== null ? String(p._id || p.id) : String(p)
        );
        return assignedIds.includes(String(projId));
      });

      if (juecesEnProyecto.length >= 3) {
        const optionText = selectProyectos.querySelector(`option[value="${projId}"]`)?.textContent || 'seleccionado';
        alert(`❌ No se puede asignar el proyecto ! "${optionText}". Ya tiene el máximo permitido de 3 jueces.`);
        return;
      }
    }
  }

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
  const tituloInput = document.getElementById('proy-nombre').value.trim();
  const categoria = document.getElementById('proy-cat').value;
  const puntajeEscrito = Number(document.getElementById('proy-puntaje-escrito').value) || 0;

  
  // Validate duplicate project title
  const proyectos = await fetchDatosAPI('proyectos');
  
  if (proyectos) {
    const existeDuplicado = proyectos.some(proy => {
      // Exclude the current project when editing
      if (id && String(proy._id) === String(id)) return false;

      const tituloExistente = (proy.tituloProyecto || proy.title || '').trim();
      return tituloExistente.toLowerCase() === tituloInput.toLowerCase();
    });

    if (existeDuplicado) {
      alert(`❌ Ya existe un proyecto registrado con el título "${tituloInput}". Por favor utilice un título diferente.`);
      return;
    }
  }
  

  // Validate maximum written score per category
  const esStem = categoria.toUpperCase().includes('STEAM') || categoria.toUpperCase().includes('STEM');
  const maximoPermitido = esStem ? 105 : 72;

  if (puntajeEscrito > maximoPermitido) {
    alert(`❌ El puntaje escrito para la categoría "${categoria}" no puede ser mayor a ${maximoPermitido}.`);
    return;
  }

  const payload = {
    tituloProyecto: document.getElementById('proy-nombre').value,
    centroEducativo: document.getElementById('proy-centro').value,
    categoria: categoria,
    ejeTematico: document.getElementById('proy-eje').value,
    puntajeEscrito: puntajeEscrito
  };

  if (!id) {
    payload.estudiante = [{ idEstudiante: "", nombre: "" }];
    payload.puntajeTotal = 0;
    payload.evaluacion = [];
  }

  await enviarDatosAPI('proyectos', payload, cargarProyectos, id);
}

function validarPuntajeEscritoMax() {
  const catInput = document.getElementById('proy-cat');
  const scoreInput = document.getElementById('proy-puntaje-escrito');
  if (!catInput || !scoreInput) return;

  const categoria = catInput.value.toUpperCase();
  const esStem = categoria.includes('STEAM') || categoria.includes('STEM');
  const maximo = esStem ? 105 : 72;

  scoreInput.max = maximo;

  if (Number(scoreInput.value) > maximo) {
    alert(`⚠️ El puntaje escrito máximo para la categoría seleccionada es ${maximo}.`);
    scoreInput.value = maximo;
  }
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
  // Added: Puntaje Escrito
  document.getElementById('proy-puntaje-escrito').value = proy.puntajeEscrito ?? 0;

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

async function eliminarEstudiante(id) {
  if (!confirm('¿Está seguro de que desea eliminar este estudiante?')) return;

  const token = sessionStorage.getItem('token');

  try {
    const res = await fetch(`${API_URL}/estudiantes/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await res.json();

    if (res.ok) {
      alert('✅ Estudiante eliminado con éxito');
      cargarEstudiantes();
    } else {
      alert('❌ Error: ' + (data.message || 'No se pudo eliminar el estudiante'));
    }
  } catch (err) {
    console.error(err);
    alert('❌ Error de conexión con el servidor');
  }
}

async function eliminarJuez(id) {
  if (!confirm('¿Está seguro de que desea eliminar este juez?')) return;

  const token = sessionStorage.getItem('token');

  try {
    const res = await fetch(`${API_URL}/jueces/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await res.json();

    if (res.ok) {
      alert('✅ Juez eliminado con éxito');
      cargarJueces();
    } else {
      alert('❌ Error: ' + (data.message || 'No se pudo eliminar el juez'));
    }
  } catch (err) {
    console.error(err);
    alert('❌ Error de conexión con el servidor');
  }
}

async function eliminarProyecto(id) {
  if (!confirm('¿Está seguro de que desea eliminar este proyecto?')) return;

  const token = sessionStorage.getItem('token');

  try {
    const res = await fetch(`${API_URL}/proyectos/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await res.json();

    if (res.ok) {
      alert('✅ Proyecto eliminado con éxito');
      cargarProyectos();
    } else {
      alert('❌ Error: ' + (data.message || 'No se pudo eliminar el proyecto'));
    }
  } catch (err) {
    console.error(err);
    alert('❌ Error de conexión con el servidor');
  }
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

  // Ordenar numéricamente por el prefijo del proyecto
  data.sort((a, b) => {
    const projA = typeof a.projectId === 'object' && a.projectId 
      ? (a.projectId.title || a.projectId.tituloProyecto || '') 
      : '';
    const projB = typeof b.projectId === 'object' && b.projectId 
      ? (b.projectId.title || b.projectId.tituloProyecto || '') 
      : '';

    const numA = parseInt(projA, 10);
    const numB = parseInt(projB, 10);

    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    if (!isNaN(numA)) return -1;
    if (!isNaN(numB)) return 1;

    return projA.localeCompare(projB, 'es', { sensitivity: 'base' });
  });

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
        <div class="actions-container">
          <button class="btn-action btn-edit" id="btn-edit-est-${item._id}">Editar</button>
          <button class="btn-action btn-delete" id="btn-del-est-${item._id}">Eliminar</button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);

    document.getElementById(`btn-edit-est-${item._id}`).addEventListener('click', () => prepararEdicionEstudiante(item));
    document.getElementById(`btn-del-est-${item._id}`).addEventListener('click', () => eliminarEstudiante(item._id));
  });
}



async function cargarJueces() {
  const tbody = document.getElementById('tbl-jueces');
  tbody.innerHTML = '<tr><td colspan="5">Cargando datos...</td></tr>';
  
  const data = await fetchDatosAPI('jueces');
  
  if (!data || data.length === 0) {
    paginationState.jueces.data = [];
    renderJuecesPage();
    return;
  }

  const obtenerTextoProyectos = (item) => {
    if (Array.isArray(item.assignedProjects) && item.assignedProjects.length > 0) {
      return item.assignedProjects
        .map(p => (typeof p === 'object' && p !== null) ? (p.tituloProyecto || p.title || '') : String(p))
        .join(', ');
    }
    return '';
  };

  // Ordenar numéricamente por el primer número de proyecto asignado
  data.sort((a, b) => {
    const projA = obtenerTextoProyectos(a);
    const projB = obtenerTextoProyectos(b);

    const numA = parseInt(projA, 10);
    const numB = parseInt(projB, 10);

    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    if (!isNaN(numA)) return -1;
    if (!isNaN(numB)) return 1;

    return projA.localeCompare(projB, 'es', { sensitivity: 'base' });
  });

  paginationState.jueces.data = data;
  renderJuecesPage();
}


function renderJuecesPage() {
  const state = paginationState.jueces;
  const tbody = document.getElementById('tbl-jueces');
  if (!tbody) return;

  const totalItems = state.data.length;
  const totalPages = Math.ceil(totalItems / state.pageSize) || 1;

  if (state.currentPage > totalPages) state.currentPage = totalPages;
  if (state.currentPage < 1) state.currentPage = 1;

  const start = (state.currentPage - 1) * state.pageSize;
  const end = start + Number(state.pageSize);
  const pageData = state.data.slice(start, end);

  const pageInfo = document.getElementById('page-info-jueces');
  const btnPrev = document.getElementById('btn-prev-jueces');
  const btnNext = document.getElementById('btn-next-jueces');

  if (pageInfo) pageInfo.textContent = `Página ${state.currentPage} de ${totalPages}`;
  if (btnPrev) btnPrev.disabled = state.currentPage <= 1;
  if (btnNext) btnNext.disabled = state.currentPage >= totalPages || totalPages === 0;

  tbody.innerHTML = '';

  if (!pageData || pageData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">No hay jueces registrados.</td></tr>';
    return;
  }

  pageData.forEach(item => {
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
        <div class="actions-container">
          <button class="btn-action btn-edit" id="btn-edit-juez-${item._id}">Editar</button>
          <button class="btn-action btn-delete" id="btn-del-juez-${item._id}">Eliminar</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);

    document.getElementById(`btn-edit-juez-${item._id}`).addEventListener('click', () => prepararEdicionJuez(item));
    document.getElementById(`btn-del-juez-${item._id}`).addEventListener('click', () => eliminarJuez(item._id));
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
  
  if (!data || data.length === 0) {
    paginationState.proyectos.data = [];
    renderProyectosPage();
    return;
  }

  // Ordenar numéricamente por el prefijo del título del proyecto
  data.sort((a, b) => {
    const titleA = a.tituloProyecto || a.title || '';
    const titleB = b.tituloProyecto || b.title || '';

    const numA = parseInt(titleA, 10);
    const numB = parseInt(titleB, 10);

    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    if (!isNaN(numA)) return -1;
    if (!isNaN(numB)) return 1;

    return titleA.localeCompare(titleB, 'es', { sensitivity: 'base' });
  });

  paginationState.proyectos.data = data;
  renderProyectosPage();
}


function renderProyectosPage() {
  const state = paginationState.proyectos;
  const tbody = document.getElementById('tbl-proyectos');
  if (!tbody) return;

  const totalItems = state.data.length;
  const totalPages = Math.ceil(totalItems / state.pageSize) || 1;

  if (state.currentPage > totalPages) state.currentPage = totalPages;
  if (state.currentPage < 1) state.currentPage = 1;

  const start = (state.currentPage - 1) * state.pageSize;
  const end = start + Number(state.pageSize);
  const pageData = state.data.slice(start, end);

  const pageInfo = document.getElementById('page-info-proyectos');
  const btnPrev = document.getElementById('btn-prev-proyectos');
  const btnNext = document.getElementById('btn-next-proyectos');

  if (pageInfo) pageInfo.textContent = `Página ${state.currentPage} de ${totalPages}`;
  if (btnPrev) btnPrev.disabled = state.currentPage <= 1;
  if (btnNext) btnNext.disabled = state.currentPage >= totalPages || totalPages === 0;

  tbody.innerHTML = '';

  if (!pageData || pageData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7">No hay proyectos registrados.</td></tr>';
    return;
  }

  pageData.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item._id.substring(0,6)}...</td>
      <td>${item.tituloProyecto || item.title || '-'}</td>
      <td>${item.centroEducativo || '-'}</td>
      <td>${item.categoria || '-'}</td>
      <td>${item.ejeTematico || '-'}</td>
      <td>${item.puntajeEscrito ?? 0} pts</td>
      <td>
        <div class="actions-container">
          <button class="btn-action btn-edit" id="btn-edit-proy-${item._id}">Editar</button>
          <button class="btn-action btn-delete" id="btn-del-proy-${item._id}">Eliminar</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);

    document.getElementById(`btn-edit-proy-${item._id}`).addEventListener('click', () => prepararEdicionProyecto(item));
    document.getElementById(`btn-del-proy-${item._id}`).addEventListener('click', () => eliminarProyecto(item._id));
  });
}



//===================================================   
// Pagination functions for all categories
//===================================================
function changePageSize(category, newSize) {
  const state = paginationState[category];
  if (!state) return;

  state.pageSize = parseInt(newSize, 10);
  state.currentPage = 1;

  if (category === 'estudiantes') {
    renderEstudiantesPage();
  } else if (category === 'proyectos') {
    renderProyectosPage();
  } else if (category === 'jueces') {
    renderJuecesPage();
  } else {
    // Handles 'modelo', 'steam', or any other evaluation category
    renderLeaderboardPage(category);
  }
}

function changePage(category, delta) {
  const state = paginationState[category];
  if (!state) return;

  state.currentPage += delta;

  if (category === 'estudiantes') {
    renderEstudiantesPage();
  } else if (category === 'proyectos') {
    renderProyectosPage();
  } else if (category === 'jueces') {
    renderJuecesPage();
  } else {
    // Handles 'modelo', 'steam', or any other evaluation category
    renderLeaderboardPage(category);
  }
}


// ==========================================
// LEADERBOARD POR CATEGORÍAS Y PAGINACIÓN
// ==========================================

function calcularPuntajeTotal(item, categoryHint = '') {
  const votesCount = item.scores ? item.scores.length : (item.evaluacion ? item.evaluacion.length : 0);
  
  let avgScoreNum = 0;
  if (item.scores && item.scores.length > 0) {
    avgScoreNum = item.scores.reduce((sum, scoreObj) => sum + scoreObj.score, 0) / (votesCount || 1);
  } else if (item.evaluacion && item.evaluacion.length > 0) {
    avgScoreNum = item.evaluacion.reduce((sum, ev) => sum + (ev.Total || 0), 0) / (votesCount || 1);
  }

  const N1 = Number(item.puntajeEscrito) || 0;
  const N2 = avgScoreNum;

  const cat = (item.categoria || categoryHint || '').toUpperCase();
  const esStem = cat.includes('STEM') || cat.includes('STEAM');

  const M1 = esStem ? 105 : 72;
  const M2 = esStem ? 111 : 54;

  return Number((50 * ((N1 / M1) + (N2 / M2))).toFixed(1));
}

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

  // Sort both categories in descending order based on calculated puntajeTotal
  paginationState.modelo.data = data
    .filter(p => !p.categoria || p.categoria.toUpperCase() !== 'STEAM')
    .sort((a, b) => calcularPuntajeTotal(b, 'modelo') - calcularPuntajeTotal(a, 'modelo'));

  paginationState.steam.data = data
    .filter(p => p.categoria && p.categoria.toUpperCase() === 'STEAM')
    .sort((a, b) => calcularPuntajeTotal(b, 'steam') - calcularPuntajeTotal(a, 'steam'));

  const totalVotes = data.reduce((acc, curr) => acc + (curr.scores ? curr.scores.length : (curr.evaluacion ? curr.evaluacion.length : 0)), 0);
  document.getElementById('kpi-total-votes').textContent = totalVotes;

  // Update Top KPI Cards
  if (paginationState.modelo.data.length > 0) {
    const topM = paginationState.modelo.data[0];
    const scoreM = calcularPuntajeTotal(topM, 'modelo').toFixed(1);
    document.getElementById('kpi-top-modelo').textContent = `${topM.title || topM.tituloProyecto} (${scoreM} pts)`;
  } else {
    document.getElementById('kpi-top-modelo').textContent = '-';
  }

  if (paginationState.steam.data.length > 0) {
    const topS = paginationState.steam.data[0];
    const scoreS = calcularPuntajeTotal(topS, 'steam').toFixed(1);
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
    tbody.innerHTML = '<tr><td colspan="7">No hay proyectos registrados en esta categoría.</td></tr>';
    return;
  }

  pageData.forEach((item, index) => {
    const rank = start + index + 1;
    const badgeClass = rank === 1 ? 'badge-1' : rank === 2 ? 'badge-2' : rank === 3 ? 'badge-3' : 'badge-other';
    const votesCount = item.scores ? item.scores.length : (item.evaluacion ? item.evaluacion.length : 0);
    
    let avgScoreNum = 0;
    if (item.scores && item.scores.length > 0) {
      avgScoreNum = item.scores.reduce((sum, scoreObj) => sum + scoreObj.score, 0) / (votesCount || 1);
    } else if (item.evaluacion && item.evaluacion.length > 0) {
      avgScoreNum = item.evaluacion.reduce((sum, ev) => sum + (ev.Total || 0), 0) / (votesCount || 1);
    }

    const avgScore = avgScoreNum.toFixed(1);
    const N1 = Number(item.puntajeEscrito) || 0;
    const puntajeTotal = calcularPuntajeTotal(item, category).toFixed(1);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="badge ${badgeClass}">${rank}</span></td>
      <td><strong>${item.title || item.tituloProyecto}</strong></td>
      <td>${item.centroEducativo || 'N/A'}</td>
      <td>${votesCount} Juez(ces)</td>
      <td>${N1} pts</td>
      <td>${avgScore} pts prom.</td>
      <td class="score-cell">${puntajeTotal} pts</td>
    `;
    tbody.appendChild(tr);
  });
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
  { id: 'q', label: 'q. Explica los canales utilizados para dar a conocer su modelo de negocios.' },
  { id: 'r', label: 'r. Describe las alianzas estratégicas de su propuesta de valor.' }
];

const PREGUNTAS_STEM = [
  { id: '1', label: '1. Define el problema de forma precisa.' },
  { id: '2', label: '2. Plantea alternativas de solución que contemplen conceptos teóricos prácticos atinentes al problema.' },
  { id: '3', label: '3. Propone objetivos vinculados con la búsqueda de soluciones al problema planteado.' },
  { id: '4', label: '4. Evidencia el impacto del proyecto a nivel social, científico o tecnológico, tanto a corto como largo plazo.' },
  { id: '5', label: '5. Demuestra capacidad para expresar ideas con seguridad y defender el proyecto planteado.' },
  { id: '6', label: '6. Demuestra en su elaboración una línea de investigación y desarrollo coherente y clara.' },
  { id: '7', label: '7. Argumenta, desde la implementación del proyecto, el análisis e interpretación de los datos recopilados.' },
  { id: '8', label: '8. Evidencia la gestión de recursos y búsqueda de apoyo para la elaboración del proyecto.' },
  { id: '9', label: '9. Demuestra originalidad y autoría propia del proyecto expuesto.' },
  { id: '10', label: '10. Aplica la normativa vigente en el contexto del proyecto.' },
  { id: '11', label: '11. Se evidencia la factibilidad e implementación comercial o industrial del proyecto, a futuro.' },
  { id: '12', label: '12. Presenta una línea de trabajo de investigación y desarrollo coherente y clara.' },
  { id: '13', label: '13. Da respuesta a la necesidad u objetivos planteados.' },
  { id: '14', label: '14. Evidencia el uso óptimo de los recursos disponibles para su construcción.' },
  { id: '15', label: '15. Demuestra precisión técnica en la elaboración y funcionamiento del prototipo, al aplicar de forma correcta los conocimientos científicos y tecnológicos en la solución presentada.' },
  { id: '16', label: '16. Respeta las normativas de seguridad y otras vigentes en su construcción y desempeño.' },
  { id: '17', label: '17. Muestra actualidad tecnológica en el campo de trabajo seleccionado.' },
  { id: '18', label: '18. Evidencia el funcionamiento correcto según la solución planteada en el proyecto.' },
  { id: '19', label: '19. Demuestra creatividad e innovación en el desarrollo de ideas nuevas o mejoradas al crear el prototipo.' },
  { id: '20', label: '20. Evidencia apropiación y dominio del tema del proyecto.' },
  { id: '21', label: '21. Demuestra claridad y coherencia en la exposición del proyecto ante el panel de jueces.' },
  { id: '22', label: '22. Utiliza lenguaje técnico acorde con el nivel académico y el campo de desarrollo del proyecto.' },
  { id: '23', label: '23. Argumenta de forma sólida y fundamentada su propuesta de proyecto.' },
  { id: '24', label: '24. Emplea recursos afines con el tema del proyecto (diseños, diagramas, gráficos, esquemas, modelos, programas de computación, equipos, entre otros).' },
  { id: '25', label: '25. Describe la metodología utilizada para la implementación, evaluación y perfeccionamiento de la solución propuesta.' },
  { id: '26', label: '26. Presenta resultados consistentes con los objetivos y solución al problema planteado.' },
  { id: '27', label: '27. Brinda conclusiones precisas y objetivas basadas en los resultados obtenidos.' },
  { id: '28', label: '28. Denota colaboración y comunicación efectiva del estudiante o integrantes del equipo, según corresponda.' },
  { id: '29', label: '29. Demuestra capacidad de recibir, analizar y aplicar sugerencias para mejorar el proyecto.' },
  { id: '30', label: '30. Se evidencia congruencia entre lo expuesto por la persona estudiante o equipo y el informe escrito.' },
  { id: '31', label: '31. Evidencia el uso de lenguaje técnico afín al tema del proyecto.' },
  { id: '32', label: '32. Estipula los procedimientos técnicos utilizados.' },
  { id: '33', label: '33. Investigación.' },
  { id: '34', label: '34. Implementación.' },
  { id: '35', label: '35. Experimentación.' },
  { id: '36', label: '36. Contiene información relevante para la exposición del proyecto.' },
  { id: '37', label: '37. Utiliza el cartel como recurso y apoyo para el desarrollo de la exposición.' }
  
];

function validarInputPuntaje(input) {
  if (Number(input.value) > 3) {
    alert('⚠️ El puntaje máximo por criterio es 3.');
    input.value = 3;
  } else if (Number(input.value) < 0) {
    input.value = 0;
  }
  calcularPuntajeTotalEval();
}

/*
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
*/

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
    let assignedProjectsSource = user?.assignedProjects || [];

    // Fetch judge profile from API to ensure up-to-date assignment sync
    const todosJueces = await fetchDatosAPI('jueces');
    if (todosJueces && todosJueces.length > 0 && user) {
      const juezProfile = todosJueces.find(j => 
        (user.id && String(j._id) === String(user.id)) ||
        (user._id && String(j._id) === String(user._id)) ||
        (user.email && j.email && j.email.toLowerCase() === user.email.toLowerCase())
      );
      if (juezProfile?.assignedProjects) {
        assignedProjectsSource = juezProfile.assignedProjects;
      }
    }

    const assignedIds = assignedProjectsSource.map(p => 
      typeof p === 'object' && p !== null ? String(p._id || p.id) : String(p)
    );

    // Filter strictly by assigned IDs; if assignedIds is empty, filter results in []
    proyectosMostrados = todosProyectos.filter(p => assignedIds.includes(String(p._id)));
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
/*
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
    const maxPts = 3; // Fixed maximum score limit

    rubricQuestions.forEach(q => {
      const row = document.createElement('div');
      row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #475569; padding: 8px 0; gap: 12px;';
      row.innerHTML = `
        <label for="eval-preg-${q.id}" style="flex: 1; font-size: 0.9rem; font-weight: 500;">${q.label}</label>
        <input type="number" class="eval-score-input" id="eval-preg-${q.id}" data-id="${q.id}" data-text="${q.label}" min="0" max="${maxPts}" value="0" style="width: 80px; text-align: center; font-weight: bold;" oninput="validarInputPuntaje(this)" required>
      `;
      questionsContainer.appendChild(row);
    });
  }

  document.getElementById('eval-total').value = 0;
  if (formContainer) formContainer.style.display = 'block';

  mostrarDetalleEvaluacion(proyectoId);
}
*/

function alSeleccionarProyecto(proyectoId) {
  const formContainer = document.getElementById('container-form-evaluacion');
  const questionsContainer = document.getElementById('eval-questions-container');

  if (!proyectoId) {
    if (formContainer) formContainer.style.display = 'none';
    mostrarDetalleEvaluacion(proyectoId);
    return;
  }

  const proyecto = proyectosCargados.find(p => p._id === proyectoId);
  if (!proyecto) return;

  const cat = proyecto.categoria ? proyecto.categoria.toUpperCase() : '';
  const esStem = cat.includes('STEM') || cat.includes('STEAM');

  if (questionsContainer) {
    questionsContainer.innerHTML = '';
    const rubricQuestions = esStem ? PREGUNTAS_STEM : PREGUNTAS_MODELO_NEGOCIO;
    const maxPts = 3;

    rubricQuestions.forEach(q => {
      const row = document.createElement('div');
      row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #475569; padding: 8px 0; gap: 12px;';
      row.innerHTML = `
        <label for="eval-preg-${q.id}" style="flex: 1; font-size: 0.9rem; font-weight: 500;">${q.label}</label>
        <input type="number" class="eval-score-input" id="eval-preg-${q.id}" data-id="${q.id}" data-text="${q.label}" min="0" max="${maxPts}" style="width: 80px; text-align: center; font-weight: bold;" oninput="validarInputPuntaje(this)" required>
      `;
      questionsContainer.appendChild(row);
    });
  }

  document.getElementById('eval-total').value = 0;
  if (formContainer) formContainer.style.display = 'block';

  // Check if current judge already evaluated this project
  const currentUser = obtenerUsuarioActual();
  const currentUserId = currentUser ? (currentUser.id || currentUser._id || currentUser.sub || '') : '';
  
  const evaluacionExistente = (proyecto.evaluacion || proyecto.evaluaciones || []).find(e => {
    const eJuezId = e.juez ? (e.juez.id || e.juez._id || e.juez) : (e.juezId || '');
    return eJuezId && String(eJuezId) === String(currentUserId);
  });

  // If already evaluated, automatically enter edit mode for that evaluation
  if (evaluacionExistente) {
    prepararEdicionEvaluacion(evaluacionExistente.id);
  } else {
    cancelarEdicionEvaluacion();
  }

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
    tbody.innerHTML = '<tr><td colspan="4">Seleccione un proyecto de la lista superior para ver sus evaluaciones.</td></tr>';
    return;
  }

  const proyecto = proyectosCargados.find(p => p._id === proyectoId);

  if (!proyecto || !proyecto.evaluacion || proyecto.evaluacion.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4">Este proyecto aún no cuenta con evaluaciones registradas.</td></tr>';
    return;
  }

  const userRole = obtenerRolUsuario();
  const currentUser = obtenerUsuarioActual();
  const currentUserId = currentUser ? (currentUser.id || currentUser._id || '') : '';
  const isAdmin = userRole.toLowerCase() === 'admin';

  proyecto.evaluacion.forEach(ev => {
    const juezId = ev.juez ? (ev.juez.id || ev.juez._id || ev.juez) : '';
    const esDuenio = Boolean(juezId && String(juezId) === String(currentUserId));
    const puedeVerYEditar = isAdmin || esDuenio;

    // Mask points and comments if the user is not an admin nor the evaluation owner
    const puntajeMostrar = puedeVerYEditar ? `${ev.Total || 0} pts` : '-';
    const comentariosMostrar = puedeVerYEditar ? (ev.comentarios || '-') : '-';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${ev.juez ? (ev.juez.nombre || ev.juez.email || 'Juez') : 'Juez'}</td>
      
      <td class="score-cell">${puntajeMostrar}</td>
      
      <td style="max-width: 250px; word-break: break-word;">${comentariosMostrar}</td>
      <td>
        ${puedeVerYEditar ? `
          <div class="actions-container">
            <button class="btn-action btn-edit" onclick="prepararEdicionEvaluacion('${ev.id}')">Editar</button>
            <button class="btn-action btn-delete" onclick="eliminarEvaluacion('${ev.id}')">Eliminar</button>
          </div>
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

  // Cargar comentarios existentes en el campo del formulario (NUEVO)
  const comentariosEl = document.getElementById('eval-comentarios');
  if (comentariosEl) {
    comentariosEl.value = evaluacion.comentarios || '';
  }

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

  const comentariosEl = document.getElementById('eval-comentarios');
  if (comentariosEl) comentariosEl.value = '';

  const submitBtn = document.getElementById('btn-submit-eval');
  const cancelBtn = document.getElementById('btn-cancel-eval');
  if (submitBtn) submitBtn.textContent = '💾 Guardar Evaluación';
  if (cancelBtn) cancelBtn.style.display = 'none';
}

// 3. Handle both POST (Create) and PUT (Edit) submissions

/*
async function guardarEvaluacion(event) {
  event.preventDefault();

  const proyectoId = document.getElementById('select-eval-proyecto').value;
  const evalId = document.getElementById('eval-id').value;
  const comentarios = document.getElementById('eval-comentarios').value.trim() || '';

  if (!proyectoId) {
    alert('Por favor seleccione un proyecto.');
    return;
  }

  const isUpdate = Boolean(evalId);

  // --- MAX 3 EVALUATIONS VALIDATION ---
  if (!isUpdate) {
    const proyecto = proyectosCargados.find(p => p._id === proyectoId);
    const evaluacionesExistentes = proyecto ? (proyecto.evaluacion || proyecto.evaluaciones || []) : [];

    if (evaluacionesExistentes.length >= 3) {
      alert('❌ Este proyecto ya cuenta con el número máximo permitido de 3 evaluaciones.');
      return;
    }
  }
  // ------------------------------------

  const total = Number(document.getElementById('eval-total').value) || 0;
  const userRole = obtenerRolUsuario();
  const currentUser = obtenerUsuarioActual();

  let nombreJuez = currentUser ? (currentUser.nombre || currentUser.name || currentUser.email || 'Juez') : 'Juez';
  let juezId = currentUser ? (currentUser.id || currentUser._id || currentUser.sub || '') : '';

  const inputs = document.querySelectorAll('.eval-score-input');

  // Score limit validation
  let tieneExceso = false;
  inputs.forEach(inp => {
    if (Number(inp.value) > 3) {
      tieneExceso = true;
    }
  });

  if (tieneExceso) {
    alert('❌ Ningún criterio individual puede superar los 3 puntos.');
    return;
  }

  const preguntasDetalle = {};
  inputs.forEach(inp => {
    const qKey = inp.getAttribute('data-id');
    const qText = inp.getAttribute('data-text') || qKey;
    const scoreVal = Number(inp.value) || 0;

    preguntasDetalle[qKey] = {
      texto: qText,
      puntos: scoreVal
    };
  });

  // Payload formatted with fallbacks to satisfy both flat and nested schemas
  const payload = {
    total: total,
    Total: total,
    nombreJuez: nombreJuez,
    juezId: juezId,
    juez: {
      id: juezId,
      _id: juezId,
      nombre: nombreJuez
    },
    userRole: userRole,
    comentarios: comentarios,
    preguntasDetalle: preguntasDetalle,
    preguntas: preguntasDetalle
  };

  const token = sessionStorage.getItem('token');
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

      // Safely extract updated project object from response
      const proyectoActualizado = data.proyecto || data.data || (data._id ? data : null);

      if (proyectoActualizado) {
        const proyectoIdx = proyectosCargados.findIndex(p => p._id === proyectoId);
        if (proyectoIdx !== -1) {
          proyectosCargados[proyectoIdx] = proyectoActualizado;
        }
      } else {
        // Fallback: reload projects from API if payload structure varies
        const todosProyectos = await fetchDatosAPI('proyectos');
        if (todosProyectos) proyectosCargados = todosProyectos;
      }

      cancelarEdicionEvaluacion();

      // Force table refresh for the updated project
      if (typeof mostrarDetalleEvaluacion === 'function') {
        mostrarDetalleEvaluacion(proyectoId);
      }
    } else {
      alert('❌ Error: ' + (data.message || 'No se pudo guardar la evaluación'));
    }
  } catch (err) {
    console.error('Error al guardar evaluación:', err);
    alert('❌ Error de conexión con el servidor');
  }
}
*/
async function guardarEvaluacion(event) {
  event.preventDefault();

  const proyectoId = document.getElementById('select-eval-proyecto').value;
  const evalId = document.getElementById('eval-id').value;
  const comentarios = document.getElementById('eval-comentarios').value.trim() || '';

  if (!proyectoId) {
    alert('Por favor seleccione un proyecto.');
    return;
  }

  const isUpdate = Boolean(evalId);
  const userRole = obtenerRolUsuario();
  const currentUser = obtenerUsuarioActual();

  let nombreJuez = currentUser ? (currentUser.nombre || currentUser.name || currentUser.email || 'Juez') : 'Juez';
  let juezId = currentUser ? (currentUser.id || currentUser._id || currentUser.sub || '') : '';

  const proyecto = proyectosCargados.find(p => p._id === proyectoId);
  const evaluacionesExistentes = proyecto ? (proyecto.evaluacion || proyecto.evaluaciones || []) : [];

  // --- BUSINESS LOGIC VALIDATIONS FOR NEW EVALUATIONS ---
  if (!isUpdate) {
    // 1. Prevent duplicate evaluation by the same judge
    const yaEvaluado = evaluacionesExistentes.some(ev => {
      const evJuezId = ev.juez ? (ev.juez.id || ev.juez._id || ev.juez) : (ev.juezId || '');
      return evJuezId && String(evJuezId) === String(juezId);
    });

    if (yaEvaluado) {
      alert('❌ Ya has registrado una evaluación para este proyecto. Debes editar la evaluación existente o eliminarla antes de crear una nueva.');
      return;
    }

    // 2. Maximum total evaluation cap per project
    if (evaluacionesExistentes.length >= 3) {
      alert('❌ Este proyecto ya cuenta con el número máximo permitido de 3 evaluaciones.');
      return;
    }
  }
  // ------------------------------------------------------

  const total = Number(document.getElementById('eval-total').value) || 0;
  const inputs = document.querySelectorAll('.eval-score-input');

  let tieneExceso = false;
  inputs.forEach(inp => {
    if (Number(inp.value) > 3) {
      tieneExceso = true;
    }
  });

  if (tieneExceso) {
    alert('❌ Ningún criterio individual puede superar los 3 puntos.');
    return;
  }

  const preguntasDetalle = {};
  inputs.forEach(inp => {
    const qKey = inp.getAttribute('data-id');
    const qText = inp.getAttribute('data-text') || qKey;
    const scoreVal = Number(inp.value) || 0;

    preguntasDetalle[qKey] = {
      texto: qText,
      puntos: scoreVal
    };
  });

  const payload = {
    total: total,
    Total: total,
    nombreJuez: nombreJuez,
    juezId: juezId,
    juez: {
      id: juezId,
      _id: juezId,
      nombre: nombreJuez
    },
    userRole: userRole,
    comentarios: comentarios,
    preguntasDetalle: preguntasDetalle,
    preguntas: preguntasDetalle
  };

  const token = sessionStorage.getItem('token');
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

      const proyectoActualizado = data.proyecto || data.data || (data._id ? data : null);

      if (proyectoActualizado) {
        const proyectoIdx = proyectosCargados.findIndex(p => p._id === proyectoId);
        if (proyectoIdx !== -1) {
          proyectosCargados[proyectoIdx] = proyectoActualizado;
        }
      } else {
        const todosProyectos = await fetchDatosAPI('proyectos');
        if (todosProyectos) proyectosCargados = todosProyectos;
      }

      cancelarEdicionEvaluacion();

      if (typeof mostrarDetalleEvaluacion === 'function') {
        mostrarDetalleEvaluacion(proyectoId);
      }
    } else {
      alert('❌ Error: ' + (data.message || 'No se pudo guardar la evaluación'));
    }
  } catch (err) {
    console.error('Error al guardar evaluación:', err);
    alert('❌ Error de conexión con el servidor');
  }
}


// ==========================================
// INICIALIZACIÓN
// ==========================================



function initApp() {
  applyRolePermissions();

  // Check the logged-in user's role
  const userRole = obtenerRolUsuario();

  if (userRole.toLowerCase() === 'juez') {
    // Automatically switch judges to the Evaluaciones view
    switchTab('juez-dashboard');
  } else {
    // Default view for admins
    switchTab('leaderboard');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}