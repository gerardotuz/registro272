
const express = require('express');
const Alumno = require('../models/Alumno');
const PDFDocument = require('pdfkit');
const router = express.Router();

router.get('/buscar-folio/:folio', async (req, res) => {
  const alumno = await Alumno.findOne({ folio: req.params.folio });
  if (!alumno) return res.status(404).json({ message: 'Folio no encontrado' });
  res.json(alumno);
});

router.post('/guardar', async (req, res) => {
  const { folio, curp, correo_alumno, telefono_alumno } = req.body;
  await Alumno.updateOne({ folio }, { curp, correo_alumno, telefono_alumno });
  res.json({ message: 'Datos guardados correctamente' });
});

router.get('/pdf/:folio', async (req, res) => {
  const alumno = await Alumno.findOne({ folio: req.params.folio });
  if (!alumno) return res.status(404).json({ message: 'No encontrado' });

  const doc = new PDFDocument();
  res.setHeader('Content-Type', 'application/pdf');
  doc.pipe(res);
  doc.fontSize(18).text('Datos del Alumno', { align: 'center' });
  doc.moveDown();
  doc.text(`Folio: ${alumno.folio}`);
  doc.text(`CURP: ${alumno.curp}`);
  doc.text(`Correo: ${alumno.correo_alumno}`);
  doc.text(`Teléfono: ${alumno.telefono_alumno}`);
  doc.end();
});

module.exports = router;
