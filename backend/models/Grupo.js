// backend/models/Grupo.js
const mongoose = require('mongoose');

const GrupoSchema = new mongoose.Schema({
  folio: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  nombres: { type: String, required: true },
  primer_apellido: { type: String, required: true },
  segundo_apellido: { type: String, required: true },
  grupo: { type: String, required: true },
  especialidad: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Grupo', GrupoSchema);
