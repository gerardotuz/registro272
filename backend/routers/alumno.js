// backend/routers/alumno.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Config = require('../models/config.model');
const multer = require('multer');
const xlsx = require('xlsx');
const generarPDF = require('../utils/pdfGenerator');
const generarPDFRegistro = require('../utils/pdfGeneratorRegistro');
const flattenToNested = require('../utils/flattenToNested');
const path = require('path');
const fs = require('fs');
const AlumnoSchema = require('../models/Alumno').schema;
const { conexiones } = require('../server');
const RegistradoBase = require('../models/Registrado');

const Paraescolar = require('../models/paraescolar.model');
const {
  MAX_PARAESCOLAR,
  normalizarParaescolar,
  construirResumenParaescolares,
  contarParaescolares,
  puedeAsignarParaescolar
} = require('../utils/paraescolares');

// 👇 usar SIEMPRE la conexión del plantel actual
const Alumno = conexiones.registro272.models.Alumno || conexiones.registro272.model("Alumno", AlumnoSchema);
const Registrado = conexiones.registro272.models.Registrado || conexiones.registro272.model('Registrado', RegistradoBase.schema);

// ============================================
// VALIDAR CURP GLOBAL ENTRE PLANTELES (BLINDADO)
// ============================================

async function curpExisteEnOtroPlantel(curpActual) {

  for (const key in conexiones) {

    if (key === "registro272") continue;

    const AlumnoModel = conexiones[key].model("Alumno", AlumnoSchema);

    const alumno = await AlumnoModel.findOne({
      "datos_alumno.curp": curpActual,
      registro_completado: true
    }).lean();

    if (alumno) {
      return {
        existe: true,
        plantel: key,
        folio: alumno.folio
      };
    }
  }

  return { existe: false };
}




router.get('/ping', (req, res) => {
  res.status(200).json({ ok: true });
});


router.get('/paraescolares/cupos', async (req, res) => {
  try {
    const conteos = await obtenerConteosParaescolares();
    res.json({
      limite: MAX_PARAESCOLAR,
      paraescolares: construirResumenParaescolares(conteos)
    });
  } catch (error) {
    console.error('❌ Error al consultar cupos de paraescolar:', error);
    res.status(500).json({ message: 'Error al consultar cupos de paraescolar' });
  }
});

const upload = multer({ storage: multer.memoryStorage() });


// ---------- Helpers ----------
const CLAVES_EXENTAS = new Set([
  'estado_nacimiento', 'municipio_nacimiento', 'ciudad_nacimiento',
  'estado_nacimiento_general', 'municipio_nacimiento_general', 'ciudad_nacimiento_general'
]);


function toUpperData(obj) {
  return JSON.parse(JSON.stringify(obj), (key, value) => {
    return (typeof value === 'string' && !CLAVES_EXENTAS.has(key)) ? value.toUpperCase() : value;
  });
}


function obtenerConteosParaescolares(alumnoId = null) {
  return contarParaescolares({ Alumno, Paraescolar, alumnoId });
}
async function validarCupoParaescolar(paraescolar, alumnoId = null) {
  return puedeAsignarParaescolar({ Alumno, Paraescolar, paraescolar, alumnoId });
}

function formatearFechaNacimiento(fecha) {
  const partes = String(fecha || '').trim().split('-');
  if (partes.length !== 3) return fecha || '';

  const [a, b, c] = partes;
  if (a.length === 4) return `${c}-${b}-${a}`;
  return `${a}-${b}-${c}`;
}


