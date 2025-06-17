
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const catalogo = require('../public/data/catalogo.json');

function obtenerNombreDesdeCatalogo(tipo, codigo) {
  if (!codigo) return '---';
  switch (tipo) {
    case 'estado':
      const estado = catalogo.estados.find(e => e.clave === codigo);
      return estado ? estado.nombre : '---';
    case 'municipio':
      for (const estado of catalogo.estados) {
        const municipio = estado.municipios.find(m => m.clave === codigo);
        if (municipio) return municipio.nombre;
      }
      return '---';
    case 'ciudad':
      for (const estado of catalogo.estados) {
        for (const municipio of estado.municipios) {
          const ciudad = municipio.localidades.find(l => l.clave === codigo);
          if (ciudad) return ciudad.nombre;
        }
      }
      return '---';
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
  const personaEmergencia = datos.persona_emergencia || {};
  const lengua = generales.habla_lengua_indigena || {};
  const alergia = medicos.enfermedad_cronica_o_alergia || {};
  const extra = generales.responsable_emergencia || {};

  const estadoCivilTexto = {
    1: 'Soltero',
    2: 'Casado',
    3: 'Unión libre',
    4: 'Otro'
  };

  let y = 50;
  const GAP_Y = 16;
  const marginX = 50;

  const drawField = (label, value) => {
    doc.text(`${label}: ${value || '---'}`, marginX, y);
    y += GAP_Y;
  };

  doc.fontSize(14).text('📄 CÉDULA DE REGISTRO ESCOLAR COMPLETA', marginX, y); y += GAP_Y * 2;
  doc.fontSize(11);

  drawField('Folio', datos.folio);
  drawField('Nombre', `${alumno.nombres} ${alumno.primer_apellido} ${alumno.segundo_apellido}`);
  drawField('CURP', alumno.curp);
  drawField('Carrera', alumno.carrera);
  drawField('Periodo', alumno.periodo_semestral);
  drawField('Semestre', alumno.semestre);
  drawField('Turno', alumno.turno);
  drawField('Grupo', alumno.grupo);
  drawField('Fecha Nacimiento', alumno.fecha_nacimiento);
  drawField('Edad', alumno.edad);
  drawField('Sexo', alumno.sexo);
  drawField('Estado Civil', estadoCivilTexto[alumno.estado_civil] || alumno.estado_civil);
  drawField('Nacionalidad', alumno.nacionalidad);
  drawField('País extranjero', alumno.pais_extranjero);
  drawField('Estado nacimiento', obtenerNombreDesdeCatalogo('estado', alumno.estado_nacimiento));
  drawField('Municipio nacimiento', obtenerNombreDesdeCatalogo('municipio', alumno.municipio_nacimiento));
  drawField('Ciudad nacimiento', obtenerNombreDesdeCatalogo('ciudad', alumno.ciudad_nacimiento));

  y += 10;
  doc.fontSize(12).text('🧑‍🎓 Especialidades preferidas:', marginX, y); y += GAP_Y;
  doc.fontSize(11);
  drawField('1ra opción', alumno.primera_opcion);
  drawField('2da opción', alumno.segunda_opcion);
  drawField('3ra opción', alumno.tercera_opcion);
  drawField('4ta opción', alumno.cuarta_opcion);

  y += 10;
  doc.fontSize(12).text('🏠 Datos Generales:', marginX, y); y += GAP_Y;
  doc.fontSize(11);
  drawField('Colonia', generales.colonia);
  drawField('Domicilio', generales.domicilio);
  drawField('Código Postal', generales.codigo_postal);
  drawField('Teléfono', generales.telefono_alumno);
  drawField('Correo', generales.correo_alumno);
  drawField('Tipo de sangre', generales.tipo_sangre);
  drawField('Paraescolar asignado', generales.paraescolar);
  drawField('Contacto emergencia - nombre', generales.contacto_emergencia_nombre);
  drawField('Contacto emergencia - teléfono', generales.contacto_emergencia_telefono);
  drawField('¿Habla lengua indígena?', lengua.respuesta);
  drawField('¿Cuál?', lengua.cual);
  drawField('¿Entrega diagnóstico?', generales.entrega_diagnostico);
  drawField('Detalle enfermedad', generales.detalle_enfermedad);
  drawField('Responsable adicional - nombre', extra.nombre);
  drawField('Responsable adicional - teléfono', extra.telefono);
  drawField('Responsable adicional - parentesco', extra.parentesco);
  drawField('¿Entregó carta poder?', generales.carta_poder);

  y += 10;
  doc.fontSize(12).text('🏥 Datos Médicos:', marginX, y); y += GAP_Y;
  doc.fontSize(11);
  drawField('Número Seguro Social', medicos.numero_seguro_social);
  drawField('Unidad Médica Familiar', medicos.unidad_medica_familiar);
  drawField('¿Tiene alergias o enfermedades?', alergia.respuesta);
  drawField('Detalle', alergia.detalle);
  drawField('Discapacidad', medicos.discapacidad);

  y += 10;
  doc.fontSize(12).text('🏫 Secundaria de Origen:', marginX, y); y += GAP_Y;
  doc.fontSize(11);
  drawField('Nombre secundaria', secundaria.nombre_secundaria);
  drawField('Régimen', secundaria.regimen);
  drawField('Promedio', secundaria.promedio_general);
  drawField('Modalidad', secundaria.modalidad);

  y += 10;
  doc.fontSize(12).text('👨‍👩‍👧 Tutor Responsable:', marginX, y); y += GAP_Y;
  doc.fontSize(11);
  drawField('Padre', `${tutor.nombre_padre} - ${tutor.telefono_padre}`);
  drawField('Madre', `${tutor.nombre_madre} - ${tutor.telefono_madre}`);
  drawField('¿Con quién vive?', tutor.vive_con);

  y += 10;
  doc.fontSize(12).text('📞 Persona de Emergencia:', marginX, y); y += GAP_Y;
  doc.fontSize(11);
  drawField('Nombre', personaEmergencia.nombre);
  drawField('Teléfono', personaEmergencia.telefono);
  drawField('Parentesco', personaEmergencia.parentesco);

  doc.end();
}

module.exports = generarPDF;
