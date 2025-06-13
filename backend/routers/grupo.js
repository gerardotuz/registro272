const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const xlsx    = require('xlsx');
const Grupo   = require('../models/Grupo');
const router = express.Router();
const Grupo = require('../models/Grupo'); // ✅ Importación corregida
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');

const upload = multer({ dest: 'uploads/' });

// ======= 1) Consultar grupo por folio =======
// GET /api/consultar-grupo/:folio
router.get('/consultar-grupo/:folio', async (req, res) => {
  try {
    const { folio } = req.params;
    const registro  = await Grupo.findOne({ folio });
    if (!registro) {
      return res.status(404).json({ ok:false, msg:'Folio no encontrado' });
    const folio = req.params.folio.trim().toUpperCase();
    console.log("📌 Consultando folio:", folio);

    const grupo = await Grupo.findOne({ folio: folio });
    if (!grupo) {
      console.log("❌ Folio no encontrado en MongoDB");
      return res.status(404).json({ mensaje: 'Folio no encontrado' });
    }
    res.json({ ok:true, data:registro });

    console.log("✅ Grupo encontrado:", grupo);
    res.json(grupo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok:false, msg:'Error del servidor' });
    console.error("❌ Error en el backend al buscar grupo:", err);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
});

// ======= 2) Carga masiva desde Excel =======
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/cargar-grupos
router.post('/cargar-grupos', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok:false, msg:'Archivo no recibido' });
    }
    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const datos = xlsx.utils.sheet_to_json(sheet);

    await Grupo.deleteMany({});
    await Grupo.insertMany(datos);

    const workbook = xlsx.read(req.file.buffer, { type:'buffer' });
    const hoja     = workbook.Sheets[workbook.SheetNames[0]];
    const rows     = xlsx.utils.sheet_to_json(hoja, { defval:'' });

    // Espera columnas: folio, nombres, primer_apellido, segundo_apellido, grupo, especialidad
    const operaciones = rows.map(row =>
      Grupo.updateOne(
        { folio: row.folio },
        {
          $set: {
            nombres          : row.nombres,
            primer_apellido  : row.primer_apellido,
            segundo_apellido : row.segundo_apellido,
            grupo            : row.grupo,
            especialidad     : row.especialidad
          }
        },
        { upsert:true }
      )
    );

    await Promise.all(operaciones);
    res.json({ ok:true, msg:`Se cargaron/actualizaron ${operaciones.length} registros` });
    fs.unlinkSync(req.file.path);
    res.json({ mensaje: 'Datos cargados correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok:false, msg:'Error procesando el archivo' });
    console.error("❌ Error al cargar grupos:", err);
    res.status(500).json({ mensaje: 'Error al cargar los datos' });
  }
});
