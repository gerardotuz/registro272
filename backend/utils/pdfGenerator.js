

// ✅ backend/utils/pdfGenerator.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function generarPDF(datos, nombreArchivo = 'formulario.pdf') {
  return new Promise((resolve, reject) => {
    try {
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

      doc.fontSize(14).text('📝 CÉDULA DE INSCRIPCIÓN', { align: 'center' });
      doc.moveDown();

      doc.fontSize(10).text(`Nombre: ${alumno.nombres || ''} ${alumno.primer_apellido || ''} ${alumno.segundo_apellido || ''}`);
      doc.text(`CURP: ${alumno.curp || ''}`);
      doc.text(`Carrera: ${alumno.carrera || ''}`);
      doc.text(`Semestre: ${alumno.semestre || ''}, Turno: ${alumno.turno || ''}`);
      doc.text(`Fecha de nacimiento: ${alumno.fecha_nacimiento || ''} | Edad: ${alumno.edad || ''}`);
      doc.text(`Estado: ${alumno.estado_nacimiento || ''}, Municipio: ${alumno.municipio_nacimiento || ''}, Ciudad: ${alumno.ciudad_nacimiento || ''}`);
      doc.text(`Estado civil: ${alumno.estado_civil || ''}`);
      doc.moveDown();

      doc.text(`Colonia: ${generales.colonia || ''}`);
      doc.text(`Domicilio: ${generales.domicilio || ''}`);
      doc.text(`Código Postal: ${generales.codigo_postal || ''}`);
      doc.text(`Teléfono: ${generales.telefono_alumno || ''}`);
      doc.text(`Correo: ${generales.correo_alumno || ''}`);
      doc.text(`Paraescolar: ${generales.paraescolar || ''}`);
      doc.moveDown();

      doc.text(`Nombre Padre: ${tutor.nombre_padre || ''} Tel: ${tutor.telefono_padre || ''}`);
      doc.text(`Nombre Madre: ${tutor.nombre_madre || ''} Tel: ${tutor.telefono_madre || ''}`);
      doc.text(`Vive con: ${tutor.vive_con || ''}`);
      doc.moveDown();

      doc.text(`Contacto Emergencia: ${emergencia.nombre || ''} (${emergencia.parentesco || ''}) Tel: ${emergencia.telefono || ''}`);
      doc.moveDown();

      doc.text(`Seguro Social: ${medicos.numero_seguro_social || ''}`);
      doc.text(`Unidad Médica: ${medicos.unidad_medica_familiar || ''}`);
      doc.text(`Enfermedad o Alergia: ${medicos.enfermedad_cronica_o_alergia?.detalle || ''}`);
      doc.text(`Discapacidad: ${medicos.discapacidad || ''}`);
      doc.moveDown();

      doc.text(`Secundaria de Origen: ${secundaria.nombre_secundaria || ''}`);
      doc.text(`Promedio: ${secundaria.promedio_general || ''}, Modalidad: ${secundaria.modalidad || ''}`);

      doc.end();

      stream.on('finish', () => resolve(rutaPDF));
      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = generarPDF;


// ✅ server.js (solo línea clave de pdfs)
app.use('/pdfs', express.static(path.join(__dirname, 'public/pdfs')));

