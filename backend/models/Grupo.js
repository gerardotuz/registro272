// backend/routers/grupo.js
const express = require('express');
const router = express.Router();
const Grupo = require('../models/Grupo');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');

const upload = multer({ dest: 'uploads/' });

// GET /api/consultar-grupo/:folio
router.get('/consultar-grupo/:folio', async (req, res) => {
  try {
    console.log("Buscando folio:", req.params.folio); // ← agrega esto
    const grupo = await Grupo.findOne({ folio: req.params.folio });
    if (!grupo) return res.status(404).json({ mensaje: 'Folio no encontrado' });
    res.json(grupo); // ✅ RESPUESTA PLANA SIN .data
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
});

// POST /api/cargar-grupos
router.post('/cargar-grupos', upload.single('archivo'), async (req, res) => {
  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const datos = xlsx.utils.sheet_to_json(sheet);

    await Grupo.deleteMany({});
    await Grupo.insertMany(datos);

    fs.unlinkSync(req.file.path);
    res.json({ mensaje: 'Datos cargados correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al cargar los datos' });
  }
});

module.exports = router;
