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
// POST /api/proyectos/evaluacion-sheet
// ==========================================
/*
router.post('/evaluacion-sheet', async (req, res) => {
  try {
    const { tituloProyecto, total, nombreJuez } = req.body;

    // Search project by title (case-insensitive)
    const proyecto = await Proyecto.findOne({ 
      tituloProyecto: { $regex: new RegExp(`^${tituloProyecto.trim()}$`, 'i') } 
    });

    if (!proyecto) {
      return res.status(404).json({ message: `Proyecto "${tituloProyecto}" no encontrado en MongoDB.` });
    }

    // SAFEGUARD: Initialize evaluacion array if it is undefined or null
    if (!Array.isArray(proyecto.evaluacion)) {
      proyecto.evaluacion = [];
    }

    // Build the evaluation object matching your schema structure
    const nuevaEvaluacion = {
      id: new Date().getTime().toString(),
      juez: {
        id: "",
        nombre: nombreJuez || "Juez Google Sheets"
      },
      preguntaA: 0,
      preguntaB: 0,
      preguntaC: 0,
      Total: Number(total) || 0
    };

    // Push into the evaluacion array
    proyecto.evaluacion.push(nuevaEvaluacion);

    // Save changes to database
    await proyecto.save();

    res.json({ 
      message: 'Evaluación agregada con éxito',
      evaluacionAgregada: nuevaEvaluacion
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error interno: ' + err.message });
  }
});
*/

router.post('/evaluacion-sheet', async (req, res) => {
  try {
    const { tituloProyecto, total, nombreJuez } = req.body;

    if (!tituloProyecto) {
      return res.status(400).json({ message: 'El título del proyecto es requerido.' });
    }

    // Build evaluation object
    const nuevaEvaluacion = {
      id: new Date().getTime().toString(),
      juez: {
        id: "",
        nombre: nombreJuez || "Juez Google Sheets"
      },
      preguntaA: 0,
      preguntaB: 0,
      preguntaC: 0,
      Total: Number(total) || 0
    };

    // Atomic update using $push directly in MongoDB
    const result = await Proyecto.updateOne(
      { tituloProyecto: { $regex: new RegExp(`^${tituloProyecto.trim()}$`, 'i') } },
      { $push: { evaluacion: nuevaEvaluacion } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: `Proyecto "${tituloProyecto}" no encontrado en MongoDB.` });
    }

    res.json({ 
      message: 'Evaluación agregada con éxito',
      evaluacionAgregada: nuevaEvaluacion
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error interno: ' + err.message });
  }
});

module.exports = router;