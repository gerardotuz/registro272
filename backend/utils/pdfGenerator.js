const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const catalogo = require('../../public/data/catalogo.json');

function obtenerNombreDesdeCatalogo(claveEstado, claveMunicipio, claveLocalidad) {
  const estado = catalogo.find(e => e.nombre === claveEstado);
  if (!estado) return { municipio: '', localidad: '' };

  const municipio = estado.municipios.find(m => m.nombre === claveMunicipio);
  const localidad = municipio?.localidades?.find(l => l.nombre === claveLocalidad);

  return {
    municipio: municipio?.nombre || '',
    localidad: localidad?.nombre || ''
  };
}

function generarPDF(datos, nombreArchivo = 'formulario.pdf') {
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

  const { municipio, localidad } = obtenerNombreDesdeCatalogo(
    alumno.estado_nacimiento,
    alumno.municipio_nacimiento,
    alumno.ciudad_nacimiento
  );

  doc.fontSize(12).text('CÉDULA DE INSCRIPCIÓN SEMESTRAL', { align: 'center' });
  doc.moveDown();

  doc.text(`Nombre: ${alumno.nombres} ${alumno.primer_apellido} ${alumno.segundo_apellido}`);
  doc.text(`CURP: ${alumno.curp}`);
  doc.text(`Carrera: ${alumno.carrera}`);
  doc.text(`Estado de nacimiento: ${alumno.estado_nacimiento}`);
  doc.text(`Municipio: ${municipio}`);
  doc.text(`Ciudad: ${localidad}`);
  doc.text(`Correo: ${generales.correo_alumno}`);
  doc.text(`Teléfono: ${generales.telefono_alumno}`);
  doc.text(`Paraescolar: ${generales.paraescolar}`);
  doc.text(`Unidad Médica: ${medicos.unidad_medica_familiar}`);
  doc.text(`Contacto emergencia: ${emergencia.nombre} (${emergencia.parentesco}) - ${emergencia.telefono}`);

  doc.end();
}

module.exports = generarPDF;
