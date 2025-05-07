
const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const Alumno = require('../models/Alumno');
const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post('/excel', upload.single('file'), async (req, res) => {
  const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
  const hoja = workbook.Sheets[workbook.SheetNames[0]];
  const datos = xlsx.utils.sheet_to_json(hoja);
  await Alumno.insertMany(datos);
  res.json({ message: 'Datos cargados correctamente' });
});

module.exports = router;
