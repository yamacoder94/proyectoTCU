const mongoose = require('mongoose');

const scoreSchema = new mongoose.Schema({
  judgeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Juez' },
  score: { type: Number, required: true },
  submittedAt: { type: Date, default: Date.now }
});

const proyectoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  scores: [scoreSchema],
  latestScore: { type: Number, default: 0 }
}, { 
  timestamps: true,
  collection: 'proyectos' 
});

module.exports = mongoose.model('Proyecto', proyectoSchema);