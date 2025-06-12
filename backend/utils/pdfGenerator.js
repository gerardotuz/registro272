const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function generarPDF(datos, nombreArchivo = 'formulario_paginado.pdf') {
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

  const PAGE_HEIGHT = doc.page.height;
  const PAGE_WIDTH = doc.page.width;
  const BOTTOM_MARGIN = 80;
  const START_Y = 50;
  const BOX_HEIGHT = 30;
  const GAP_Y = 35;
  const marginX = 50;

  let y = START_Y;

  const drawBox = (label, value, x, y, width = 240, height = BOX_HEIGHT) => {
    if (y + height + BOTTOM_MARGIN > PAGE_HEIGHT) {
      doc.addPage();
      y = START_Y;
    }
    doc.lineWidth(0.5).strokeColor('#000').rect(x, y, width, height).stroke();
    doc.fontSize(8).fillColor('#333').text(label, x + 5, y + 2);
    doc.fontSize(10).fillColor('#000').text(value || '', x + 5, y + 14, { width: width - 10 });
    return y;
  };

  const drawSectionTitle = (title, y) => {
    if (y + 30 + BOTTOM_MARGIN > PAGE_HEIGHT) {
      doc.addPage();
      y = START_Y;
    }
    doc.rect(marginX, y, 500, 20).fill('#89042e');
    doc.fillColor('white').fontSize(12).text('  ' + title.toUpperCase(), marginX + 5, y + 5);
    doc.fillColor('black');
    return y + 30;
  };

  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 50, y, { width: 500 });
    y += 80;
  }

  y = drawSectionTitle('Datos del Alumno', y);
  y = drawBox('Nombres', alumno.nombres, marginX, y);
  y = drawBox('Primer Apellido', alumno.primer_apellido, marginX + 260, y);
  y += GAP_Y;
  y = drawBox('Segundo Apellido', alumno.segundo_apellido, marginX, y);
  y = drawBox('CURP', alumno.curp, marginX + 260, y);
  y += GAP_Y;
  y = drawBox('Carrera', alumno.carrera, marginX, y);
  y = drawBox('Periodo Semestral', alumno.periodo_semestral, marginX + 260, y);
  y += GAP_Y;
  y = drawBox('Semestre', alumno.semestre, marginX, y);
  y = drawBox('Grupo', alumno.grupo, marginX + 260, y);
  y += GAP_Y;
  y = drawBox('Turno', alumno.turno, marginX, y);
  y = drawBox('Fecha de Nacimiento', alumno.fecha_nacimiento, marginX + 260, y);
  y += GAP_Y;
  y = drawBox('Edad', alumno.edad, marginX, y);
  y = drawBox('Sexo', alumno.sexo, marginX + 260, y);
  y += GAP_Y;
  y = drawBox('Estado Nacimiento', alumno.estado_nacimiento, marginX, y);
  y = drawBox('Municipio Nac.', alumno.municipio_nacimiento, marginX + 260, y);
  y += GAP_Y;
  y = drawBox('Ciudad Nac.', alumno.ciudad_nacimiento, marginX, y);
  y = drawBox('Estado Civil', alumno.estado_civil, marginX + 260, y);
  y += GAP_Y;
  y = drawBox('Nacionalidad', alumno.nacionalidad, marginX, y);
  y = drawBox('País Extranjero', alumno.pais_extranjero, marginX + 260, y);
  y += GAP_Y;

  y = drawSectionTitle('Datos Generales', y);
  y = drawBox('Colonia', generales.colonia, marginX, y);
  y = drawBox('Domicilio', generales.domicilio, marginX + 260, y);
  y += GAP_Y;
  y = drawBox('Código Postal', generales.codigo_postal, marginX, y);
  y = drawBox('Teléfono', generales.telefono_alumno, marginX + 260, y);
  y += GAP_Y;
  y = drawBox('Correo Electrónico', generales.correo_alumno, marginX, y, 500);
  y += GAP_Y;
  y = drawBox('Tipo Sangre', generales.tipo_sangre, marginX, y);
  y = drawBox('Paraescolar', generales.paraescolar, marginX + 260, y);
  y += GAP_Y;
  y = drawBox('Contacto Emergencia', generales.contacto_emergencia_nombre, marginX, y);
  y = drawBox('Tel. Emergencia', generales.contacto_emergencia_telefono, marginX + 260, y);
  y += GAP_Y;
  y = drawBox('Lengua Indígena', generales.habla_lengua_indigena?.respuesta, marginX, y);
  y = drawBox('¿Cuál?', generales.habla_lengua_indigena?.cual, marginX + 260, y);
  y += GAP_Y;
  y = drawBox('¿Entrega Diagnóstico?', generales.entrega_diagnostico, marginX, y);
  y = drawBox('Detalle Enfermedad', generales.detalle_enfermedad, marginY + 500, y);
  y += GAP_Y;

  y = drawSectionTitle('Datos Médicos', y);
  y = drawBox('Número Seguro Social', medicos.numero_seguro_social, marginX, y);
  y = drawBox('Unidad Médica', medicos.unidad_medica_familiar, marginX + 260, y);
  y += GAP_Y;
  y = drawBox('¿Alergia o Enfermedad?', medicos.enfermedad_cronica_o_alergia?.respuesta, marginX, y);
  y = drawBox('Detalle', medicos.enfermedad_cronica_o_alergia?.detalle, marginX + 260, y);
  y += GAP_Y;
  y = drawBox('Discapacidad', medicos.discapacidad, marginX, y);
  y += GAP_Y;

  y = drawSectionTitle('Secundaria de Origen', y);
  y = drawBox('Nombre Secundaria', secundaria.nombre_secundaria, marginX, y);
  y = drawBox('Régimen', secundaria.regimen, marginX + 260, y);
  y += GAP_Y;
  y = drawBox('Promedio', secundaria.promedio_general, marginX, y);
  y = drawBox('Modalidad', secundaria.modalidad, marginX + 260, y);
  y += GAP_Y;

  y = drawSectionTitle('Tutor Responsable', y);
  y = drawBox('Nombre del Padre', tutor.nombre_padre, marginX, y);
  y = drawBox('Tel. Padre', tutor.telefono_padre, marginX + 260, y);
  y += GAP_Y;
  y = drawBox('Nombre de la Madre', tutor.nombre_madre, marginX, y);
  y = drawBox('Tel. Madre', tutor.telefono_madre, marginX + 260, y);
  y += GAP_Y;
  y = drawBox('Vive con', tutor.vive_con, marginX, y);
  y += GAP_Y;
  y = drawBox('Persona Emergencia', tutor.persona_emergencia?.nombre, marginX, y);
  y = drawBox('Parentesco', tutor.persona_emergencia?.parentesco, marginX + 260, y);
  y += GAP_Y;
  y = drawBox('Tel. Persona Emergencia', tutor.persona_emergencia?.telefono, marginX, y);
  y += GAP_Y;

  y = drawSectionTitle('Emergencia Adicional', y);
  y = drawBox('Nombre Emergencia Adic.', generales.responsable_emergencia?.nombre, marginX, y);
  y = drawBox('Tel. Emergencia Adic.', generales.responsable_emergencia?.telefono, marginX + 260, y);
  y += GAP_Y;
  y = drawBox('Parentesco Emergencia', generales.responsable_emergencia?.parentesco, marginX, y);
  y = drawBox('¿Carta Poder?', generales.carta_poder, marginX + 260, y);
  y += GAP_Y;

  if (fs.existsSync(footerPath)) {
    if (y + 100 > PAGE_HEIGHT) {
      doc.addPage();
      y = START_Y;
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
