// /public/js/dashboard.js
document.addEventListener('DOMContentLoaded', () => {
  // Validar login localStorage
  if (!localStorage.getItem('login')) {
    window.location.href = '/login.html';
  }

  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('login');
    window.location.href = '/login.html';
  });

  const searchFolio = document.getElementById('searchFolio');
  const searchApellidos = document.getElementById('searchApellidos');
  const btnBuscar = document.getElementById('btnBuscar');
  const resultadosTable = document.getElementById('resultadosTable');

  btnBuscar.addEventListener('click', async () => {
    resultadosTable.innerHTML = '';

    const folio = searchFolio.value.trim();
    const apellidos = searchApellidos.value.trim();

    const res = await fetch(`/api/dashboard/alumnos?folio=${folio}&apellidos=${apellidos}`);
    const data = await res.json();

    data.forEach(alumno => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${alumno.folio}</td>
        <td>${alumno.datos_alumno.primer_apellido} ${alumno.datos_alumno.segundo_apellido} ${alumno.datos_alumno.nombres}</td>
        <td>${alumno.datos_alumno.curp}</td>
        <td>${alumno.datos_alumno.semestre}</td>
        <td>${alumno.datos_alumno.grupo}</td>
        <td>
          <button class="btn btn-sm btn-warning btnEditar" data-id="${alumno._id}">Editar</button>
          <button class="btn btn-sm btn-danger btnEliminar" data-id="${alumno._id}">Eliminar</button>
        </td>
      `;
      resultadosTable.appendChild(row);
    });

    // Botones CRUD
    document.querySelectorAll('.btnEditar').forEach(btn => {
      btn.addEventListener('click', abrirModalEdicion);
    });
    document.querySelectorAll('.btnEliminar').forEach(btn => {
      btn.addEventListener('click', eliminarAlumno);
    });
  });

  function abrirModalEdicion(e) {
    const id = e.target.dataset.id;
    fetch(`/api/dashboard/alumnos/${id}`)
      .then(res => res.json())
      .then(alumno => {
        document.getElementById('editId').value = alumno._id;
        document.getElementById('editPrimerApellido').value = alumno.datos_alumno.primer_apellido;
        document.getElementById('editSegundoApellido').value = alumno.datos_alumno.segundo_apellido;
        document.getElementById('editNombres').value = alumno.datos_alumno.nombres;

        new bootstrap.Modal(document.getElementById('editModal')).show();
      });
  }

  document.getElementById('btnGuardar').addEventListener('click', () => {
    const id = document.getElementById('editId').value;
    const datos = {
      datos_alumno: {
        primer_apellido: document.getElementById('editPrimerApellido').value,
        segundo_apellido: document.getElementById('editSegundoApellido').value,
        nombres: document.getElementById('editNombres').value
      }
    };

    fetch(`/api/dashboard/alumnos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    }).then(() => {
      alert('Cambios guardados');
      location.reload();
    });
  });

  function eliminarAlumno(e) {
    const id = e.target.dataset.id;
    if (confirm('¿Eliminar este alumno?')) {
      fetch(`/api/dashboard/alumnos/${id}`, { method: 'DELETE' })
        .then(() => {
          alert('Alumno eliminado');
          location.reload();
        });
    }
  }
});
