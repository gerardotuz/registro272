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

// 👇 usar SIEMPRE la conexión del plantel actual
const Alumno = conexiones.registro272.model("Alumno", AlumnoSchema);
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
    const conteos = await contarParaescolares();
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
const MAX_PARAESCOLAR = 50;
const PARAESCOLARES_DISPONIBLES = [
  'AJEDREZ',
  'ATLETISMO',
  'BANDA DE GUERRA',
  'BASQUETBOL',
  'DANZA',
  'ESCOLTA DE BANDERA',
  'FOTOGRAFÍA',
  'FUTBOL',
  'PINTURA',
  'TEATRO-CANTO',
  'TOCHO BANDERA',
  'VOLEIBOL',
  'ORATORIADECLAMACION',
  'CORO',
  'MÚSICA'
];

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


function normalizarParaescolar(paraescolar) {
  return String(paraescolar || '').trim().toUpperCase();
}

async function contarParaescolares(alumnoId = null) {
  const match = {
    registro_completado: true,
    "datos_generales.paraescolar": { $exists: true, $nin: [null, ''] }
  };

  if (alumnoId && mongoose.Types.ObjectId.isValid(alumnoId)) {
    match._id = { $ne: new mongoose.Types.ObjectId(alumnoId) };
  }

  const conteos = await Alumno.aggregate([
    { $match: match },
    {
      $project: {
        paraescolar: {
          $toUpper: {
            $trim: { input: { $ifNull: ['$datos_generales.paraescolar', ''] } }
          }
        }
      }
    },
    { $match: { paraescolar: { $ne: '' } } },
    { $group: { _id: '$paraescolar', ocupados: { $sum: 1 } } }
  ]);

  return new Map(conteos.map((item) => [item._id, item.ocupados]));
}

function construirResumenParaescolares(conteos) {
  return PARAESCOLARES_DISPONIBLES.map((nombre) => {
    const ocupados = conteos.get(nombre) || 0;
    const disponibles = Math.max(MAX_PARAESCOLAR - ocupados, 0);
    return {
      nombre,
      ocupados,
      disponibles,
      limite: MAX_PARAESCOLAR,
      lleno: ocupados >= MAX_PARAESCOLAR
    };
  });
}

async function puedeAsignarParaescolar(paraescolar, alumnoId = null) {
  const limpio = normalizarParaescolar(paraescolar);
  if (!limpio) return true;
  const conteos = await contarParaescolares(alumnoId);
  return (conteos.get(limpio) || 0) < MAX_PARAESCOLAR;
}

