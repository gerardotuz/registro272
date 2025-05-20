const express = require('express');
const router = express.Router();
const Alumno = require('../models/Alumno');
const PDFDocument = require('pdfkit');
const path = require('path');

// Ruta para generar PDF completo con fondo y todos los campos
router.get('/pdf/:folio', async (req, res) => {
  try {
    const alumno = await Alumno.findOne({ folio: req.params.folio });
    if (!alumno) return res.status(404).send('Folio no encontrado');

    const doc = new PDFDocument({ size: 'A4', margin: 0 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${req.params.folio}.pdf`);
    doc.pipe(res);

    const fondo1 = path.join(__dirname, '../assets/fondo1.png');
    const fondo2 = path.join(__dirname, '../assets/fondo2.png');
    const height = doc.page.height;

    // Página 1
    doc.image(fondo1, 0, 0, { width: doc.page.width });

    doc.fontSize(8).fillColor('black');

    const datos = alumno;

    doc.text(datos.datos_alumno?.primer_apellido || '', 70, height - 110);
    doc.text(datos.datos_alumno?.segundo_apellido || '', 180, height - 110);
    doc.text(datos.datos_alumno?.nombres || '', 300, height - 110);
    doc.text(datos.datos_alumno?.periodo_semestral || '', 70, height - 125);
    doc.text(datos.datos_alumno?.semestre || '', 150, height - 125);
    doc.text(datos.datos_alumno?.grupo || '', 180, height - 125);
    doc.text(datos.datos_alumno?.turno || '', 210, height - 125);
    doc.text(datos.datos_alumno?.carrera || '', 270, height - 125);
    doc.text(datos.datos_alumno?.curp || '', 70, height - 140);
    doc.text(datos.datos_alumno?.fecha_nacimiento || '', 200, height - 140);
    doc.text(datos.datos_alumno?.edad || '', 300, height - 140);
    doc.text(datos.datos_alumno?.sexo || '', 340, height - 140);
    doc.text(datos.datos_alumno?.estado_nacimiento || '', 70, height - 155);
    doc.text(datos.datos_alumno?.municipio_nacimiento || '', 180, height - 155);
    doc.text(datos.datos_alumno?.ciudad_nacimiento || '', 300, height - 155);
    doc.text(datos.datos_alumno?.estado_civil || '', 70, height - 170);

    doc.text(datos.datos_generales?.colonia || '', 70, height - 200);
    doc.text(datos.datos_generales?.domicilio || '', 200, height - 200);
    doc.text(datos.datos_generales?.codigo_postal || '', 350, height - 200);
    doc.text(datos.datos_generales?.telefono_alumno || '', 70, height - 215);
    doc.text(datos.datos_generales?.correo_alumno || '', 200, height - 215);
    doc.text(datos.datos_generales?.tipo_sangre || '', 70, height - 230);
    doc.text(datos.datos_generales?.contacto_emergencia_nombre || '', 200, height - 230);
    doc.text(datos.datos_generales?.contacto_emergencia_telefono || '', 340, height - 230);
    doc.text(datos.datos_generales?.habla_lengua_indigena?.respuesta || '', 70, height - 245);
    doc.text(datos.datos_generales?.habla_lengua_indigena?.cual || '', 120, height - 245);

    doc.text(datos.datos_medicos?.numero_seguro_social || '', 70, height - 270);
    doc.text(datos.datos_medicos?.unidad_medica_familiar || '', 200, height - 270);
    doc.text(datos.datos_medicos?.enfermedad_cronica_o_alergia?.respuesta || '', 70, height - 285);
    doc.text(datos.datos_medicos?.enfermedad_cronica_o_alergia?.detalle || '', 120, height - 285);
    doc.text(datos.datos_medicos?.discapacidad || '', 70, height - 300);

    doc.addPage().image(fondo2, 0, 0, { width: doc.page.width });

    doc.text(datos.secundaria_origen?.nombre_secundaria || '', 70, height - 100);
    doc.text(datos.secundaria_origen?.regimen || '', 200, height - 100);
    doc.text(datos.secundaria_origen?.promedio_general?.toString() || '', 300, height - 100);
    doc.text(datos.secundaria_origen?.modalidad || '', 70, height - 115);

    doc.text(datos.tutor_responsable?.nombre_padre || '', 70, height - 145);
    doc.text(datos.tutor_responsable?.telefono_padre || '', 250, height - 145);
    doc.text(datos.tutor_responsable?.nombre_madre || '', 70, height - 160);
    doc.text(datos.tutor_responsable?.telefono_madre || '', 250, height - 160);
    doc.text(datos.tutor_responsable?.vive_con || '', 70, height - 175);
    doc.text(datos.tutor_responsable?.persona_emergencia?.nombre || '', 70, height - 190);
    doc.text(datos.tutor_responsable?.persona_emergencia?.parentesco || '', 200, height - 190);
    doc.text(datos.tutor_responsable?.persona_emergencia?.telefono || '', 300, height - 190);

    doc.end();
  } catch (err) {
    console.error('Error al generar PDF:', err);
    res.status(500).send('Error al generar el PDF');
  }
});

module.exports = router;
