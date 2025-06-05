const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function generarPDF(datos, nombreArchivo = 'formulario_generado.pdf') {
  const doc = new PDFDocument();
  const rutaPDF = path.join(__dirname, '../public/pdfs', nombreArchivo);
  const writeStream = fs.createWriteStream(rutaPDF);

  doc.pipe(writeStream);

  // Encabezado con logo ancho
  const logoPath = path.join(__dirname, '../public/images/logo.png');
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 40, 30, { width: 530 });
  }

  doc.moveDown(4);
  doc.fontSize(16).text('Formulario de Registro de Alumno', { align: 'center' });
  doc.moveDown(1);
  doc.fontSize(12);

  // Datos del alumno
  doc.text(`Nombre: ${datos.nombres} ${datos.primer_apellido} ${datos.segundo_apellido}`);
  doc.text(`CURP: ${datos.curp}`);
  doc.text(`Carrera: ${datos.carrera}`);
  doc.text(`Semestre: ${datos.semestre}  Grupo: ${datos.grupo}  Turno: ${datos.turno}`);
  doc.text(`Fecha de Nacimiento: ${datos.fecha_nacimiento}  Edad: ${datos.edad}  Sexo: ${datos.sexo}`);
  doc.moveDown();

  doc.text('Domicilio:', { underline: true });
  doc.text(`${datos.domicilio}, ${datos.colonia}, CP: ${datos.codigo_postal}`);
  doc.moveDown();

  doc.text('Contacto de Emergencia:', { underline: true });
  doc.text(`${datos.emergencia_nombre} - Tel: ${datos.emergencia_telefono}`);
  doc.moveDown();

  doc.text('Información Médica:', { underline: true });
  doc.text(`Tipo de sangre: ${datos.tipo_sangre}`);
  doc.text(`Enfermedades / Alergias: ${datos.alergias} (${datos.alergias_detalle})`);
  doc.text(`Discapacidad: ${datos.discapacidad}`);
  doc.moveDown();

  doc.text('Secundaria de Origen:', { underline: true });
  doc.text(`Nombre: ${datos.secundaria}  Régimen: ${datos.regimen}  Promedio: ${datos.promedio}`);
  doc.text(`Modalidad: ${datos.modalidad}`);
  doc.moveDown();

  doc.text('Tutor Responsable:', { underline: true });
  doc.text(`Padre: ${datos.padre} - Tel: ${datos.telefono_padre}`);
  doc.text(`Madre: ${datos.madre} - Tel: ${datos.telefono_madre}`);
  doc.text(`Vive con: ${datos.vive_con}`);
  doc.text(`Persona de Emergencia: ${datos.persona_emergencia} (${datos.parentesco_emergencia}) - Tel: ${datos.telefono_emergencia}`);

  doc.end();

  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => resolve(`/pdfs/${nombreArchivo}`));
    writeStream.on('error', reject);
  });
}

module.exports = generarPDF;
