const BASE_URL = window.location.origin.includes('localhost')
  ? 'http://localhost:3001'
  : 'https://registro272.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
  cargarCatalogo();
  cargarCatalogoGeneral();

  document.getElementById('registroForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const camposObligatorios = document.querySelectorAll(
      '#registroForm [required]'
    );

    for (const campo of camposObligatorios) {
      if (!campo.value.trim()) {
        alert(`⚠️ Completa el campo: ${campo.name}`);
        campo.focus();
        return;
      }
    }

    const formData = new FormData(e.target);

    const nuevoRegistro = {
      datos_alumno: {
        nombres: formData.get('nombres'),
        primer_apellido: formData.get('primer_apellido'),
        segundo_apellido: formData.get('segundo_apellido'),
        curp: formData.get('curp'),
        fecha_nacimiento: formData.get('fecha_nacimiento'),
        edad: formData.get('edad'),
        sexo: formData.get('sexo'),
        estado_civil: formData.get('estado_civil'),
        nacionalidad: formData.get('nacionalidad'),
        pais_extranjero: formData.get('pais_extranjero'),
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
        correo_alumno: formData.get('correo_alumno')
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
      }
    };

    const res = await fetch(`${BASE_URL}/api/guardar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuevoRegistro)
    });

    const result = await res.json();

    if (res.ok) {
      alert(`✅ Registro exitoso\nFolio asignado: ${result.alumno.folio}`);
      window.open(result.pdf_url, '_blank');
      deshabilitarFormulario();
    } else {
      alert(result.message || '❌ Error al guardar');
    }
  });
});

function deshabilitarFormulario() {
  const form = document.getElementById('registroForm');
  Array.from(form.elements).forEach(el => el.disabled = true);
}
