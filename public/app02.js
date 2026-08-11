// public/app.js

// Validar sesión al cargar
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

  // Llama a la función específica según la pestaña
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

// Logout function
function logout() {
  sessionStorage.removeItem('token');
  window.location.replace('login.html');
}

// ==========================================
// MÉTODOS DE INSERCIÓN SEPARADOS (POST)
// ==========================================

async function guardarEstudiante(event) {
  event.preventDefault();
  const payload = {
    projectId: document.getElementById('est-proid').value,
    name: document.getElementById('est-nombre').value,
    email: document.getElementById('est-correo').value,
    major: document.getElementById('est-carrera').value
  };
  await enviarDatosAPI('estudiantes', payload, event.target, cargarEstudiantes);
}

async function guardarJuez(event) {
  event.preventDefault();
  const payload = {
    //judgeId: document.getElementById('juez-id').value,
    name: document.getElementById('juez-nombre').value,
    email: document.getElementById('juez-correo').value,
    specialty: document.getElementById('juez-esp').value
  };
  await enviarDatosAPI('jueces', payload, event.target, cargarJueces);
}

async function guardarProyecto(event) {
  event.preventDefault();
  const payload = {
   
    title: document.getElementById('proy-nombre').value,
    description: document.getElementById('proy-desc').value,
    teamMembers: document.getElementById('proy-integ').value
  };
  await enviarDatosAPI('proyectos', payload, event.target, cargarProyectos);
}

// Helper para centralizar peticiones POST y manejar recargas
async function enviarDatosAPI(endpoint, payload, formElement, reloadCallback) {
  const token = sessionStorage.getItem('token');
  
  try {
    const response = await fetch(`${API_URL}/${endpoint}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const resData = await response.json();
    if (response.ok) {
      alert(`✅ Guardado correctamente en la base de datos (${endpoint})`);
      formElement.reset();
      if (reloadCallback) reloadCallback(); // Recarga solo la tabla afectada
    } else {
      alert('❌ Error: ' + resData.message);
    }
  } catch (err) {
    console.error(err);
    alert('❌ Error de conexión al intentar guardar.');
  }
}

// ==========================================
// MÉTODOS DE OBTENCIÓN SEPARADOS (GET)
// ==========================================

// Helper para centralizar peticiones GET
async function fetchDatosAPI(endpoint) {
  const token = sessionStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL}/${endpoint}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Error en la petición: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(err);
    return null;
  }
}

async function cargarEstudiantes() {
  const tbody = document.getElementById('tbl-estudiantes');
  tbody.innerHTML = '<tr><td colspan="4">Cargando datos...</td></tr>';
  
  const data = await fetchDatosAPI('estudiantes');
  tbody.innerHTML = '';
  
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4">No hay estudiantes registrados aún.</td></tr>';
    return;
  }

  data.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.studentId || item._id.substring(0,6)}</td>
      <td>${item.name}</td>
      <td>${item.email}</td>
      <td>${item.major || 'N/A'}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function cargarJueces() {
  const tbody = document.getElementById('tbl-jueces');
  tbody.innerHTML = '<tr><td colspan="4">Cargando datos...</td></tr>';
  
  const data = await fetchDatosAPI('jueces');
  tbody.innerHTML = '';
  
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4">No hay jueces registrados aún.</td></tr>';
    return;
  }

  data.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.judgeId || item._id.substring(0,6)}</td>
      <td>${item.name}</td>
      <td>${item.email}</td>
      <td>${item.specialty || 'N/A'}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function cargarProyectos() {
  const tbody = document.getElementById('tbl-proyectos');
  tbody.innerHTML = '<tr><td colspan="4">Cargando datos...</td></tr>';
  
  const data = await fetchDatosAPI('proyectos');
  tbody.innerHTML = '';
  
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4">No hay proyectos registrados aún.</td></tr>';
    return;
  }

  data.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.projectId || item._id.substring(0,6)}</td>
      <td>${item.title}</td>
      <td>${item.description || '-'}</td>
      <td>${item.teamMembers || 'N/A'}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Cargar Leaderboard (Lógica especial que combina puntuaciones)
async function loadLeaderboardData() {
  const tbody = document.getElementById('tbl-leaderboard');
  tbody.innerHTML = '<tr><td colspan="5">Cargando puntuaciones...</td></tr>';
  
  const data = await fetchDatosAPI('proyectos');

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">Aún no hay proyectos registrados.</td></tr>';
    document.getElementById('kpi-top-project').textContent = '-';
    document.getElementById('kpi-top-score').textContent = '-';
    document.getElementById('kpi-total-votes').textContent = '0';
    return;
  }

  const leaderboardList = data.sort((a, b) => (b.latestScore || 0) - (a.latestScore || 0));
  const totalVotes = data.reduce((acc, curr) => acc + (curr.scores ? curr.scores.length : 0), 0);

  document.getElementById('kpi-top-project').textContent = leaderboardList[0].title;
  document.getElementById('kpi-top-score').textContent = `${leaderboardList[0].latestScore || 0} pts`;
  document.getElementById('kpi-total-votes').textContent = totalVotes;

  tbody.innerHTML = '';
  leaderboardList.forEach((item, index) => {
    const rank = index + 1;
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
}

// Cargar el Leaderboard por defecto al iniciar
window.addEventListener('DOMContentLoaded', () => loadLeaderboardData());