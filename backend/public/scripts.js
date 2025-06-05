// Convierte todos los inputs de texto a mayúsculas automáticamente
document.addEventListener('DOMContentLoaded', () => {
  const inputs = document.querySelectorAll('input[type="text"], textarea');
  inputs.forEach(input => {
    input.addEventListener('input', () => {
      input.value = input.value.toUpperCase();
    });
  });
});

function validarFormularioCompleto(form) {
  const campos = form.querySelectorAll('[required]');
  for (let campo of campos) {
    if (!campo.value.trim()) {
      alert('Por favor completa todos los campos requeridos.');
      return false;
    }
  }
  return true;
}

async function validarParaescolarDisponible(paraescolar, folio) {
  try {
    const res = await fetch(`/api/validar-paraescolar/${encodeURIComponent(paraescolar)}`);
    const data = await res.json();

    // Si ya hay el máximo y el alumno no está registrado, bloquear
    if (data.count >= 1) {
      const alumno = await fetch(`/api/folio/${folio}`);
      const dataAlumno = await alumno.ok ? await alumno.json() : null;

      if (!dataAlumno || (dataAlumno.datos_generales?.paraescolar !== paraescolar.toUpperCase())) {
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error("Error validando paraescolar:", error);
    return true;
  }
}

document.getElementById('registroForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const form = e.target;
  if (!validarFormularioCompleto(form)) return;

  const paraescolar = form.paraescolar.value;
  const folio = form.folio.value;

  const disponible = await validarParaescolarDisponible(paraescolar, folio);
  if (!disponible) {
    alert(`Ya no hay lugares disponibles para ${paraescolar}.`);
    return;
  }

  const datos = {
    folio,
    datos_alumno: {
      curp: form.curp.value,
      nombres: form.nombres.value,
      primer_apellido: form.primer_apellido.value,
      segundo_apellido: form.segundo_apellido.value,
      carrera: form.carrera.value,
      periodo_semestral: form.periodo_semestral.value,
      semestre: form.semestre.value,
      grupo: form.grupo.value,
      turno: form.turno.value
    },
    datos_generales: {
      paraescolar,
      correo_alumno: form.correo_alumno?.value || ''
    }
  };

  try {
    const response = await fetch('/api/guardar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });

    const resultado = await response.json();
    alert(resultado.message);

    if (response.ok) {
      window.location.href = `/api/pdf/${folio}`;
    }
  } catch (error) {
    console.error(error);
    alert('Error al registrar: ' + error.message);
  }
});
