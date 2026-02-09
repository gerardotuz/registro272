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
   🔹 OBTENER MODELOS DINÁMICOS POR PLANTEL
===================================================== */

function getPlantel() {
  const plantel = process.env.PLANTEL_ID;
  if (!plantel) throw new Error("PLANTEL_ID no definido");
  return plantel;
}

function getAlumnoModel() {
  const plantel = getPlantel();
  return conexiones[plantel].model("Alumno", AlumnoSchema);
}

function getConfigModel() {
  const plantel = getPlantel();
  return conexiones[plantel].model("Config", ConfigSchema);
}

/* =====================================================
   🌎 VALIDAR CURP GLOBAL ENTRE PLANTELES
===================================================== */

async function curpExisteEnOtroPlantel(curpActual) {
  const plantelActual = getPlantel();

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
   🔹 HELPERS
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
   🔢 GENERAR FOLIO
===================================================== */

async function generarFolio() {
  const Alumno = getAlumnoModel();
  const prefijo = process.env.PREFIJO_FOLIO || "CBTIS272-";

  const ultimo = await Alumno.findOne({
    folio: { $regex: `^${prefijo}` }
  })
    .sort({ folio: -1 })
    .lean();

  let consecutivo = 1;

  if (ultimo?.folio) {
    const num = parseInt(ultimo.folio.replace(prefijo, ""));
    consecutivo = num + 1;
  }

  return `${prefijo}${String(consecutivo).padStart(4, "0")}`;
}

/* =====================================================
   🚀 POST /guardar
===================================================== */

router.post('/guardar', async (req, res) => {
  try {

    const Alumno = getAlumnoModel();
    const Config = getConfigModel();

    // 🔒 Validar bloqueo estatal
    const config = await Config.findOne();
    if (config?.bloqueo_registro) {
      return res.status(403).json({
        error: "El registro está temporalmente deshabilitado por administración estatal"
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
        error: `La CURP ya está registrada en el plantel ${resultado.plantel}`
      });
    }

    // 🏫 Validación local
    const existeLocal = await Alumno.findOne({
      "datos_alumno.curp": curp
    });

    if (existeLocal?.registro_completado) {
      return res.status(400).json({
        error: "Este alumno ya completó su registro en este plantel"
      });
    }

    // 🔢 Generar folio
    const folio = await generarFolio();
    data.folio = folio;
    data.registro_completado = true;
    data.bloqueado = true;

    const nuevoAlumno = await Alumno.create(data);

    // 📄 Generar PDF
    const datosAnidados = flattenToNested(nuevoAlumno.toObject());
    const pdfUrl = await generarPDF(datosAnidados, `${folio}.pdf`);

    return res.status(200).json({
      message: "Registro exitoso",
      folio,
      pdf_url: pdfUrl
    });

  } catch (err) {
    console.error("❌ ERROR EN /guardar:", err);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

/* =====================================================
   🔎 REIMPRIMIR
===================================================== */

router.get('/reimprimir/:folio', async (req, res) => {
  try {
    const Alumno = getAlumnoModel();

    const alumno = await Alumno.findOne({ folio: req.params.folio });

    if (!alumno) {
      return res.status(404).json({ message: 'Folio no encontrado' });
    }

    const datosAnidados = flattenToNested(alumno.toObject());
    const rutaPDF = await generarPDF(datosAnidados, `${alumno.folio}.pdf`);

    const fullPath = path.join(__dirname, '../public', rutaPDF);
    res.sendFile(fullPath);

  } catch (err) {
    console.error("❌ Error al reimprimir:", err);
    res.status(500).json({ message: 'Error interno al generar PDF' });
  }
});

router.get('/exportar-excel', async (req, res) => {
  try {

    const Alumno = getAlumnoModel();

    const alumnos = await Alumno.find({
      registro_completado: true
    }).lean();

    if (!alumnos.length) {
      return res.status(404).json({
        message: 'No hay alumnos registrados aún.'
      });
    }

    const datos = alumnos.map(al => ({
      folio: al.folio || '',

      // ===== DATOS ALUMNO =====
      primer_apellido: al.datos_alumno?.primer_apellido || '',
      segundo_apellido: al.datos_alumno?.segundo_apellido || '',
      nombres: al.datos_alumno?.nombres || '',
      periodo_semestral: al.datos_alumno?.periodo_semestral || '',
      semestre: al.datos_alumno?.semestre || '',
      grupo: al.datos_alumno?.grupo || '',
      turno: al.datos_alumno?.turno || '',
      carrera: al.datos_alumno?.carrera || '',
      curp: al.datos_alumno?.curp || '',
      fecha_nacimiento: al.datos_alumno?.fecha_nacimiento || '',
      edad: al.datos_alumno?.edad || '',
      sexo: al.datos_alumno?.sexo || '',
      estado_nacimiento: al.datos_alumno?.estado_nacimiento || '',
      municipio_nacimiento: al.datos_alumno?.municipio_nacimiento || '',
      ciudad_nacimiento: al.datos_alumno?.ciudad_nacimiento || '',
      estado_civil: al.datos_alumno?.estado_civil || '',
      nacionalidad: al.datos_alumno?.nacionalidad || '',
      pais_extranjero: al.datos_alumno?.pais_extranjero || '',

      // ===== DATOS GENERALES =====
      colonia: al.datos_generales?.colonia || '',
      domicilio: al.datos_generales?.domicilio || '',
      codigo_postal: al.datos_generales?.codigo_postal || '',
      telefono_alumno: al.datos_generales?.telefono_alumno || '',
      correo_alumno: al.datos_generales?.correo_alumno || '',
      paraescolar: al.datos_generales?.paraescolar || '',
      entrega_diagnostico: al.datos_generales?.entrega_diagnostico || '',
      detalle_enfermedad: al.datos_generales?.detalle_enfermedad || '',
      tipo_sangre: al.datos_generales?.tipo_sangre || '',

      // ===== MÉDICOS =====
      numero_seguro_social: al.datos_medicos?.numero_seguro_social || '',
      unidad_medica_familiar: al.datos_medicos?.unidad_medica_familiar || '',
      enfermedad_cronica_respuesta: al.datos_medicos?.enfermedad_cronica_o_alergia?.respuesta || '',
      enfermedad_cronica_detalle: al.datos_medicos?.enfermedad_cronica_o_alergia?.detalle || '',
      discapacidad: al.datos_medicos?.discapacidad || '',

      // ===== TUTOR =====
      nombre_padre: al.tutor_responsable?.nombre_padre || '',
      telefono_padre: al.tutor_responsable?.telefono_padre || '',
      nombre_madre: al.tutor_responsable?.nombre_madre || '',
      telefono_madre: al.tutor_responsable?.telefono_madre || '',
      vive_con: al.tutor_responsable?.vive_con || '',

      // ===== EMERGENCIA =====
      persona_emergencia_nombre: al.persona_emergencia?.nombre || '',
      persona_emergencia_parentesco: al.persona_emergencia?.parentesco || '',
      persona_emergencia_telefono: al.persona_emergencia?.telefono || ''
    }));

    const worksheet = xlsx.utils.json_to_sheet(datos);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Alumnos');

    const buffer = xlsx.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx'
    });

    res.setHeader(
      'Content-Disposition',
      'attachment; filename=alumnos_registrados.xlsx'
    );

    res.send(buffer);

  } catch (err) {
    console.error('ERROR exportar Excel:', err);
    res.status(500).json({ message: 'Error al exportar datos.' });
  }
});


module.exports = router;
