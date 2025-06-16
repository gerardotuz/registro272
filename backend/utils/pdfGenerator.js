
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const catalogo = require(path.join(__dirname, '../public/data/catalogo.json'));

function generarPDF(datos, nombreArchivo = 'formulario_completo.pdf') {
  const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
  const rutaPDF = path.join(__dirname, '../public/pdfs', nombreArchivo);
  const stream = fs.createWriteStream(rutaPDF);
  doc.pipe(stream);

  const alumno = datos.datos_alumno || {};
  const generales = datos.datos_generales || {};
  const medicos = datos.datos_medicos || {};
  const secundaria = datos.secundaria_origen || {};
  const tutor = datos.tutor_responsable || {};

  const estado = catalogo.estados.find(e => e.clave === alumno.estado_nacimiento);
  const municipio = estado?.municipios.find(m => m.clave === alumno.municipio_nacimiento);
  const ciudad = municipio?.localidades.find(c => c.clave === alumno.ciudad_nacimiento);

  const getSafe = (val, fallback = '---') => (val !== undefined && val !== null && val !== '' ? val : fallback);

  function linea(titulo, valor) {
    doc.font('Helvetica-Bold').text(`${titulo}: `, { continued: true });
    doc.font('Helvetica').text(getSafe(valor));
  }

  doc.fontSize(14).text('Formulario de Registro de Alumno', { align: 'center' }).moveDown();

  linea('Folio', datos.folio);
  linea('Nombre completo', `${alumno.nombres} ${alumno.primer_apellido} ${alumno.segundo_apellido}`);
  linea('CURP', alumno.curp);
  linea('Carrera', alumno.carrera);
  linea('Semestre', alumno.semestre);
  linea('Turno', alumno.turno);
  linea('Fecha de nacimiento', alumno.fecha_nacimiento);
  linea('Edad', alumno.edad);
  linea('Sexo', alumno.sexo);
  linea('Estado de nacimiento', estado?.nombre || alumno.estado_nacimiento);
  linea('Municipio de nacimiento', municipio?.nombre || alumno.municipio_nacimiento);
  linea('Ciudad de nacimiento', ciudad?.nombre || alumno.ciudad_nacimiento);
  linea('Estado civil', alumno.estado_civil);
  doc.moveDown();

  linea('Colonia', generales.colonia);
  linea('Domicilio', generales.domicilio);
  linea('Código Postal', generales.codigo_postal);
  linea('Teléfono del alumno', generales.telefono_alumno);
  linea('Correo del alumno', generales.correo_alumno);
  linea('Paraescolar', generales.paraescolar);
  linea('Tipo de sangre', generales.tipo_sangre);
  linea('Contacto de emergencia', generales.contacto_emergencia_nombre);
  linea('Tel. de emergencia', generales.contacto_emergencia_telefono);
  linea('¿Habla lengua indígena?', generales.habla_lengua_indigena?.respuesta);
  linea('¿Cuál lengua?', generales.habla_lengua_indigena?.cual);
  doc.moveDown();

  linea('Número de seguro social', medicos.numero_seguro_social);
  linea('Unidad médica familiar', medicos.unidad_medica_familiar);
  linea('¿Tiene enfermedad o alergia?', medicos.enfermedad_cronica_o_alergia?.respuesta);
  linea('Detalle enfermedad o alergia', medicos.enfermedad_cronica_o_alergia?.detalle);
  linea('Discapacidad', medicos.discapacidad);
  doc.moveDown();

  linea('Nombre secundaria', secundaria.nombre_secundaria);
  linea('Régimen', secundaria.regimen);
  linea('Promedio general', secundaria.promedio_general);
  linea('Modalidad', secundaria.modalidad);
  doc.moveDown();

  linea('Nombre del padre', tutor.nombre_padre);
  linea('Teléfono del padre', tutor.telefono_padre);
  linea('Nombre de la madre', tutor.nombre_madre);
  linea('Teléfono de la madre', tutor.telefono_madre);
  linea('Vive con', tutor.vive_con);
  linea('Persona emergencia nombre', tutor.persona_emergencia?.nombre);
  linea('Persona emergencia parentesco', tutor.persona_emergencia?.parentesco);
  linea('Persona emergencia teléfono', tutor.persona_emergencia?.telefono);

  linea('Responsable emergencia adicional', tutor.responsable_emergencia_nombre);
  linea('Teléfono adicional', tutor.responsable_emergencia_telefono);
  linea('Parentesco adicional', tutor.responsable_emergencia_parentesco);
  linea('¿Entregó carta poder?', tutor.carta_poder);
  doc.moveDown();

  doc.end();
}

module.exports = generarPDF;
