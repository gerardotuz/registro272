const express = require('express');
const router = express.Router();
const Alumno = require('../models/Alumno');
const multer = require('multer');
const xlsx = require('xlsx');
const PDFDocument = require('pdfkit');
const flattenToNested = require('../utils/flattenToNested');

const upload = multer({ storage: multer.memoryStorage() });
const MAX_PARAESCOLAR = 5;

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

    // Validación mejorada
    const obligatorios = [
      data.folio,
      data.datos_alumno?.curp,
      data.datos_generales?.correo_alumno,
      data.datos_generales?.paraescolar
    ];
    if (obligatorios.some(d => !d || d.trim() === '')) {
      return res.status(400).json({ message: 'Faltan datos obligatorios' });
    }

    const paraescolar = data.datos_generales.paraescolar.toUpperCase();
    const count = await Alumno.countDocuments({ "datos_generales.paraescolar": paraescolar });
    const yaRegistrado = await Alumno.findOne({ folio: data.folio });

    if (!yaRegistrado && count >= MAX_PARAESCOLAR) {
      return res.status(400).json({ message: `El paraescolar ${paraescolar} ya alcanzó el límite de 50 alumnos.` });
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
    res.status(500).json({ message: err.message });
  }
});

router.get('/pdf/:folio', async (req, res) => {
  try {
    const alumno = await Alumno.findOne({ folio: req.params.folio });
    if (!alumno) return res.status(404).send('Folio no encontrado');

    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', \`attachment; filename=\${req.params.folio}.pdf\`);
    doc.pipe(res);

    doc.fontSize(18).text('Registro de Alumno', { align: 'center' });
    doc.moveDown();

    const imprimirObjeto = (titulo, objeto) => {
      doc.moveDown().fontSize(14).text(titulo);
      for (const [key, val] of Object.entries(objeto || {})) {
        if (typeof val === 'object' && val !== null) {
          for (const [subkey, subval] of Object.entries(val)) {
            doc.fontSize(12).text(\`\${key.replace(/_/g, ' ')} - \${subkey}: \${subval}\`);
          }
        } else {
          doc.fontSize(12).text(\`\${key.replace(/_/g, ' ')}: \${val}\`);
        }
      }
    };

    imprimirObjeto('📘 DATOS DEL ALUMNO', alumno.datos_alumno);
    imprimirObjeto('📗 DATOS GENERALES', alumno.datos_generales);

    doc.moveDown();
    doc.fontSize(14).fillColor('blue').text(\`🎯 PARAESCOLAR ELEGIDO: \${alumno.datos_generales?.paraescolar || 'NO REGISTRADO'}\`);
    doc.fillColor('black');

    imprimirObjeto('📙 DATOS MÉDICOS', alumno.datos_medicos);
    imprimirObjeto('📒 SECUNDARIA DE ORIGEN', alumno.secundaria_origen);
    imprimirObjeto('📕 TUTOR RESPONSABLE', alumno.tutor_responsable);

    doc.end();
  } catch (err) {
    res.status(500).send('Error generando el PDF');
  }
});

module.exports = router;