function escaparRegex(valor) {
  return String(valor).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function normalizarNumeroSeguroSocial(data) {
  if (!data || typeof data !== 'object') return data;

  if (data.datos_medicos?.numero_seguro_social !== undefined) {
    data.datos_medicos.numero_seguro_social = String(data.datos_medicos.numero_seguro_social || '').replace(/\D/g, '');
  }

  if (data.numero_seguro_social !== undefined) {
    data.numero_seguro_social = String(data.numero_seguro_social || '').replace(/\D/g, '');
  }

  return data;
}
function normalizarEstadoCivilAlumno(data) {
  if (!data?.datos_alumno) return data;

  const estadoCivilMap = {
    soltero: 1,
    casado: 2,
    'unión libre': 3,
    'union libre': 3,
    otro: 4
  };
  const valor = data.datos_alumno.estado_civil;

  if (valor === undefined || valor === null || valor === '') {
    data.datos_alumno.estado_civil = 0;
    return data;
  }

  if (typeof valor === 'number') {
    data.datos_alumno.estado_civil = valor;
    return data;
  }

  const texto = String(valor).trim().toLowerCase();
  data.datos_alumno.estado_civil = estadoCivilMap[texto] || parseInt(texto, 10) || 0;
  return data;
}

function alumnoYaTieneRegistroFinal(alumno) {
  return Boolean(alumno?.registro_completado || alumno?.bloqueado);
}

function reinscripcionYaFueCapturada(registrado) {
  return Boolean(
    registrado?.reinscripcion_completada === true ||
    registrado?.bloqueado_reinscripcion === true
  );
}
function obtenerMateriasReprobadas(registrado) {
  const valor = registrado?.materias_reprobadas ?? registrado?.materiasReprobadas ?? registrado?.adeudo;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function permiteReimpresionPDF(registrado) {
  return Boolean(
    registrado?.permitir_reimpresion_pdf === true ||
    registrado?.reimpresion_pdf_permitida === true
  );
}

function requiereControlEscolarParaPDF(registrado) {
   const materiasReprobadas = obtenerMateriasReprobadas(registrado);
  if (materiasReprobadas <= 2) return false;
  if (permiteReimpresionPDF(registrado)) return false;

  return Boolean(
    registrado?.requiere_control_escolar === true ||
    materiasReprobadas > 2
  );
}
function crearFiltroNumeroControl(numeroControl) {
  const limpio = String(numeroControl || '').trim().toUpperCase();
  const comoNumero = Number(limpio);
  const exactoConEspacios = new RegExp(`^\\s*${escaparRegex(limpio)}\\s*$`, 'i');
  const posiblesValores = [limpio, exactoConEspacios];

  if (!Number.isNaN(comoNumero)) {
    posiblesValores.push(comoNumero);
  }

  return {
    $or: [
      { numero_control: { $in: posiblesValores } },
      { numeroControl: { $in: posiblesValores } },
      { numero_de_control: { $in: posiblesValores } },
      { no_control: { $in: posiblesValores } },
      { num_control: { $in: posiblesValores } },
      { control: { $in: posiblesValores } },
      { matricula: { $in: posiblesValores } },
      { matrícula: { $in: posiblesValores } },
      { folio: { $in: posiblesValores } },
      { 'datos_alumno.numero_control': { $in: posiblesValores } },
      { 'datos_alumno.numeroControl': { $in: posiblesValores } },
      { 'datos_alumno.numero_de_control': { $in: posiblesValores } },
      { 'datos_alumno.no_control': { $in: posiblesValores } },
      { 'datos_alumno.num_control': { $in: posiblesValores } },
      { 'datos_alumno.control': { $in: posiblesValores } },
      { 'datos_alumno.matricula': { $in: posiblesValores } },
      { 'datos_alumno.matrícula': { $in: posiblesValores } },
      { 'NUMERO CONTROL': { $in: posiblesValores } },
      { 'NÚMERO CONTROL': { $in: posiblesValores } },
      { 'Numero Control': { $in: posiblesValores } },
      { 'Número Control': { $in: posiblesValores } },
      { 'numero control': { $in: posiblesValores } },
      { 'NUMERO DE CONTROL': { $in: posiblesValores } },
      { 'NÚMERO DE CONTROL': { $in: posiblesValores } },
      { 'Numero de Control': { $in: posiblesValores } },
      { 'Número de Control': { $in: posiblesValores } },
      { 'Numero de control': { $in: posiblesValores } },
      { 'Número de control': { $in: posiblesValores } },
      { 'numero de control': { $in: posiblesValores } },
      { 'No. Control': { $in: posiblesValores } },
      { 'NO. CONTROL': { $in: posiblesValores } },
      { 'No. de Control': { $in: posiblesValores } },
      { 'No. de control': { $in: posiblesValores } },
      { 'NO. DE CONTROL': { $in: posiblesValores } },
      { 'No Control': { $in: posiblesValores } },
            { 'NO CONTROL': { $in: posiblesValores } },
      { 'MATRICULA': { $in: posiblesValores } },
      { 'MATRÍCULA': { $in: posiblesValores } },
      { 'Matricula': { $in: posiblesValores } },
      { 'Matrícula': { $in: posiblesValores } }
    ]
  };
}

function crearFiltroFlexibleNumeroControl(numeroControl) {
  const limpio = String(numeroControl || '').trim().toUpperCase();
  const regexExacto = `^\\s*${escaparRegex(limpio)}\\s*$`;

  return {
    $expr: {
      $anyElementTrue: {
        $map: {
          input: { $objectToArray: '$$ROOT' },
          as: 'campo',
          in: {
            $cond: [
              { $in: [{ $type: '$$campo.v' }, ['string', 'int', 'long', 'double', 'decimal']] },
              {
                $regexMatch: {
                  input: { $toString: '$$campo.v' },
                  regex: regexExacto,
                  options: 'i'
                }
              },
              false
            ]
          }
        }
      }
    }
  };
}

async function buscarEnModeloPorNumeroControl(Modelo, numeroControl) {
  const filtro = crearFiltroNumeroControl(numeroControl);
  const encontradoPorCampos = await Modelo.findOne(filtro).lean();
  if (encontradoPorCampos) return encontradoPorCampos;

  // Último recurso: busca el número en cualquier campo superior string/numérico del documento.
  return Modelo.findOne(crearFiltroFlexibleNumeroControl(numeroControl)).lean();
}
function normalizarNumeroControl(numeroControl) {
  return String(numeroControl || '').trim().toUpperCase();
}

function tieneHermanosActivos(valor) {
  const limpio = String(valor || '').trim().toUpperCase();
  return ['SI', 'SÍ', 'YES', 'TRUE', '1'].includes(limpio);
}


function esValorVacio(valor) {
  return valor === undefined || valor === null || valor === '';
}


function quitarIdMongo(valor) {
  if (!valor || typeof valor !== 'object') return valor;

  if (Array.isArray(valor)) {
    valor.forEach(quitarIdMongo);
    return valor;
  }

  delete valor._id;
  Object.values(valor).forEach(quitarIdMongo);
  return valor;
}
function quitarIdMongo(valor) {
  if (!valor || typeof valor !== 'object') return valor;

  if (Array.isArray(valor)) {
    valor.forEach(quitarIdMongo);
    return valor;
  }

  delete valor._id;
  Object.values(valor).forEach(quitarIdMongo);
  return valor;
}

function combinarSinBorrarDatosActuales(actual = {}, nuevo = {}) {
  if (!nuevo || typeof nuevo !== 'object' || Array.isArray(nuevo)) {
    return esValorVacio(nuevo) ? actual : nuevo;
  }

  const combinado = { ...(actual && typeof actual === 'object' && !Array.isArray(actual) ? actual : {}) };
  Object.entries(nuevo).forEach(([clave, valor]) => {
    if (Array.isArray(valor)) {
      if (valor.length) combinado[clave] = valor;
      return;
    }

    if (valor && typeof valor === 'object') {
      combinado[clave] = combinarSinBorrarDatosActuales(combinado[clave], valor);
      return;
    }

    if (!esValorVacio(valor)) {
      combinado[clave] = valor;
    }
  });

  return combinado;
}

function primerValor(...valores) {
  return valores.find((valor) => !esValorVacio(valor)) || '';
}

function normalizarRegistradoParaFormulario(raw = {}, numeroControl = '') {
  const datosAlumno = raw.datos_alumno || {};
  const datosGenerales = raw.datos_generales || {};
  const datosMedicos = raw.datos_medicos || {};
  const secundariaOrigen = raw.secundaria_origen || {};
  const tutorResponsable = raw.tutor_responsable || {};
  const personaEmergencia = raw.persona_emergencia || {};

  return {
    ...raw,
    folio: primerValor(raw.folio, raw.numero_control, raw.numeroControl, numeroControl),
    numero_control: primerValor(raw.numero_control, raw.numeroControl, raw.folio, numeroControl),
    numeroControl: primerValor(raw.numeroControl, raw.numero_control, raw.folio, numeroControl),
    adeudo: raw.adeudo ?? raw.materias_reprobadas ?? raw.materiasReprobadas ?? '',
    materias_reprobadas: raw.materias_reprobadas ?? raw.adeudo ?? raw.materiasReprobadas ?? '',
    datos_alumno: {
      ...datosAlumno,
      nombres: primerValor(datosAlumno.nombres, raw.nombres, raw.nombre),
      primer_apellido: primerValor(datosAlumno.primer_apellido, raw.primer_apellido),
      segundo_apellido: primerValor(datosAlumno.segundo_apellido, raw.segundo_apellido),
      curp: primerValor(datosAlumno.curp, raw.curp),
      carrera: primerValor(datosAlumno.carrera, raw.carrera),
      periodo_semestral: primerValor(datosAlumno.periodo_semestral, raw.periodo_semestral),
      semestre: primerValor(datosAlumno.semestre, raw.semestre, raw.grado),
      grupo: primerValor(datosAlumno.grupo, raw.grupo),
      turno: primerValor(datosAlumno.turno, raw.turno),
      nacionalidad: primerValor(datosAlumno.nacionalidad, raw.nacionalidad),
      pais_extranjero: primerValor(datosAlumno.pais_extranjero, raw.pais_extranjero),
      estado_civil: primerValor(datosAlumno.estado_civil, raw.estado_civil),
      fecha_nacimiento: primerValor(datosAlumno.fecha_nacimiento, raw.fecha_nacimiento),
      edad: primerValor(datosAlumno.edad, raw.edad),
      sexo: primerValor(datosAlumno.sexo, raw.sexo),
      estado_nacimiento: primerValor(datosAlumno.estado_nacimiento, raw.estado_nacimiento),
      municipio_nacimiento: primerValor(datosAlumno.municipio_nacimiento, raw.municipio_nacimiento),
      ciudad_nacimiento: primerValor(datosAlumno.ciudad_nacimiento, raw.ciudad_nacimiento)
    },
    datos_generales: {
      ...datosGenerales,
      colonia: primerValor(datosGenerales.colonia, raw.colonia),
      domicilio: primerValor(datosGenerales.domicilio, raw.domicilio),
      codigo_postal: primerValor(datosGenerales.codigo_postal, raw.codigo_postal),
      telefono_alumno: primerValor(datosGenerales.telefono_alumno, raw.telefono_alumno),
      correo_alumno: primerValor(datosGenerales.correo_alumno, raw.correo_alumno),
      tipo_sangre: primerValor(datosGenerales.tipo_sangre, raw.tipo_sangre),
      hermanos_activos: primerValor(datosGenerales.hermanos_activos, raw.hermanos_activos),
      entrega_diagnostico: primerValor(datosGenerales.entrega_diagnostico, raw.entrega_diagnostico),
      detalle_enfermedad: primerValor(datosGenerales.detalle_enfermedad, raw.detalle_enfermedad),
      carta_poder: primerValor(datosGenerales.carta_poder, raw.carta_poder),
      contacto_emergencia_nombre: primerValor(datosGenerales.contacto_emergencia_nombre, raw.contacto_emergencia_nombre),
      contacto_emergencia_telefono: primerValor(datosGenerales.contacto_emergencia_telefono, raw.contacto_emergencia_telefono),
      habla_lengua_indigena: datosGenerales.habla_lengua_indigena || { respuesta: raw.habla_lengua_indigena_respuesta || '', cual: raw.habla_lengua_indigena_cual || '' }
    },
    datos_medicos: {
      ...datosMedicos,
      numero_seguro_social: primerValor(datosMedicos.numero_seguro_social, raw.numero_seguro_social),
      unidad_medica_familiar: primerValor(datosMedicos.unidad_medica_familiar, raw.unidad_medica_familiar),
      discapacidad: primerValor(datosMedicos.discapacidad, raw.discapacidad),
      enfermedad_cronica_o_alergia: datosMedicos.enfermedad_cronica_o_alergia || { respuesta: raw.enfermedad_cronica_o_alergia_respuesta || '', detalle: raw.enfermedad_cronica_o_alergia_detalle || '' }
    },
    secundaria_origen: { ...secundariaOrigen, participaciones_secundaria: primerValor(secundariaOrigen.participaciones_secundaria, raw.participaciones_secundaria) },
    tutor_responsable: {
      ...tutorResponsable,
      nombre_padre: primerValor(tutorResponsable.nombre_padre, raw.nombre_padre),
      telefono_padre: primerValor(tutorResponsable.telefono_padre, raw.telefono_padre),
      nombre_madre: primerValor(tutorResponsable.nombre_madre, raw.nombre_madre),
      telefono_madre: primerValor(tutorResponsable.telefono_madre, raw.telefono_madre),
      vive_con: primerValor(tutorResponsable.vive_con, raw.vive_con)
    },
    persona_emergencia: {
      ...personaEmergencia,
      nombre: primerValor(personaEmergencia.nombre, raw.persona_emergencia_nombre),
      parentesco: primerValor(personaEmergencia.parentesco, raw.persona_emergencia_parentesco),
      telefono: primerValor(personaEmergencia.telefono, raw.persona_emergencia_telefono)
    }
  };
}

async function buscarRegistradoPorNumeroControl(numeroControl) {
  const registradoPlantel = await buscarEnModeloPorNumeroControl(Registrado, numeroControl);
  if (registradoPlantel) {
    return { alumno: registradoPlantel, origen: 'registrados' };
  }

  // Fallback para instalaciones donde la colección `registrados` quedó en la conexión principal.
  const registradoPrincipal = await buscarEnModeloPorNumeroControl(RegistradoBase, numeroControl);
  if (registradoPrincipal) {
    return { alumno: registradoPrincipal, origen: 'registrados' };
  }

  // Fallback adicional: revisar `registrados` en todas las conexiones configuradas.
  for (const [plantel, conexion] of Object.entries(conexiones)) {
    if (plantel === 'registro272') continue;

    const RegistradoPlantel = conexion.models.Registrado || conexion.model('Registrado', RegistradoBase.schema);
    const registradoOtroPlantel = await buscarEnModeloPorNumeroControl(RegistradoPlantel, numeroControl);
    if (registradoOtroPlantel) {
      return { alumno: registradoOtroPlantel, origen: `registrados:${plantel}` };
    }
  }
// Los alumnos de nuevo ingreso pueden cargarse directamente en la colección `alumnos`
  // usando el folio como identificador para la reinscripción/actualización de expediente.
  const alumnoPlantel = await buscarEnModeloPorNumeroControl(Alumno, numeroControl);
  if (alumnoPlantel) {
    return { alumno: alumnoPlantel, origen: 'alumnos' };
  }
  
  // Fallback para alumnos cargados desde el módulo de paraescolares con número de control.
  const paraescolar = await buscarEnModeloPorNumeroControl(Paraescolar, numeroControl);
  if (paraescolar) {
    return { alumno: paraescolar, origen: 'paraescolar' };
  }

  return null;
}

// ---------- Endpoints ----------
router.get('/folio/:folio', async (req, res) => {
  try {
    const alumno = await Alumno.findOne({ folio: req.params.folio }).lean();
    if (!alumno) return res.status(404).json({ message: 'Folio no encontrado' });
   res.json(normalizarRegistradoParaFormulario(alumno, alumno.folio));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/preregistro/:folio', async (req, res) => {
  try {
    const folio = String(req.params.folio || '').trim().toUpperCase();
    const alumno = await Alumno.findOne({ folio }).lean();

    if (!alumno) return res.status(404).json({ message: 'Folio no encontrado en preregistro' });

    res.json({
      message: 'Datos de preregistro encontrados',
       alumno: normalizarRegistradoParaFormulario(alumno, folio)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/reinscripcion/:numeroControl', async (req, res) => {
  try {
    const numeroControl = String(req.params.numeroControl || '').trim().toUpperCase();
    const encontrado = await buscarRegistradoPorNumeroControl(numeroControl);

    if (!encontrado) return res.status(404).json({ message: 'Número de control o folio no encontrado en registrados ni alumnos' });

    res.json({
      message: 'Datos de reinscripción encontrados',
      alumno: normalizarRegistradoParaFormulario(encontrado.alumno, numeroControl),
      origen: encontrado.origen
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

function normalizarRegistradoParaPDF(registrado, numeroControl) {
  const raw = registrado || {};
  if (raw.datos_alumno) {
    return {
      ...raw,
      folio: raw.folio || numeroControl,
      numero_control: raw.numero_control || numeroControl
    };
  }

  return {
    folio: numeroControl,
    numero_control: numeroControl,
    datos_alumno: {
      nombres: raw.nombres || raw.nombre || '',
      primer_apellido: raw.primer_apellido || '',
      segundo_apellido: raw.segundo_apellido || '',
      curp: raw.curp || '',
      carrera: raw.carrera || '',
      periodo_semestral: raw.periodo_semestral || '',
      semestre: raw.semestre || raw.grado || '',
      grupo: raw.grupo || '',
      nacionalidad: raw.nacionalidad || '',
      pais_extranjero: raw.pais_extranjero || '',
      estado_civil: raw.estado_civil || '',
      fecha_nacimiento: raw.fecha_nacimiento || '',
      edad: raw.edad || '',
      sexo: raw.sexo || '',
      estado_nacimiento: raw.estado_nacimiento || '',
      municipio_nacimiento: raw.municipio_nacimiento || '',
      ciudad_nacimiento: raw.ciudad_nacimiento || '',
      turno: raw.turno || ''
    },
    datos_generales: raw.datos_generales || {
      colonia: raw.colonia || '',
      domicilio: raw.domicilio || '',
      codigo_postal: raw.codigo_postal || '',
      telefono_alumno: raw.telefono_alumno || '',
      correo_alumno: raw.correo_alumno || '',
      tipo_sangre: raw.tipo_sangre || '',
      contacto_emergencia_nombre: raw.contacto_emergencia_nombre || '',
      contacto_emergencia_telefono: raw.contacto_emergencia_telefono || '',
      habla_lengua_indigena: {
        respuesta: raw.habla_lengua_indigena_respuesta || '',
        cual: raw.habla_lengua_indigena_cual || ''
      }
    },
    datos_medicos: raw.datos_medicos || {},
    secundaria_origen: raw.secundaria_origen || {},
    tutor_responsable: raw.tutor_responsable || {},
    persona_emergencia: raw.persona_emergencia || {}
  };
}







// ===================================
// GENERAR NUMERO DE CONTROL AUTOMATICO
// ===================================

async function generarFolio() {
  const prefijo = "CBTIS272-";

  const ultimo = await Alumno.findOne({
    folio: { $regex: `^${prefijo}` }
  })
  .sort({ folio: -1 })
  .lean();

  let consecutivo = 1;

  if (ultimo?.folio) {
    const num = parseInt(ultimo.folio.replace(prefijo, ""));
    consecutivo = num + 1;
  }

  return `${prefijo}${String(consecutivo).padStart(4, "0")}`;
}


router.post('/guardar', async (req, res) => {
 
  try {

    // ==========================================
    // 🔒 BLOQUEO GLOBAL ESTATAL
    // ==========================================
    const config = await Config.findOne();
    if (config?.bloqueo_registro) {
      return res.status(403).json({
        error: "El registro está temporalmente deshabilitado por administración estatal"
      });
    }

    const data = normalizarNumeroSeguroSocial(normalizarEstadoCivilAlumno(req.body));
    if (data?.datos_alumno) {
      data.datos_alumno.fecha_nacimiento = formatearFechaNacimiento(data.datos_alumno.fecha_nacimiento);
    }
    if (data?.datos_generales) {
      data.datos_generales.numero_control_hermano = '';
    }
    const curp = data.datos_alumno?.curp?.toUpperCase();

    if (!curp) {
      return res.status(400).json({
        error: "CURP no válida"
      });
    }

    // ==========================================
    // 🔎 VALIDACIÓN GLOBAL ENTRE PLANTELES
    // ==========================================
const resultado = await curpExisteEnOtroPlantel(curp);

if (resultado.existe) {
  return res.status(400).json({
    error: `La CURP ya está registrada en el plantel ${resultado.plantel} con folio ${resultado.folio}`
  });
}



    // ==========================================
    // 🚫 VALIDACIÓN LOCAL
    // ==========================================
    const existe = await Alumno.findOne({
      "datos_alumno.curp": curp
    });

    if (existe?.registro_completado || existe?.bloqueado) {
      return res.status(400).json({
        message: "Este alumno ya completó su registro"
      });
    }
  // ==========================================
    // 🔢 GENERAR O CONSERVAR FOLIO DE PREREGISTRO
    // ==========================================
    const folio = existe?.folio || await generarFolio();
    data.folio = folio;

    // El formulario inicial solo crea/actualiza el preregistro.
    // Debe quedar abierto para que el alumno complete formulario-registro.html.
    data.registro_completado = false;
    data.bloqueado = false;
    
    const paraescolarSolicitado = data?.datos_generales?.paraescolar;
    if (paraescolarSolicitado) {
     const okParaescolar = await validarCupoParaescolar(paraescolarSolicitado, existe?._id);
      if (!okParaescolar) {
        return res.status(400).json({
          message: `El paraescolar ${paraescolarSolicitado} ya alcanzó el límite de ${MAX_PARAESCOLAR} alumno(s).`
        });
      }
    }
    
    // ==========================================
    // 🔢 GENERAR FOLIO
    // ==========================================
 
    // ==========================================
    // 💾 GUARDAR EN BD
    // ==========================================
    const actualizado = existe
      ? await Alumno.findOneAndUpdate({ _id: existe._id }, data, { new: true })
      : await Alumno.create(data);
    
    // ==========================================
    // 📄 GENERAR PDF DE PREREGISTRO
    // ==========================================
    const datosAnidados = flattenToNested(actualizado.toObject());
    const nombreArchivo = `${folio}.pdf`;
    const pdfUrl = await generarPDF(datosAnidados, nombreArchivo);

    // ==========================================
    // ✅ RESPUESTA FINAL
    // ==========================================
    res.status(200).json({
       message: "Preregistro guardado. Conserva tu folio para completar el registro.",
      folio,
       registro_completado: false,
      bloqueado: false,
      pdf_url: pdfUrl
     
    });

  } catch (err) {
   
    console.error("❌ ERROR EN /guardar:", err);
    res.status(err.status || 500).json({ message: err.message });
  }
});





router.post('/cargar-excel', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No se envió archivo' });

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const datos = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    if (!datos || datos.length === 0) {
      return res.status(400).json({ message: 'El archivo está vacío o mal formado' });
    }

    const nestedDocs = datos.map(flattenToNested);

    for (const doc of nestedDocs) {
      delete doc._id;

    

      if (doc.folio) {
        await Alumno.findOneAndUpdate(
          { folio: doc.folio },
          toUpperData(doc),
          { upsert: true, new: true }
        );
      }
    }

    res.status(200).json({ message: '✅ Alumnos cargados o actualizados correctamente' });

  } catch (error) {
    console.error('❌ Error al cargar Excel:', error);
    res.status(500).json({ message: 'Error al procesar el archivo' });
  }
});



router.get('/reimprimir/:folio', async (req, res) => {
  try {
    const identificador = String(req.params.folio || '').trim().toUpperCase();
    const alumno = await Alumno.findOne({ folio: identificador });

    if (alumno) {
      const datosAlumnoPDF = flattenToNested(alumno.toObject());

      const esRegistroCompleto = Boolean(
        alumno?.datos_generales?.quinta_opcion ||
        alumno?.datos_alumno?.nacionalidad ||
        alumno?.secundaria_origen?.estudias
      );

      const nombreArchivoAlumno = esRegistroCompleto
        ? `${alumno.folio}_registro.pdf`
        : `${alumno.folio}.pdf`;

      const rutaPDFAlumno = esRegistroCompleto
        ? await generarPDFRegistro(datosAlumnoPDF, nombreArchivoAlumno)
        : await generarPDF(datosAlumnoPDF, nombreArchivoAlumno);

      const fullPathAlumno = path.join(__dirname, '../public', rutaPDFAlumno);
      return res.sendFile(fullPathAlumno);
    }

    const encontrado = await buscarRegistradoPorNumeroControl(identificador);

    if (!encontrado) {
      return res.status(404).json({ message: 'Folio o número de control no encontrado' });
    }
 if (requiereControlEscolarParaPDF(encontrado.alumno)) {
      return res.status(403).json({
        message: 'No se puede reimprimir la ficha porque tienes 3 o más materias reprobadas. Acude a control escolar.',
        requiere_control_escolar: true,
        pdf_generado: false
      });
    }
    const datosRegistradoPDF = normalizarRegistradoParaPDF(encontrado.alumno, identificador);
    const nombreArchivoRegistrado = `${identificador}.pdf`;
    const rutaPDFRegistrado = await generarPDFRegistro(datosRegistradoPDF, nombreArchivoRegistrado);
    const fullPathRegistrado = path.join(__dirname, '../public', rutaPDFRegistrado);
    return res.sendFile(fullPathRegistrado);

  } catch (err) {
    console.error("❌ Error al reimprimir:", err);
    res.status(500).json({ message: 'Error interno al generar PDF' });
  }
});



// ---------- Dashboard: búsqueda ----------
function construirRegexBusqueda(valor) {
  const limpio = String(valor || '').trim();
  return limpio ? { $regex: escaparRegex(limpio), $options: 'i' } : null;
}

function agregarOrigenDashboard(doc, coleccion) {
  const plano = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return { ...plano, _dashboardCollection: coleccion };
}
async function obtenerUltimoFolioAsignado() {
  const prefijo = 'CBTIS272-';
  const [ultimo] = await Alumno.aggregate([
    { $match: { folio: { $regex: `^${prefijo}` } } },
    {
      $addFields: {
        folioConsecutivo: {
          $convert: {
            input: { $arrayElemAt: [{ $split: ['$folio', prefijo] }, 1] },
            to: 'int',
            onError: 0,
            onNull: 0
          }
        }
      }
    },
    { $sort: { folioConsecutivo: -1, folio: -1 } },
    { $project: { folio: 1 } },
    { $limit: 1 }
  ]);

  return ultimo?.folio || null;
}

router.get('/dashboard/ultimo-folio', async (req, res) => {
  try {
    const folio = await obtenerUltimoFolioAsignado();
    res.json({ folio });
  } catch (error) {
    res.status(500).json({ message: 'Error al consultar el último folio asignado', error });
  }
});


router.get('/dashboard/alumnos', async (req, res) => {
  const { folio, apellidos } = req.query;
  const folioRegex = construirRegexBusqueda(folio);
  const apellidosRegex = construirRegexBusqueda(apellidos);

  const queryAlumnos = {};
  const queryRegistrados = {};

  if (folioRegex) {
    queryAlumnos.folio = folioRegex;
    queryRegistrados.$or = crearFiltroNumeroControl(folio).$or;
    
  }

  if (apellidosRegex) {
    queryAlumnos.$or = [
      { 'datos_alumno.primer_apellido': apellidosRegex },
      { 'datos_alumno.segundo_apellido': apellidosRegex },
      { 'datos_alumno.nombres': apellidosRegex }
    ];

    const filtroNombresRegistrados = [
      { primer_apellido: apellidosRegex },
      { segundo_apellido: apellidosRegex },
      { nombres: apellidosRegex },
      { 'datos_alumno.primer_apellido': apellidosRegex },
      { 'datos_alumno.segundo_apellido': apellidosRegex },
      { 'datos_alumno.nombres': apellidosRegex }
    ];

    queryRegistrados.$and = queryRegistrados.$or
      ? [{ $or: queryRegistrados.$or }, { $or: filtroNombresRegistrados }]
      : [{ $or: filtroNombresRegistrados }];
    delete queryRegistrados.$or;
  }

  try {
    const [alumnos, registrados] = await Promise.all([
      Alumno.find(queryAlumnos).limit(100),
      Registrado.find(queryRegistrados).limit(100)
    ]);

    res.json([
      ...alumnos.map((alumno) => agregarOrigenDashboard(alumno, 'alumnos')),
      ...registrados.map((registrado) => agregarOrigenDashboard(registrado, 'registrados'))
    ]);
  } catch (error) {
    res.status(500).json({ message: 'Error al buscar registros del dashboard', error });
  }
});

  router.get('/dashboard/registrados/:id', async (req, res) => {

  try {
    const registrado = await Registrado.findById(req.params.id);
    if (!registrado) return res.status(404).json({ message: 'No encontrado' });
    res.json(registrado);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener registrado', error });
  }
});

router.get('/dashboard/alumnos/:id', async (req, res) => {
  try {
    const alumno = await Alumno.findById(req.params.id);
    if (!alumno) return res.status(404).json({ message: 'No encontrado' });
    res.json(alumno);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener alumno', error });
  }
});

router.put('/dashboard/registrados/:id', async (req, res) => {
  try {
   const bodyUpper = quitarIdMongo(normalizarNumeroSeguroSocial(toUpperData(req.body)));
    const desbloquearSolicitado = bodyUpper.desbloquear_reinscripcion === true;
    const permitirReimpresionSolicitado = bodyUpper.permitir_reimpresion_pdf === true;
    delete bodyUpper.desbloquear_reinscripcion;
    delete bodyUpper.permitir_reimpresion_pdf;

    
    const materiasReprobadas = Number(bodyUpper.materias_reprobadas ?? bodyUpper.adeudo ?? 0);
    const tieneMateriasValidas = Number.isFinite(materiasReprobadas);
    const puedeGenerarPDF = tieneMateriasValidas && materiasReprobadas <= 2;
    const debeBloquearPDF = tieneMateriasValidas && materiasReprobadas > 2 && !permitirReimpresionSolicitado;

   if (desbloquearSolicitado) {
      bodyUpper.bloqueado_reinscripcion = false;
      bodyUpper.reinscripcion_completada = false;
      }

    if (puedeGenerarPDF) {
      bodyUpper.requiere_control_escolar = false;
      bodyUpper.permitir_reimpresion_pdf = false;
      bodyUpper.pdf_generado = false;
      } else if (permitirReimpresionSolicitado) {
      bodyUpper.requiere_control_escolar = false;
      bodyUpper.permitir_reimpresion_pdf = true;
      bodyUpper.pdf_generado = false;
    } else if (debeBloquearPDF) {
      bodyUpper.requiere_control_escolar = true;
      bodyUpper.permitir_reimpresion_pdf = false;
    }
    
    const registrado = await Registrado.findByIdAndUpdate(req.params.id, bodyUpper, { new: true, strict: false });
    if (!registrado) return res.status(404).json({ message: 'No encontrado' });
    res.json(registrado);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar registrado', error });
  }
});

router.post('/dashboard/registrados', async (req, res) => {
  try {
    const bodyUpper = normalizarNumeroSeguroSocial(toUpperData(req.body));
    const nuevoRegistrado = new Registrado(bodyUpper);
    await nuevoRegistrado.save();
    res.status(201).json(nuevoRegistrado);
  } catch (error) {
    res.status(500).json({ message: 'Error al crear registrado', error });
  }
});

router.delete('/dashboard/registrados/:id', async (req, res) => {
  try {
    const registrado = await Registrado.findByIdAndDelete(req.params.id);
    if (!registrado) return res.status(404).json({ message: 'No encontrado' });
    res.json({ message: 'Registrado eliminado' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar registrado' });
  }
});

router.put('/dashboard/alumnos/:id', async (req, res) => {
  try {
    const alumnoActual = await Alumno.findById(req.params.id);
    if (!alumnoActual) return res.status(404).json({ message: 'No encontrado' });

    const bodyUpper = normalizarNumeroSeguroSocial(toUpperData(req.body));
      const desbloquearSolicitado = bodyUpper.desbloquear_registro_alumno === true;
    delete bodyUpper.desbloquear_registro_alumno;

    if (desbloquearSolicitado) {
      bodyUpper.registro_completado = false;
      bodyUpper.bloqueado = false;
    }
    const nuevoPara = bodyUpper?.datos_generales?.paraescolar;
    const previoPara = alumnoActual?.datos_generales?.paraescolar;
    const cambiando = nuevoPara && (nuevoPara.toUpperCase() !== (previoPara || '').toUpperCase());

    if (cambiando) {
      const ok = await validarCupoParaescolar(nuevoPara, alumnoActual._id);
      if (!ok) {
        return res.status(400).json({ message: `No se puede cambiar a ${nuevoPara}, ya alcanzó su límite de ${MAX_PARAESCOLAR}.` });
      }
    }

    const actualizado = await Alumno.findByIdAndUpdate(req.params.id, bodyUpper, { new: true });
    res.json(actualizado);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar alumno', error });
  }
});


router.post('/dashboard/alumnos', async (req, res) => {
  try {
    const bodyUpper = normalizarNumeroSeguroSocial(toUpperData(req.body));
    delete bodyUpper.desbloquear_registro_alumno;
    const nuevoPara = bodyUpper?.datos_generales?.paraescolar;

    if (nuevoPara) {
      const ok = await validarCupoParaescolar(nuevoPara);
      if (!ok) {
        return res.status(400).json({ message: `El paraescolar ${nuevoPara} ya alcanzó el límite de ${MAX_PARAESCOLAR} alumno(s).` });
      }
    }

    const nuevoAlumno = new Alumno(bodyUpper);
    await nuevoAlumno.save();
    res.status(201).json(nuevoAlumno);
  } catch (error) {
    res.status(500).json({ message: 'Error al crear alumno', error });
  }
});

router.delete('/dashboard/alumnos/:id', async (req, res) => {
  try {
    await Alumno.findByIdAndDelete(req.params.id);
    res.json({ message: 'Alumno eliminado' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar alumno' });
  }
});


// VALIDAR CURP EN ALUMNOS REGISTRADOS
router.get('/curp/:curp', async (req, res) => {
  try {
    const alumno = await Alumno.findOne({
      "datos_alumno.curp": req.params.curp.toUpperCase()
    });

    if (!alumno) {
      return res.json({ registrado: false });
    }

    res.json({
      registrado: true,
      folio: alumno.folio
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function normalizarValorExcel(valor) {
  if (valor === null || valor === undefined) return '';

  if (valor instanceof Date) {
    return valor.toISOString();
  }

  if (valor && typeof valor === 'object') {
    if (typeof valor.toHexString === 'function') {
      return valor.toHexString();
    }

    return JSON.stringify(valor);
  }

  return valor;
}

function aplanarDocumentoParaExcel(documento, prefijo = '', salida = {}) {
  Object.entries(documento || {}).forEach(([clave, valor]) => {
    if (clave === '__v') return;

    const nombreColumna = prefijo ? `${prefijo}_${clave}` : clave;

    if (
      valor &&
      typeof valor === 'object' &&
      !(valor instanceof Date) &&
      typeof valor.toHexString !== 'function' &&
      !Array.isArray(valor)
    ) {
      aplanarDocumentoParaExcel(valor, nombreColumna, salida);
      return;
    }

    salida[nombreColumna] = normalizarValorExcel(valor);
  });

  return salida;
}

function prepararFilasExportacion(documentos, coleccion) {
  return documentos.map((documento, index) => ({
    orden: index + 1,
    coleccion,
    ...aplanarDocumentoParaExcel(documento)
  }));
}

function ajustarAnchoColumnas(worksheet, filas) {
  const columnas = new Set();
  filas.forEach((fila) => {
    Object.keys(fila).forEach((columna) => columnas.add(columna));
  });

  worksheet['!cols'] = Array.from(columnas).map((columna) => {
    const anchoMaximo = filas.reduce((maximo, fila) => {
      const longitud = String(fila[columna] ?? '').length;
      return Math.max(maximo, longitud);
    }, columna.length);

    return { wch: Math.min(Math.max(anchoMaximo + 2, 12), 45) };
  });
}

function agregarHojaExcel(workbook, nombreHoja, filas) {
  const worksheet = xlsx.utils.json_to_sheet(filas);
  ajustarAnchoColumnas(worksheet, filas);
  xlsx.utils.book_append_sheet(workbook, worksheet, nombreHoja);
}


router.get('/exportar-excel', async (req, res) => {
  try {
 const [alumnos, registrados] = await Promise.all([
      Alumno.find({ registro_completado: true }).sort({ createdAt: -1 }).lean(),
      Registrado.find({}).sort({ createdAt: -1 }).lean()
    ]);

    if (!alumnos.length && !registrados.length) {
      return res.status(404).json({ message: 'No hay alumnos ni registrados para exportar.' });
    }

 const filasAlumnos = prepararFilasExportacion(alumnos, 'alumnos');
    const filasRegistrados = prepararFilasExportacion(registrados, 'registrados');
    const filasGeneral = [...filasAlumnos, ...filasRegistrados];

    const workbook = xlsx.utils.book_new();
  if (filasGeneral.length) {
      agregarHojaExcel(workbook, 'Todos', filasGeneral);
    }

  if (filasAlumnos.length) {
      agregarHojaExcel(workbook, 'Alumnos', filasAlumnos);
    }

    if (filasRegistrados.length) {
      agregarHojaExcel(workbook, 'Registrados', filasRegistrados);
    }

    const buffer = xlsx.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx'
    });
 res.setHeader(
      'Content-Disposition',
      'attachment; filename=alumnos_registrados_completo.xlsx'
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.send(buffer);
  } catch (err) {
    console.error('❌ Error al exportar Excel:', err);
    res.status(500).json({ message: 'Error al exportar datos.' });
  }
});



// ============================================
// 🧪 DIAGNÓSTICO GLOBAL DE CURP (TEMPORAL)
// ============================================

router.get('/debug/curp-global/:curp', async (req, res) => {
  try {

    const curp = req.params.curp.toUpperCase();
    const resultados = [];

    for (const key in conexiones) {

      try {
        const AlumnoModel = conexiones[key].model("Alumno", AlumnoSchema);

        const alumno = await AlumnoModel.findOne({
          "datos_alumno.curp": curp
        }).lean();

        resultados.push({
          plantel: key,
          encontrado: alumno ? true : false,
          folio: alumno?.folio || null,
          registro_completado: alumno?.registro_completado ?? null
        });

      } catch (err) {
        resultados.push({
          plantel: key,
          error: err.message
        });
      }
    }

    res.json({
      curp_consultada: curp,
      base_actual: Alumno.db.name,
      resultados
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/guardar-registro', async (req, res) => {
  
  try {
    const data = req.body;
    const folio = String(data?.folio || '').trim().toUpperCase();
    if (!folio || !data.datos_alumno?.curp || !data.datos_generales?.correo_alumno) {
      return res.status(400).json({ message: 'Faltan datos obligatorios' });
    }

    const registroExistente = await Alumno.findOne({ folio }).lean();
    if (alumnoYaTieneRegistroFinal(registroExistente)) {
      return res.status(409).json({
        message: 'Este folio ya tiene un registro finalizado y no puede editarse. Si necesitas cambios, acude a control escolar.'
      });
    }

    data.folio = folio;

    const clavesExentas = [
      'estado_nacimiento', 'municipio_nacimiento', 'ciudad_nacimiento',
      'estado_nacimiento_general', 'municipio_nacimiento_general', 'ciudad_nacimiento_general'
    ];

    const upperCaseData = JSON.parse(JSON.stringify(data), (key, value) =>
      typeof value === 'string' && !clavesExentas.includes(key) ? value.toUpperCase() : value
    );

    normalizarEstadoCivilAlumno(upperCaseData);
    normalizarNumeroSeguroSocial(upperCaseData);
    upperCaseData.datos_alumno.fecha_nacimiento = formatearFechaNacimiento(upperCaseData.datos_alumno.fecha_nacimiento);
    upperCaseData.datos_generales.numero_control_hermano = '';

    upperCaseData.datos_generales.primera_opcion = data.datos_generales.primera_opcion || '';
    upperCaseData.datos_generales.segunda_opcion = data.datos_generales.segunda_opcion || '';
    upperCaseData.datos_generales.tercera_opcion = data.datos_generales.tercera_opcion || '';
    upperCaseData.datos_generales.cuarta_opcion = data.datos_generales.cuarta_opcion || '';
    upperCaseData.datos_generales.quinta_opcion = data.datos_generales.quinta_opcion || '';

    const nuevoParaescolar = upperCaseData?.datos_generales?.paraescolar;
    if (nuevoParaescolar) {
      const okParaescolar = await validarCupoParaescolar(nuevoParaescolar, registroExistente?._id);
      if (!okParaescolar) {
        return res.status(400).json({
          message: `El paraescolar ${nuevoParaescolar} ya alcanzó el límite de ${MAX_PARAESCOLAR} alumno(s).`
        });
      }
    }

    upperCaseData.registro_completado = true;

    const payloadRegistro = combinarSinBorrarDatosActuales(registroExistente || {}, upperCaseData);

        await Alumno.findOneAndUpdate({ folio }, payloadRegistro, { upsert: true });

    const datosAnidados = flattenToNested(payloadRegistro);
    const nombreArchivo = `${datosAnidados.datos_alumno?.curp || 'formulario'}_registro.pdf`;
    await generarPDFRegistro(datosAnidados, nombreArchivo);

    res.status(200).json({
      message: 'Registro exitoso y PDF generado',
      pdf_url: `/pdfs/${nombreArchivo}`
    });
  } catch (err) {
    
    
    console.error('Error en /guardar-registro:', err);
    res.status(err.status || 500).json({ message: err.message });
  }
});

router.post('/guardar-reinscripcion', async (req, res) => {
  try {
    const data = req.body;
    const numeroControl = String(data?.numero_control || data?.numeroControl || '').trim().toUpperCase();
    if (!numeroControl) {
      return res.status(400).json({ message: 'Falta número de control' });
    }

    const reinscripcionExistente = await buscarRegistradoPorNumeroControl(numeroControl);
    if (reinscripcionYaFueCapturada(reinscripcionExistente?.alumno)) {
      return res.status(409).json({
        message: 'Este número de control ya tiene una reinscripción capturada y no puede editarse. Si necesitas cambios, acude a control escolar.'
      });
    }

    const materiasReprobadas = Number(data?.materias_reprobadas ?? data?.materiasReprobadas ?? data?.adeudo ?? 0);
    const requiereControlEscolar = materiasReprobadas > 2;
    normalizarNumeroSeguroSocial(data);
     const datosActuales = normalizarRegistradoParaFormulario(reinscripcionExistente?.alumno || {}, numeroControl);

    const payload = quitarIdMongo(combinarSinBorrarDatosActuales(datosActuales, {
      ...data,
      numero_control: numeroControl,
      numeroControl,
      folio: numeroControl,
      adeudo: materiasReprobadas,
      materias_reprobadas: materiasReprobadas,
      tipo_tramite: 'REINSCRIPCION',
      reinscripcion_completada: true,
      bloqueado_reinscripcion: true,
      requiere_control_escolar: requiereControlEscolar,
      pdf_generado: !requiereControlEscolar,
      updatedAt: new Date()
    }));

    await Registrado.findOneAndUpdate(
      crearFiltroNumeroControl(numeroControl),
      { $set: payload, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, new: true }
    );

    if (requiereControlEscolar) {
      return res.status(200).json({
        message: 'Reinscripción guardada. Debes acudir a control escolar por tener 3 o más materias reprobadas.',
        pdf_generado: false,
        requiere_control_escolar: true
      });
    }

    const nombreArchivo = `${numeroControl}.pdf`;
    const datosAnidados = flattenToNested(payload);
    await generarPDFRegistro(datosAnidados, nombreArchivo);

    res.status(200).json({
      message: 'Reinscripción guardada y PDF generado (REINSCRIPCIÓN)',
      pdf_generado: true,
      requiere_control_escolar: false,
      pdf_url: `/pdfs/${nombreArchivo}`
    });
  } catch (err) {
    console.error('Error en /guardar-reinscripcion:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
