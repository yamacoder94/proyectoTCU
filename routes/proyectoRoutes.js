const express = require('express');
const router = express.Router();
const Proyecto = require('../models/Proyecto');

// ==========================================
// 1. CREATE: Add a new project
// POST /api/proyectos
// ==========================================
router.post('/', async (req, res) => {
  try {
    const nuevoProyecto = new Proyecto(req.body);
    const proyectoGuardado = await nuevoProyecto.save();
    res.status(201).json(proyectoGuardado);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ==========================================
// 2. READ ALL: Fetch all projects
// GET /api/proyectos
// ==========================================
router.get('/', async (req, res) => {
  try {
    const proyectos = await Proyecto.find();
    res.status(200).json(proyectos);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==========================================
// 3. READ ONE: Fetch a single project by ID
// GET /api/proyectos/:id
// ==========================================
router.get('/:id', async (req, res) => {
  try {
    const proyecto = await Proyecto.findById(req.params.id);
    if (!proyecto) {
      return res.status(404).json({ message: 'Proyecto not found' });
    }
    res.status(200).json(proyecto);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==========================================
// 4. UPDATE: Modify a project by ID
// PUT /api/proyectos/:id
// ==========================================
router.put('/:id', async (req, res) => {
  try {
    const proyectoActualizado = await Proyecto.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!proyectoActualizado) {
      return res.status(404).json({ message: 'Proyecto not found' });
    }
    res.status(200).json(proyectoActualizado);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ==========================================
// 5. DELETE: Remove a project by ID
// DELETE /api/proyectos/:id
// ==========================================
router.delete('/:id', async (req, res) => {
  try {
    const proyectoEliminado = await Proyecto.findByIdAndDelete(req.params.id);
    if (!proyectoEliminado) {
      return res.status(404).json({ message: 'Proyecto not found' });
    }
    res.status(200).json({ message: 'Proyecto deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==========================================
// 6. SPECIAL: Endpoint for Google Sheets Score Submission
// POST /api/proyectos/submit-score
// ==========================================
router.post('/submit-score', async (req, res) => {
  const { projectId, judgeId, score } = req.body;

  if (!projectId || !judgeId || score === undefined) {
    return res.status(400).json({ message: 'projectId, judgeId, and score are required.' });
  }

  try {
    const proyecto = await Proyecto.findByIdAndUpdate(
      projectId,
      {
        $push: { scores: { judgeId, score: Number(score) } },
        $set: { latestScore: Number(score) }
      },
      { new: true }
    );

    if (!proyecto) {
      return res.status(404).json({ message: 'Proyecto not found' });
    }

    res.status(200).json({ message: 'Score successfully recorded!', proyecto });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;