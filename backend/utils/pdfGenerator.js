const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function generarPDF(datos, nombreArchivo = 'formulario_con_cuadricula.pdf') {
  const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
  const rutaPDF = path.join(__dirname, '../public/pdfs', nombreArchivo);
  const stream = fs.createWriteStream(rutaPDF);
  doc.pipe(stream);

  const alumno = datos.datos_alumno || {};
  const generales = datos.datos_generales || {};
  const medicos = datos.datos_medicos || {};
  const secundaria = datos.secundaria_origen || {};
  const tutor = datos.tutor_responsable || {};

  const logoPath = path.join(__dirname, '../public/images/logo.png');
  const footerPath = path.join(__dirname, '../public/images/firma_footer.png');

  const drawBox = (label, value, x, y, width = 240, height = 30) => {
    doc.lineWidth(0.5).strokeColor('#000').rect(x, y, width, height).stroke();
    doc.fontSize(8).fillColor('#333').text(label, x + 5, y + 2);
    doc.fontSize(10).fillColor('#000').text(value || '', x + 5, y + 14, { width: width - 10 });
  };

  const drawSectionTitle = (title, y) => {
    doc.rect(50, y, 500, 20).fill('#89042e');
    doc.fillColor('white').fontSize(12).text('  ' + title.toUpperCase(), 55, y + 5);
    doc.fillColor('black');
    return y + 30;
  };

  let y = 50;
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 50, y, { width: 500 });
    y += 80;
  }

  const marginX = 50;
  const gapY = 35;

  y = drawSectionTitle('Datos del Alumno', y);
  drawBox('Nombres', alumno.nombres, marginX, y);
  drawBox('Primer Apellido', alumno.primer_apellido, marginX + 260, y);
  y += gapY;
  drawBox('Segundo Apellido', alumno.segundo_apellido, marginX, y);
  drawBox('CURP', alumno.curp, marginX + 260, y);
  y += gapY;
  drawBox('Carrera', alumno.carrera, marginX, y);
  drawBox('Periodo Semestral', alumno.periodo_semestral, marginX + 260, y);
  y += gapY;
  drawBox('Semestre', alumno.semestre, marginX, y);
  drawBox('Grupo', alumno.grupo, marginX + 260, y);
  y += gapY;
  drawBox('Turno', alumno.turno, marginX, y);
  drawBox('Fecha de Nacimiento', alumno.fecha_nacimiento, marginX + 260, y);
  y += gapY;
  drawBox('Edad', alumno.edad, marginX, y);
  drawBox('Sexo', alumno.sexo, marginX + 260, y);
  y += gapY;
  drawBox('Estado Nacimiento', alumno.estado_nacimiento, marginX, y);
  drawBox('Municipio Nac.', alumno.municipio_nacimiento, marginX + 260, y);
  y += gapY;
  drawBox('Ciudad Nac.', alumno.ciudad_nacimiento, marginX, y);
  drawBox('Estado Civil', alumno.estado_civil, marginX + 260, y);
  y += gapY + 5;

  y = drawSectionTitle('Datos Generales', y);
  drawBox('Colonia', generales.colonia, marginX, y);
  drawBox('Domicilio', generales.domicilio, marginX + 260, y);
  y += gapY;
  drawBox('Código Postal', generales.codigo_postal, marginX, y);
  drawBox('Teléfono', generales.telefono_alumno, marginX + 260, y);
  y += gapY;
  drawBox('Correo Electrónico', generales.correo_alumno, marginX, y, 500);
  y += gapY;
  drawBox('Tipo Sangre', generales.tipo_sangre, marginX, y);
  drawBox('Paraescolar', generales.paraescolar, marginX + 260, y);
  y += gapY;
  drawBox('Contacto Emergencia', generales.contacto_emergencia_nombre, marginX, y);
  drawBox('Tel. Emergencia', generales.contacto_emergencia_telefono, marginX + 260, y);
  y += gapY;
  drawBox('Lengua Indígena', generales.habla_lengua_indigena?.respuesta, marginX, y);
  drawBox('¿Cuál?', generales.habla_lengua_indigena?.cual, marginX + 260, y);
  y += gapY + 5;

  y = drawSectionTitle('Datos Médicos', y);
  drawBox('Número Seguro Social', medicos.numero_seguro_social, marginX, y);
  drawBox('Unidad Médica', medicos.unidad_medica_familiar, marginX + 260, y);
  y += gapY;
  drawBox('¿Alergia o Enfermedad?', medicos.enfermedad_cronica_o_alergia?.respuesta, marginX, y);
  drawBox('Detalle', medicos.enfermedad_cronica_o_alergia?.detalle, marginX + 260, y);
  y += gapY;
  drawBox('Discapacidad', medicos.discapacidad, marginX, y);
  y += gapY + 5;

  y = drawSectionTitle('Secundaria de Origen', y);
  drawBox('Nombre Secundaria', secundaria.nombre_secundaria, marginX, y);
  drawBox('Régimen', secundaria.regimen, marginX + 260, y);
  y += gapY;
  drawBox('Promedio', secundaria.promedio_general, marginX, y);
  drawBox('Modalidad', secundaria.modalidad, marginX + 260, y);
  y += gapY + 5;

  y = drawSectionTitle('Tutor Responsable', y);
  drawBox('Nombre del Padre', tutor.nombre_padre, marginX, y);
  drawBox('Tel. Padre', tutor.telefono_padre, marginX + 260, y);
  y += gapY;
  drawBox('Nombre de la Madre', tutor.nombre_madre, marginX, y);
  drawBox('Tel. Madre', tutor.telefono_madre, marginX + 260, y);
  y += gapY;
  drawBox('Vive con', tutor.vive_con, marginX, y);
  y += gapY;
  drawBox('Persona Emergencia', tutor.persona_emergencia?.nombre, marginX, y);
  drawBox('Parentesco', tutor.persona_emergencia?.parentesco, marginX + 260, y);
  y += gapY;
  drawBox('Tel. Persona Emergencia', tutor.persona_emergencia?.telefono, marginX, y);
  y += gapY + 10;

  if (fs.existsSync(footerPath)) {
    const espacio = doc.page.height - y;
    if (espacio < 180) {
      doc.addPage();
      y = 50;
    }
    doc.image(footerPath, 50, y, { width: 500 });
  }

  doc.end();
  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(`/pdfs/${nombreArchivo}`));
    stream.on('error', reject);
  });
}

module.exports = generarPDF;
