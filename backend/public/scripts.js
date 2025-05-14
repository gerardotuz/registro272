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
  
  // Puedes usar esto en cualquier formulario así:
  // if (!validarFormularioCompleto(miFormulario)) return;
  