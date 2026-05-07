const BASE_URL = window.location.origin.includes('localhost')
  ? 'http://localhost:3001'
  : 'https://registro272.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
  cargarCatalogo();
  cargarCatalogoGeneral();
  consultarFolioYAutocompletar();

  document.getElementById('registroForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const folio = localStorage.getItem('alumnoFolio');
    if (!folio) return alert('Folio perdido');

    const clave = (id) => document.getElementById(id).selectedOptions[0]?.dataset.clave;

    const payload = {
      folio,
      datos_alumno: {
        nombres: formData.get('nombres'), primer_apellido: formData.get('primer_apellido'), segundo_apellido: formData.get('segundo_apellido'),
        curp: formData.get('curp'), carrera: formData.get('carrera'), periodo_semestral: formData.get('periodo_semestral'), semestre: formData.get('semestre'), grupo: formData.get('grupo'), turno: formData.get('turno'),
        fecha_nacimiento: formData.get('fecha_nacimiento'), edad: formData.get('edad'), sexo: formData.get('sexo'),
        estado_nacimiento: clave('estado_nacimiento'), municipio_nacimiento: clave('municipio_nacimiento'), ciudad_nacimiento: clave('ciudad_nacimiento'), estado_civil: formData.get('estado_civil')
      },
      datos_generales: {
        colonia: formData.get('colonia'), domicilio: formData.get('domicilio'), codigo_postal: formData.get('codigo_postal'), telefono_alumno: formData.get('telefono_alumno'), correo_alumno: formData.get('correo_alumno'), paraescolar: formData.get('paraescolar'), tipo_sangre: formData.get('tipo_sangre'),
        contacto_emergencia_nombre: formData.get('contacto_emergencia_nombre'), contacto_emergencia_telefono: formData.get('contacto_emergencia_telefono'),
        habla_lengua_indigena: { respuesta: formData.get('habla_lengua_indigena_respuesta'), cual: formData.get('habla_lengua_indigena_cual') },
        entrega_diagnostico: formData.get('entrega_diagnostico'), detalle_enfermedad: formData.get('detalle_enfermedad'),
        responsable_emergencia: { nombre: formData.get('responsable_emergencia_nombre'), telefono: formData.get('responsable_emergencia_telefono'), parentesco: formData.get('responsable_emergencia_parentesco') },
        carta_poder: formData.get('carta_poder'),
        primera_opcion: formData.get('primera_opcion'), segunda_opcion: formData.get('segunda_opcion'), tercera_opcion: formData.get('tercera_opcion'), cuarta_opcion: formData.get('cuarta_opcion'),
        estado_nacimiento_general: clave('estado_nacimiento_general'), municipio_nacimiento_general: clave('municipio_nacimiento_general'), ciudad_nacimiento_general: clave('ciudad_nacimiento_general')
      },
      datos_medicos: {
        numero_seguro_social: formData.get('numero_seguro_social'), unidad_medica_familiar: formData.get('unidad_medica_familiar'),
        enfermedad_cronica_o_alergia: { respuesta: formData.get('enfermedad_cronica_o_alergia_respuesta'), detalle: formData.get('enfermedad_cronica_o_alergia_detalle') },
        discapacidad: formData.get('discapacidad')
      },
      secundaria_origen: { nombre_secundaria: formData.get('nombre_secundaria'), regimen: formData.get('regimen'), promedio_general: formData.get('promedio_general'), modalidad: formData.get('modalidad') },
      tutor_responsable: { nombre_padre: formData.get('nombre_padre'), telefono_padre: formData.get('telefono_padre'), nombre_madre: formData.get('nombre_madre'), telefono_madre: formData.get('telefono_madre'), vive_con: formData.get('vive_con') },
      persona_emergencia: { nombre: formData.get('persona_emergencia_nombre'), parentesco: formData.get('persona_emergencia_parentesco'), telefono: formData.get('persona_emergencia_telefono') }
    };

    const res = await fetch(`${BASE_URL}/api/guardar-registro`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await res.json();
    if (res.ok) {
      alert('✅ Registro guardado con éxito');
      if (result.pdf_url) window.open(result.pdf_url, '_blank');
      deshabilitarFormulario();
    } else alert(result.message || '❌ Error al guardar');
  });
});

function deshabilitarFormulario() { Array.from(document.getElementById('registroForm').elements).forEach(el => el.disabled = true); }
function cargarCatalogo() { fetch('/catalogo.json').then(r => r.json()).then(d => cargarSelectores('nacimiento', d)); }
function cargarCatalogoGeneral() { fetch('/catalogo.json').then(r => r.json()).then(d => cargarSelectores('nacimiento_general', d)); }
function cargarSelectores(s, data) { const e = document.getElementById(`estado_${s}`), m = document.getElementById(`municipio_${s}`), c = document.getElementById(`ciudad_${s}`); if (!e || !m || !c) return; e.innerHTML='<option value="">-- Selecciona Estado --</option>'; m.innerHTML='<option value="">-- Selecciona Municipio --</option>'; c.innerHTML='<option value="">-- Selecciona Ciudad --</option>'; data.forEach(est=>{const o=document.createElement('option'); o.value=est.nombre; o.dataset.clave=est.clave; o.dataset.municipios=JSON.stringify(est.municipios||[]); o.textContent=est.nombre; e.appendChild(o);}); e.addEventListener('change',()=>{const ms=JSON.parse(e.selectedOptions[0]?.dataset.municipios||'[]'); m.innerHTML='<option value="">-- Selecciona Municipio --</option>'; c.innerHTML='<option value="">-- Selecciona Ciudad --</option>'; ms.forEach(mu=>{const o=document.createElement('option'); o.value=mu.nombre;o.dataset.clave=mu.clave;o.dataset.localidades=JSON.stringify(mu.localidades||[]);o.textContent=mu.nombre;m.appendChild(o);}); m.disabled=!ms.length;c.disabled=true;}); m.addEventListener('change',()=>{const ls=JSON.parse(m.selectedOptions[0]?.dataset.localidades||'[]'); c.innerHTML='<option value="">-- Selecciona Ciudad --</option>'; ls.forEach(l=>{const o=document.createElement('option'); o.value=l.nombre;o.dataset.clave=l.clave;o.textContent=l.nombre;c.appendChild(o);}); c.disabled=!ls.length;}); }
function consultarFolioYAutocompletar(){const datos=JSON.parse(localStorage.getItem('datosPrecargados')); if(!datos) return; const set=(name,v)=>{const i=document.querySelector(`[name="${name}"]`); if(i&&v!=null&&v!=='') i.value=v;}; const mappings={...datos.datos_alumno,...datos.datos_generales,...datos.datos_medicos,...datos.secundaria_origen,...datos.tutor_responsable,'habla_lengua_indigena_respuesta':datos.datos_generales?.habla_lengua_indigena?.respuesta,'habla_lengua_indigena_cual':datos.datos_generales?.habla_lengua_indigena?.cual,'enfermedad_cronica_o_alergia_respuesta':datos.datos_medicos?.enfermedad_cronica_o_alergia?.respuesta,'enfermedad_cronica_o_alergia_detalle':datos.datos_medicos?.enfermedad_cronica_o_alergia?.detalle,'persona_emergencia_nombre':datos.persona_emergencia?.nombre,'persona_emergencia_parentesco':datos.persona_emergencia?.parentesco,'persona_emergencia_telefono':datos.persona_emergencia?.telefono}; Object.entries(mappings).forEach(([k,v])=>set(k,v));}
