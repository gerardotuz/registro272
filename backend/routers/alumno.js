
const express = require('express');
const router = express.Router();
const Alumno = require('../models/Alumno');
const multer = require('multer');
const xlsx = require('xlsx');
const generarPDF = require('../utils/pdfGenerator');
const flattenToNested = require('../utils/flattenToNested');
const path = require('path');

router.get('/ping', (req, res) => {
  res.status(200).json({ ok: true });
});

const upload = multer({ storage: multer.memoryStorage() });
const MAX_PARAESCOLAR = 40;

router.get('/folio/:folio', async (req, res) => {
  try {
    const alumno = await Alumno.findOne({ folio: req.params.folio });
    if (!alumno) return res.status(404).json({ message: 'Folio no encontrado' });
    res.json(alumno);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/guardar', async (req, res) => {
  try {
    const data = req.body;

    if (!data.folio || !data.datos_alumno?.curp || !data.datos_generales?.correo_alumno) {
      return res.status(400).json({ message: 'Faltan datos obligatorios' });
    }

    const yaRegistrado = await Alumno.findOne({ folio: data.folio });

    if (yaRegistrado?.registro_completado) {
      return res.status(403).json({ message: 'Este folio ya fue registrado y no se puede modificar.' });
    }

    // Evitar convertir claves de catálogos
    const clavesExentas = [
      'estado_nacimiento', 'municipio_nacimiento', 'ciudad_nacimiento',
      'estado_nacimiento_general', 'municipio_nacimiento_general', 'ciudad_nacimiento_general'
    ];

    const upperCaseData = JSON.parse(JSON.stringify(data), (key, value) => {
      return typeof value === 'string' && !clavesExentas.includes(key) ? value.toUpperCase() : value;
    });

    // Validar paraescolar
    const paraescolar = data.datos_generales?.paraescolar;
    if (paraescolar) {
      const count = await Alumno.countDocuments({ "datos_generales.paraescolar": paraescolar.toUpperCase() });
      const paraescolarPrevio = yaRegistrado?.datos_generales?.paraescolar;
      const estaCambiando = paraescolarPrevio && paraescolarPrevio.toUpperCase() !== paraescolar.toUpperCase();

      if (!yaRegistrado && count >= MAX_PARAESCOLAR) {
        return res.status(400).json({ message: `El paraescolar ${paraescolar} ya alcanzó el límite de ${MAX_PARAESCOLAR} alumno(s).` });
      }

      if (yaRegistrado && estaCambiando && count >= MAX_PARAESCOLAR) {
        return res.status(400).json({ message: `No se puede cambiar a ${paraescolar}, ya alcanzó su límite.` });
      }
    }

    // Asegurar estado civil como número
    const estadoCivilNum = parseInt(data.datos_alumno?.estado_civil);
    if (!isNaN(estadoCivilNum)) {
      upperCaseData.datos_alumno.estado_civil = estadoCivilNum;
    }

    // Asegurar opciones vacías si no existen
    upperCaseData.datos_generales.primera_opcion = data.datos_generales.primera_opcion || '';
    upperCaseData.datos_generales.segunda_opcion = data.datos_generales.segunda_opcion || '';
    upperCaseData.datos_generales.tercera_opcion = data.datos_generales.tercera_opcion || '';
    upperCaseData.datos_generales.cuarta_opcion = data.datos_generales.cuarta_opcion || '';

    // ✅ NUEVO: guardar claves generales si vienen en el body
    upperCaseData.datos_generales.estado_nacimiento_general = data.datos_generales.estado_nacimiento_general || '';
    upperCaseData.datos_generales.municipio_nacimiento_general = data.datos_generales.municipio_nacimiento_general || '';
    upperCaseData.datos_generales.ciudad_nacimiento_general = data.datos_generales.ciudad_nacimiento_general || '';

    // ✅ Marcar como registro completado
    upperCaseData.registro_completado = true;

    await Alumno.findOneAndUpdate({ folio: data.folio }, upperCaseData, { upsert: true });

    // Generar PDF
    const datosAnidados = flattenToNested(upperCaseData);
    const nombreArchivo = `${datosAnidados.datos_alumno?.curp || 'formulario'}.pdf`;
    await generarPDF(datosAnidados, nombreArchivo);

    res.status(200).json({
      message: 'Registro exitoso y PDF generado',
      pdf_url: `/pdfs/${nombreArchivo}`
    });

  } catch (err) {
    console.error('Error al guardar o generar PDF:', err);
    res.status(500).json({ message: err.message });
  }
});


//carga de excel alumnos
router.post('/cargar-excel', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No se envió archivo' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const datos = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (!datos || datos.length === 0) {
      return res.status(400).json({ message: 'El archivo está vacío o no tiene datos válidos' });
    }

    const flattenToNested = require('../utils/flattenToNested');
    const nestedDocs = datos.map(flattenToNested);

    // 🔑 ELIMINA cualquier _id para evitar duplicados
    nestedDocs.forEach(doc => { delete doc._id; });

    await Alumno.insertMany(nestedDocs);
    res.status(200).json({ message: 'Archivo Excel cargado correctamente' });

  } catch (error) {
    console.error('❌ Error al cargar Excel:', error);
    res.status(500).json({ message: 'Error al procesar el archivo' });
  }
});






// ✅ NUEVA RUTA: Reimprimir PDF desde folio ya registrado
router.get('/reimprimir/:folio', async (req, res) => {
  try {
    const alumno = await Alumno.findOne({ folio: req.params.folio });

    if (!alumno || !alumno.registro_completado) {
      return res.status(404).json({ message: 'Folio no registrado o incompleto.' });
    }

    const datosAnidados = flattenToNested(alumno.toObject());
    const nombreArchivo = `${datosAnidados.datos_alumno?.curp || 'formulario'}.pdf`;

    await generarPDF(datosAnidados, nombreArchivo);

    res.json({ pdf: `/pdfs/${nombreArchivo}` });
  } catch (err) {
    console.error('❌ Error al reimprimir PDF:', err);
    res.status(500).json({ message: 'Error interno al generar PDF.' });
  }
});



// 📌 Búsqueda para Dashboard (folio y apellidos)
router.get('/dashboard/alumnos', async (req, res) => {
  const { folio, apellidos } = req.query;
  let query = {};

  if (folio) query.folio = folio;
  if (apellidos) {
    query['datos_alumno.primer_apellido'] = { $regex: apellidos, $options: 'i' };
  }

  try {
    const alumnos = await Alumno.find(query);
    res.json(alumnos);
  } catch (error) {
    res.status(500).json({ message: 'Error al buscar alumnos', error });
  }
});

// 📌 Obtener alumno por ID para edición
router.get('/dashboard/alumnos/:id', async (req, res) => {
  try {
    const alumno = await Alumno.findById(req.params.id);
    if (!alumno) return res.status(404).json({ message: 'No encontrado' });
    res.json(alumno);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener alumno', error });
  }
});

// 📌 Actualizar alumno desde Dashboard
router.put('/dashboard/alumnos/:id', async (req, res) => {
  try {
    const actualizado = await Alumno.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(actualizado);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar alumno', error });
  }
});

// 📌 Eliminar alumno desde Dashboard
router.delete('/dashboard/alumnos/:id', async (req, res) => {
  try {
    await Alumno.findByIdAndDelete(req.params.id);
    res.json({ message: 'Alumno eliminado' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar alumno', error });
  }
});



module.exports = router;
