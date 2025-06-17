document.getElementById('registroForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const camposObligatorios = [
    'nombres','primer_apellido','segundo_apellido','curp','carrera',
    'periodo_semestral','semestre','turno','fecha_nacimiento','edad','sexo',
    'estado_nacimiento','municipio_nacimiento','ciudad_nacimiento','estado_civil',
    'primera_opcion','segunda_opcion','tercera_opcion','cuarta_opcion',
    'colonia','domicilio','codigo_postal','telefono_alumno','correo_alumno',
    'tipo_sangre','contacto_emergencia_nombre','contacto_emergencia_telefono',
    'habla_lengua_indigena_respuesta','numero_seguro_social','unidad_medica_familiar',
    'enfermedad_cronica_o_alergia_respuesta','enfermedad_cronica_o_alergia_detalle',
    'discapacidad','entrega_diagnostico','detalle_enfermedad',
    'nombre_secundaria','regimen','promedio_general','modalidad',
    'nombre_padre','telefono_padre','nombre_madre','telefono_madre',
    'vive_con','persona_emergencia_nombre','persona_emergencia_parentesco','persona_emergencia_telefono',
    'responsable_emergencia_nombre','responsable_emergencia_telefono','responsable_emergencia_parentesco','carta_poder',
    'paraescolar'
  ];

  for (const campo of camposObligatorios) {
    const input = document.querySelector(`[name="${campo}"]`);
    if (!input || !input.value.trim()) {
      alert(`⚠️ Por favor completa el campo: ${campo.replaceAll('_', ' ')}`);
      input?.focus();
      return;
    }
  }

  const folio = localStorage.getItem('alumnoFolio');
  if (!folio) return alert('Folio perdido');

  const formData = new FormData(e.target);
  const nuevoRegistro = {
    folio,
    datos_alumno: {
      nombres: formData.get('nombres'),
      primer_apellido: formData.get('primer_apellido'),
      segundo_apellido: formData.get('segundo_apellido'),
      curp: formData.get('curp'),
      carrera: formData.get('carrera'),
      periodo_semestral: formData.get('periodo_semestral'),
      semestre: formData.get('semestre'),
      grupo: formData.get('grupo'),
      turno: formData.get('turno'),
      fecha_nacimiento: formData.get('fecha_nacimiento'),
      edad: formData.get('edad'),
      sexo: formData.get('sexo'),
      estado_nacimiento: formData.get('estado_nacimiento'),
      municipio_nacimiento: formData.get('municipio_nacimiento'),
      ciudad_nacimiento: formData.get('ciudad_nacimiento'),
      estado_civil: formData.get('estado_civil'),
      primera_opcion: formData.get('primera_opcion'),
      segunda_opcion: formData.get('segunda_opcion'),
      tercera_opcion: formData.get('tercera_opcion'),
      cuarta_opcion: formData.get('cuarta_opcion')
    },
    datos_generales: {
      colonia: formData.get('colonia'),
      domicilio: formData.get('domicilio'),
      codigo_postal: formData.get('codigo_postal'),
      telefono_alumno: formData.get('telefono_alumno'),
      correo_alumno: formData.get('correo_alumno'),
      paraescolar: formData.get('paraescolar'),
      tipo_sangre: formData.get('tipo_sangre'),
      contacto_emergencia_nombre: formData.get('contacto_emergencia_nombre'),
      contacto_emergencia_telefono: formData.get('contacto_emergencia_telefono'),
      habla_lengua_indigena: {
        respuesta: formData.get('habla_lengua_indigena_respuesta'),
        cual: formData.get('habla_lengua_indigena_cual')
      },
      entrega_diagnostico: formData.get('entrega_diagnostico'),
      detalle_enfermedad: formData.get('detalle_enfermedad'),
      responsable_emergencia: {
        nombre: formData.get('responsable_emergencia_nombre'),
        telefono: formData.get('responsable_emergencia_telefono'),
        parentesco: formData.get('responsable_emergencia_parentesco')
      },
      carta_poder: formData.get('carta_poder')
    },
    datos_medicos: {
      numero_seguro_social: formData.get('numero_seguro_social'),
      unidad_medica_familiar: formData.get('unidad_medica_familiar'),
      enfermedad_cronica_o_alergia: {
        respuesta: formData.get('enfermedad_cronica_o_alergia_respuesta'),
        detalle: formData.get('enfermedad_cronica_o_alergia_detalle')
      },
      discapacidad: formData.get('discapacidad')
    },
    secundaria_origen: {
      nombre_secundaria: formData.get('nombre_secundaria'),
      regimen: formData.get('regimen'),
      promedio_general: formData.get('promedio_general'),
      modalidad: formData.get('modalidad')
    },
    tutor_responsable: {
      nombre_padre: formData.get('nombre_padre'),
      telefono_padre: formData.get('telefono_padre'),
      nombre_madre: formData.get('nombre_madre'),
      telefono_madre: formData.get('telefono_madre'),
      vive_con: formData.get('vive_con')
    },
    persona_emergencia: {
      nombre: formData.get('persona_emergencia_nombre'),
      parentesco: formData.get('persona_emergencia_parentesco'),
      telefono: formData.get('persona_emergencia_telefono')
    }
  };

  const BASE_URL = window.location.origin.includes('localhost')
    ? 'http://localhost:3001'
    : 'https://registro272.onrender.com';

  const res = await fetch(`${BASE_URL}/api/guardar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(nuevoRegistro)
  });

  const result = await res.json();
  if (res.ok) {
    alert('Registro guardado con éxito');
    window.open(`${BASE_URL}/api/pdf/${folio}`, '_blank');
  } else {
    alert(result.message || 'Error al guardar');
  }
});


window.onload = cargarCatalogo;


async function cargarCatalogo() {
  try {
    const response = await fetch('./data/catalogo.json');
    const catalogo = await response.json();
    const estados = catalogo.estados;

    const estadoSelect = document.getElementById('estadoSelect');
    const municipioSelect = document.getElementById('municipioSelect');
    const ciudadSelect = document.getElementById('ciudadSelect');

    estadoSelect.innerHTML = '<option value="">Seleccione un estado</option>';
    municipioSelect.innerHTML = '<option value="">Seleccione un municipio</option>';
    ciudadSelect.innerHTML = '<option value="">Seleccione una ciudad</option>';

    estados.forEach(estado => {
      const option = document.createElement('option');
      option.value = estado.clave;
      option.textContent = estado.nombre;
      estadoSelect.appendChild(option);
    });

    estadoSelect.addEventListener('change', () => {
      const estadoSeleccionado = estados.find(e => e.clave === estadoSelect.value);
      municipioSelect.disabled = false;
      municipioSelect.innerHTML = '<option value="">Seleccione un municipio</option>';
      ciudadSelect.innerHTML = '<option value="">Seleccione una ciudad</option>';
      ciudadSelect.disabled = true;

      if (estadoSeleccionado) {
        estadoSeleccionado.municipios.forEach(municipio => {
          const option = document.createElement('option');
          option.value = municipio.clave;
          option.textContent = municipio.nombre;
          municipioSelect.appendChild(option);
        });
      }
    });

    municipioSelect.addEventListener('change', () => {
      const estadoSeleccionado = estados.find(e => e.clave === estadoSelect.value);
      const municipioSeleccionado = estadoSeleccionado?.municipios.find(m => m.clave === municipioSelect.value);
      ciudadSelect.disabled = false;
      ciudadSelect.innerHTML = '<option value="">Seleccione una ciudad</option>';

      if (municipioSeleccionado) {
        municipioSeleccionado.localidades.forEach(localidad => {
          const option = document.createElement('option');
          option.value = localidad.clave;
          option.textContent = localidad.nombre;
          ciudadSelect.appendChild(option);
        });
      }
    });
  } catch (error) {
    console.error('Error al cargar el catálogo:', error);
  }
}

window.onload = cargarCatalogo;


async function consultarFolioYAutocompletar() {
  const folio = localStorage.getItem('alumnoFolio');
  if (!folio) return;

  const BASE_URL = window.location.origin.includes('localhost')
    ? 'http://localhost:3001'
    : 'https://registro272.onrender.com';

  try {
    const res = await fetch(`${BASE_URL}/api/folio/${folio}`);
    if (!res.ok) throw new Error('Folio no encontrado');

    const datos = await res.json();

    const set = (name, value) => {
      const input = document.querySelector(`[name="${name}"]`);
      if (input) input.value = value;
    };

    const alumno = datos.datos_alumno || {};
    const generales = datos.datos_generales || {};
    const medicos = datos.datos_medicos || {};
    const secundaria = datos.secundaria_origen || {};
    const tutor = datos.tutor_responsable || {};
    const emergencia = datos.persona_emergencia || {};
    const habla = generales.habla_lengua_indigena || {};
    const enfermedad = medicos.enfermedad_cronica_o_alergia || {};
    const responsableEmergencia = generales.responsable_emergencia || {};

    // datos_alumno
    set('nombres', alumno.nombres);
    set('primer_apellido', alumno.primer_apellido);
    set('segundo_apellido', alumno.segundo_apellido);
    set('curp', alumno.curp);
    set('carrera', alumno.carrera);
    set('periodo_semestral', alumno.periodo_semestral);
    set('semestre', alumno.semestre);
    set('grupo', alumno.grupo);
    set('turno', alumno.turno);
    set('fecha_nacimiento', alumno.fecha_nacimiento);
    set('edad', alumno.edad);
    set('sexo', alumno.sexo);
    set('estado_nacimiento', alumno.estado_nacimiento);
    set('municipio_nacimiento', alumno.municipio_nacimiento);
    set('ciudad_nacimiento', alumno.ciudad_nacimiento);
    set('estado_civil', alumno.estado_civil);
    set('primera_opcion', alumno.primera_opcion);
    set('segunda_opcion', alumno.segunda_opcion);
    set('tercera_opcion', alumno.tercera_opcion);
    set('cuarta_opcion', alumno.cuarta_opcion);

    // datos_generales
    set('colonia', generales.colonia);
    set('domicilio', generales.domicilio);
    set('codigo_postal', generales.codigo_postal);
    set('telefono_alumno', generales.telefono_alumno);
    set('correo_alumno', generales.correo_alumno);
    set('paraescolar', generales.paraescolar);
    set('tipo_sangre', generales.tipo_sangre);
    set('contacto_emergencia_nombre', generales.contacto_emergencia_nombre);
    set('contacto_emergencia_telefono', generales.contacto_emergencia_telefono);
    set('habla_lengua_indigena_respuesta', habla.respuesta);
    set('habla_lengua_indigena_cual', habla.cual);
    set('entrega_diagnostico', generales.entrega_diagnostico);
    set('detalle_enfermedad', generales.detalle_enfermedad);
    set('responsable_emergencia_nombre', responsableEmergencia.nombre);
    set('responsable_emergencia_telefono', responsableEmergencia.telefono);
    set('responsable_emergencia_parentesco', responsableEmergencia.parentesco);
    set('carta_poder', generales.carta_poder);

    // datos_medicos
    set('numero_seguro_social', medicos.numero_seguro_social);
    set('unidad_medica_familiar', medicos.unidad_medica_familiar);
    set('enfermedad_cronica_o_alergia_respuesta', enfermedad.respuesta);
    set('enfermedad_cronica_o_alergia_detalle', enfermedad.detalle);
    set('discapacidad', medicos.discapacidad);

    // secundaria_origen
    set('nombre_secundaria', secundaria.nombre_secundaria);
    set('regimen', secundaria.regimen);
    set('promedio_general', secundaria.promedio_general);
    set('modalidad', secundaria.modalidad);

    // tutor_responsable
    set('nombre_padre', tutor.nombre_padre);
    set('telefono_padre', tutor.telefono_padre);
    set('nombre_madre', tutor.nombre_madre);
    set('telefono_madre', tutor.telefono_madre);
    set('vive_con', tutor.vive_con);

    // persona_emergencia
    set('persona_emergencia_nombre', emergencia.nombre);
    set('persona_emergencia_parentesco', emergencia.parentesco);
    set('persona_emergencia_telefono', emergencia.telefono);

  } catch (err) {
    console.error('Error al cargar datos del folio:', err);
  }
}


window.onload = () => { cargarCatalogo(); consultarFolioYAutocompletar(); };
