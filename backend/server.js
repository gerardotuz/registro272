// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// ✅ CORS
const corsOptions = {
  origin: 'https://registro272.onrender.com',
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Incluye PUT y DELETE para el dashboard
  credentials: true
};
app.use(cors(corsOptions));

// ✅ Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/pdfs', express.static(path.join(__dirname, 'public/pdfs')));

// ✅ Rutas API existentes
app.use('/api', require('./routers/alumno.js'));
app.use('/api', require('./routers/auth.js'));
app.use('/api', require('./routers/grupo.js'));

// ✅ Rutas Dashboard
app.use('/api/dashboard', require('./routes/dashboard')); // NUEVA ruta API para dashboard

// ✅ Vista Dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

// ✅ MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch(err => console.error('❌ Error en la conexión', err));

// ✅ Catch-all final (debe ir al final)
// Si quieres que el dashboard no se vea afectado por el catch-all, exclúyelo aquí:
app.get('*', (req, res) => {
  // Si la ruta solicitada es /dashboard, ya fue atendida arriba.
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ✅ Puerto
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
});

