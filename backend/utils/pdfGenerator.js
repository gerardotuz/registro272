const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const catalogo = require('../public/data/catalogo.json');

function obtenerNombreDesdeCatalogo(tipo, codigo) {
  if (!codigo) return '---';
  switch (tipo) {
    case 'estado': {
      const estado = catalogo.estados.find(e => e.clave === codigo);
      return estado ? estado.nombre : '---';
    }
    case 'municipio': {
      for (const estado of catalogo.estados) {
        const municipio = estado.municipios.find(m => m.clave === codigo);
        if (municipio) return municipio.nombre;
      }
      return '---';
    }
    case 'ciudad': {
      for (const estado of catalogo.estados) {
        for (const municipio of estado.municipios) {
          const ciudad = municipio.localidades.find(l => l.clave === codigo);
          if (ciudad) return ciudad.nombre;
        }
      }
      return '---';
    }
    default:
      return '---';
  }
}

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

  const emergExtra = tutor.responsable_emergencia || {};
  const lengua = generales.habla_lengua_indigena || {};
  const alergia = medicos.enfermedad_cronica_o_alergia || {};
  const personaEmergencia = tutor.persona_emergencia || {};

  let y = 50;
  const GAP_Y = 20;
  const marginX = 50;

  const drawLine = () => {
    doc.moveTo(marginX, y).lineTo(550, y).stroke();
    y += 10;
  };

  const drawField = (label, value, indent = 0) => {
    doc.text(`${label}: ${value || '---'}`, marginX + indent, y);
    y += 16;
  };

  doc.fontSize(14).text('CÉDULA DE INSCRIPCIÓN', { align: 'center' });
  y += 30;
  drawLine();

  doc.fontSize(12).text('DATOS DEL ALUMNO', marginX, y); y += 20;
  drawField('Nombre', `${alumno.nombres || ''} ${alumno.primer_apellido || ''} ${alumno.segundo_apellido || ''}`);
  drawField('CURP', alumno.curp);
  drawField('Carrera', alumno.carrera);
  drawField('Periodo Semestral', alumno.periodo_semestral);
  drawField('Semestre', alumno.semestre);
  drawField('Grupo', alumno.grupo);
  drawField('Turno', alumno.turno);
  drawField('Fecha de Nacimiento', alumno.fecha_nacimiento);
  drawField('Edad', alumno.edad);
  drawField('Sexo', alumno.sexo);
  drawField('Nacionalidad', generales.nacionalidad || '---');
  drawField('País (si extranjero)', generales.pais_extranjero || '---');
  drawField('Estado de Nacimiento', obtenerNombreDesdeCatalogo('estado', alumno.estado_nacimiento));
  drawField('Municipio de Nacimiento', obtenerNombreDesdeCatalogo('municipio', alumno.municipio_nacimiento));
  drawField('Ciudad de Nacimiento', obtenerNombreDesdeCatalogo('ciudad', alumno.ciudad_nacimiento));
  drawField('Estado Civil', alumno.estado_civil);
  drawLine();

  doc.text('DATOS GENERALES', marginX, y); y += 20;
  drawField('Colonia', generales.colonia);
  drawField('Domicilio', generales.domicilio);
  drawField('Código Postal', generales.codigo_postal);
  drawField('Teléfono del Alumno', generales.telefono_alumno);
  drawField('Correo Electrónico', generales.correo_alumno);
  drawField('Paraescolar', generales.paraescolar);
  drawField('Tipo de Sangre', generales.tipo_sangre);
  drawField('Contacto de Emergencia', generales.contacto_emergencia_nombre);
  drawField('Teléfono Emergencia', generales.contacto_emergencia_telefono);
  drawField('¿Habla lengua indígena?', lengua.respuesta);
  drawField('¿Cuál?', lengua.cual);
  drawLine();

  doc.text('DATOS MÉDICOS', marginX, y); y += 20;
  drawField('NSS', medicos.numero_seguro_social);
  drawField('Unidad Médica', medicos.unidad_medica_familiar);
  drawField('¿Tiene enfermedad o alergia?', alergia.respuesta);
  drawField('Detalle enfermedad o alergia', alergia.detalle);
  drawField('Discapacidad', medicos.discapacidad);
  drawField('¿Entrega diagnóstico?', generales.entrega_diagnostico || '---');
  drawField('Detalle enfermedad', generales.detalle_enfermedad || '---');
  drawLine();

  doc.text('SECUNDARIA DE ORIGEN', marginX, y); y += 20;
  drawField('Nombre', secundaria.nombre_secundaria);
  drawField('Régimen', secundaria.regimen);
  drawField('Promedio', secundaria.promedio_general);
  drawField('Modalidad', secundaria.modalidad);
  drawLine();

  doc.text('TUTOR RESPONSABLE', marginX, y); y += 20;
  drawField('Padre', tutor.nombre_padre);
  drawField('Teléfono Padre', tutor.telefono_padre);
  drawField('Madre', tutor.nombre_madre);
  drawField('Teléfono Madre', tutor.telefono_madre);
  drawField('Vive con', tutor.vive_con);
  drawField('Persona Emergencia', personaEmergencia.nombre);
  drawField('Tel. Emergencia', personaEmergencia.telefono);
  drawField('Parentesco Emergencia', personaEmergencia.parentesco);
  drawLine();

  doc.text('RESPONSABLE DE EMERGENCIA ADICIONAL', marginX, y); y += 20;
  drawField('Nombre', emergExtra.nombre);
  drawField('Teléfono', emergExtra.telefono);
  drawField('Parentesco', emergExtra.parentesco);
  drawField('Carta Poder', emergExtra.carta_poder);
  drawLine();

  doc.end();
}

module.exports = generarPDF;
