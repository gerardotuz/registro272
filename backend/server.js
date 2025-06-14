const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// ✅ CORS con origen específico
const corsOptions = {
  origin: 'https://registro272.onrender.com', // sin la barra final
  methods: ['GET', 'POST'],
  credentials: true
};
app.use(cors(corsOptions)); // ✅ SÓLO este

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/pdfs', express.static(path.join(__dirname, 'public/pdfs')));

// Rutas
app.use('/api', require('./routers/alumno.js'));
app.use('/api', require('./routers/auth.js'));
app.use('/api', require('./routers/grupo.js')); // ✅ NUEVA RUTA PARA GRUPOS

// Conexión a MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch(err => console.error('❌ Error en la conexión', err));

// Middleware para servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Ruta por defecto
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Puerto
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
});

