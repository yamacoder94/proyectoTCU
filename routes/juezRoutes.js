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