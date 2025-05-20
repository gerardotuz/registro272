
const express = require('express');
const router = express.Router();
const Alumno = require('../models/Alumno');
const PDFDocument = require('pdfkit');

// Ruta para generar PDF sin fondo, con todos los campos
router.get('/pdf/:folio', async (req, res) => {
  try {
    const alumno = await Alumno.findOne({ folio: req.params.folio });
    if (!alumno) return res.status(404).send('Folio no encontrado');

    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${req.params.folio}.pdf`);
    doc.pipe(res);

    doc.fontSize(16).text('Ficha de Inscripción - Alumno', { align: 'center' });
    doc.moveDown();

    const datos = alumno;

    doc.fontSize(12).text(`Folio: ${datos.folio}`);
    doc.moveDown().text('--- DATOS DEL ALUMNO ---');
    Object.entries(datos.datos_alumno || {}).forEach(([key, value]) => {
      doc.text(`${key.replace(/_/g, ' ')}: ${value ?? ''}`);
    });

    doc.moveDown().text('--- DATOS GENERALES ---');
    Object.entries(datos.datos_generales || {}).forEach(([key, value]) => {
      if (typeof value === 'object') {
        Object.entries(value).forEach(([subkey, subval]) => {
          doc.text(`${key.replace(/_/g, ' ')} - ${subkey}: ${subval ?? ''}`);
        });
      } else {
        doc.text(`${key.replace(/_/g, ' ')}: ${value ?? ''}`);
      }
    });

    doc.moveDown().text('--- DATOS MÉDICOS ---');
    Object.entries(datos.datos_medicos || {}).forEach(([key, value]) => {
      if (typeof value === 'object') {
        Object.entries(value).forEach(([subkey, subval]) => {
          doc.text(`${key.replace(/_/g, ' ')} - ${subkey}: ${subval ?? ''}`);
        });
      } else {
        doc.text(`${key.replace(/_/g, ' ')}: ${value ?? ''}`);
      }
    });

    doc.moveDown().text('--- SECUNDARIA DE ORIGEN ---');
    Object.entries(datos.secundaria_origen || {}).forEach(([key, value]) => {
      doc.text(`${key.replace(/_/g, ' ')}: ${value ?? ''}`);
    });

    doc.moveDown().text('--- TUTOR RESPONSABLE ---');
    Object.entries(datos.tutor_responsable || {}).forEach(([key, value]) => {
      if (typeof value === 'object') {
        Object.entries(value).forEach(([subkey, subval]) => {
          doc.text(`${key.replace(/_/g, ' ')} - ${subkey}: ${subval ?? ''}`);
        });
      } else {
        doc.text(`${key.replace(/_/g, ' ')}: ${value ?? ''}`);
      }
    });

    doc.end();
  } catch (err) {
    console.error('Error al generar PDF simple:', err);
    res.status(500).send('Error al generar el PDF');
  }
});

module.exports = router;
