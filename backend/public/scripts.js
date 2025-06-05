
// Convierte todos los inputs de texto a mayúsculas automáticamente
document.addEventListener('DOMContentLoaded', () => {
  const inputs = document.querySelectorAll('input[type="text"], textarea');

  inputs.forEach(input => {
    input.addEventListener('input', () => {
      input.value = input.value.toUpperCase();
    });
  });
});

// Validación básica para campos requeridos antes de enviar
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

document.getElementById('registroForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const form = e.target;
  if (!validarFormularioCompleto(form)) return;

  const datos = {
    folio: form.folio?.value || '',
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
      paraescolar: form.paraescolar.value,
      correo_alumno: form.correo_alumno?.value || ''
    }
  };

  try {
    const response = await fetch('/api/guardar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(datos)
    });

    const resultado = await response.json();
    alert(resultado.message);
  } catch (error) {
    console.error(error);
    alert('Error al registrar: ' + error.message);
  }
});
