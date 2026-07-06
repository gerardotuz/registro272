// backend/server.js

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const Paraescolar = require("./models/paraescolar.model");
const AlumnoSchema = require("./models/Alumno").schema;
const {
  MAX_PARAESCOLAR,
  construirResumenParaescolares,
  contarParaescolares,
  normalizarParaescolar,
  puedeAsignarParaescolar
} = require("./utils/paraescolares");
const multer = require("multer");
const XLSX = require("xlsx");


const fs = require("fs");

// Crear carpeta uploads si no existe (Render)
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}


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

// ============================================
// CONEXIONES MULTIPLES A LAS 8 BASES
// ============================================

// Conexión principal (para el servidor actual)
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Conectado a MongoDB principal"))
  .catch(err => console.error("❌ Error en la conexión principal:", err));

// Conexiones a los 8 planteles
const conexiones = {
  registro272: mongoose.createConnection(process.env.MONGO_URI_272),
  registro214: mongoose.createConnection(process.env.MONGO_URI_214),
  registro253: mongoose.createConnection(process.env.MONGO_URI_253),
  registro301: mongoose.createConnection(process.env.MONGO_URI_301),
  registro309: mongoose.createConnection(process.env.MONGO_URI_309),
  registro72: mongoose.createConnection(process.env.MONGO_URI_72),
  registro28: mongoose.createConnection(process.env.MONGO_URI_28),
  registro111: mongoose.createConnection(process.env.MONGO_URI_111),
};

// Mostrar estado de conexiones secundarias
Object.entries(conexiones).forEach(([key, conn]) => {
  conn.on("connected", () => {
    console.log(`✅ Conectado a ${key}`);
  });

  conn.on("error", (err) => {
    console.error(`❌ Error en conexión ${key}:`, err.message);
  });
});

module.exports.conexiones = conexiones;


const Alumno = conexiones.registro272.models.Alumno || conexiones.registro272.model("Alumno", AlumnoSchema);

function obtenerConteosParaescolares(paraescolarId = null) {
  return contarParaescolares({ Alumno, Paraescolar, paraescolarId });
}

async function validarCupoParaescolar(paraescolar, paraescolarId = null) {
  return puedeAsignarParaescolar({ Alumno, Paraescolar, paraescolar, paraescolarId });
}
/* =========================
   RUTAS API EXISTENTES
========================= */

app.use('/api', require('./routers/alumno.js'));
app.use('/api', require('./routers/auth.js'));
app.use('/api', require('./routers/grupo.js'));
app.use('/api/dashboard', require('./routers/dashboard'));
app.use('/api', require('./routers/padron.js'));
app.use('/api/superadmin', require('./routers/superadmin'));
app.use("/api/superadmin", require("./routers/superadmin.auth"));





/* =========================
   MÓDULO PARAESCOLARES
========================= */



