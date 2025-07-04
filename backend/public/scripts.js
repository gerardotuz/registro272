const BASE_URL = window.location.origin.includes('localhost')
  ? 'http://localhost:3001'
  : 'https://registro272.onrender.com';

let catalogoEstados = [];

document.addEventListener('DOMContentLoaded', async () => {
  await cargarCatalogo();
  await cargarCatalogoGeneral();
  await consultarFolioYAutocompletar();

  const datos = JSON.parse(localStorage.getItem('datosPrecargados'));
  if (datos) {
    const combined = flatten(datos);

    // Rellenar campos normales
    Object.entries(combined).forEach(([name, value]) => {
      const input = document.querySelector(`[name="${name}"]`);
      if (input && value != null) input.value = value;
    });

    // Estado civil numérico → texto
    if (combined.datos_alumno_estado_civil) {
      const map = { 1: 'Soltero', 2: 'Casado', 3: 'Unión libre', 4: 'Divorciado', 5: 'Viudo' };
      document.querySelector('[name="estado_civil"]').value = map[combined.datos_alumno_estado_civil] || '';
    }

    // Cargar selects: nacimiento
    if (combined.datos_alumno_estado_nacimiento) {
      await asignarEstadoMunicipioCiudad(
        'nacimiento',
        getNombreEstado(combined.datos_alumno_estado_nacimiento),
        getNombreMunicipio(combined.datos_alumno_estado_nacimiento, combined.datos_alumno_municipio_nacimiento),
        getNombreCiudad(combined.datos_alumno_estado_nacimiento, combined.datos_alumno_municipio_nacimiento, combined.datos_alumno_ciudad_nacimiento)
      );
    }

    // Cargar selects: residencia general
    if (combined.datos_generales_estado_nacimiento_general) {
      await asignarEstadoMunicipioCiudad(
        'nacimiento_general',
        getNombreEstado(combined.datos_generales_estado_nacimiento_general),
        getNombreMunicipio(combined.datos_generales_estado_nacimiento_general, combined.datos_generales_municipio_nacimiento_general),
        getNombreCiudad(combined.datos_generales_estado_nacimiento_general, combined.datos_generales_municipio_nacimiento_general, combined.datos_generales_ciudad_nacimiento_general)
      );
    }
  }

  document.getElementById('registroForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validar campos obligatorios
    const camposObligatorios = [
      'nombres', 'primer_apellido', 'segundo_apellido', 'curp', 'carrera',
      'periodo_semestral', 'semestre', 'fecha_nacimiento', 'edad', 'sexo',
      'estado_nacimiento', 'municipio_nacimiento', 'ciudad_nacimiento', 'estado_civil',
      'colonia', 'domicilio', 'codigo_postal', 'telefono_alumno', 'correo_alumno',
      'paraescolar'
    ];

    for (const campo of camposObligatorios) {
      const input = document.querySelector(`[name="${campo}"]`);
      if (!input || !input.value.trim()) {
        alert(`⚠️ Falta: ${campo.replaceAll('_', ' ')}`);
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
      }
      // 👇 Aquí igual rellena el resto como tengas
    };

    const map = { 'soltero': 1, 'casado': 2, 'unión libre': 3, 'divorciado': 4, 'viudo': 5 };
    nuevoRegistro.datos_alumno.estado_civil = map[nuevoRegistro.datos_alumno.estado_civil.toLowerCase()] || 0;

    const res = await fetch(`${BASE_URL}/api/guardar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuevoRegistro)
    });

    const result = await res.json();
    if (res.ok) {
      alert('✅ Guardado OK');
      window.open(result.pdf_url, '_blank');
    } else {
      alert(result.message || '❌ Error');
    }
  });
});

function flatten(obj, prefix = '') {
  let result = {};
  for (let key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      Object.assign(result, flatten(obj[key], prefix ? `${prefix}_${key}` : key));
    } else {
      result[prefix ? `${prefix}_${key}` : key] = obj[key];
    }
  }
  return result;
}

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

  estado.innerHTML = '<option value="">-- Estado --</option>';
  municipio.innerHTML = '<option value="">-- Municipio --</option>';
  ciudad.innerHTML = '<option value="">-- Ciudad --</option>';

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
    const municipios = selected ? JSON.parse(selected.dataset.municipios) : [];
    municipio.innerHTML = '<option value="">-- Municipio --</option>';
    ciudad.innerHTML = '<option value="">-- Ciudad --</option>';
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
    const localidades = selected ? JSON.parse(selected.dataset.localidades) : [];
    ciudad.innerHTML = '<option value="">-- Ciudad --</option>';
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
  localStorage.setItem('datosPrecargados', JSON.stringify(data));
}

function getNombreEstado(clave) {
  return catalogoEstados.find(e => e.clave == clave)?.nombre || '';
}
function getNombreMunicipio(estadoC, munC) {
  const estado = catalogoEstados.find(e => e.clave == estadoC);
  return estado?.municipios?.find(m => m.clave == munC)?.nombre || '';
}
function getNombreCiudad(estadoC, munC, locC) {
  const estado = catalogoEstados.find(e => e.clave == estadoC);
  const mun = estado?.municipios?.find(m => m.clave == munC);
  return mun?.localidades?.find(l => l.clave == locC)?.nombre || '';
}

async function asignarEstadoMunicipioCiudad(sufijo, estado, municipio, ciudad) {
  const e = document.getElementById(`estado_${sufijo}`);
  const m = document.getElementById(`municipio_${sufijo}`);
  const c = document.getElementById(`ciudad_${sufijo}`);
  if (!e) return;
  e.value = estado; e.dispatchEvent(new Event('change'));
  await new Promise(r => setTimeout(r, 400));
  m.value = municipio; m.dispatchEvent(new Event('change'));
  await new Promise(r => setTimeout(r, 400));
  c.value = ciudad;
}
