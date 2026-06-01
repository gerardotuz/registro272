const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const catalogoPath = path.resolve(__dirname, './catalogo.json');
const catalogo = JSON.parse(fs.readFileSync(catalogoPath, 'utf8'));

function obtenerNombresDesdeCatalogo(estadoClave, municipioClave, ciudadClave) {
  const estado = catalogo.find((e) => String(e.clave) === String(estadoClave));
  if (!estado) return { estado: '', municipio: '', ciudad: '' };

  const municipio = estado.municipios.find((m) => String(m.clave) === String(municipioClave) || m.nombre === municipioClave);
  const localidad = municipio?.localidades?.find((l) => String(l.clave) === String(ciudadClave) || l.nombre === ciudadClave);

  return {
    estado: estado.nombre || '',
    municipio: municipio?.nombre || '',
    ciudad: localidad?.nombre || ''
  };
}

async function generarPDF(datos, nombreArchivo = 'formulario.pdf') {
  const rutaPDF = path.join(__dirname, '../public/pdfs', nombreArchivo);
  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
  const stream = fs.createWriteStream(rutaPDF);
  doc.pipe(stream);

  const alumno = datos.datos_alumno || {};
  const generales = datos.datos_generales || {};
  const medicos = datos.datos_medicos || {};
  const secundaria = datos.secundaria_origen || {};
  const tutor = datos.tutor_responsable || {};
  const emergencia = datos.persona_emergencia || {};

  const logoPath = path.join(__dirname, '../public/images/logo.png');
  const footerPath = path.join(__dirname, '../public/images/firma_footer.png');

  const PAGE_HEIGHT = doc.page.height;
  const BOTTOM_MARGIN = 80;
  const START_Y = 50;
  const BOX_HEIGHT = 30;
  const GAP_Y = 35;
  const marginX = 50;

  const nacimiento = obtenerNombresDesdeCatalogo(alumno.estado_nacimiento, alumno.municipio_nacimiento, alumno.ciudad_nacimiento);
  const residencia = obtenerNombresDesdeCatalogo(generales.estado_nacimiento_general, generales.municipio_nacimiento_general, generales.ciudad_nacimiento_general);

  const estadoCivilTexto = {
    '1': 'Soltero', '2': 'Casado', '3': 'Unión Libre', '4': 'Divorciado', '5': 'Viudo'
  }[String(alumno.estado_civil)] || alumno.estado_civil;

  let y = START_Y;

  const drawBox = (label, value, x, yPos, width = 240, height = BOX_HEIGHT) => {
    let yy = yPos;
    if (yy + height + BOTTOM_MARGIN > PAGE_HEIGHT) {
      doc.addPage();
      yy = START_Y;
    }
    doc.lineWidth(0.5).strokeColor('#000').rect(x, yy, width, height).stroke();
    doc.fontSize(8).fillColor('#333').text(label, x + 5, yy + 2);
    doc.fontSize(10).fillColor('#000').text(value ?? '', x + 5, yy + 14, { width: width - 10 });
    return yy;
  };

  const drawMultilineBox = (label, value, x, yPos, width = 240) => {
    const text = value || '';
    const textHeight = doc.heightOfString(text, { width: width - 10 });
    const height = textHeight + 24;
    let yy = yPos;
    if (yy + height + BOTTOM_MARGIN > PAGE_HEIGHT) {
      doc.addPage();
      yy = START_Y;
    }
    doc.lineWidth(0.5).strokeColor('#000').rect(x, yy, width, height).stroke();
    doc.fontSize(8).fillColor('#333').text(label, x + 5, yy + 2);
    doc.fontSize(10).fillColor('#000').text(text, x + 5, yy + 14, { width: width - 10 });
    return yy + height + 5;
  };

  const drawSectionTitle = (title, yPos) => {
    let yy = yPos;
    if (yy + 30 + BOTTOM_MARGIN > PAGE_HEIGHT) {
      doc.addPage();
      yy = START_Y;
    }
    doc.rect(marginX, yy, 500, 20).fill('#89042e');
    doc.fillColor('white').fontSize(12).text(`  ${title.toUpperCase()}`, marginX + 5, yy + 5);
    doc.fillColor('black');
    return yy + 30;
  };

  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 50, y, { width: 500 });
    y += 65;
  }

  const folioBoxX = 340;
  const folioBoxY = y - 5;
  doc.lineWidth(2).strokeColor('#7A1E2C').roundedRect(folioBoxX, folioBoxY, 210, 38, 10).stroke();
  doc.fontSize(16).fillColor('#7A1E2C').font('Helvetica-Bold').text(datos.folio || '', folioBoxX, folioBoxY + 10, { width: 210, align: 'center' });
  doc.font('Helvetica').fillColor('black');
  y += 45;

  y = drawSectionTitle('Datos del Alumno', y + 10);
  y = drawBox('Nombres', alumno.nombres, marginX, y);
  y = drawBox('Primer Apellido', alumno.primer_apellido, marginX + 260, y); y += GAP_Y;
  y = drawBox('Segundo Apellido', alumno.segundo_apellido, marginX, y);
  y = drawBox('CURP', alumno.curp, marginX + 260, y); y += GAP_Y;
  y = drawBox('Carrera', alumno.carrera, marginX, y);
  y = drawBox('Periodo Semestral', alumno.periodo_semestral, marginX + 260, y); y += GAP_Y;
  y = drawBox('Semestre', alumno.semestre, marginX, y);
  y = drawBox('Grupo', alumno.grupo, marginX + 260, y); y += GAP_Y;
  y = drawBox('Turno', alumno.turno, marginX, y);
  y = drawBox('Estado Civil', estadoCivilTexto, marginX + 260, y); y += GAP_Y;
  y = drawBox('Nacionalidad', alumno.nacionalidad, marginX, y);
  y = drawBox('País extranjero', alumno.pais_extranjero, marginX + 260, y); y += GAP_Y;
  y = drawBox('Fecha de Nacimiento', alumno.fecha_nacimiento, marginX, y);
  y = drawBox('Edad', alumno.edad, marginX + 260, y); y += GAP_Y;
  y = drawBox('Sexo', alumno.sexo, marginX, y);
  y = drawBox('Estado de Nacimiento', nacimiento.estado, marginX + 260, y); y += GAP_Y;
  y = drawBox('Municipio de Nacimiento', nacimiento.municipio, marginX, y);
  y = drawBox('Ciudad de Nacimiento', nacimiento.ciudad, marginX + 260, y); y += GAP_Y;
  y = drawBox('Primera Opción', generales.primera_opcion, marginX, y);
  y = drawBox('Segunda Opción', generales.segunda_opcion, marginX + 260, y); y += GAP_Y;
  y = drawBox('Tercera Opción', generales.tercera_opcion, marginX, y);
  y = drawBox('Cuarta Opción', generales.cuarta_opcion, marginX + 260, y); y += GAP_Y;
  y = drawBox('Quinta Opción', generales.quinta_opcion, marginX, y); y += GAP_Y;

  y = drawSectionTitle('Datos Generales', y);
  y = drawBox('Colonia', generales.colonia, marginX, y);
  y = drawBox('Domicilio', generales.domicilio, marginX + 260, y); y += GAP_Y;
  y = drawBox('Código Postal', generales.codigo_postal, marginX, y);
  y = drawBox('Teléfono Alumno', generales.telefono_alumno, marginX + 260, y); y += GAP_Y;
  y = drawBox('Correo Alumno', generales.correo_alumno, marginX, y, 500); y += GAP_Y;
  y = drawBox('Tipo de Sangre', generales.tipo_sangre, marginX, y);
  y = drawBox('Paraescolar', generales.paraescolar, marginX + 260, y); y += GAP_Y;
  y = drawBox('Contacto Emergencia', generales.contacto_emergencia_nombre, marginX, y);
  y = drawBox('Tel. Emergencia', generales.contacto_emergencia_telefono, marginX + 260, y); y += GAP_Y;
  y = drawBox('¿Lengua indígena?', generales.habla_lengua_indigena?.respuesta, marginX, y);
  y = drawBox('¿Cuál lengua?', generales.habla_lengua_indigena?.cual, marginX + 260, y); y += GAP_Y;
  y = drawBox('Hermanos activos', generales.hermanos_activos, marginX, y); y += GAP_Y;

  y = drawSectionTitle('Estado de Residencia', y);
  y = drawBox('Estado', residencia.estado, marginX, y);
  y = drawBox('Municipio', residencia.municipio, marginX + 260, y); y += GAP_Y;
  y = drawBox('Ciudad', residencia.ciudad, marginX, y); y += GAP_Y;

  y = drawSectionTitle('Datos Médicos', y);
  y = drawBox('NSS', medicos.numero_seguro_social, marginX, y);
  y = drawBox('Unidad Médica', medicos.unidad_medica_familiar, marginX + 260, y); y += GAP_Y;
  y = drawBox('¿Enfermedad/Alergia?', medicos.enfermedad_cronica_o_alergia?.respuesta, marginX, y);
  y = drawMultilineBox('Detalle enfermedad/alergia', medicos.enfermedad_cronica_o_alergia?.detalle, marginX + 260, y);
  y = drawBox('Discapacidad', medicos.discapacidad, marginX, y);
  y = drawBox('¿Entrega diagnóstico?', generales.entrega_diagnostico, marginX + 260, y); y += GAP_Y;
  y = drawMultilineBox('Detalle enfermedad', generales.detalle_enfermedad, marginX, y, 500);

  y = drawSectionTitle('Secundaria de Origen', y);
  y = drawBox('Nombre secundaria', secundaria.nombre_secundaria, marginX, y);
  y = drawBox('CCT secundaria', secundaria.cct_secundaria, marginX + 260, y); y += GAP_Y;
  y = drawBox('Régimen', secundaria.regimen, marginX, y);
  y = drawBox('Modalidad', secundaria.modalidad, marginX + 260, y); y += GAP_Y;
  y = drawBox('Participaciones', secundaria.participaciones_secundaria, marginX, y);
  y = drawBox('Promedio general', secundaria.promedio_general, marginX + 260, y); y += GAP_Y;

  y = drawSectionTitle('Tutor Responsable', y);
  y = drawBox('Nombre padre', tutor.nombre_padre, marginX, y);
  y = drawBox('Teléfono padre', tutor.telefono_padre, marginX + 260, y); y += GAP_Y;
  y = drawBox('Nombre madre', tutor.nombre_madre, marginX, y);
  y = drawBox('Teléfono madre', tutor.telefono_madre, marginX + 260, y); y += GAP_Y;
  y = drawBox('Vive con', tutor.vive_con, marginX, y);
  y = drawBox('Carta poder', generales.carta_poder, marginX + 260, y); y += GAP_Y;
  y = drawBox('Resp. Emergencia adicional', generales.responsable_emergencia?.nombre, marginX, y);
  y = drawBox('Tel. adicional', generales.responsable_emergencia?.telefono, marginX + 260, y); y += GAP_Y;
  y = drawBox('Parentesco adicional', generales.responsable_emergencia?.parentesco, marginX, y); y += GAP_Y;

  y = drawSectionTitle('Persona de Emergencia', y);
  y = drawBox('Nombre', emergencia.nombre, marginX, y);
  y = drawBox('Parentesco', emergencia.parentesco, marginX + 260, y); y += GAP_Y;
  y = drawBox('Teléfono', emergencia.telefono, marginX, y); y += GAP_Y;

 
y = drawSectionTitle('', y);
   if (fs.existsSync(footerPath)) {
    if (y + 100 > PAGE_HEIGHT) {
      doc.addPage();
      y = START_Y;
    }
    doc.image(footerPath, 50, y, { width: 500 });
  }
  
  doc.flushPages();
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(8).fillColor('gray').text(`Página ${i + 1} de ${range.count}`, 50, doc.page.height - 40, {
      align: 'center',
      width: doc.page.width - 100
    });
  }

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(`/pdfs/${nombreArchivo}`));
    stream.on('error', reject);
  });
}

module.exports = generarPDF;
