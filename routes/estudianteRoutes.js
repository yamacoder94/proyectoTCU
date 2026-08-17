const express = require('express');
const router = express.Router();
const Estudiante = require('../models/Estudiante');

// ==========================================
// 1. CREATE: Add a new Estudiante
// POST /api/estudiantes
// ==========================================
/*
router.post('/', async (req, res) => {
  try {
    const nuevoEstudiante = new Estudiante(req.body);
    const estudianteGuardado = await nuevoEstudiante.save();
    res.status(201).json(estudianteGuardado);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
*/

// POST /api/estudiantes
router.post('/', async (req, res) => {
  try {
    const nombreLimpio = req.body.name ? req.body.name.trim() : '';

    if (!nombreLimpio) {
      return res.status(400).json({ message: 'El nombre del estudiante es obligatorio.' });
    }

    // 1. Check if a student with the same name already exists (case-insensitive)
    const estudianteExistente = await Estudiante.findOne({
      name: { $regex: new RegExp(`^${nombreLimpio}$`, 'i') }
    });

    if (estudianteExistente) {
      return res.status(400).json({ 
        message: `El estudiante "${nombreLimpio}" ya existe en el sistema.` 
      });
    }

    // 2. Save if not found
    const nuevoEstudiante = new Estudiante({
      ...req.body,
      name: nombreLimpio
    });

    const estudianteGuardado = await nuevoEstudiante.save();
    res.status(201).json(estudianteGuardado);

  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ==========================================
// 2. READ ALL: Fetch all students
// GET /api/estudiantes
// ==========================================
router.get('/', async (req, res) => {
  try {
    const estudiantes = await Estudiante.find().populate('projectId');
    res.status(200).json(estudiantes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==========================================
// 3. READ ONE: Fetch a single student by ID
// GET /api/estudiantes/:id
// ==========================================
router.get('/:id', async (req, res) => {
  try {
    const estudiante = await Estudiante.findById(req.params.id).populate('projectId');
    if (!estudiante) {
      return res.status(404).json({ message: 'Estudiante not found' });
    }
    res.status(200).json(estudiante);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==========================================
// 4. UPDATE: Modify a student by ID
// PUT /api/estudiantes/:id
// ==========================================
router.put('/:id', async (req, res) => {
  try {
    const estudianteActualizado = await Estudiante.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!estudianteActualizado) {
      return res.status(404).json({ message: 'Estudiante not found' });
    }
    res.status(200).json(estudianteActualizado);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ==========================================
// 5. DELETE: Remove a student by ID
// DELETE /api/estudiantes/:id
// ==========================================
router.delete('/:id', async (req, res) => {
  try {
    const estudianteEliminado = await Estudiante.findByIdAndDelete(req.params.id);
    if (!estudianteEliminado) {
      return res.status(404).json({ message: 'Estudiante not found' });
    }
    res.status(200).json({ message: 'Estudiante deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;