const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { conexiones } = require('../server');

const AlumnoSchema = require('../models/Alumno').schema;

function getModelo(nombreConexion) {
  return conexiones[nombreConexion].model('Alumno', AlumnoSchema);
}

// ===============================
// TOTAL POR PLANTEL
// ===============================
router.get('/totales', async (req, res) => {
  try {
    const resultado = {};

    for (const key in conexiones) {
      const Modelo = getModelo(key);
      const total = await Modelo.countDocuments({ registro_completado: true });
      resultado[key] = total;
    }

    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===============================
// BUSQUEDA GLOBAL POR CURP
// ===============================
router.get('/buscar/:curp', async (req, res) => {
  try {
    const curp = req.params.curp.toUpperCase();
    const encontrado = [];

    for (const key in conexiones) {
      const Modelo = getModelo(key);
      const alumno = await Modelo.findOne({
        "datos_alumno.curp": curp
      });

      if (alumno) {
        encontrado.push({
          plantel: key,
          folio: alumno.folio,
          nombre: alumno.datos_alumno.nombres
        });
      }
    }

    res.json(encontrado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
