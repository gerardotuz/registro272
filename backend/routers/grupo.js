// backend/routers/grupo.js
const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const xlsx    = require('xlsx');
const Grupo   = require('../models/Grupo');

// ======= 1) Consultar grupo por folio =======
router.get('/consultar-grupo/:folio', async (req, res) => {
  try {
    const { folio } = req.params;
    const registro  = await Grupo.findOne({ folio });
    if (!registro) {
      return res.status(404).json({ ok:false, msg:'Folio no encontrado' });
    }
    res.json({ ok:true, data:registro });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok:false, msg:'Error del servidor' });
  }
});

// ======= 2) Carga masiva desde Excel =======
const upload = multer({ storage: multer.memoryStorage() });

router.post('/cargar-grupos', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok:false, msg:'Archivo no recibido' });
    }

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
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok:false, msg:'Error procesando el archivo' });
  }
});

module.exports = router;
