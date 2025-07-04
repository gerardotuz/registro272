const BASE_URL = window.location.origin.includes('localhost')
  ? 'http://localhost:3001'
  : 'https://registro272.onrender.com';

let catalogoEstados = [];

document.addEventListener('DOMContentLoaded', async () => {
  await cargarCatalogo();
  await cargarCatalogoGeneral();
  await consultarFolioYAutocompletar();

  // Precargar datos locales si existen
  const datos = JSON.parse(localStorage.getItem('datosPrecargados'));
  if (datos) {
    const flatten = (obj, prefix = '') => {
      let result = {};
      for (let key in obj) {
        if (!obj.hasOwnProperty(key)) continue;
        const newKey = prefix ? `${prefix}_${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          Object.assign(result, flatten(obj[key], newKey));
        } else {
          result[newKey] = obj[key];
        }
      }
      return result;
    };
    const combined = flatten(datos);
    Object.entries(combined).forEach(([name, value]) => {
      const input = document.querySelector(`[name="${name}"]`);
      if (input) input.value = value;
    });
  }

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

    const estadoClave = document.getElementById('estado_nacimiento').selectedOptions[0]?.dataset?.clave;
    const municipioClave = document.getElementById('municipio_nacimiento').selectedOptions[0]?.dataset?.clave;
    const ciudadClave = document.getElementById('ciudad_nacimiento').selectedOptions[0]?.dataset?.clave;

    const estadoClaveG = document.getElementById('estado_nacimiento_general').selectedOptions[0]?.dataset?.clave;
    const municipioClaveG = document.getElementById('municipio_nacimiento_general').selectedOptions[0]?.dataset?.clave;
    const ciudadClaveG = document.getElementById('ciudad_nacimiento_general').selectedOptions[0]?.dataset?.clave;

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

    const estadoCivilMap = { 'soltero': 1, 'casado': 2, 'union_libre': 3, 'divorciado': 4, 'viudo': 5 };
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

async function cargarCatalogo() {
  const res = await fetch('/data/catalogo.json');
  catalogoEstados = await res.json();
  cargarSelectores('nacimiento', catalogoEstados);
}

async function cargarCatalogoGeneral() {
  const res = await fetch('/data/catalogo.json');
  const data = await res.json();
  cargarSelectores('nacimiento_general', data);
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
    if (!selected) return;
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
    if (!selected) return;
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

async function consultarFolioYAutocompletar() {
  const folio = localStorage.getItem('alumnoFolio');
  if (!folio) return;

  const res = await fetch(`${BASE_URL}/api/folio/${folio}`);
  const data = await res.json();
  if (!data) return;

  const estadoCivilMapReverse = { 1: 'Soltero', 2: 'Casado', 3: 'Unión libre', 4: 'Divorciado', 5: 'Viudo' };

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
    document.querySelector('[name="estado_civil"]').value = estadoCivilMapReverse[d.estado_civil] || '';
    await asignarEstadoMunicipioCiudad('nacimiento',
      getNombreEstado(d.estado_nacimiento),
      getNombreMunicipio(d.estado_nacimiento, d.municipio_nacimiento),
      getNombreCiudad(d.estado_nacimiento, d.municipio_nacimiento, d.ciudad_nacimiento));
  }

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
    await asignarEstadoMunicipioCiudad('nacimiento_general',
      getNombreEstado(d.estado_nacimiento_general),
      getNombreMunicipio(d.estado_nacimiento_general, d.municipio_nacimiento_general),
      getNombreCiudad(d.estado_nacimiento_general, d.municipio_nacimiento_general, d.ciudad_nacimiento_general));
  }
}

function getNombreEstado(clave) {
  return catalogoEstados.find(est => est.clave == clave)?.nombre || '';
}

function getNombreMunicipio(claveEstado, claveMunicipio) {
  const estado = catalogoEstados.find(est => est.clave == claveEstado);
  return estado?.municipios?.find(mun => mun.clave == claveMunicipio)?.nombre || '';
}

function getNombreCiudad(claveEstado, claveMunicipio, claveCiudad) {
  const estado = catalogoEstados.find(est => est.clave == claveEstado);
  const municipio = estado?.municipios?.find(mun => mun.clave == claveMunicipio);
  return municipio?.localidades?.find(loc => loc.clave == claveCiudad)?.nombre || '';
}

async function asignarEstadoMunicipioCiudad(sufijo, estado, municipio, ciudad) {
  const estadoSel = document.getElementById(`estado_${sufijo}`);
  const municipioSel = document.getElementById(`municipio_${sufijo}`);
  const ciudadSel = document.getElementById(`ciudad_${sufijo}`);
  if (!estadoSel) return;
  estadoSel.value = estado;
  estadoSel.dispatchEvent(new Event('change'));
  await new Promise(r => setTimeout(r, 400));
  municipioSel.value = municipio;
  municipioSel.dispatchEvent(new Event('change'));
  await new Promise(r => setTimeout(r, 400));
  ciudadSel.value = ciudad;
}
