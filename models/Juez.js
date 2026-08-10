const mongoose = require('mongoose');

const juezSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  assignedProjects: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Proyecto'
  }]
}, { 
  timestamps: true,
  collection: 'jueces' 
});

module.exports = mongoose.model('Juez', juezSchema);