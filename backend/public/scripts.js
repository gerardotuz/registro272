const BASE_URL = window.location.origin.includes('localhost')
  ? 'http://localhost:3001'
  : 'https://registro272.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
  cargarCatalogo();
  cargarCatalogoGeneral();
  consultarFolioYAutocompletar();

  document.getElementById('registroForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const camposObligatorios = [
      'nombres','primer_apellido','segundo_apellido','curp','carrera',
      'periodo_semestral','semestre','fecha_nacimiento','edad','sexo',
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
    const estadoClave = document.getElementById('estado_nacimiento').selectedOptions[0]?.dataset.clave;
    const municipioClave = document.getElementById('municipio_nacimiento').selectedOptions[0]?.dataset.clave;
    const ciudadClave = document.getElementById('ciudad_nacimiento').selectedOptions[0]?.dataset.clave;

    const estadoClaveG = document.getElementById('estado_nacimiento_general').selectedOptions[0]?.dataset.clave;
    const municipioClaveG = document.getElementById('municipio_nacimiento_general').selectedOptions[0]?.dataset.clave;
    const ciudadClaveG = document.getElementById('ciudad_nacimiento_general').selectedOptions[0]?.dataset.clave;

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
        estado_nacimiento: estadoClave,
        municipio_nacimiento: municipioClave,
        ciudad_nacimiento: ciudadClave,
        estado_civil: formData.get('estado_civil')
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
        carta_poder: formData.get('carta_poder'),
        primera_opcion: formData.get('primera_opcion'),
        segunda_opcion: formData.get('segunda_opcion'),
        tercera_opcion: formData.get('tercera_opcion'),
        cuarta_opcion: formData.get('cuarta_opcion'),
        estado_nacimiento_general: estadoClaveG,
        municipio_nacimiento_general: municipioClaveG,
        ciudad_nacimiento_general: ciudadClaveG
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

    const estadoCivilMap = {
      'soltero': 1,
      'casado': 2,
      'union_libre': 3,
      'divorciado': 4,
      'viudo': 5
    };
    const textoEC = nuevoRegistro.datos_alumno.estado_civil?.toLowerCase();
    nuevoRegistro.datos_alumno.estado_civil = estadoCivilMap[textoEC] || 0;

    const res = await fetch(`${BASE_URL}/api/guardar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuevoRegistro)
    });

    const result = await res.json();
    if (res.ok) {
      alert('✅ Registro guardado con éxito');
      window.open(result.pdf_url, '_blank');
    } else {
      alert(result.message || '❌ Error al guardar');
    }
  });
});

function cargarCatalogo() {
  fetch('/data/catalogo.json')
    .then(res => res.json())
    .then(data => cargarSelectores('nacimiento', data))
    .catch(err => console.error('❌ Error cargando catálogo:', err));
}

function cargarCatalogoGeneral() {
  fetch('/data/catalogo.json')
    .then(res => res.json())
    .then(data => cargarSelectores('nacimiento_general', data))
    .catch(err => console.error('❌ Error cargando catálogo general:', err));
}

function cargarSelectores(sufijo, data) {
  const estado = document.getElementById(`estado_${sufijo}`);
  const municipio = document.getElementById(`municipio_${sufijo}`);
  const ciudad = document.getElementById(`ciudad_${sufijo}`);

  estado.innerHTML = '<option value="">-- Selecciona Estado --</option>';
  municipio.innerHTML = '<option value="">-- Selecciona Municipio --</option>';
  ciudad.innerHTML = '<option value="">-- Selecciona Ciudad --</option>';

  data.forEach(est => {
    const opt = document.createElement('option');
    opt.value = est.nombre;
    opt.dataset.clave = est.clave;
    opt.dataset.municipios = JSON.stringify(est.municipios || []);
    opt.textContent = est.nombre;
    estado.appendChild(opt);
  });

  estado.addEventListener('change', function () {
    const selected = this.selectedOptions[0];
    const municipios = JSON.parse(selected.dataset.municipios || '[]');

    municipio.innerHTML = '<option value="">-- Selecciona Municipio --</option>';
    ciudad.innerHTML = '<option value="">-- Selecciona Ciudad --</option>';

    municipios.forEach(mun => {
      const opt = document.createElement('option');
      opt.value = mun.nombre;
      opt.dataset.clave = mun.clave;
      opt.dataset.localidades = JSON.stringify(mun.localidades || []);
      opt.textContent = mun.nombre;
      municipio.appendChild(opt);
    });

    municipio.disabled = municipios.length === 0;
    ciudad.disabled = true;
  });

  municipio.addEventListener('change', function () {
    const selected = this.selectedOptions[0];
    const localidades = JSON.parse(selected.dataset.localidades || '[]');

    ciudad.innerHTML = '<option value="">-- Selecciona Ciudad --</option>';
    localidades.forEach(loc => {
      const opt = document.createElement('option');
      opt.value = loc.nombre;
      opt.dataset.clave = loc.clave;
      opt.textContent = loc.nombre;
      ciudad.appendChild(opt);
    });

    ciudad.disabled = localidades.length === 0;
  });
}





function consultarFolioYAutocompletar() {
  const folio = localStorage.getItem('alumnoFolio');
  if (!folio) return;

  fetch(`${BASE_URL}/api/folio/${folio}`)
    .then(res => res.json())
    .then(data => {
      if (!data) return;

      // DATOS ALUMNO
      if (data.datos_alumno) {
        const d = data.datos_alumno;
        document.querySelector('[name="nombres"]').value = d.nombres || '';
        document.querySelector('[name="primer_apellido"]').value = d.primer_apellido || '';
        document.querySelector('[name="segundo_apellido"]').value = d.segundo_apellido || '';
        document.querySelector('[name="curp"]').value = d.curp || '';
        document.querySelector('[name="carrera"]').value = d.carrera || '';
        document.querySelector('[name="periodo_semestral"]').value = d.periodo_semestral || '';
        document.querySelector('[name="semestre"]').value = d.semestre || '';
        document.querySelector('[name="grupo"]').value = d.grupo || '';
        document.querySelector('[name="turno"]').value = d.turno || '';
        document.querySelector('[name="fecha_nacimiento"]').value = d.fecha_nacimiento || '';
        document.querySelector('[name="edad"]').value = d.edad || '';
        document.querySelector('[name="sexo"]').value = d.sexo || '';
        document.querySelector('[name="estado_civil"]').value = d.estado_civil || '';

        // ESTADO/MUNICIPIO/CIUDAD nacimiento
        document.getElementById('estado_nacimiento').value = d.estado_nacimiento || '';
        document.getElementById('estado_nacimiento').dispatchEvent(new Event('change'));
        setTimeout(() => {
          document.getElementById('municipio_nacimiento').value = d.municipio_nacimiento || '';
          document.getElementById('municipio_nacimiento').dispatchEvent(new Event('change'));
          setTimeout(() => {
            document.getElementById('ciudad_nacimiento').value = d.ciudad_nacimiento || '';
          }, 200);
        }, 200);
      }

      // DATOS GENERALES
      if (data.datos_generales) {
        const d = data.datos_generales;
        document.querySelector('[name="colonia"]').value = d.colonia || '';
        document.querySelector('[name="domicilio"]').value = d.domicilio || '';
        document.querySelector('[name="codigo_postal"]').value = d.codigo_postal || '';
        document.querySelector('[name="telefono_alumno"]').value = d.telefono_alumno || '';
        document.querySelector('[name="correo_alumno"]').value = d.correo_alumno || '';
        document.querySelector('[name="paraescolar"]').value = d.paraescolar || '';
        document.querySelector('[name="tipo_sangre"]').value = d.tipo_sangre || '';
        document.querySelector('[name="contacto_emergencia_nombre"]').value = d.contacto_emergencia_nombre || '';
        document.querySelector('[name="contacto_emergencia_telefono"]').value = d.contacto_emergencia_telefono || '';
        document.querySelector('[name="habla_lengua_indigena_respuesta"]').value = d.habla_lengua_indigena?.respuesta || '';
        document.querySelector('[name="habla_lengua_indigena_cual"]').value = d.habla_lengua_indigena?.cual || '';
        document.querySelector('[name="entrega_diagnostico"]').value = d.entrega_diagnostico || '';
        document.querySelector('[name="detalle_enfermedad"]').value = d.detalle_enfermedad || '';

        document.querySelector('[name="responsable_emergencia_nombre"]').value = d.responsable_emergencia?.nombre || '';
        document.querySelector('[name="responsable_emergencia_telefono"]').value = d.responsable_emergencia?.telefono || '';
        document.querySelector('[name="responsable_emergencia_parentesco"]').value = d.responsable_emergencia?.parentesco || '';
        document.querySelector('[name="carta_poder"]').value = d.carta_poder || '';

        document.querySelector('[name="primera_opcion"]').value = d.primera_opcion || '';
        document.querySelector('[name="segunda_opcion"]').value = d.segunda_opcion || '';
        document.querySelector('[name="tercera_opcion"]').value = d.tercera_opcion || '';
        document.querySelector('[name="cuarta_opcion"]').value = d.cuarta_opcion || '';

        // ESTADO/MUNICIPIO/CIUDAD generales
        document.getElementById('estado_nacimiento_general').value = d.estado_nacimiento_general || '';
        document.getElementById('estado_nacimiento_general').dispatchEvent(new Event('change'));
        setTimeout(() => {
          document.getElementById('municipio_nacimiento_general').value = d.municipio_nacimiento_general || '';
          document.getElementById('municipio_nacimiento_general').dispatchEvent(new Event('change'));
          setTimeout(() => {
            document.getElementById('ciudad_nacimiento_general').value = d.ciudad_nacimiento_general || '';
          }, 200);
        }, 200);
      }

      // DATOS MÉDICOS
      if (data.datos_medicos) {
        const d = data.datos_medicos;
        document.querySelector('[name="numero_seguro_social"]').value = d.numero_seguro_social || '';
        document.querySelector('[name="unidad_medica_familiar"]').value = d.unidad_medica_familiar || '';
        document.querySelector('[name="enfermedad_cronica_o_alergia_respuesta"]').value = d.enfermedad_cronica_o_alergia?.respuesta || '';
        document.querySelector('[name="enfermedad_cronica_o_alergia_detalle"]').value = d.enfermedad_cronica_o_alergia?.detalle || '';
        document.querySelector('[name="discapacidad"]').value = d.discapacidad || '';
      }

      // SECUNDARIA ORIGEN
      if (data.secundaria_origen) {
        const d = data.secundaria_origen;
        document.querySelector('[name="nombre_secundaria"]').value = d.nombre_secundaria || '';
        document.querySelector('[name="regimen"]').value = d.regimen || '';
        document.querySelector('[name="promedio_general"]').value = d.promedio_general || '';
        document.querySelector('[name="modalidad"]').value = d.modalidad || '';
      }

      // TUTOR RESPONSABLE
      if (data.tutor_responsable) {
        const d = data.tutor_responsable;
        document.querySelector('[name="nombre_padre"]').value = d.nombre_padre || '';
        document.querySelector('[name="telefono_padre"]').value = d.telefono_padre || '';
        document.querySelector('[name="nombre_madre"]').value = d.nombre_madre || '';
        document.querySelector('[name="telefono_madre"]').value = d.telefono_madre || '';
        document.querySelector('[name="vive_con"]').value = d.vive_con || '';
      }

      // PERSONA EMERGENCIA
      if (data.persona_emergencia) {
        const d = data.persona_emergencia;
        document.querySelector('[name="persona_emergencia_nombre"]').value = d.nombre || '';
        document.querySelector('[name="persona_emergencia_parentesco"]').value = d.parentesco || '';
        document.querySelector('[name="persona_emergencia_telefono"]').value = d.telefono || '';
      }

    })
    .catch(err => console.error('Error al cargar alumno:', err));
}








      
    })
    .catch(err => console.error('Error al cargar alumno:', err));
}

const reimprimirForm = document.getElementById('reimprimirForm');
if (reimprimirForm) {
  reimprimirForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const folio = document.getElementById('folioReimpresion').value.trim();
    if (!folio) return;

    try {
      const res = await fetch(`${BASE_URL}/api/reimprimir/${folio}`);
      const data = await res.json();
      if (res.ok) {
        window.open(data.pdf, '_blank');
      } else {
        alert(data.message || 'No se pudo reimprimir el PDF');
      }
    } catch (err) {
      alert('❌ Error al reimprimir PDF');
    }
  });
}
