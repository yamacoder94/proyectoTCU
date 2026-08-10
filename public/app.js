// public/app.js
// Add this at the very top of your app.js or inside index.html
if (!sessionStorage.getItem('token')) {
      window.location.replace('login.html');
    }
// Point directly to your local Express routes
  const API_URL = "/api";

  // Navegación entre pestañas
  function switchTab(tabName) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById(`sec-${tabName}`).classList.add('active');
    event.target.classList.add('active');

    if (tabName === 'leaderboard') {
      loadLeaderboardData();
    } else {
      loadTableData(tabName);
    }
  }

  //Logout function to clear session and redirect to login
  function logout() {
      sessionStorage.removeItem('token');
      window.location.replace('login.html');
    }

  // Cargar y procesar puntuaciones para el Leaderboard
  async function loadLeaderboardData() {
    const tbody = document.getElementById('tbl-leaderboard');
    tbody.innerHTML = '<tr><td colspan="5">Cargando puntuaciones...</td></tr>';

    try {
      const res = await fetch(`${API_URL}/proyectos`);
      const data = await res.json();

      if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">Aún no hay proyectos registrados.</td></tr>';
        document.getElementById('kpi-top-project').textContent = '-';
        document.getElementById('kpi-top-score').textContent = '-';
        document.getElementById('kpi-total-votes').textContent = '0';
        return;
      }

      // Sort by latestScore descending
      const leaderboardList = data.sort((a, b) => (b.latestScore || 0) - (a.latestScore || 0));
      
      // Calculate total votes across all projects
      const totalVotes = data.reduce((acc, curr) => acc + (curr.scores ? curr.scores.length : 0), 0);

      // Update KPIs
      document.getElementById('kpi-top-project').textContent = leaderboardList[0].title;
      document.getElementById('kpi-top-score').textContent = `${leaderboardList[0].latestScore || 0} pts`;
      document.getElementById('kpi-total-votes').textContent = totalVotes;

      // Render Table
      tbody.innerHTML = '';
      leaderboardList.forEach((item, index) => {
        const rank = index + 1;
        const badgeClass = rank === 1 ? 'badge-1' : rank === 2 ? 'badge-2' : rank === 3 ? 'badge-3' : 'badge-other';
        const votesCount = item.scores ? item.scores.length : 0;
        
        // Calculate average if there are scores
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

    } catch (err) {
      console.error(err);
      tbody.innerHTML = '<tr><td colspan="5">Error al cargar los datos del Leaderboard.</td></tr>';
    }
  }

  // Cargar datos desde la API de Node.js (GET)
  async function loadTableData(endpoint) {
    const tbody = document.getElementById(`tbl-${endpoint}`);
    tbody.innerHTML = '<tr><td colspan="4">Cargando datos...</td></tr>';

    try {
      const res = await fetch(`${API_URL}/${endpoint}`);
      const data = await res.json();
      
      tbody.innerHTML = '';
      if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">No hay registros aún.</td></tr>';
        return;
      }

      // Map API JSON data to table columns dynamically based on the section
      data.forEach(item => {
        const tr = document.createElement('tr');
        if (endpoint === 'estudiantes') {
          tr.innerHTML = `<td>${item._id.substring(0, 6)}...</td><td>${item.name}</td><td>${item.email}</td><td>${item.projectId || 'N/A'}</td>`;
        } else if (endpoint === 'jueces') {
          tr.innerHTML = `<td>${item._id.substring(0, 6)}...</td><td>${item.name}</td><td>${item.email}</td><td>${item.assignedProjects?.length || 0} Proyectos</td>`;
        } else if (endpoint === 'proyectos') {
          tr.innerHTML = `<td>${item._id.substring(0, 6)}...</td><td>${item.title}</td><td>${item.description || '-'}</td><td>${item.latestScore || 0} Pts</td>`;
        }
        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error(err);
      tbody.innerHTML = '<tr><td colspan="4">Error al cargar datos.</td></tr>';
    }
  }

  // Guardar nuevo registro hacia la API de Node (POST)
  async function handleFormSubmit(event, sheetName, inputIds) {
    event.preventDefault();
    const endpoint = sheetName.toLowerCase();
    
    // Grab UI values
    const values = inputIds.map(id => document.getElementById(id).value);
    
    // Construct the correct JSON payload mapping for your Express API
    let payload = {};
    if (endpoint === 'estudiantes') {
      payload = { name: values[1], email: values[2], projectId: values[0] }; // Requires valid Project ObjectId
    } else if (endpoint === 'jueces') {
      payload = { name: values[1], email: values[2] };
    } else if (endpoint === 'proyectos') {
      payload = { title: values[1], description: values[2] };
    }

    try {
      const response = await fetch(`${API_URL}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resData = await response.json();
      if (response.ok) {
        alert('✅ Guardado correctamente en MongoDB');
        event.target.reset();
        loadTableData(endpoint);
      } else {
        alert('❌ Error: ' + resData.message);
      }
    } catch (err) {
      console.error(err);
      alert('❌ Error de conexión al guardar.');
    }
  }

  // Cargar el Leaderboard por defecto al abrir el panel
  window.addEventListener('DOMContentLoaded', () => loadLeaderboardData());
