const mongoose = require('mongoose');

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