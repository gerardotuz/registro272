const express = require('express');
const router = express.Router();
const Alumno = require('../models/Alumno');
const multer = require('multer');
const xlsx = require('xlsx');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const flattenToNested = require('../utils/flattenToNested');

// Configuración para subir archivos desde memoria
const upload = multer({ storage: multer.memoryStorage() });

// Obtener alumno por folio
router.get('/folio/:folio', async (req, res) => {
  try {
    const alumno = await Alumno.findOne({ folio: req.params.folio });
    if (!alumno) return res.status(404).json({ message: 'Folio no encontrado' });
    res.json(alumno);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Guardar formulario
router.post('/guardar', async (req, res) => {
  try {
    const data = req.body;

    if (!data.folio || !data.datos_alumno?.curp || !data.datos_generales?.correo_alumno) {
      return res.status(400).json({ message: 'Faltan datos obligatorios' });
    }

    const upperCaseData = JSON.parse(JSON.stringify(data), (key, value) =>
      typeof value === 'string' ? value.toUpperCase() : value
    );

    await Alumno.findOneAndUpdate({ folio: data.folio }, upperCaseData, { upsert: true });
    res.status(200).json({ message: 'Registro exitoso' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Cargar alumnos desde Excel (plano → anidado)
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

// Generar PDF por folio
router.get('/pdf/:folio', async (req, res) => {
  try {
    const alumno = await Alumno.findOne({ folio: req.params.folio });
    if (!alumno) return res.status(404).send('Folio no encontrado');

    const doc = new PDFDocument();
    const pdfPath = `backend/public/pdfs/${req.params.folio}.pdf`;
    doc.pipe(fs.createWriteStream(pdfPath));

    doc.fontSize(18).text('Registro de Alumno', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Folio: ${alumno.folio}`);
    doc.text(`Nombre: ${alumno.datos_alumno.nombres} ${alumno.datos_alumno.primer_apellido} ${alumno.datos_alumno.segundo_apellido}`);
    doc.text(`CURP: ${alumno.datos_alumno.curp}`);
    doc.text(`Carrera: ${alumno.datos_alumno.carrera}`);
    doc.text(`Correo: ${alumno.datos_generales.correo_alumno}`);
    doc.end();

    doc.on('finish', () => {
      res.download(pdfPath);
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;
