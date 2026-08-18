

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const Usuario = require('../models/Usuario');
const Proyecto = require('../models/Proyecto');

// Helper query to find users with role "juez"
const juezRoleFilter = {
  $or: [
    { userRole: /^juez$/i },
    { rol: /^juez$/i },
    { role: /^juez$/i }
  ]
};

// Robust helper to extract 24-char hex ID string from any data shape <===================== Working version 
/*const extractProjectId = (p) => {
  if (!p) return null;
  if (typeof p === 'string') return p.trim();
  if (typeof p === 'object') {
    if (p.$oid) return String(p.$oid).trim(); // Fix for Extended JSON ($oid) <======= Cambio agregado para manejar $oid
    if (p.id) return String(p.id).trim();
    if (p._id) return String(p._id).trim();
    if (typeof p.toString === 'function') {
      const str = p.toString().trim();
      if (str && str !== '[object Object]') return str;
    }
  }
  return null;
};
*/

const extractProjectId = (p) => {
  if (!p) return null;
  if (typeof p === 'string') return p.trim();
  if (typeof p === 'object') {
    if (p.$oid) return String(p.$oid).trim();
    if (p.id) return String(p.id).trim();
    if (p._id) return extractProjectId(p._id);
    if (typeof p.toString === 'function') {
      const str = p.toString().trim();
      if (str && str !== '[object Object]') return str;
    }
  }
  return null;
};




// Helper para formatear y limpiar el arreglo de proyectos
// Helper: Ensure assignedProjects is saved as an array of plain string ObjectIds
//< =================================================================================== Also added
// Working version <=====================
/*
const formatAssignedProjects = (projects) => {
  if (!Array.isArray(projects)) return [];
  return projects
    .map(extractProjectId)
    .filter(id => id && typeof id === 'string' && id.length === 24);
};
*/
// < Working version but adds project as $oid <==================
/*
const formatAssignedProjects = (projects) => {
  if (!Array.isArray(projects)) return [];
  return projects
    .map(extractProjectId)
    .filter(id => id && typeof id === 'string' && id.length === 24)
    .map(cleanId => ({ id: cleanId }));
};
*/
const formatAssignedProjects = (projects) => {
  // Parse stringified JSON if passed as a string
  if (typeof projects === 'string') {
    try {
      projects = JSON.parse(projects);
    } catch (err) {
      return [];
    }
  }

  if (!Array.isArray(projects)) return [];

  return projects
    .map(extractProjectId)
    .filter(id => id && typeof id === 'string' && id.length === 24)
    .map(cleanId => ({ id: cleanId }));
};

// ==========================================
// 1. CREATE: Add a new user with role 'juez'
// POST /api/jueces
// ==========================================
router.post('/', async (req, res) => {
  try {
    const { name, email, password, assignedProjects } = req.body;

    const existingUser = await Usuario.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'El usuario ya existe' });
    }

    const userPassword = password || 'Juez1234!';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userPassword, salt);

    const nuevoJuez = new Usuario({
      name,
      email,
      password: hashedPassword,
      userRole: 'juez',
      assignedProjects: formatAssignedProjects(assignedProjects) // <-- Sanitizado aquí
    });

    const juezGuardado = await nuevoJuez.save();
    res.status(201).json(juezGuardado);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ==========================================
// 2. READ ALL: Fetch all users with role 'juez'
// GET /api/jueces
// ==========================================

router.get('/', async (req, res) => {
  try {
    const jueces = await Usuario.find(juezRoleFilter).select('-password').lean();

    const allProjectIds = [];
    jueces.forEach(juez => {
      if (Array.isArray(juez.assignedProjects)) {
        juez.assignedProjects = juez.assignedProjects
          .map(extractProjectId)
          .filter(id => id && id.length === 24);
        allProjectIds.push(...juez.assignedProjects);
      } else {
        juez.assignedProjects = [];
      }
    });

    const proyectos = await Proyecto.find({ _id: { $in: allProjectIds } }, 'tituloProyecto title').lean();
    const proyectoMap = new Map(proyectos.map(p => [p._id.toString(), p]));

    const juecesPoblados = jueces.map(juez => ({
      ...juez,
      assignedProjects: juez.assignedProjects
        .map(id => proyectoMap.get(id))
        .filter(Boolean)
    }));

    res.status(200).json(juecesPoblados);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// ==========================================
// 3. READ ONE: Fetch a single judge user by ID
// GET /api/jueces/:id
// ==========================================

router.get('/:id', async (req, res) => {
  try {
    const juez = await Usuario.findOne({ _id: req.params.id, ...juezRoleFilter })
      .select('-password')
      .lean();

    if (!juez) {
      return res.status(404).json({ message: 'Juez not found' });
    }

    const projectIds = (juez.assignedProjects || [])
      .map(extractProjectId)
      .filter(id => id && id.length === 24);

    juez.assignedProjects = await Proyecto.find({ _id: { $in: projectIds } }, 'tituloProyecto title').lean();

    res.status(200).json(juez);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// ==========================================
// 4. UPDATE: Modify a judge user by ID
// PUT /api/jueces/:id < Working version but adds pruecto as $oid <==================
// ==========================================
/*
router.put('/:id', async (req, res) => {
  try {
    const updateData = { ...req.body };

    if (updateData.assignedProjects) {
      updateData.assignedProjects = formatAssignedProjects(updateData.assignedProjects);
    }

    if (updateData.password && updateData.password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(updateData.password, salt);
    } else {
      delete updateData.password;
    }

    const juezActualizado = await Usuario.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!juezActualizado) {
      return res.status(404).json({ message: 'Juez no encontrado' });
    }
    res.status(200).json(juezActualizado);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
*/

router.put('/:id', async (req, res) => {
  try {
    const updateData = { ...req.body };

    if (updateData.assignedProjects) {
      updateData.assignedProjects = formatAssignedProjects(updateData.assignedProjects);
    }

    if (updateData.password && updateData.password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(updateData.password, salt);
    } else {
      delete updateData.password;
    }

    const juezActualizado = await Usuario.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!juezActualizado) {
      return res.status(404).json({ message: 'Juez no encontrado' });
    }
    res.status(200).json(juezActualizado);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ==========================================
// 5. DELETE: Remove a judge user by ID
// DELETE /api/jueces/:id
// ==========================================
router.delete('/:id', async (req, res) => {
  try {
    // Ensures only users matching the juezRoleFilter can be deleted from 'usuarios'
    const juezEliminado = await Usuario.findOneAndDelete({
      _id: req.params.id,
      ...juezRoleFilter
    });

    if (!juezEliminado) {
      return res.status(404).json({ message: 'Juez no encontrado o el usuario no tiene rol de Juez' });
    }

    res.status(200).json({ message: 'Juez eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


module.exports = router;