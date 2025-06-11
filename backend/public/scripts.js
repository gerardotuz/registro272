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
    "TEATRO-CANTO", "TOCHO BANDERA", "VOLEIBOL", "ORATORIA-DECLAMACION", "CORO", "MÚSICA"
  ];

  const select = document.querySelector('select[name="datos_generales.paraescolar"]');
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
      if (data.count >= 40 && opcion !== paraescolarPrevio) {
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
  const errores = [];

  campos.forEach(campo => {
    const visible = campo.offsetParent !== null;
    const habilitado = !campo.disabled;
    if (visible && habilitado && (!campo.value || !campo.value.trim())) {
      errores.push(campo.name);
    }
  });

  if (errores.length > 0) {
    alert("Faltan campos obligatorios:
" + errores.join("\n"));
    const primerCampo = form.querySelector(`[name="${errores[0]}"]`);
    if (primerCampo) primerCampo.focus();
    return false;
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
      if (partes.length === 3) {
        if (!objeto[partes[0]][partes[1]]) objeto[partes[0]][partes[1]] = {};
        objeto[partes[0]][partes[1]][partes[2]] = valor;
      } else {
        objeto[partes[0]][partes[1]] = valor;
      }
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

    if (data.pdf_url) {
      const div = document.getElementById('pdfLink');
      div.innerHTML = '';
      const link = document.createElement('a');
      link.href = data.pdf_url;
      link.textContent = '📄 Ver PDF generado';
      link.target = '_blank';
      link.style.display = 'inline-block';
      link.style.marginTop = '10px';
      link.style.color = '#0066cc';
      div.appendChild(link);
    }

  } catch (error) {
    console.error(error);
    alert('Error al enviar el formulario.');
  }
});
