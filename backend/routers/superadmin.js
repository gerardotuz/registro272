const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const XLSX = require("xlsx");

const alumnoSchema = require("../models/Alumno").schema;

const ConfigSchema = new mongoose.Schema({
  bloqueo_registro: { type: Boolean, default: false }
});

const Config = require("../models/config.model");



/* =========================================
   CONFIGURACIÓN
========================================= */

const uri = process.env.MONGO_URI;

const planteles = [
  "registro14",
  "registro253",
  "registro272",
  "registro301",
  "registro309",
  "registro311",
  "registro72",
  "registro28"
];

/* =========================================
   MIDDLEWARE SUPERADMIN
========================================= */

function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Token requerido" });
  }

  const token = authHeader.split(" ")[1];

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(403).json({ error: "Token inválido" });
  }
}

/* =========================================
   CONEXIÓN DINÁMICA
========================================= */

function getConnection(dbName) {
  return mongoose.createConnection(uri, { dbName });
}

/* =========================================
   📊 RESUMEN GENERAL (para tarjetas)
========================================= */

router.get("/resumen", verificarToken, async (req, res) => {
  const resultados = {};

  for (const db of planteles) {
    const conn = getConnection(db);
    const Alumno = conn.model("Alumno", alumnoSchema);

    const total = await Alumno.countDocuments({
      registro_completado: true
    });

    resultados[db] = total;

    await conn.close();
  }

  res.json(resultados);
});

/* =========================================
   📋 LISTADO POR PLANTEL
========================================= */

router.get("/plantel/:db", verificarToken, async (req, res) => {
  const db = req.params.db;

  if (!planteles.includes(db)) {
    return res.status(400).json({ error: "Plantel inválido" });
  }

  const conn = getConnection(db);
  const Alumno = conn.model("Alumno", alumnoSchema);

  const alumnos = await Alumno.find({
    registro_completado: true
  }).lean();

  await conn.close();

  res.json(alumnos);
});

/* =========================================
   🔎 BUSCAR CURP GLOBAL
========================================= */

router.get("/buscar/:curp", verificarToken, async (req, res) => {
  const curp = req.params.curp.toUpperCase();
  const resultados = [];

  for (const db of planteles) {
    const conn = getConnection(db);
    const Alumno = conn.model("Alumno", alumnoSchema);

    const alumno = await Alumno.findOne({
      "datos_alumno.curp": curp,
      registro_completado: true
    }).lean();

    await conn.close();

    if (alumno) {
      resultados.push({
        plantel: db,
        nombres: alumno.datos_alumno?.nombres || "",
        primer_apellido: alumno.datos_alumno?.primer_apellido || "",
        curp: alumno.datos_alumno?.curp || "",
        folio: alumno.folio || ""
      });
    }
  }

  res.json(resultados);
});

/* =========================================
   📤 EXPORTAR EXCEL GENERAL
========================================= */

router.get("/exportar", verificarToken, async (req, res) => {
  let datos = [];

  for (const db of planteles) {
    const conn = getConnection(db);
    const Alumno = conn.model("Alumno", alumnoSchema);

    const alumnos = await Alumno.find({
      registro_completado: true
    }).lean();

    alumnos.forEach(a => {
      datos.push({
        plantel: db,
        nombre: a.datos_alumno?.nombres || "",
        apellido: a.datos_alumno?.primer_apellido || "",
        curp: a.datos_alumno?.curp || "",
        folio: a.folio || ""
      });
    });

    await conn.close();
  }

  const worksheet = XLSX.utils.json_to_sheet(datos);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "General");

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx"
  });

  res.setHeader(
    "Content-Disposition",
    "attachment; filename=general-planteles.xlsx"
  );

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );

  res.send(buffer);
});

router.get("/estadisticas", verificarToken, async (req, res) => {
  let totalGeneral = 0;
  let lider = { plantel: null, total: 0 };
  const detalle = {};

  for (const db of planteles) {
    const conn = getConnection(db);
    const Alumno = conn.model("Alumno", alumnoSchema);

    const total = await Alumno.countDocuments({
      registro_completado: true
    });

    detalle[db] = total;
    totalGeneral += total;

    if (total > lider.total) {
      lider = { plantel: db, total };
    }

    await conn.close();
  }

  res.json({
    totalGeneral,
    lider,
    detalle
  });
});

router.post("/bloqueo", verificarToken, async (req, res) => {
  const { estado } = req.body; // true o false

  let config = await Config.findOne();

  if (!config) {
    config = new Config();
  }

  config.bloqueo_registro = estado;
  await config.save();

  res.json({ bloqueo: estado });
});
router.get("/bloqueo", async (req, res) => {
  const config = await Config.findOne();
  res.json({ bloqueo: config?.bloqueo_registro || false });
});


module.exports = router;
