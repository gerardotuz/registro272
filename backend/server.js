// backend/server.js

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const Paraescolar = require("./models/paraescolar.model");
const multer = require("multer");
const XLSX = require("xlsx");

require('dotenv').config();

const app = express();

/* =========================
   CONFIGURACIÓN GENERAL
========================= */

// CORS
const corsOptions = {
  origin: 'https://registro272.onrender.com',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
};
app.use(cors(corsOptions));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Upload temporal
const upload = multer({ dest: "uploads/" });

/* =========================
   CONEXIÓN MONGODB
========================= */

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Conectado a MongoDB Atlas'))
.catch(err => console.error('❌ Error en la conexión', err));

/* =========================
   RUTAS API EXISTENTES
========================= */

app.use('/api', require('./routers/alumno.js'));
app.use('/api', require('./routers/auth.js'));
app.use('/api', require('./routers/grupo.js'));
app.use('/api/dashboard', require('./routers/dashboard'));

/* =========================
   MÓDULO PARAESCOLARES
========================= */

// Buscar alumno
app.get("/api/paraescolar/:control", async (req, res) => {
  try {
    const alumno = await Paraescolar.findOne({
      numero_control: req.params.control
    });

    if (!alumno) {
      return res.status(404).json({ error: "Alumno no encontrado" });
    }

    res.json(alumno);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error en servidor" });
  }
});

// Guardar paraescolar
app.put("/api/paraescolar/:id", async (req, res) => {
  try {
    const { paraescolar } = req.body;

    const alumno = await Paraescolar.findById(req.params.id);

    if (!alumno) {
      return res.status(404).json({ error: "Alumno no existe" });
    }

    if (alumno.bloqueado) {
      return res.status(400).json({
        error: "Este alumno ya seleccionó un paraescolar"
      });
    }

    const total = await Paraescolar.countDocuments({ paraescolar });
    if (total >= 50) {
      return res.status(400).json({
        error: "Este paraescolar ya alcanzó el límite de 50 alumnos"
      });
    }

    alumno.paraescolar = paraescolar;
    alumno.fecha_registro = new Date();
    alumno.bloqueado = true;
    await alumno.save();

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al guardar paraescolar" });
  }
});

// Cargar Excel
app.post("/api/paraescolar/cargar-excel", upload.single("excel"), async (req, res) => {
  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    // Leer como arreglo (no como objeto)
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Eliminar encabezado
    rows.shift();

    let insertados = 0;

    for (const fila of rows) {
      const numero_control = String(fila[0] || "").trim();
      const curp   = String(fila[1] || "").trim();
      const nombre = String(fila[2] || "").trim();
      const grado  = String(fila[3] || "").trim();
      const grupo  = String(fila[4] || "").trim();

      if (!numero_control) continue;

      await Paraescolar.updateOne(
        { numero_control },
        {
          $set: {
            numero_control,
            curp,
            nombre,
            grado,
            grupo,
            bloqueado: false
          }
        },
        { upsert: true }
      );

      insertados++;
    }

    res.json({ ok: true, total: insertados });

  } catch (err) {
    console.error("ERROR CARGA EXCEL:", err);
    res.status(500).json({ error: "Error al cargar Excel" });
  }
});


// Exportar CSV
app.get("/api/paraescolar/exportar", async (req, res) => {
  try {
    const data = await Paraescolar.find().lean();

    if (!data || data.length === 0) {
      return res.status(400).send("No hay datos para exportar");
    }

    const headers = [
      "numero_control",
      "curp",
      "nombre",
      "grado",
      "grupo",
      "paraescolar",
      "fecha_registro"
    ];

    const rows = data.map(item => [
      item.numero_control || "",
      item.curp || "",
      item.nombre || "",
      item.grado || "",
      item.grupo || "",
      item.paraescolar || "",
      item.fecha_registro || ""
    ]);

    let csv = headers.join(",") + "\n";
    rows.forEach(row => {
      csv += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",") + "\n";
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=paraescolares.csv");
    res.send(csv);

  } catch (error) {
    console.error("ERROR EXPORTAR CSV:", error);
    res.status(500).send("Error al generar CSV");
  }
});



// 📊 Contador por paraescolar
app.get("/api/paraescolar/estadisticas", async (req, res) => {
  try {
    const stats = await Paraescolar.aggregate([
      { $match: { paraescolar: { $ne: null } } },
      {
        $group: {
          _id: "$paraescolar",
          total: { $sum: 1 }
        }
      },
      { $sort: { total: -1 } }
    ]);

    res.json(stats);
  } catch (error) {
    console.error("ERROR ESTADISTICAS:", error);
    res.status(500).json({ error: "Error al generar estadísticas" });
  }
});



/* =========================
   ARCHIVOS ESTÁTICOS
========================= */

app.use(express.static(path.join(__dirname, 'public')));
app.use('/pdfs', express.static(path.join(__dirname, 'public/pdfs')));

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'views', 'dashboard.html'));
});

/* =========================
   FALLBACK SPA
========================= */

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* =========================
   SERVIDOR
========================= */

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
});
