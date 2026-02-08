const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const alumnoSchema = require("../models/Alumno").schema;

const uri = process.env.MONGO_URI;

const planteles = [
  "registro214",
  "registro253",
  "registro272",
  "registro301",
  "registro309",
  "registro311",
  "registro72",
  "registro28"
];

function getConnection(dbName) {
  return mongoose.createConnection(uri, { dbName });
}

/* ===============================
   TOTAL POR PLANTEL
================================ */
router.get("/totales", async (req, res) => {
  const resultados = {};

  for (const db of planteles) {
    const conn = getConnection(db);
    const Alumno = conn.model("Alumno", alumnoSchema);

    resultados[db] = await Alumno.countDocuments({
      registro_completado: true
    });

    await conn.close();
  }

  res.json(resultados);
});

/* ===============================
   LISTADO POR PLANTEL
================================ */
router.get("/plantel/:db", async (req, res) => {
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

/* ===============================
   BUSCAR CURP GLOBAL
================================ */
router.get("/buscar/:curp", async (req, res) => {
  const curp = req.params.curp.toUpperCase();

  for (const db of planteles) {
    const conn = getConnection(db);
    const Alumno = conn.model("Alumno", alumnoSchema);

    const alumno = await Alumno.findOne({
      "datos_alumno.curp": curp
    }).lean();

    await conn.close();

    if (alumno) {
      return res.json({
        encontrado: true,
        plantel: db,
        alumno
      });
    }
  }

  res.json({ encontrado: false });
});

/* ===============================
   EXPORTAR GENERAL
================================ */
router.get("/exportar-general", async (req, res) => {
  const XLSX = require("xlsx");
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
    "attachment; filename=general.xlsx"
  );

  res.send(buffer);
});

module.exports = router;
