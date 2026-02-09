// backend/routers/alumno.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const generarPDF = require('../utils/pdfGenerator');
const flattenToNested = require('../utils/flattenToNested');
const path = require('path');
const fs = require('fs');

const { conexiones } = require('../server');
const AlumnoSchema = require('../models/Alumno').schema;
const ConfigSchema = require('../models/config.model').schema;

const upload = multer({ storage: multer.memoryStorage() });
const MAX_PARAESCOLAR = 40;

/* =====================================================
   OBTENER MODELO DINÁMICO SEGÚN PLANTEL
===================================================== */

function getAlumnoModel() {
  const plantel = process.env.PLANTEL_ID;
  if (!plantel) throw new Error("PLANTEL_ID no configurado");
  return conexiones[plantel].model("Alumno", AlumnoSchema);
}

function getConfigModel() {
  const plantel = process.env.PLANTEL_ID;
  return conexiones[plantel].model("Config", ConfigSchema);
}

/* =====================================================
   VALIDAR CURP GLOBAL ENTRE PLANTELES
===================================================== */

async function curpExisteEnOtroPlantel(curpActual) {
  const plantelActual = process.env.PLANTEL_ID;

  for (const key in conexiones) {
    if (key === plantelActual) continue;

    const AlumnoModel = conexiones[key].model("Alumno", AlumnoSchema);

    const existe = await AlumnoModel.findOne({
      "datos_alumno.curp": curpActual
    });

    if (existe) {
      return { existe: true, plantel: key };
    }
  }

  return { existe: false };
}

/* =====================================================
   HELPERS
===================================================== */

const CLAVES_EXENTAS = new Set([
  'estado_nacimiento',
  'municipio_nacimiento',
  'ciudad_nacimiento',
  'estado_nacimiento_general',
  'municipio_nacimiento_general',
  'ciudad_nacimiento_general'
]);

function toUpperData(obj) {
  return JSON.parse(JSON.stringify(obj), (key, value) => {
    return (typeof value === 'string' && !CLAVES_EXENTAS.has(key))
      ? value.toUpperCase()
      : value;
  });
}

async function puedeAsignarParaescolar(paraescolar, alumnoId = null) {
  const Alumno = getAlumnoModel();
  if (!paraescolar) return true;

  const filtro = {
    "datos_generales.paraescolar": paraescolar.toUpperCase()
  };

  if (alumnoId) filtro._id = { $ne: alumnoId };

  const count = await Alumno.countDocuments(filtro);
  return count < MAX_PARAESCOLAR;
}

/* =====================================================
   GUARDAR ALUMNO
===================================================== */

router.post('/guardar', async (req, res) => {
  try {

    const Alumno = getAlumnoModel();
    const Config = getConfigModel();

    // 🔒 Validar bloqueo estatal
    const config = await Config.findOne();
    if (config?.bloqueo_registro) {
      return res.status(403).json({
        error: "El registro está temporalmente deshabilitado"
      });
    }

    const data = req.body;
    const curp = data.datos_alumno?.curp?.toUpperCase();

    if (!curp) {
      return res.status(400).json({ error: "CURP inválida" });
    }

    // 🌎 Validación global
    const resultado = await curpExisteEnOtroPlantel(curp);
    if (resultado.existe) {
      return res.status(400).json({
        error: `La CURP ya está registrada en ${resultado.plantel}`
      });
    }

    // 🏫 Validación local
    const existeLocal = await Alumno.findOne({
      "datos_alumno.curp": curp
    });

    if (existeLocal?.registro_completado) {
      return res.status(400).json({
        message: "Este alumno ya completó su registro"
      });
    }

    // 🔢 Generar folio
    const prefijo = "CBTIS272-";
    const ultimo = await Alumno.findOne({
      folio: { $regex: `^${prefijo}` }
    }).sort({ folio: -1 });

    let consecutivo = 1;
    if (ultimo?.folio) {
      consecutivo = parseInt(ultimo.folio.replace(prefijo, "")) + 1;
    }

    const folio = `${prefijo}${String(consecutivo).padStart(4, "0")}`;
    data.folio = folio;
    data.registro_completado = true;
    data.bloqueado = true;

    const nuevoAlumno = await Alumno.create(data);

    const datosAnidados = flattenToNested(nuevoAlumno.toObject());
    const nombreArchivo = `${folio}.pdf`;
    const pdfUrl = await generarPDF(datosAnidados, nombreArchivo);

    res.json({
      message: "Registro exitoso",
      folio,
      pdf_url: pdfUrl
    });

  } catch (err) {
    console.error("ERROR /guardar:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

/* =====================================================
   REIMPRIMIR PDF
===================================================== */

router.get('/reimprimir/:folio', async (req, res) => {
  try {

    const Alumno = getAlumnoModel();

    const alumno = await Alumno.findOne({ folio: req.params.folio });

    if (!alumno) {
      return res.status(404).json({ message: 'Folio no encontrado' });
    }

    const datosAnidados = flattenToNested(alumno.toObject());
    const nombreArchivo = `${alumno.folio}.pdf`;

    const rutaPDF = await generarPDF(datosAnidados, nombreArchivo);
    const fullPath = path.join(__dirname, '../public', rutaPDF);

    res.sendFile(fullPath);

  } catch (err) {
    console.error("ERROR reimprimir:", err);
    res.status(500).json({ message: 'Error interno' });
  }
});

/* =====================================================
   DASHBOARD CRUD
===================================================== */

router.get('/dashboard/alumnos', async (req, res) => {
  try {
    const Alumno = getAlumnoModel();
    const alumnos = await Alumno.find();
    res.json(alumnos);
  } catch (error) {
    res.status(500).json({ message: 'Error al buscar alumnos' });
  }
});

router.put('/dashboard/alumnos/:id', async (req, res) => {
  try {
    const Alumno = getAlumnoModel();
    const actualizado = await Alumno.findByIdAndUpdate(
      req.params.id,
      toUpperData(req.body),
      { new: true }
    );
    res.json(actualizado);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar alumno' });
  }
});

router.delete('/dashboard/alumnos/:id', async (req, res) => {
  try {
    const Alumno = getAlumnoModel();
    await Alumno.findByIdAndDelete(req.params.id);
    res.json({ message: 'Alumno eliminado' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar alumno' });
  }
});

/* =====================================================
   EXPORTAR EXCEL
===================================================== */

router.get('/exportar-excel', async (req, res) => {
  try {

    const Alumno = getAlumnoModel();
    const alumnos = await Alumno.find({ registro_completado: true }).lean();

    const worksheet = xlsx.utils.json_to_sheet(alumnos);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Alumnos");

    const buffer = xlsx.write(workbook, {
      type: "buffer",
      bookType: "xlsx"
    });

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=alumnos.xlsx"
    );

    res.send(buffer);

  } catch (err) {
    console.error("ERROR exportar:", err);
    res.status(500).json({ message: "Error al exportar" });
  }
});

module.exports = router;
