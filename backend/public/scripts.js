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

);
