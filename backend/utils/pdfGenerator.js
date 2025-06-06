const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function generarPDF(datos, nombreArchivo = 'formulario_con_recuadros_alineado.pdf') {
  const doc = new PDFDocument({ margin: 50 });
  const rutaPDF = path.join(__dirname, '../public/pdfs', nombreArchivo);
  const stream = fs.createWriteStream(rutaPDF);
  doc.pipe(stream);

  const alumno = datos.datos_alumno || {};
  const generales = datos.datos_generales || {};
  const medicos = datos.datos_medicos || {};
  const secundaria = datos.secundaria_origen || {};
  const tutor = datos.tutor_responsable || {};

  const drawField = (label, value, x, y, width = 180, height = 30) => {
    doc.fontSize(9).fillColor('#000').text(label, x + 3, y - 10);
    doc.rect(x, y, width, height).stroke();
    doc.fontSize(10).text(value || '', x + 5, y + 8, { width: width - 10, height: height - 10 });
  };

  const drawSectionTitle = (title, y) => {
    doc.rect(50, y, 500, 20).fill('#89042e');
    doc.fillColor('white').fontSize(12).text('  ' + title, 55, y + 5);
    doc.fillColor('black');
    return y + 30;
  };

  let y = 50;
  const logoPath = path.join(__dirname, '../public/images/logo.png');
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 50, y, { width: 500 });
    y += 80;
  }

  y = drawSectionTitle('Datos del Alumno', y);
  drawField('Nombres', alumno.nombres, 50, y);
  drawField('Primer Apellido', alumno.primer_apellido, 250, y);
  drawField('Segundo Apellido', alumno.segundo_apellido, 400, y);
  y += 40;

  drawField('CURP', alumno.curp, 50, y);
  drawField('Carrera', alumno.carrera, 250, y);
  drawField('Escuela', alumno.escuela || 'BENITO JUÁREZ / CBTIS NO. 272', 400, y);
  y += 40;

  drawField('Periodo Semestral', alumno.periodo_semestral, 50, y);
  drawField('Semestre', alumno.semestre, 200, y);
  drawField('Grupo', alumno.grupo, 300, y);
  drawField('Turno', alumno.turno, 400, y);
  y += 40;

  drawField('Fecha de Nacimiento', alumno.fecha_nacimiento, 50, y);
  drawField('Edad', alumno.edad, 200, y);
  drawField('Sexo', alumno.sexo, 300, y);
  drawField('Estado Nac.', alumno.estado_nacimiento, 400, y);
  y += 40;

  drawField('Municipio Nac.', alumno.municipio_nacimiento, 50, y);
  drawField('Ciudad Nac.', alumno.ciudad_nacimiento, 250, y);
  drawField('Estado Civil', alumno.estado_civil, 400, y);
  y += 50;

  y = drawSectionTitle('Datos Generales', y);
  drawField('Colonia', generales.colonia, 50, y);
  drawField('Domicilio', generales.domicilio, 250, y);
  drawField('Código Postal', generales.codigo_postal, 400, y);
  y += 40;

  drawField('Teléfono', generales.telefono_alumno, 50, y);
  drawField('Correo Electrónico', generales.correo_alumno, 250, y);
  y += 40;

  drawField('Tipo Sangre', generales.tipo_sangre, 50, y);
  drawField('Contacto Emergencia', generales.contacto_emergencia_nombre, 200, y);
  drawField('Tel. Emergencia', generales.contacto_emergencia_telefono, 400, y);
  y += 40;

  drawField('¿Habla Lengua Indígena?', generales.habla_lengua_indigena?.respuesta || '', 50, y);
  drawField('¿Cuál?', generales.habla_lengua_indigena?.cual || '', 250, y);
  y += 50;

  y = drawSectionTitle('Datos Médicos', y);
  drawField('Número de Seguro', medicos.numero_seguro_social, 50, y);
  drawField('Unidad Médica', medicos.unidad_medica_familiar, 250, y);
  y += 40;

  drawField('¿Alergia/Enfermedad?', medicos.enfermedad_cronica_o_alergia?.respuesta || '', 50, y);
  drawField('Especifique', medicos.enfermedad_cronica_o_alergia?.detalle || '', 250, y);
  drawField('Discapacidad', medicos.discapacidad, 400, y);
  y += 50;

  y = drawSectionTitle('Secundaria de Origen', y);
  drawField('Nombre', secundaria.nombre_secundaria, 50, y);
  drawField('Régimen', secundaria.regimen, 250, y);
  drawField('Promedio', secundaria.promedio_general, 400, y);
  y += 40;
  drawField('Modalidad', secundaria.modalidad, 50, y);
  y += 50;

  y = drawSectionTitle('Tutor Responsable', y);
  drawField('Nombre Padre', tutor.nombre_padre, 50, y);
  drawField('Tel. Padre', tutor.telefono_padre, 250, y);
  drawField('Nombre Madre', tutor.nombre_madre, 400, y);
  y += 40;

  drawField('Tel. Madre', tutor.telefono_madre, 50, y);
  drawField('Vive con', tutor.vive_con, 250, y);
  y += 40;

  drawField('Nombre Persona Emergencia', tutor.persona_emergencia?.nombre, 50, y);
  drawField('Parentesco', tutor.persona_emergencia?.parentesco, 250, y);
  drawField('Tel. Emergencia', tutor.persona_emergencia?.telefono, 400, y);
  y += 40;

  y = drawSectionTitle('Selecciona un Paraescolar', y);
  drawField('Paraescolar', generales.paraescolar, 50, y, 500, 30);
  y += 60;

  // Agregar imagen de firma si hay espacio, si no, agregar nueva página
  const firmaFooter = path.join(__dirname, '../public/images/firma_footer.png');
  if (fs.existsSync(firmaFooter)) {
    const espacioRestante = doc.page.height - y - 100;
    if (espacioRestante < 200) {
      doc.addPage();
      y = 50;
    }
    doc.image(firmaFooter, 50, y, { width: 500 });
  }

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(`/pdfs/${nombreArchivo}`));
    stream.on('error', reject);
  });
}

module.exports = generarPDF;
