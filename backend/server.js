// backend/server.js

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const Paraescolar = require("./models/paraescolar.model");

require('dotenv').config();

const app = express();

//  CORS
const corsOptions = {
  origin: 'https://registro272.onrender.com',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
};
app.use(cors(corsOptions));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//  Archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/pdfs', express.static(path.join(__dirname, 'public/pdfs')));

//  Rutas API existentes
app.use('/api', require('./routers/alumno.js'));
app.use('/api', require('./routers/auth.js'));
app.use('/api', require('./routers/grupo.js'));

//  Rutas Dashboard API
app.use('/api/dashboard', require('./routers/dashboard'));


app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'views', 'dashboard.html'));
});

//  Conexión MongoDB Atlas
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch(err => console.error('❌ Error en la conexión', err));


app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


const PORT = process.env.PORT || 3001;


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
    res.status(500).json({ error: "Error en servidor" });
  }
});



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




const multer = require("multer");
const XLSX = require("xlsx");
const upload = multer({ dest: "uploads/" });

app.post("/api/paraescolar/cargar-excel", upload.single("excel"), async (req, res) => {
  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    for (const fila of data) {
      await Paraescolar.updateOne(
        { numero_control: fila.numero_control },
        {
          $setOnInsert: {
            nombres: fila.nombres,
            primer_apellido: fila.primer_apellido,
            segundo_apellido: fila.segundo_apellido,
            grupo: fila.grupo,
            turno: fila.turno
          }
        },
        { upsert: true }
      );
    }

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al cargar Excel" });
  }
});



app.get("/api/paraescolar/exportar", async (req, res) => {
  try {
    const data = await Paraescolar.find().lean();

    if (!data || data.length === 0) {
      return res.status(400).json({ error: "No hay datos para exportar" });
    }

    const wb = XLSX.utils.book_new();

    // Limpiar datos para Excel
    const cleanData = data.map(item => ({
      numero_control: item.numero_control,
      curp: item.curp || "",
      nombre: item.nombre || "",
      grado: item.grado || "",
      grupo: item.grupo || "",
      paraescolar: item.paraescolar || "",
      fecha_registro: item.fecha_registro || ""
    }));

    const ws = XLSX.utils.json_to_sheet(cleanData);
    XLSX.utils.book_append_sheet(wb, ws, "Paraescolares");

    // 👉 Generar ArrayBuffer REAL
    const excelBuffer = XLSX.write(wb, {
      bookType: "xlsx",
      type: "array"
    });

    const buffer = Buffer.from(excelBuffer);

    res.setHeader("Content-Disposition", "attachment; filename=paraescolares.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Length", buffer.length);

    res.end(buffer);

  } catch (error) {
    console.error("ERROR EXPORTAR:", error);
    res.status(500).json({ error: "Error al generar Excel" });
  }
});





app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
});
