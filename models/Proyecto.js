const mongoose = require('mongoose');

/*
const scoreSchema = new mongoose.Schema({
  judgeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Juez' },
  score: { type: Number, required: true },
  submittedAt: { type: Date, default: Date.now }
});
*/
/*
const proyectoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  scores: [scoreSchema],
  latestScore: { type: Number, default: 0 }
}, { 
  timestamps: true,
  collection: 'proyectos' 
});
*/

// models/Proyecto.js
/*
const proyectoSchema = new mongoose.Schema({
  tituloProyecto: { type: String, required: true }, // Changed from 'title' to 'tituloProyecto'
  centroEducativo: { type: String },
  categoria: { type: String },
  ejeTematico: { type: String },
  puntajeTotal: { type: Number },
  evaluacion: { type: Array, default: [] }
}, { timestamps: true });

*/

const estudianteSchema = new mongoose.Schema({
  idEstudiante: { type: String, default: "" },
  nombre: { type: String, default: "" }
}, { _id: false });

const proyectoSchema = new mongoose.Schema({
  tituloProyecto: { type: String, required: true },
  centroEducativo: { type: String, default: "" },
  categoria: { type: String, default: "" },
  ejeTematico: { type: String, default: "" },
  estudiante: { 
    type: [estudianteSchema], 
    default: [{ idEstudiante: "", nombre: "" }] 
  },
  puntajeTotal: { type: Number, default: 0 },
  evaluacion: { type: Array, default: [] },
  puntajeEscrito: { type: Number, default: 0 }
}, { 
  timestamps: true,
  collection: 'proyectos' 
});

module.exports = mongoose.model('Proyecto', proyectoSchema);