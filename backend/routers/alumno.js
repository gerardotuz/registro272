const express = require('express');
const router = express.Router();
const Alumno = require('../models/Alumno');
const multer = require('multer');
const xlsx = require('xlsx');
const PDFDocument = require('pdfkit');
const flattenToNested = require('../utils/flattenToNested');
const generarPDF = require('../utils/pdfGenerator'); // NUEVO
const path = require('path'); // NUEVO

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

    const upperCaseData = JSON.parse(JSON.stringify(data), (key, value) =>
      typeof value === 'string' ? value.toUpperCase() : value
    );

    const paraescolar = data.datos_generales?.paraescolar;
    const yaRegistrado = await Alumno.findOne({ folio: data.folio });

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

    await Alumno.findOneAndUpdate({ folio: data.folio }, upperCaseData, { upsert: true });

    res.status(200).json({
      message: 'Registro exitoso',
      pdf_url: `/api/pdf/${data.folio}`
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/validar-paraescolar/:nombre', async (req, res) => {
  try {
    const nombre = req.params.nombre.toUpperCase();
    const count = await Alumno.countDocuments({ "datos_generales.paraescolar": nombre });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/cargar-excel', upload.single('archivo'), async (req, res) => {
  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    for (let row of data) {
      const alumno = flattenToNested(row);
      await Alumno.findOneAndUpdate({ folio: alumno.folio }, { $set: alumno }, { upsert: true });
    }

    res.status(200).json({ message: 'Carga exitosa' });
  } catch (err) {
    console.error('Error al procesar Excel:', err);
    res.status(500).json({ message: err.message });
  }
});

router.get('/pdf/:folio', async (req, res) => {
  try {
    const alumno = await Alumno.findOne({ folio: req.params.folio });
    if (!alumno) return res.status(404).send('Folio no encontrado');

    const nombrePDF = `${alumno.datos_alumno?.curp || 'alumno'}.pdf`;
    const rutaPDF = await generarPDF(alumno, nombrePDF);

    res.redirect(rutaPDF); // redirige a /pdfs/<archivo>.pdf
  } catch (err) {
    console.error('Error generando PDF con diseño:', err);
    res.status(500).send('Error generando el PDF');
  }
});

module.exports = router;

