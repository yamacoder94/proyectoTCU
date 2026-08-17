/*
const usuarioSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true,
    trim: true 
  },
  password: { 
    type: String, 
    required: true 
  }
}, { 
  timestamps: true,
  collection: 'usuarios' 
});
*/

const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true, 
    trim: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  name: { 
    type: String, 
    default: '' 
  },
  userRole: { 
    type: String, 
    default: 'juez' 
  },
  //This is what is causing the issue with the assignedProjects being saved as an array of objects instead of an array of strings
  /*
  assignedProjects: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Proyecto'
  }]*/
 assignedProjects: [
    {
      id: { type: String, required: true },
      _id: false // Prevents Mongoose from auto-generating nested _id fields
    }
  ]

}, { 
  timestamps: true,
  collection: 'usuarios' 
});

module.exports = mongoose.model('Usuario', usuarioSchema);
