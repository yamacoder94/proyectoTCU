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

/* Version that threw successful but did not update the document in MongoDB. Using $push directly in updateOne should work, but let's ensure we are using the correct query and update syntax.
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
*/

// ==========================================
// 6. POST /api/proyectos/:id/evaluaciones
// ==========================================

// POST /api/proyectos/:id/evaluaciones *Working version prior to latest changes about categoria of proyectos

/*
router.post('/:id/evaluaciones', async (req, res) => {
  try {
    const { id } = req.params;
    const { preguntaA, preguntaB, preguntaC, total, nombreJuez, juezId } = req.body;

    const nuevaEvaluacion = {
      id: new Date().getTime().toString(),
      juez: {
        id: juezId || "",
        nombre: nombreJuez || "Juez"
      },
      preguntaA: Number(preguntaA) || 0,
      preguntaB: Number(preguntaB) || 0,
      preguntaC: Number(preguntaC) || 0,
      Total: Number(total) || 0
    };

    const proyectoActualizado = await Proyecto.findOneAndUpdate(
      { _id: id },
      { $push: { evaluacion: nuevaEvaluacion } },
      { new: true, runValidators: false }
    );

    if (!proyectoActualizado) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }

    res.json({
      message: 'Evaluación agregada con éxito',
      proyecto: proyectoActualizado
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error interno: ' + err.message });
  }
});
*/

// POST /api/proyectos/:id/evaluaciones <========================================================
/*
router.post('/:id/evaluaciones', async (req, res) => {
  try {
    const { id } = req.params;
    const { preguntaA, preguntaB, preguntaC, preguntaX, preguntaY, preguntaZ, total, nombreJuez, juezId } = req.body;

    // 1. Fetch project to check category
    const proyecto = await Proyecto.findById(id);
    if (!proyecto) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }

    const esSteam = proyecto.categoria && proyecto.categoria.toUpperCase() === 'STEAM';

    // 2. Build base evaluation object
    const nuevaEvaluacion = {
      id: new Date().getTime().toString(),
      juez: {
        id: juezId || "",
        nombre: nombreJuez || "Juez"
      },
      Total: Number(total) || 0
    };

    // 3. Assign key names according to category
    if (esSteam) {
      nuevaEvaluacion.preguntaX = Number(preguntaX !== undefined ? preguntaX : preguntaA) || 0;
      nuevaEvaluacion.preguntaY = Number(preguntaY !== undefined ? preguntaY : preguntaB) || 0;
      nuevaEvaluacion.preguntaZ = Number(preguntaZ !== undefined ? preguntaZ : preguntaC) || 0;
    } else {
      nuevaEvaluacion.preguntaA = Number(preguntaA) || 0;
      nuevaEvaluacion.preguntaB = Number(preguntaB) || 0;
      nuevaEvaluacion.preguntaC = Number(preguntaC) || 0;
    }

    // 4. Atomic update in MongoDB
    const proyectoActualizado = await Proyecto.findOneAndUpdate(
      { _id: id },
      { $push: { evaluacion: nuevaEvaluacion } },
      { new: true, runValidators: false }
    );

    res.json({
      message: 'Evaluación agregada con éxito',
      proyecto: proyectoActualizado
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error interno: ' + err.message });
  }
});
*/

