const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcrypt');

// Ruta para login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  console.log('🔐 Intentando login con:', username); // 👈 AGREGAR ESTO

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: 'Usuario no encontrado' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Contraseña incorrecta' });

    res.status(200).json({ message: 'Login exitoso' }); // Puedes usar JWT si deseas.
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Ruta para crear el primer admin (sólo una vez)
router.post('/register-admin', async (req, res) => {
  const { username, password } = req.body;
  const existing = await User.findOne({ username });
  if (existing) return res.status(400).json({ message: 'El usuario ya existe' });

  const hashed = await bcrypt.hash(password, 10);
  const newUser = new User({ username, password: hashed });
  await newUser.save();
  res.status(201).json({ message: 'Administrador creado' });
});

module.exports = router;