// Guardar paraescolar
app.put("/api/paraescolar/:id", async (req, res) => {
  try {
    const paraescolar = normalizarParaescolar(req.body?.paraescolar);

    const alumno = await Paraescolar.findById(req.params.id);

    if (!alumno) {
      return res.status(404).json({ error: "Alumno no existe" });
    }

    if (alumno.bloqueado) {
      return res.status(400).json({
        error: "Este alumno ya seleccionó un paraescolar"
      });
    }

     if (!paraescolar) {
      return res.status(400).json({ error: "Selecciona un paraescolar válido" });
    }

    const tieneCupo = await validarCupoParaescolar(paraescolar, alumno._id);
    if (!tieneCupo) {
      return res.status(400).json({
        error: `Este paraescolar ya alcanzó el límite de ${MAX_PARAESCOLAR} alumnos`
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

app.post("/api/paraescolar/cargar-excel", upload.single("excel"), async (req, res) => {
  try {

    if (!req.file) {
      return res.status(400).json({ error: "No se recibió archivo" });
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    rows.shift(); // eliminar encabezados

    let insertados = 0;

    for (const fila of rows) {
      const numero_control = String(fila[0] || "").trim();
      const curp   = String(fila[1] || "").trim();
      const nombre = String(fila[2] || "").trim();
      const grado  = String(fila[3] || "").trim();
      const grupo  = String(fila[4] || "").trim();
      const turno  = String(fila[5] || "").trim(); 

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
            turno, 
            bloqueado: false
          }
        },
        { upsert: true }
      );

      insertados++;
    }

    // 🧹 Borrar archivo temporal
    fs.unlinkSync(req.file.path);

    res.json({ ok: true, total: insertados });

  } catch (err) {
    console.error("❌ ERROR CARGA EXCEL:", err);
    res.status(500).json({ error: "Error al cargar Excel" });
  }
});

function formatearFechaMexico(fechaUTC) {
  if (!fechaUTC) return "";

  const fecha = new Date(fechaUTC);

  // Ajuste manual UTC-5 (México)
  fecha.setHours(fecha.getHours() - 5);

  const dia  = String(fecha.getDate()).padStart(2, "0");
  const mes  = String(fecha.getMonth() + 1).padStart(2, "0");
  const año  = fecha.getFullYear();
  const hora = String(fecha.getHours()).padStart(2, "0");
  const min  = String(fecha.getMinutes()).padStart(2, "0");

  return `${dia}/${mes}/${año} ${hora}:${min}`;
}



app.get("/api/paraescolar/exportar", async (req, res) => {
  try {
    const data = await Paraescolar.find()
      .sort({ fecha_registro: -1 })   // Orden por registro
      .lean();

    if (!data || data.length === 0) {
      return res.status(400).send("No hay datos para exportar");
    }

    // 🧾 Construcción del Excel
   const excelData = data.map((item, index) => ({
  orden: index + 1,
  numero_control: item.numero_control ?? "",
  curp: item.curp ?? "",
  nombre: item.nombre ?? "",
  grado: item.grado ?? "",
  grupo: item.grupo ?? "",
  turno: item.turno ?? "",
  paraescolar: item.paraescolar ?? "",   // ✅ no se pierde
  fecha_registro: item.fecha_registro
    ? formatearFechaMexico(item.fecha_registro)
    : ""                                  // ✅ no se pierde
}));


    // Crear hoja Excel
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Paraescolares");

    // Generar buffer XLSX
    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx"
    });

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=paraescolares.xlsx"
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.send(buffer);

  } catch (error) {
    console.error("ERROR EXPORTAR EXCEL:", error);
    res.status(500).send("Error al generar Excel");
  }
});



// 📊 Contador por paraescolar
app.get("/api/paraescolar/estadisticas", async (req, res) => {
  try {
   const conteos = await obtenerConteosParaescolares();
    const stats = Array.from(conteos.entries())
      .map(([nombre, total]) => ({ _id: nombre, total }))
      .sort((a, b) => b.total - a.total);

    res.json(stats);
  } catch (error) {
    console.error("ERROR ESTADISTICAS:", error);
    res.status(500).json({ error: "Error al generar estadísticas" });
  }
});




// 🎯 Cupos disponibles por paraescolar (normalizado)
app.get("/api/paraescolar/cupos", async (req, res) => {
  try {
const conteos = await obtenerConteosParaescolares();
    const resumen = construirResumenParaescolares(conteos);

    const mapa = {};
    resumen.forEach((item) => {
      mapa[item.nombre] = item.disponibles;
    });

    res.json(mapa);

  } catch (error) {
    console.error("ERROR CUPOS:", error);
    res.status(500).json({ error: "Error al calcular cupos" });
  }
});



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


/* =========================
   ARCHIVOS ESTÁTICOS
========================= */
app.use('/js/dashboard.js', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(express.static(path.join(__dirname, 'public')));
app.use('/pdfs', express.static(path.join(__dirname, 'public/pdfs')));

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'views', 'dashboard.html'));
});
app.get('/superadmin-register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'views', 'superadmin-register.html'));
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





app.post("/api/registro-online", async (req,res)=>{
  try{
    await Paraescolar.updateOne(
      { curp: req.body.curp },
      { $set: req.body },
      { upsert:true }
    );

    res.json({ ok:true });
  }catch(e){
    res.status(500).json({ ok:false });
  }
});

