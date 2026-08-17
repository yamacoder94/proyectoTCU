const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

// REGISTER ROUTE (Use this once to create your admin account)
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user already exists
    const existingUser = await Usuario.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'El usuario ya existe' });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Save new user
    const nuevoUsuario = new Usuario({
      email,
      password: hashedPassword
    });

    await nuevoUsuario.save();
    res.status(201).json({ message: 'Usuario registrado exitosamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// LOGIN ROUTE
/*
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const usuario = await Usuario.findOne({ email });
    if (!usuario) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, usuario.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }

    // Create a JWT token valid for 2 hours
    const token = jwt.sign(
      { id: usuario._id, email: usuario.email },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '2h' }
    );

    res.json({ message: 'Login exitoso', token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});
*/

// LOGIN ROUTE
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Use .lean() to prevent Mongoose from stripping unmapped schema fields
    const usuario = await Usuario.findOne({ email }).lean();
    if (!usuario) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, usuario.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }

    // Determine userRole safely
    const userRole = usuario.userRole || usuario.rol || usuario.role || 'admin';

    // Create JWT token including userRole
    const token = jwt.sign(
      { id: usuario._id, email: usuario.email, userRole: userRole },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '2h' }
    );

    // Send user object back to frontend
    res.json({
      token,
      user: {
        id: usuario._id,
        email: usuario.email,
        userRole: userRole,
        assignedProjects: usuario.assignedProjects || [] // Includes assigned project IDs
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

module.exports = router;