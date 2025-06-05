const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function generarPDF(datos, nombreArchivo = 'formulario_generado.pdf') {
  const doc = new PDFDocument();
  const rutaPDF = path.join(__dirname, '../public/pdfs', nombreArchivo);
  const writeStream = fs.createWriteStream(rutaPDF);
  doc.pipe(writeStream);

  const logoPath = path.join(__dirname, '../public/images/logo.png');
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 40, 30, { width: 530 });
  }

  doc.moveDown(4);
  doc.fontSize(16).text('Formulario de Registro de Alumno', { align: 'center' });
  doc.moveDown(1);
  doc.fontSize(12);

  const alumno = datos.datos_alumno || {};
  const generales = datos.datos_generales || {};
  const medicos = datos.datos_medicos || {};
  const secundaria = datos.secundaria_origen || {};
  const tutor = datos.tutor_responsable || {};

  // DATOS DEL ALUMNO
  doc.text(`Nombre: ${alumno.nombres} ${alumno.primer_apellido} ${alumno.segundo_apellido}`);
  doc.text(`CURP: ${alumno.curp}`);
  doc.text(`Carrera: ${alumno.carrera}`);
  doc.text(`Semestre: ${alumno.semestre}  Grupo: ${alumno.grupo}  Turno: ${alumno.turno}`);
  doc.text(`Fecha de Nacimiento: ${alumno.fecha_nacimiento}  Edad: ${alumno.edad}  Sexo: ${alumno.sexo}`);
  doc.text(`Estado Nacimiento: ${alumno.estado_nacimiento}  Municipio: ${alumno.municipio_nacimiento}  Ciudad: ${alumno.ciudad_nacimiento}`);
  doc.text(`Estado Civil: ${alumno.estado_civil}`);
  doc.moveDown();

  // DATOS GENERALES
  doc.text('Domicilio:', { underline: true });
  doc.text(`${generales.domicilio}, ${generales.colonia}, CP: ${generales.codigo_postal}`);
  doc.text(`Teléfono: ${generales.telefono_alumno}  Correo: ${generales.correo_alumno}`);
  doc.text(`Paraescolar: ${generales.paraescolar}`);
  doc.text(`Tipo de Sangre: ${generales.tipo_sangre}`);
  doc.text(`Contacto Emergencia: ${generales.contacto_emergencia_nombre} - Tel: ${generales.contacto_emergencia_telefono}`);
  doc.text(`Lengua Indígena: ${generales.habla_lengua_indigena?.respuesta || ''} - ${generales.habla_lengua_indigena?.cual || ''}`);
  doc.moveDown();

  // DATOS MÉDICOS
  doc.text('Datos Médicos:', { underline: true });
  doc.text(`Número Seguro Social: ${medicos.numero_seguro_social}`);
  doc.text(`Unidad Médica Familiar: ${medicos.unidad_medica_familiar}`);
  doc.text(`Enfermedad o Alergia: ${medicos.enfermedad_cronica_o_alergia?.respuesta || ''} - ${medicos.enfermedad_cronica_o_alergia?.detalle || ''}`);
  doc.text(`Discapacidad: ${medicos.discapacidad}`);
  doc.moveDown();

  // SECUNDARIA
  doc.text('Secundaria de Origen:', { underline: true });
  doc.text(`Nombre: ${secundaria.nombre_secundaria}`);
  doc.text(`Régimen: ${secundaria.regimen}  Promedio: ${secundaria.promedio_general}  Modalidad: ${secundaria.modalidad}`);
  doc.moveDown();

  // TUTOR
  doc.text('Tutor Responsable:', { underline: true });
  doc.text(`Padre: ${tutor.nombre_padre} - Tel: ${tutor.telefono_padre}`);
  doc.text(`Madre: ${tutor.nombre_madre} - Tel: ${tutor.telefono_madre}`);
  doc.text(`Vive con: ${tutor.vive_con}`);
  doc.text(`Persona Emergencia: ${tutor.persona_emergencia?.nombre || ''} (${tutor.persona_emergencia?.parentesco || ''}) - Tel: ${tutor.persona_emergencia?.telefono || ''}`);

  doc.end();

  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => resolve(`/pdfs/${nombreArchivo}`));
    writeStream.on('error', reject);
  });
}

module.exports = generarPDF;
