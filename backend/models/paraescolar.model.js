const mongoose = require("mongoose");

const ParaescolarSchema = new mongoose.Schema({
  numero_control: { type: String, required: true, unique: true },
  nombres: String,
  primer_apellido: String,
  segundo_apellido: String,
  grupo: String,
  turno: String,
  paraescolar: { type: String, default: null },
  fecha_registro: Date,
  bloqueado: { type: Boolean, default: false }
});

module.exports = mongoose.model("Paraescolar", ParaescolarSchema);
