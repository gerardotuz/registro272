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

// 👇 usar SIEMPRE la conexión del plantel actual
const Alumno = conexiones.registro272.model("Alumno", AlumnoSchema);


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

const upload = multer({ storage: multer.memoryStorage() });
const MAX_PARAESCOLAR = 40;

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


async function puedeAsignarParaescolar(paraescolar, alumnoId = null) {
  if (!paraescolar) return true;
  const filtro = { "datos_generales.paraescolar": paraescolar.toUpperCase() };
  if (alumnoId) filtro._id = { $ne: alumnoId };
  const count = await Alumno.countDocuments(filtro);
  return count < MAX_PARAESCOLAR;
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

    const data = req.body;

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
    const nombreArchivo = `${folio}.pdf`;
    const pdfUrl = await generarPDF(datosAnidados, nombreArchivo);

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
    const alumno = await Alumno.findOne({ folio: req.params.folio });

    if (!alumno) {
      return res.status(404).json({ message: 'Folio no encontrado' });
    }

    const datosAnidados = flattenToNested(alumno.toObject());
    const nombreArchivo = `${alumno.folio}.pdf`;

    const rutaPDF = await generarPDF(datosAnidados, nombreArchivo);

    const fullPath = path.join(__dirname, '../public', rutaPDF);

    res.sendFile(fullPath);

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
    res.status(500).json({ message: 'Error al eliminar alumno', error });
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


const BASE_URL = window.location.origin.includes('localhost')
  ? 'http://localhost:3001'
  : 'https://registro272.onrender.com';

const OPCIONES_CARRERA = ['A Y B', 'PROGRAMACIÓN', 'GESTIÓN E INNOVACIÓN TURÍSTICA', 'VENTAS', 'ROBOTICA'];
const IDS_OPCIONES = ['primera_opcion', 'segunda_opcion', 'tercera_opcion', 'cuarta_opcion', 'quinta_opcion'];

document.addEventListener('DOMContentLoaded', () => {
  inicializarOpcionesCarrera();
  cargarCatalogo();
  cargarCatalogoGeneral();
  consultarFolioYAutocompletar();

  document.getElementById('registroForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const folio = localStorage.getItem('alumnoFolio');
    if (!folio) return alert('Folio perdido');

    const clave = (id) => document.getElementById(id).selectedOptions[0]?.dataset.clave;

    const payload = {
      folio,
      datos_alumno: {
        nombres: formData.get('nombres'), primer_apellido: formData.get('primer_apellido'), segundo_apellido: formData.get('segundo_apellido'),
        curp: formData.get('curp'), carrera: formData.get('carrera'), periodo_semestral: formData.get('periodo_semestral'), semestre: formData.get('semestre'), grupo: formData.get('grupo'), turno: formData.get('turno'),
        fecha_nacimiento: formData.get('fecha_nacimiento'), edad: formData.get('edad'), sexo: formData.get('sexo'),
        estado_nacimiento: clave('estado_nacimiento'), municipio_nacimiento: clave('municipio_nacimiento'), ciudad_nacimiento: clave('ciudad_nacimiento'), estado_civil: formData.get('estado_civil')
      },
      datos_generales: {
        colonia: formData.get('colonia'), domicilio: formData.get('domicilio'), codigo_postal: formData.get('codigo_postal'), telefono_alumno: formData.get('telefono_alumno'), correo_alumno: formData.get('correo_alumno'), paraescolar: formData.get('paraescolar'), tipo_sangre: formData.get('tipo_sangre'),
        contacto_emergencia_nombre: formData.get('contacto_emergencia_nombre'), contacto_emergencia_telefono: formData.get('contacto_emergencia_telefono'),
        habla_lengua_indigena: { respuesta: formData.get('habla_lengua_indigena_respuesta'), cual: formData.get('habla_lengua_indigena_cual') },
        entrega_diagnostico: formData.get('entrega_diagnostico'), detalle_enfermedad: formData.get('detalle_enfermedad'),
        responsable_emergencia: { nombre: formData.get('responsable_emergencia_nombre'), telefono: formData.get('responsable_emergencia_telefono'), parentesco: formData.get('responsable_emergencia_parentesco') },
        carta_poder: formData.get('carta_poder'),
        primera_opcion: formData.get('primera_opcion'), segunda_opcion: formData.get('segunda_opcion'), tercera_opcion: formData.get('tercera_opcion'), cuarta_opcion: formData.get('cuarta_opcion'), quinta_opcion: formData.get('quinta_opcion'),
        estado_nacimiento_general: clave('estado_nacimiento_general'), municipio_nacimiento_general: clave('municipio_nacimiento_general'), ciudad_nacimiento_general: clave('ciudad_nacimiento_general')
      },
      datos_medicos: {
        numero_seguro_social: formData.get('numero_seguro_social'), unidad_medica_familiar: formData.get('unidad_medica_familiar'),
        enfermedad_cronica_o_alergia: { respuesta: formData.get('enfermedad_cronica_o_alergia_respuesta'), detalle: formData.get('enfermedad_cronica_o_alergia_detalle') },
        discapacidad: formData.get('discapacidad')
      },
      secundaria_origen: { nombre_secundaria: formData.get('nombre_secundaria'), regimen: formData.get('regimen'), promedio_general: formData.get('promedio_general'), modalidad: formData.get('modalidad') },
      tutor_responsable: { nombre_padre: formData.get('nombre_padre'), telefono_padre: formData.get('telefono_padre'), nombre_madre: formData.get('nombre_madre'), telefono_madre: formData.get('telefono_madre'), vive_con: formData.get('vive_con') },
      persona_emergencia: { nombre: formData.get('persona_emergencia_nombre'), parentesco: formData.get('persona_emergencia_parentesco'), telefono: formData.get('persona_emergencia_telefono') }
    };

    const res = await fetch(`${BASE_URL}/api/guardar-registro`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await res.json();
    if (res.ok) {
      alert('✅ Registro guardado con éxito');
      if (result.pdf_url) window.open(result.pdf_url, '_blank');
      deshabilitarFormulario();
    } else alert(result.message || '❌ Error al guardar');
  });
});

function inicializarOpcionesCarrera() {
  const selects = IDS_OPCIONES.map((id) => document.getElementById(id)).filter(Boolean);
  if (!selects.length) return;

  const placeholderById = {
    primera_opcion: 'cuál fue tu 1era opción',
    segunda_opcion: 'cuál fue tu 2da opción',
    tercera_opcion: 'cuál fue tu 3era opción',
    cuarta_opcion: 'cuál fue tu 4ta opción',
    quinta_opcion: 'cuál fue tu 5ta opción'
  };

  const refrescar = () => {
    const seleccionadas = selects.map((s) => s.value).filter(Boolean);
    selects.forEach((select) => {
      const actual = select.value;
      select.innerHTML = '';

      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = placeholderById[select.id] || 'Selecciona opción';
      select.appendChild(placeholder);

      OPCIONES_CARRERA.forEach((opcion) => {
        if (!seleccionadas.includes(opcion) || opcion === actual) {
          const opt = document.createElement('option');
          opt.value = opcion;
          opt.textContent = opcion;
          if (opcion === actual) opt.selected = true;
          select.appendChild(opt);
        }
      });
    });
  };

  selects.forEach((s) => s.addEventListener('change', refrescar));
  refrescar();
}

function deshabilitarFormulario() { Array.from(document.getElementById('registroForm').elements).forEach(el => el.disabled = true); }

async function obtenerCatalogo() {
  const rutas = ['/data/catalogo.json', '/catalogo.json'];
  for (const ruta of rutas) {
    try {
      const res = await fetch(ruta);
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn(`No se pudo cargar catálogo desde ${ruta}`, err);
    }
  }
  throw new Error('No se pudo cargar catalogo.json');
}

function cargarCatalogo() {
  obtenerCatalogo().then((d) => cargarSelectores('nacimiento', d)).catch((err) => console.error('❌ Error cargando catálogo:', err));
}

function cargarCatalogoGeneral() {
  obtenerCatalogo().then((d) => cargarSelectores('nacimiento_general', d)).catch((err) => console.error('❌ Error cargando catálogo general:', err));
}

function cargarSelectores(s, data) { const e = document.getElementById(`estado_${s}`), m = document.getElementById(`municipio_${s}`), c = document.getElementById(`ciudad_${s}`); if (!e || !m || !c) return; e.innerHTML='<option value="">-- Selecciona Estado --</option>'; m.innerHTML='<option value="">-- Selecciona Municipio --</option>'; c.innerHTML='<option value="">-- Selecciona Ciudad --</option>'; data.forEach(est=>{const o=document.createElement('option'); o.value=est.nombre; o.dataset.clave=est.clave; o.dataset.municipios=JSON.stringify(est.municipios||[]); o.textContent=est.nombre; e.appendChild(o);}); e.addEventListener('change',()=>{const ms=JSON.parse(e.selectedOptions[0]?.dataset.municipios||'[]'); m.innerHTML='<option value="">-- Selecciona Municipio --</option>'; c.innerHTML='<option value="">-- Selecciona Ciudad --</option>'; ms.forEach(mu=>{const o=document.createElement('option'); o.value=mu.nombre;o.dataset.clave=mu.clave;o.dataset.localidades=JSON.stringify(mu.localidades||[]);o.textContent=mu.nombre;m.appendChild(o);}); m.disabled=!ms.length;c.disabled=true;}); m.addEventListener('change',()=>{const ls=JSON.parse(m.selectedOptions[0]?.dataset.localidades||'[]'); c.innerHTML='<option value="">-- Selecciona Ciudad --</option>'; ls.forEach(l=>{const o=document.createElement('option'); o.value=l.nombre;o.dataset.clave=l.clave;o.textContent=l.nombre;c.appendChild(o);}); c.disabled=!ls.length;}); }
function consultarFolioYAutocompletar(){const datos=JSON.parse(localStorage.getItem('datosPrecargados')); if(!datos) return; const set=(name,v)=>{const i=document.querySelector(`[name="${name}"]`); if(i&&v!=null&&v!=='') i.value=v;}; const mappings={...datos.datos_alumno,...datos.datos_generales,...datos.datos_medicos,...datos.secundaria_origen,...datos.tutor_responsable,'habla_lengua_indigena_respuesta':datos.datos_generales?.habla_lengua_indigena?.respuesta,'habla_lengua_indigena_cual':datos.datos_generales?.habla_lengua_indigena?.cual,'enfermedad_cronica_o_alergia_respuesta':datos.datos_medicos?.enfermedad_cronica_o_alergia?.respuesta,'enfermedad_cronica_o_alergia_detalle':datos.datos_medicos?.enfermedad_cronica_o_alergia?.detalle,'persona_emergencia_nombre':datos.persona_emergencia?.nombre,'persona_emergencia_parentesco':datos.persona_emergencia?.parentesco,'persona_emergencia_telefono':datos.persona_emergencia?.telefono}; Object.entries(mappings).forEach(([k,v])=>set(k,v));}


module.exports = router;


