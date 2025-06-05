// Convierte todos los inputs de texto a mayúsculas automáticamente
document.addEventListener('DOMContentLoaded', async () => {
  const inputs = document.querySelectorAll('input[type="text"], textarea');
  inputs.forEach(input => {
    input.addEventListener('input', () => {
      input.value = input.value.toUpperCase();
    });
  });

  // Desactivar opciones de paraescolar que ya están llenas
  const opciones = [
    "AJEDREZ", "ATLETISMO", "BANDA DE GUERRA", "BASQUETBOL", "DANZA",
    "ESCOLTA DE BANDERA", "FOTOGRAFÍA", "FUTBOL", "PINTURA",
    "TEATRO-CANTO", "TOCHO BANDERA", "VOLEIBOL"
  ];

  const select = document.querySelector('select[name="paraescolar"]');
  const folioInput = document.querySelector('input[name="folio"]');
  let paraescolarPrevio = null;

  if (folioInput && folioInput.value.trim()) {
    try {
      const res = await fetch(`/api/folio/${folioInput.value.trim()}`);
      const alumno = await res.json();
      paraescolarPrevio = alumno?.datos_generales?.paraescolar;
    } catch (e) {
      console.warn("No se pudo verificar el folio existente");
    }
  }

  opciones.forEach(async (opcion) => {
    try {
      const res = await fetch(`/api/validar-paraescolar/${encodeURIComponent(opcion)}`);
      const data = await res.json();
      if (data.count >= 50 && opcion !== paraescolarPrevio) {
        const optionElement = [...select.options].find(opt => opt.value === opcion);
        if (optionElement) {
          optionElement.disabled = true;
          optionElement.textContent += ' (LLENO)';
        }
      }
    } catch (e) {
      console.error("Error consultando paraescolar:", opcion);
    }
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

document.getElementById('registroForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const form = e.target;
  if (!validarFormularioCompleto(form)) return;

  const datos = new FormData(form);
  const objeto = {};
  for (let [clave, valor] of datos.entries()) {
    const partes = clave.split('.');
    if (partes.length === 1) {
      objeto[clave] = valor;
    } else {
      if (!objeto[partes[0]]) objeto[partes[0]] = {};
      objeto[partes[0]][partes[1]] = valor;
    }
  }

  try {
    const res = await fetch('/api/guardar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(objeto)
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || 'Error al guardar los datos.');
      return;
    }

    alert('Registro exitoso');
    form.reset();
  } catch (error) {
    console.error(error);
    alert('Error al enviar el formulario.');
  }
});