function escaparRegex(valor) {
  return String(valor).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  const tipoTramite = String(registrado?.tipo_tramite || '').trim().toUpperCase();
  return Boolean(
    registrado?.reinscripcion_completada ||
    registrado?.bloqueado_reinscripcion ||
    tipoTramite === 'REINSCRIPCION'
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
    const alumno = await Alumno.findOne({ folio: req.params.folio });
    if (!alumno) return res.status(404).json({ message: 'Folio no encontrado' });
    res.json(alumno);
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
      alumno
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/reinscripcion/:numeroControl', async (req, res) => {
  try {
    const numeroControl = String(req.params.numeroControl || '').trim().toUpperCase();
    const encontrado = await buscarRegistradoPorNumeroControl(numeroControl);

    if (!encontrado) return res.status(404).json({ message: 'Número de control no encontrado en registrados' });

    res.json({
      message: 'Datos de reinscripción encontrados',
      alumno: encontrado.alumno,
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
      turno: raw.turno || ''
    },
    datos_generales: raw.datos_generales || {
      colonia: raw.colonia || '',
      domicilio: raw.domicilio || '',
      codigo_postal: raw.codigo_postal || '',
      telefono_alumno: raw.telefono_alumno || '',
      correo_alumno: raw.correo_alumno || '',
      paraescolar: raw.paraescolar || ''
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

    const data = normalizarEstadoCivilAlumno(req.body);

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

    if (existe?.registro_completado) {
      return res.status(400).json({
        message: "Este alumno ya completó su registro"
      });
    }

    const paraescolarSolicitado = data?.datos_generales?.paraescolar;
    if (paraescolarSolicitado) {
      const okParaescolar = await puedeAsignarParaescolar(paraescolarSolicitado);
      if (!okParaescolar) {
        return res.status(400).json({
          message: `El paraescolar ${paraescolarSolicitado} ya alcanzó el límite de ${MAX_PARAESCOLAR} alumno(s).`
        });
      }
    }
    
    // ==========================================
    // 🔢 GENERAR FOLIO
    // ==========================================
    const folio = await generarFolio();
    data.folio = folio;

    data.registro_completado = true;
    data.bloqueado = true;

    // ==========================================
    // 💾 GUARDAR EN BD
    // ==========================================
    const actualizado = await Alumno.create(data);

    // ==========================================
    // 📄 GENERAR PDF
    // ==========================================
    const datosAnidados = flattenToNested(actualizado.toObject());
    const nombreArchivo = `${folio}_registro.pdf`;
    const pdfUrl = await generarPDFRegistro(datosAnidados, nombreArchivo);

    // ==========================================
    // ✅ RESPUESTA FINAL
    // ==========================================
    res.status(200).json({
      message: "Registro exitoso",
      folio,
      pdf_url: pdfUrl
    });

  } catch (err) {
    console.error("❌ ERROR EN /guardar:", err);
    res.status(500).json({ message: err.message });
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
router.get('/dashboard/alumnos', async (req, res) => {
  const { folio, apellidos } = req.query;
  const query = {};
  if (folio) {
  query.folio = { $regex: folio, $options: 'i' };
}

  if (apellidos) query['datos_alumno.primer_apellido'] = { $regex: apellidos, $options: 'i' };

  try {
    const alumnos = await Alumno.find(query);
    res.json(alumnos);
  } catch (error) {
    res.status(500).json({ message: 'Error al buscar alumnos', error });
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


router.put('/dashboard/alumnos/:id', async (req, res) => {
  try {
    const alumnoActual = await Alumno.findById(req.params.id);
    if (!alumnoActual) return res.status(404).json({ message: 'No encontrado' });

    const bodyUpper = toUpperData(req.body);
    const nuevoPara = bodyUpper?.datos_generales?.paraescolar;
    const previoPara = alumnoActual?.datos_generales?.paraescolar;
    const cambiando = nuevoPara && (nuevoPara.toUpperCase() !== (previoPara || '').toUpperCase());

    if (cambiando) {
      const ok = await puedeAsignarParaescolar(nuevoPara, alumnoActual._id);
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
    const bodyUpper = toUpperData(req.body);
    const nuevoPara = bodyUpper?.datos_generales?.paraescolar;

    if (nuevoPara) {
      const ok = await puedeAsignarParaescolar(nuevoPara);
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




router.get('/exportar-excel', async (req, res) => {
  try {
    const alumnos = await Alumno.find({ registro_completado: true }).lean();
    if (!alumnos.length) {
      return res.status(404).json({ message: 'No hay alumnos registrados aún.' });
    }

    const datos = alumnos.map(al => ({
      folio: al.folio || '',
      // DATOS ALUMNO
      primer_apellido: al.datos_alumno?.primer_apellido || '',
      segundo_apellido: al.datos_alumno?.segundo_apellido || '',
      nombres: al.datos_alumno?.nombres || '',
      periodo_semestral: al.datos_alumno?.periodo_semestral || '',
      semestre: al.datos_alumno?.semestre || '',
      grupo: al.datos_alumno?.grupo || '',
      turno: al.datos_alumno?.turno || '',
      carrera: al.datos_alumno?.carrera || '',
            curp: al.datos_alumno?.curp || '',
      fecha_nacimiento: al.datos_alumno?.fecha_nacimiento || '',
      edad: al.datos_alumno?.edad || '',
      sexo: al.datos_alumno?.sexo || '',
      estado_nacimiento: al.datos_alumno?.estado_nacimiento || '',
      municipio_nacimiento: al.datos_alumno?.municipio_nacimiento || '',
      ciudad_nacimiento: al.datos_alumno?.ciudad_nacimiento || '',
      estado_civil: al.datos_alumno?.estado_civil || '',
      nacionalidad: al.datos_alumno?.nacionalidad || '',
      pais_extranjero: al.datos_alumno?.pais_extranjero || '',

      // DATOS GENERALES
      colonia: al.datos_generales?.colonia || '',
      domicilio: al.datos_generales?.domicilio || '',
      codigo_postal: al.datos_generales?.codigo_postal || '',
      telefono_alumno: al.datos_generales?.telefono_alumno || '',
      correo_alumno: al.datos_generales?.correo_alumno || '',
      paraescolar: al.datos_generales?.paraescolar || '',
      entrega_diagnostico: al.datos_generales?.entrega_diagnostico || '',
      detalle_enfermedad: al.datos_generales?.detalle_enfermedad || '',
      responsable_emergencia_nombre: al.datos_generales?.responsable_emergencia?.nombre || '',
      responsable_emergencia_telefono: al.datos_generales?.responsable_emergencia?.telefono || '',
      responsable_emergencia_parentesco: al.datos_generales?.responsable_emergencia?.parentesco || '',
      carta_poder: al.datos_generales?.carta_poder || '',
      tipo_sangre: al.datos_generales?.tipo_sangre || '',
      contacto_emergencia_nombre: al.datos_generales?.contacto_emergencia_nombre || '',
      contacto_emergencia_telefono: al.datos_generales?.contacto_emergencia_telefono || '',
      habla_lengua_indigena_respuesta: al.datos_generales?.habla_lengua_indigena?.respuesta || '',
      habla_lengua_indigena_cual: al.datos_generales?.habla_lengua_indigena?.cual || '',
      primera_opcion: al.datos_generales?.primera_opcion || '',
      segunda_opcion: al.datos_generales?.segunda_opcion || '',
      tercera_opcion: al.datos_generales?.tercera_opcion || '',
      cuarta_opcion: al.datos_generales?.cuarta_opcion || '',
      estado_nacimiento_general: al.datos_generales?.estado_nacimiento_general || '',
      municipio_nacimiento_general: al.datos_generales?.municipio_nacimiento_general || '',
      ciudad_nacimiento_general: al.datos_generales?.ciudad_nacimiento_general || '',

      // DATOS MÉDICOS
      numero_seguro_social: al.datos_medicos?.numero_seguro_social || '',
      unidad_medica_familiar: al.datos_medicos?.unidad_medica_familiar || '',
      enfermedad_cronica_respuesta: al.datos_medicos?.enfermedad_cronica_o_alergia?.respuesta || '',
      enfermedad_cronica_detalle: al.datos_medicos?.enfermedad_cronica_o_alergia?.detalle || '',
      discapacidad: al.datos_medicos?.discapacidad || '',

      // SECUNDARIA ORIGEN
      nombre_secundaria: al.secundaria_origen?.nombre_secundaria || '',
      regimen: al.secundaria_origen?.regimen || '',
      estudias: al.secundaria_origen?.estudias || '',
      modalidad: al.secundaria_origen?.modalidad || '',

      // TUTOR RESPONSABLE
      nombre_padre: al.tutor_responsable?.nombre_padre || '',
      telefono_padre: al.tutor_responsable?.telefono_padre || '',
      nombre_madre: al.tutor_responsable?.nombre_madre || '',
      telefono_madre: al.tutor_responsable?.telefono_madre || '',
      vive_con: al.tutor_responsable?.vive_con || '',

      // PERSONA EMERGENCIA
      persona_emergencia_nombre: al.persona_emergencia?.nombre || '',
      persona_emergencia_parentesco: al.persona_emergencia?.parentesco || '',
      persona_emergencia_telefono: al.persona_emergencia?.telefono || ''
    }));

    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(datos);
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Alumnos');

    const exportPath = path.join(__dirname, '../exports', 'alumnos_registrados.xlsx');
    xlsx.writeFile(workbook, exportPath);

    res.download(exportPath, 'alumnos_registrados.xlsx', (err) => {
      if (err) console.error('❌ Error al descargar:', err);
      try { fs.unlinkSync(exportPath); } catch (e) {}
    });

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

    upperCaseData.datos_generales.primera_opcion = data.datos_generales.primera_opcion || '';
    upperCaseData.datos_generales.segunda_opcion = data.datos_generales.segunda_opcion || '';
    upperCaseData.datos_generales.tercera_opcion = data.datos_generales.tercera_opcion || '';
    upperCaseData.datos_generales.cuarta_opcion = data.datos_generales.cuarta_opcion || '';
    upperCaseData.datos_generales.quinta_opcion = data.datos_generales.quinta_opcion || '';

    const nuevoParaescolar = upperCaseData?.datos_generales?.paraescolar;
    if (nuevoParaescolar) {
      const okParaescolar = await puedeAsignarParaescolar(nuevoParaescolar, registroExistente?._id);
      if (!okParaescolar) {
        return res.status(400).json({
          message: `El paraescolar ${nuevoParaescolar} ya alcanzó el límite de ${MAX_PARAESCOLAR} alumno(s).`
        });
      }
    }

    upperCaseData.registro_completado = true;

    await Alumno.findOneAndUpdate({ folio }, upperCaseData, { upsert: true });

    const datosAnidados = flattenToNested(upperCaseData);
    const nombreArchivo = `${datosAnidados.datos_alumno?.curp || 'formulario'}_registro.pdf`;
    await generarPDFRegistro(datosAnidados, nombreArchivo);

    res.status(200).json({
      message: 'Registro exitoso y PDF generado',
      pdf_url: `/pdfs/${nombreArchivo}`
    });
  } catch (err) {
    console.error('Error en /guardar-registro:', err);
    res.status(500).json({ message: err.message });
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
    const requiereControlEscolar = materiasReprobadas > 3;
    const payload = {
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
    };

    await Registrado.findOneAndUpdate(
      crearFiltroNumeroControl(numeroControl),
      { $set: payload, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, new: true }
    );

    if (requiereControlEscolar) {
      return res.status(200).json({
        message: 'Reinscripción guardada. Debes acudir a control escolar por tener más de 3 materias reprobadas.',
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
