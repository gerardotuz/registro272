const mongoose = require('mongoose');

const alumnoSchema = new mongoose.Schema({
  folio: { type: String, required: true, unique: true },
  datos_alumno: {
    primer_apellido: String,
    segundo_apellido: String,
    nombres: String,
    periodo_semestral: String,
    semestre: Number,
    grupo: String,
    turno: String,
    carrera: String,
    curp: String,
    fecha_nacimiento: String,
    edad: Number,
    sexo: String,
    estado_nacimiento: String,
    municipio_nacimiento: String,
    ciudad_nacimiento: String,
    estado_civil: String,
    nacionalidad: String,
    pais_extranjero: String
  },
  datos_generales: {
    colonia: String,
    domicilio: String,
    codigo_postal: String,
    telefono_alumno: String,
    correo_alumno: String,
    paraescolar: String,
    entrega_diagnostico: String,
    detalle_enfermedad: String,
    responsable_emergencia: {
      nombre: String,
      telefono: String,
      parentesco: String
    },
    carta_poder: String, // 👈 COMA aquí
    tipo_sangre: String,
    contacto_emergencia_nombre: String,
    contacto_emergencia_telefono: String,
    habla_lengua_indigena: {
      respuesta: String,
      cual: String
    }
  },
  datos_medicos: {
    numero_seguro_social: String,
    unidad_medica_familiar: String,
    enfermedad_cronica_o_alergia: {
      respuesta: String,
      detalle: String
    },
    discapacidad: String
  },
  secundaria_origen: {
    nombre_secundaria: String,
    regimen: String,
    promedio_general: Number,
    modalidad: String
  },
  tutor_responsable: {
    nombre_padre: String,
    telefono_padre: String,
    nombre_madre: String,
    telefono_madre: String,
    vive_con: String,
    persona_emergencia: {
      nombre: String,
      parentesco: String,
      telefono: String
    }
  }
});

module.exports = mongoose.model('Alumno', alumnoSchema);