// POST /api/proyectos/:id/evaluaciones
router.post('/:id/evaluaciones', async (req, res) => {
  try {
    const { id } = req.params;
    const { total, nombreJuez, juezId, comentarios, preguntasDetalle } = req.body;

    // 1. Fetch project to ensure it exists
    const proyecto = await Proyecto.findById(id);
    if (!proyecto) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }

    // 2. Build new evaluation document structure with full question details
    const nuevaEvaluacion = {
      id: new Date().getTime().toString(),
      juez: {
        id: juezId || "",
        nombre: nombreJuez || "Juez"
      },
      Total: Number(total) || 0,
      comentarios: comentarios || "",
      preguntas: preguntasDetalle || {}
    };

    // 3. Atomic push into MongoDB document array
    const proyectoActualizado = await Proyecto.findOneAndUpdate(
      { _id: id },
      { $push: { evaluacion: nuevaEvaluacion } },
      { new: true, runValidators: false }
    );

    res.json({
      message: 'Evaluación agregada con éxito',
      proyecto: proyectoActualizado
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error interno: ' + err.message });
  }
});

//Allows to update Evaluaciones

// PUT /api/proyectos/:id/evaluaciones/:evalId
router.put('/:id/evaluaciones/:evalId', async (req, res) => {
  try {
    const { id, evalId } = req.params;
    const { total, preguntasDetalle, juezId,comentarios, userRole } = req.body;

    // 1. Find project
    const proyecto = await Proyecto.findById(id);
    if (!proyecto) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }

    // 2. Find target evaluation inside array
    const evalIndex = proyecto.evaluacion.findIndex(e => String(e.id) === String(evalId));
    if (evalIndex === -1) {
      return res.status(404).json({ message: 'Evaluación no encontrada' });
    }

    const evaluacionExistente = proyecto.evaluacion[evalIndex];

    // 3. Authorization Check: Admin can edit any, Juez can only edit their own
    const isAdmin = userRole && userRole.toLowerCase() === 'admin';
    const esDuenio = evaluacionExistente.juez && String(evaluacionExistente.juez.id) === String(juezId);

    if (!isAdmin && !esDuenio) {
      return res.status(403).json({ message: 'No tiene permisos para editar esta evaluación.' });
    }

    // 4. Update evaluation fields
    proyecto.evaluacion[evalIndex].Total = Number(total) || 0;
    if (preguntasDetalle) {
      proyecto.evaluacion[evalIndex].preguntas = preguntasDetalle;
    }

    if (comentarios !== undefined) {
      proyecto.evaluacion[evalIndex].comentarios = comentarios;
    }

    // Mark mixed array modified and save
    proyecto.markModified('evaluacion');
    await proyecto.save();

    res.json({
      message: 'Evaluación actualizada con éxito',
      proyecto: proyecto
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error interno: ' + err.message });
  }
});


// ==========================================
// 8. DELETE /api/proyectos/:id/evaluaciones/:evalId
// ==========================================
router.delete('/:id/evaluaciones/:evalId', async (req, res) => {
  try {
    const { id, evalId } = req.params;
    const { juezId, userRole } = req.body;

    // 1. Find project
    const proyecto = await Proyecto.findById(id);
    if (!proyecto) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }

    // 2. Find target evaluation inside array
    const evalIndex = proyecto.evaluacion.findIndex(e => String(e.id) === String(evalId));
    if (evalIndex === -1) {
      return res.status(404).json({ message: 'Evaluación no encontrada' });
    }

    const evaluacionExistente = proyecto.evaluacion[evalIndex];

    // 3. Authorization Check
    const isAdmin = userRole && userRole.toLowerCase() === 'admin';
    const esDuenio = evaluacionExistente.juez && String(evaluacionExistente.juez.id) === String(juezId);

    if (!isAdmin && !esDuenio) {
      return res.status(403).json({ message: 'No tiene permisos para eliminar esta evaluación.' });
    }

    // 4. Remove item from evaluation array
    proyecto.evaluacion.splice(evalIndex, 1);
    proyecto.markModified('evaluacion');
    await proyecto.save();

    res.json({
      message: 'Evaluación eliminada con éxito',
      proyecto: proyecto
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error interno: ' + err.message });
  }
});



// ==========================================
/*
router.post('/evaluacion-sheet', async (req, res) => {
  try {
    const { tituloProyecto, total, nombreJuez } = req.body;

    if (!tituloProyecto) {
      return res.status(400).json({ message: 'El título del proyecto es requerido.' });
    }

    // 1. Find the project by title (case-insensitive)
    const proyecto = await Proyecto.findOne({ 
      tituloProyecto: { $regex: new RegExp(`^${tituloProyecto.trim()}$`, 'i') } 
    });

    if (!proyecto) {
      return res.status(404).json({ message: `Proyecto "${tituloProyecto}" no encontrado en MongoDB.` });
    }

    // 2. Build the new evaluation object
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

    // 3. Push and retrieve the updated document directly from MongoDB
    const proyectoActualizado = await Proyecto.findOneAndUpdate(
      { _id: proyecto._id },
      { $push: { evaluacion: nuevaEvaluacion } },
      { new: true, runValidators: false } // Bypasses schema validation & returns updated doc
    );

    res.json({ 
      message: 'Evaluación agregada con éxito',
      documentId: proyectoActualizado._id,
      totalEvaluaciones: proyectoActualizado.evaluacion ? proyectoActualizado.evaluacion.length : 0,
      evaluacionAgregada: nuevaEvaluacion
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error interno: ' + err.message });
  }
});
*/

module.exports = router;