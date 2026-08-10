require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const proyectoRoutes = require('./routes/proyectoRoutes');
const juezRoutes = require('./routes/juezRoutes');
const estudianteRoutes = require('./routes/estudianteRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB successfully'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));
  
// Serve static files from the 'public' directory
app.use(express.static('public'));

  // Routes
app.use('/api/proyectos', proyectoRoutes);
app.use('/api/jueces', juezRoutes);
app.use('/api/estudiantes', estudianteRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});

