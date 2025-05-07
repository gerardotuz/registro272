
const mongoose = require('mongoose');
const alumnoSchema = new mongoose.Schema({
  folio: String,
  curp: String,
  correo_alumno: String,
  telefono_alumno: String
});
module.exports = mongoose.model('Alumno', alumnoSchema);
