const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function generarPDF(datos, nombreArchivo = 'formulario_final_corregido.pdf') {
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

  const drawField = (label, value, x, y, width = 220, height = 28) => {
    doc.fontSize(8).fillColor('#000').text(label, x + 2, y - 10);
    doc.rect(x, y, width, height).stroke();
    doc.fontSize(10).text(value || '', x + 5, y + 8, { width: width - 10 });
  };

  const drawSection = (title, y) => {
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

  // DATOS DEL ALUMNO
  y = drawSection('Datos del Alumno', y);
  drawField('Nombres', alumno.nombres, 50, y);
  drawField('Primer Apellido', alumno.primer_apellido, 300, y);
  y += 35;
  drawField('Segundo Apellido', alumno.segundo_apellido, 50, y);
  drawField('CURP', alumno.curp, 300, y);
  y += 35;
  drawField('Carrera', alumno.carrera, 50, y);
  drawField('Periodo Semestral', alumno.periodo_semestral, 300, y);
  y += 35;
  drawField('Semestre', alumno.semestre, 50, y);
  drawField('Grupo', alumno.grupo, 300, y);
  y += 35;
  drawField('Turno', alumno.turno, 50, y);
  drawField('Fecha de Nacimiento', alumno.fecha_nacimiento, 300, y);
  y += 35;
  drawField('Edad', alumno.edad, 50, y);
  drawField('Sexo', alumno.sexo, 300, y);
  y += 35;
  drawField('Estado Nacimiento', alumno.estado_nacimiento, 50, y);
  drawField('Municipio Nac.', alumno.municipio_nacimiento, 300, y);
  y += 35;
  drawField('Ciudad Nac.', alumno.ciudad_nacimiento, 50, y);
  drawField('Estado Civil', alumno.estado_civil, 300, y);
  y += 45;

  // DATOS GENERALES
  y = drawSection('Datos Generales', y);
  drawField('Colonia', generales.colonia, 50, y);
  drawField('Domicilio', generales.domicilio, 300, y);
  y += 35;
  drawField('Código Postal', generales.codigo_postal, 50, y);
  drawField('Teléfono', generales.telefono_alumno, 300, y);
  y += 35;
  drawField('Correo Electrónico', generales.correo_alumno, 50, y, 470);
  y += 35;
  drawField('Tipo Sangre', generales.tipo_sangre, 50, y);
  drawField('Paraescolar', generales.paraescolar, 300, y);
  y += 35;
  drawField('Contacto Emergencia', generales.contacto_emergencia_nombre, 50, y);
  drawField('Tel. Emergencia', generales.contacto_emergencia_telefono, 300, y);
  y += 35;
  drawField('Lengua Indígena', generales.habla_lengua_indigena?.respuesta, 50, y);
  drawField('¿Cuál?', generales.habla_lengua_indigena?.cual, 300, y);
  y += 45;

  // DATOS MÉDICOS
  y = drawSection('Datos Médicos', y);
  drawField('Número Seguro Social', medicos.numero_seguro_social, 50, y);
  drawField('Unidad Médica', medicos.unidad_medica_familiar, 300, y);
  y += 35;
  drawField('¿Alergia o Enfermedad?', medicos.enfermedad_cronica_o_alergia?.respuesta, 50, y);
  drawField('Detalle', medicos.enfermedad_cronica_o_alergia?.detalle, 300, y);
  y += 35;
  drawField('Discapacidad', medicos.discapacidad, 50, y);
  y += 45;

  // SECUNDARIA
  y = drawSection('Secundaria de Origen', y);
  drawField('Nombre Secundaria', secundaria.nombre_secundaria, 50, y);
  drawField('Régimen', secundaria.regimen, 300, y);
  y += 35;
  drawField('Promedio', secundaria.promedio_general, 50, y);
  drawField('Modalidad', secundaria.modalidad, 300, y);
  y += 45;

  // TUTOR
  y = drawSection('Tutor Responsable', y);
  drawField('Nombre del Padre', tutor.nombre_padre, 50, y);
  drawField('Tel. Padre', tutor.telefono_padre, 300, y);
  y += 35;
  drawField('Nombre de la Madre', tutor.nombre_madre, 50, y);
  drawField('Tel. Madre', tutor.telefono_madre, 300, y);
  y += 35;
  drawField('Vive con', tutor.vive_con, 50, y);
  y += 35;
  drawField('Persona Emergencia', tutor.persona_emergencia?.nombre, 50, y);
  drawField('Parentesco', tutor.persona_emergencia?.parentesco, 300, y);
  y += 35;
  drawField('Tel. Persona Emergencia', tutor.persona_emergencia?.telefono, 50, y);
  y += 50;

  if (fs.existsSync(footerPath)) {
    const espacio = doc.page.height - y;
    if (espacio < 250) {
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
