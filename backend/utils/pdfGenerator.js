// ✅ backend/routers/alumno.js
const express = require('express');
const router = express.Router();
const Alumno = require('../models/Alumno');
const multer = require('multer');
const xlsx = require('xlsx');
const generarPDF = require('../utils/pdfGenerator');
const flattenToNested = require('../utils/flattenToNested');
const path = require('path');

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

    const upperCaseData = JSON.parse(JSON.stringify(data), (key, value) =>
      typeof value === 'string' ? value.toUpperCase() : value
    );

    const paraescolar = data.datos_generales?.paraescolar;
    const yaRegistrado = await Alumno.findOne({ folio: data.folio });

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

    const estadoCivilNum = parseInt(data.datos_alumno?.estado_civil);
    if (!isNaN(estadoCivilNum)) {
      data.datos_alumno.estado_civil = estadoCivilNum;
    }

    await Alumno.findOneAndUpdate({ folio: data.folio }, upperCaseData, { upsert: true });

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

router.get('/validar-paraescolar/:nombre', async (req, res) => {
  try {
    const nombre = req.params.nombre.toUpperCase();
    const count = await Alumno.countDocuments({ "datos_generales.paraescolar": nombre });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/cargar-excel', upload.single('archivo'), async (req, res) => {
  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    for (let row of data) {
      const alumno = flattenToNested(row);
      await Alumno.findOneAndUpdate({ folio: alumno.folio }, { $set: alumno }, { upsert: true });
    }

    res.status(200).json({ message: 'Carga exitosa' });
  } catch (err) {
    console.error('Error al procesar Excel:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;


// ✅ backend/utils/pdfGenerator.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function generarPDF(datos, nombreArchivo = 'formulario.pdf') {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
      const rutaPDF = path.join(__dirname, '../public/pdfs', nombreArchivo);
      const stream = fs.createWriteStream(rutaPDF);
      doc.pipe(stream);

      const alumno = datos.datos_alumno || {};
      const generales = datos.datos_generales || {};
      const medicos = datos.datos_medicos || {};
      const secundaria = datos.secundaria_origen || {};
      const tutor = datos.tutor_responsable || {};
      const emergencia = datos.persona_emergencia || {};

      doc.fontSize(14).text('📝 CÉDULA DE INSCRIPCIÓN', { align: 'center' });
      doc.moveDown();

      doc.fontSize(10).text(`Nombre: ${alumno.nombres || ''} ${alumno.primer_apellido || ''} ${alumno.segundo_apellido || ''}`);
      doc.text(`CURP: ${alumno.curp || ''}`);
      doc.text(`Carrera: ${alumno.carrera || ''}`);
      doc.text(`Semestre: ${alumno.semestre || ''}, Turno: ${alumno.turno || ''}`);
      doc.text(`Fecha de nacimiento: ${alumno.fecha_nacimiento || ''} | Edad: ${alumno.edad || ''}`);
      doc.text(`Estado: ${alumno.estado_nacimiento || ''}, Municipio: ${alumno.municipio_nacimiento || ''}, Ciudad: ${alumno.ciudad_nacimiento || ''}`);
      doc.text(`Estado civil: ${alumno.estado_civil || ''}`);
      doc.moveDown();

      doc.text(`Colonia: ${generales.colonia || ''}`);
      doc.text(`Domicilio: ${generales.domicilio || ''}`);
      doc.text(`Código Postal: ${generales.codigo_postal || ''}`);
      doc.text(`Teléfono: ${generales.telefono_alumno || ''}`);
      doc.text(`Correo: ${generales.correo_alumno || ''}`);
      doc.text(`Paraescolar: ${generales.paraescolar || ''}`);
      doc.moveDown();

      doc.text(`Nombre Padre: ${tutor.nombre_padre || ''} Tel: ${tutor.telefono_padre || ''}`);
      doc.text(`Nombre Madre: ${tutor.nombre_madre || ''} Tel: ${tutor.telefono_madre || ''}`);
      doc.text(`Vive con: ${tutor.vive_con || ''}`);
      doc.moveDown();

      doc.text(`Contacto Emergencia: ${emergencia.nombre || ''} (${emergencia.parentesco || ''}) Tel: ${emergencia.telefono || ''}`);
      doc.moveDown();

      doc.text(`Seguro Social: ${medicos.numero_seguro_social || ''}`);
      doc.text(`Unidad Médica: ${medicos.unidad_medica_familiar || ''}`);
      doc.text(`Enfermedad o Alergia: ${medicos.enfermedad_cronica_o_alergia?.detalle || ''}`);
      doc.text(`Discapacidad: ${medicos.discapacidad || ''}`);
      doc.moveDown();

      doc.text(`Secundaria de Origen: ${secundaria.nombre_secundaria || ''}`);
      doc.text(`Promedio: ${secundaria.promedio_general || ''}, Modalidad: ${secundaria.modalidad || ''}`);

      doc.end();

      stream.on('finish', () => resolve(rutaPDF));
      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = generarPDF;


// ✅ server.js (solo línea clave de pdfs)
app.use('/pdfs', express.static(path.join(__dirname, 'public/pdfs')));

