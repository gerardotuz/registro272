const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Cargar el catálogo plano
const catalogo = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../public/data/catalogo.json'), 'utf8')
);

// Función para buscar en el catálogo plano
function obtenerNombreDesdeCatalogo(estado, municipio, localidad) {
  const coincidencias = catalogo.filter(r =>
    r.estado === estado &&
    r.municipio === municipio &&
    r.localidad === localidad
  );

  return {
    estado: estado || '',
    municipio: municipio || '',
    ciudad: (coincidencias[0]?.localidad || localidad || '')
  };
}

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
  const personaEmergencia = datos.persona_emergencia || {};

  const lugar = obtenerNombreDesdeCatalogo(
    alumno.estado_nacimiento,
    alumno.municipio_nacimiento,
    alumno.ciudad_nacimiento
  );

  // Título
  doc.fontSize(18).text('CÉDULA DE INSCRIPCIÓN', { align: 'center' });
  doc.moveDown();

  // Datos personales
  doc.fontSize(12).text(`Nombre: ${alumno.nombres} ${alumno.primer_apellido} ${alumno.segundo_apellido}`);
  doc.text(`CURP: ${alumno.curp}`);
  doc.text(`Carrera: ${alumno.carrera}`);
  doc.text(`Turno: ${alumno.turno}`);
  doc.text(`Fecha de nacimiento: ${alumno.fecha_nacimiento}`);
  doc.text(`Edad: ${alumno.edad}`);
  doc.text(`Sexo: ${alumno.sexo}`);
  doc.text(`Estado civil: ${alumno.estado_civil}`);
  doc.text(`Lugar de nacimiento: ${lugar.estado}, ${lugar.municipio}, ${lugar.ciudad}`);
  doc.moveDown();

  // Datos de contacto
  doc.text(`Teléfono: ${generales.telefono_alumno}`);
  doc.text(`Correo: ${generales.correo_alumno}`);
  doc.text(`Colonia: ${generales.colonia}`);
  doc.text(`Domicilio: ${generales.domicilio}`);
  doc.text(`Código postal: ${generales.codigo_postal}`);
  doc.moveDown();

  // Datos médicos
  doc.text(`Tipo de sangre: ${generales.tipo_sangre}`);
  doc.text(`Seguro Social: ${medicos.numero_seguro_social}`);
  doc.text(`Unidad Médica Familiar: ${medicos.unidad_medica_familiar}`);
  doc.text(`¿Enfermedad o alergia?: ${medicos.enfermedad_cronica_o_alergia?.respuesta}`);
  doc.text(`Detalle enfermedad/alergia: ${medicos.enfermedad_cronica_o_alergia?.detalle}`);
  doc.text(`Discapacidad: ${medicos.discapacidad}`);
  doc.moveDown();

  // Secundaria de origen
  doc.text(`Secundaria: ${secundaria.nombre_secundaria}`);
  doc.text(`Régimen: ${secundaria.regimen}`);
  doc.text(`Promedio: ${secundaria.promedio_general}`);
  doc.text(`Modalidad: ${secundaria.modalidad}`);
  doc.moveDown();

  // Datos del tutor
  doc.text(`Nombre del padre: ${tutor.nombre_padre} (${tutor.telefono_padre})`);
  doc.text(`Nombre de la madre: ${tutor.nombre_madre} (${tutor.telefono_madre})`);
  doc.text(`Vive con: ${tutor.vive_con}`);
  doc.moveDown();

  // Contacto de emergencia
  doc.text(`Persona de emergencia: ${personaEmergencia.nombre}`);
  doc.text(`Parentesco: ${personaEmergencia.parentesco}`);
  doc.text(`Teléfono: ${personaEmergencia.telefono}`);
  doc.moveDown();

  // Responsable de emergencia adicional
  doc.text(`Responsable adicional: ${generales.responsable_emergencia?.nombre}`);
  doc.text(`Teléfono: ${generales.responsable_emergencia?.telefono}`);
  doc.text(`Parentesco: ${generales.responsable_emergencia?.parentesco}`);
  doc.text(`Carta poder: ${generales.carta_poder}`);
  doc.moveDown();

  // Preferencias y diagnóstico
  doc.text(`Primera opción: ${alumno.primera_opcion}`);
  doc.text(`Segunda opción: ${alumno.segunda_opcion}`);
  doc.text(`Tercera opción: ${alumno.tercera_opcion}`);
  doc.text(`Cuarta opción: ${alumno.cuarta_opcion}`);
  doc.text(`Paraescolar: ${generales.paraescolar}`);
  doc.text(`Entrega diagnóstico: ${generales.entrega_diagnostico}`);
  doc.text(`Detalle enfermedad: ${generales.detalle_enfermedad}`);

  doc.end();
}

module.exports = generarPDF;

