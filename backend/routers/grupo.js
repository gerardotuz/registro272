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
    const folio = req.params.folio.trim().toUpperCase();
    console.log("📌 Consultando folio:", folio);

    const grupo = await Grupo.findOne({ folio: folio });
    if (!grupo) {
      console.log("❌ Folio no encontrado en MongoDB");
      return res.status(404).json({ ok: false, msg: 'Folio no encontrado' });
    }

    console.log("✅ Grupo encontrado:", grupo);
    res.json({ ok: true, data: grupo });
  } catch (err) {
    console.error("❌ Error en el backend al buscar grupo:", err);
    res.status(500).json({ ok: false, msg: 'Error del servidor' });
  }
});

// POST /api/cargar-grupos
router.post('/cargar-grupos', upload.single('archivo'), async (req, res) => {
  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    let datos = xlsx.utils.sheet_to_json(sheet);

    datos = datos.filter(g => g.turno && g.turno.trim() !== '');
    if (datos.length === 0) {
      return res.status(400).json({ ok: false, msg: 'El archivo no contiene datos válidos de grupos con turno.' });
    }

    await Grupo.deleteMany({});
    await Grupo.insertMany(datos);

    fs.unlinkSync(req.file.path);
    res.json({ ok: true, msg: 'Datos de grupos cargados correctamente.' });
  } catch (err) {
    console.error("❌ Error al cargar grupos:", err);
    res.status(500).json({ ok: false, msg: 'Error al cargar los datos.' });
  }
});

module.exports = router;

