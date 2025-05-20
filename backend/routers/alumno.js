const express = require('express');
const router = express.Router();
const Alumno = require('../models/Alumno');
const multer = require('multer');
const xlsx = require('xlsx');
const PDFDocument = require('pdfkit');
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

// Generar PDF con todos los campos del formulario
router.get('/pdf/:folio', async (req, res) => {
  try {
    const alumno = await Alumno.findOne({ folio: req.params.folio });
    if (!alumno) return res.status(404).send('Folio no encontrado');

    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${req.params.folio}.pdf`);
    doc.pipe(res);

    doc.fontSize(18).text('Registro de Alumno', { align: 'center' });
    doc.moveDown();

    doc.fontSize(14).text('📘 DATOS DEL ALUMNO');
    for (const [key, val] of Object.entries(alumno.datos_alumno || {})) {
      doc.text(`${key.replace(/_/g, ' ')}: ${val}`);
    }

    doc.moveDown().text('📗 DATOS GENERALES');
    for (const [key, val] of Object.entries(alumno.datos_generales || {})) {
      if (typeof val === 'object' && val !== null) {
        for (const [subkey, subval] of Object.entries(val)) {
          doc.text(`${key.replace(/_/g, ' ')} - ${subkey}: ${subval}`);
        }
      } else {
        doc.text(`${key.replace(/_/g, ' ')}: ${val}`);
      }
    }

    doc.moveDown().text('📙 DATOS MÉDICOS');
    for (const [key, val] of Object.entries(alumno.datos_medicos || {})) {
      if (typeof val === 'object' && val !== null) {
        for (const [subkey, subval] of Object.entries(val)) {
          doc.text(`${key.replace(/_/g, ' ')} - ${subkey}: ${subval}`);
        }
      } else {
        doc.text(`${key.replace(/_/g, ' ')}: ${val}`);
      }
    }

    doc.moveDown().text('📒 SECUNDARIA DE ORIGEN');
    for (const [key, val] of Object.entries(alumno.secundaria_origen || {})) {
      doc.text(`${key.replace(/_/g, ' ')}: ${val}`);
    }

    doc.moveDown().text('📕 TUTOR RESPONSABLE');
    for (const [key, val] of Object.entries(alumno.tutor_responsable || {})) {
      if (typeof val === 'object' && val !== null) {
        for (const [subkey, subval] of Object.entries(val)) {
          doc.text(`${key.replace(/_/g, ' ')} - ${subkey}: ${subval}`);
        }
      } else {
        doc.text(`${key.replace(/_/g, ' ')}: ${val}`);
      }
    }

    doc.end();
  } catch (err) {
    console.error('Error generando PDF completo:', err);
    res.status(500).send('Error generando el PDF');
  }
});
module.exports = router;
