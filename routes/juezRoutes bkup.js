/*
const express = require('express');
const router = express.Router();
const Juez = require('../models/Juez');

// ==========================================
// 1. CREATE: Add a new Juez
// POST /api/jueces
// ==========================================
router.post('/', async (req, res) => {
  try {
    const nuevoJuez = new Juez(req.body);
    const juezGuardado = await nuevoJuez.save();
    res.status(201).json(juezGuardado);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ==========================================
// 2. READ ALL: Fetch all judges
// GET /api/jueces
// ==========================================
router.get('/', async (req, res) => {
  try {
    const jueces = await Juez.find();
    res.status(200).json(jueces);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==========================================
// 3. READ ONE: Fetch a single judge by ID
// GET /api/jueces/:id
// ==========================================
router.get('/:id', async (req, res) => {
  try {
    const juez = await Juez.findById(req.params.id);
    if (!juez) {
      return res.status(404).json({ message: 'Juez not found' });
    }
    res.status(200).json(juez);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==========================================
// 4. UPDATE: Modify a judge by ID
// PUT /api/jueces/:id
// ==========================================
router.put('/:id', async (req, res) => {
  try {
    const juezActualizado = await Juez.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!juezActualizado) {
      return res.status(404).json({ message: 'Juez not found' });
    }
    res.status(200).json(juezActualizado);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ==========================================
// 5. DELETE: Remove a judge by ID
// DELETE /api/jueces/:id
// ==========================================
router.delete('/:id', async (req, res) => {
  try {
    const juezEliminado = await Juez.findByIdAndDelete(req.params.id);
    if (!juezEliminado) {
      return res.status(404).json({ message: 'Juez not found' });
    }
    res.status(200).json({ message: 'Juez deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


module.exports = router;
*/

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

// Helper para formatear y limpiar el arreglo de proyectos
// Helper: Ensure assignedProjects is saved as an array of plain string ObjectIds
const formatAssignedProjects = (projects) => {
  if (!Array.isArray(projects)) return [];
  return projects
    .map(p => {
      if (typeof p === 'object' && p !== null) {
        return p.id || p._id || null;
      }
      return p;
    })
    .filter(id => typeof id === 'string' && id.trim() !== '');
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

    // Extract all project IDs from all judges
    const allProjectIds = [];
    jueces.forEach(juez => {
      if (Array.isArray(juez.assignedProjects)) {
        juez.assignedProjects = juez.assignedProjects
          .map(p => (typeof p === 'object' && p !== null ? p.id || p._id || p : p))
          .filter(id => typeof id === 'string' && id.trim() !== '');
        allProjectIds.push(...juez.assignedProjects);
      } else {
        juez.assignedProjects = [];
      }
    });

    // Fetch matching projects
    const proyectos = await Proyecto.find({ _id: { $in: allProjectIds } }, 'tituloProyecto title').lean();
    const proyectoMap = new Map(proyectos.map(p => [p._id.toString(), p]));

    // Map project details back to each judge
    const juecesPoblados = jueces.map(juez => ({
      ...juez,
      assignedProjects: juez.assignedProjects
        .map(id => proyectoMap.get(id.toString()))
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
      .map(p => (typeof p === 'object' && p !== null ? p.id || p._id || p : p))
      .filter(id => typeof id === 'string' && id.trim() !== '');

    juez.assignedProjects = await Proyecto.find({ _id: { $in: projectIds } }, 'tituloProyecto title').lean();

    res.status(200).json(juez);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==========================================
// 4. UPDATE: Modify a judge user by ID
// PUT /api/jueces/:id
// ==========================================


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
    const juezEliminado = await Usuario.findByIdAndDelete(req.params.id);
    if (!juezEliminado) {
      return res.status(404).json({ message: 'Juez not found' });
    }
    res.status(200).json({ message: 'Juez deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


module.exports = router;