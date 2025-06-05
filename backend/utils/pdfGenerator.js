const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function generarPDF(datos, nombreArchivo = 'formulario_estilizado.pdf') {
  const doc = new PDFDocument({ margin: 50 });
  const rutaPDF = path.join(__dirname, '../public/pdfs', nombreArchivo);
  const writeStream = fs.createWriteStream(rutaPDF);
  doc.pipe(writeStream);

  const alumno = datos.datos_alumno || {};
  const generales = datos.datos_generales || {};
  const medicos = datos.datos_medicos || {};
  const secundaria = datos.secundaria_origen || {};
  const tutor = datos.tutor_responsable || {};

  const logoPath = path.join(__dirname, '../public/images/logo.png');
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 50, 30, { width: 500 });
    doc.moveDown(4);
  }

  doc.fontSize(16).text('FICHA DE INSCRIPCIÓN', { align: 'center' });
  doc.moveDown();

  const seccion = (titulo) => {
    doc.moveDown().fontSize(12).fillColor('#ffffff')
      .rect(doc.x - 2, doc.y - 2, 500, 18).fill('#89042e').fillColor('#ffffff')
      .text(`  ${titulo}`, doc.x, doc.y, { continued: false })
      .fillColor('black').moveDown(0.5);
  };

  const campo = (label, valor) => {
    doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
    doc.font('Helvetica').text(valor || '---');
  };

  // DATOS DEL ALUMNO
  seccion('DATOS DEL ALUMNO');
  campo('Nombre completo', `${alumno.nombres} ${alumno.primer_apellido} ${alumno.segundo_apellido}`);
  campo('CURP', alumno.curp);
  campo('Carrera', alumno.carrera);
  campo('Semestre / Grupo / Turno', `${alumno.semestre} / ${alumno.grupo} / ${alumno.turno}`);
  campo('Fecha de Nacimiento / Edad / Sexo', `${alumno.fecha_nacimiento} / ${alumno.edad} / ${alumno.sexo}`);
  campo('Lugar de Nacimiento', `${alumno.estado_nacimiento}, ${alumno.municipio_nacimiento}, ${alumno.ciudad_nacimiento}`);
  campo('Estado Civil', alumno.estado_civil);

  // DATOS GENERALES
  seccion('DATOS GENERALES');
  campo('Domicilio', `${generales.domicilio}, ${generales.colonia}, CP: ${generales.codigo_postal}`);
  campo('Teléfono / Correo', `${generales.telefono_alumno} / ${generales.correo_alumno}`);
  campo('Paraescolar', generales.paraescolar);
  campo('Tipo de Sangre', generales.tipo_sangre);
  campo('Contacto Emergencia', `${generales.contacto_emergencia_nombre} - Tel: ${generales.contacto_emergencia_telefono}`);
  campo('Lengua Indígena', `${generales.habla_lengua_indigena?.respuesta || ''} / ${generales.habla_lengua_indigena?.cual || ''}`);

  // DATOS MÉDICOS
  seccion('DATOS MÉDICOS');
  campo('Número Seguro Social', medicos.numero_seguro_social);
  campo('Unidad Médica', medicos.unidad_medica_familiar);
  campo('Enfermedad o Alergia', `${medicos.enfermedad_cronica_o_alergia?.respuesta || ''} - ${medicos.enfermedad_cronica_o_alergia?.detalle || ''}`);
  campo('Discapacidad', medicos.discapacidad);

  // SECUNDARIA DE ORIGEN
  seccion('SECUNDARIA DE ORIGEN');
  campo('Nombre', secundaria.nombre_secundaria);
  campo('Régimen / Promedio / Modalidad', `${secundaria.regimen} / ${secundaria.promedio_general} / ${secundaria.modalidad}`);

  // TUTOR RESPONSABLE
  seccion('TUTOR RESPONSABLE');
  campo('Padre', `${tutor.nombre_padre} - Tel: ${tutor.telefono_padre}`);
  campo('Madre', `${tutor.nombre_madre} - Tel: ${tutor.telefono_madre}`);
  campo('Vive con', tutor.vive_con);
  campo('Persona Emergencia', `${tutor.persona_emergencia?.nombre || ''} (${tutor.persona_emergencia?.parentesco || ''}) - Tel: ${tutor.persona_emergencia?.telefono || ''}`);

  doc.end();

  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => resolve(`/pdfs/${nombreArchivo}`));
    writeStream.on('error', reject);
  });
}

module.exports = generarPDF;
