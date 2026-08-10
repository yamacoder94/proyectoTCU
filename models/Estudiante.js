const mongoose = require('mongoose');

const estudianteSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  projectId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Proyecto',
    required: true 
  }
}, { 
  timestamps: true,
  collection: 'estudiantes' 
});

module.exports = mongoose.model('Estudiante', estudianteSchema);