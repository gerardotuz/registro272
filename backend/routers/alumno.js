const express = require('express');
const router = express.Router();
const Alumno = require('../models/Alumno');
const multer = require('multer');
const xlsx = require('xlsx');
const generarPDF = require('../utils/pdfGenerator');
const flattenToNested = require('../utils/flattenToNested');
const path = require('path');

const upload = multer({ storage: multer.memoryStorage() });
const MAX_PARAESCOLAR = 40;

router.get('/folio/:folio', async (req, res) => {
  try {
    const alumno = await Alumno.findOne({ folio: req.params.folio });
    if (!alumno) return res.status(404).json({ message: 'Folio no encontrado' });
    res.json(alumno);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/guardar', async (req, res) => {
  try {
    const data = req.body;

    if (!data.folio || !data.datos_alumno?.curp || !data.datos_generales?.correo_alumno) {
      return res.status(400).json({ message: 'Faltan datos obligatorios' });
    }

    const yaRegistrado = await Alumno.findOne({ folio: data.folio });

    // 🚫 Si ya está registrado, no permitir editar
    if (yaRegistrado?.registro_completado) {
      return res.status(403).json({ message: 'Este folio ya fue registrado y no se puede modificar.' });
    }

    // Convertimos a mayúsculas excepto claves que deben mantenerse
    const upperCaseData = JSON.parse(JSON.stringify(data), (key, value) => {
      if (['estado_nacimiento', 'municipio_nacimiento', 'ciudad_nacimiento'].includes(key)) {
        return value; // No convertir claves
      }
      return typeof value === 'string' ? value.toUpperCase() : value;
    });

    // Validación de paraescolar
    const paraescolar = data.datos_generales?.paraescolar;

    if (paraescolar) {
      const count = await Alumno.countDocuments({ "datos_generales.paraescolar": paraescolar.toUpperCase() });
      const paraescolarPrevio = yaRegistrado?.datos_generales?.paraescolar;
      const estaCambiando = paraescolarPrevio && paraescolarPrevio.toUpperCase() !== paraescolar.toUpperCase();

      if (!yaRegistrado && count >= MAX_PARAESCOLAR) {
        return res.status(400).json({ message: `El paraescolar ${paraescolar} ya alcanzó el límite de ${MAX_PARAESCOLAR} alumno(s).` });
      }

      if (yaRegistrado && estaCambiando && count >= MAX_PARAESCOLAR) {
        return res.status(400).json({ message: `No se puede cambiar a ${paraescolar}, ya alcanzó su límite.` });
      }
    }

    // Convertir estado_civil a número si es numérico
    const estadoCivilNum = parseInt(data.datos_alumno?.estado_civil);
    if (!isNaN(estadoCivilNum)) {
      upperCaseData.datos_alumno.estado_civil = estadoCivilNum;
    }

    // Asegurar que las opciones estén definidas
    upperCaseData.datos_generales.primera_opcion = data.datos_generales.primera_opcion || '';
    upperCaseData.datos_generales.segunda_opcion = data.datos_generales.segunda_opcion || '';
    upperCaseData.datos_generales.tercera_opcion = data.datos_generales.tercera_opcion || '';
    upperCaseData.datos_generales.cuarta_opcion = data.datos_generales.cuarta_opcion || '';

    // ✅ Marcar como registro completado
    upperCaseData.registro_completado = true;

    // Guardar en base de datos
    await Alumno.findOneAndUpdate({ folio: data.folio }, upperCaseData, { upsert: true });

    // Generar PDF
    const datosAnidados = flattenToNested(upperCaseData);
    const nombreArchivo = `${datosAnidados.datos_alumno?.curp || 'formulario'}.pdf`;
    await generarPDF(datosAnidados, nombreArchivo);

    res.status(200).json({
      message: 'Registro exitoso y PDF generado',
      pdf_url: `/pdfs/${nombreArchivo}`
    });

  } catch (err) {
    console.error('Error al guardar o generar PDF:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
