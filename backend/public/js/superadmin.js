const token = localStorage.getItem("superToken");

if (!token) {
  window.location.href = "/views/superadmin-login.html";
}

async function cargarTotales() {
  const res = await fetch("/api/superadmin/totales");
  const data = await res.json();

  const contenedor = document.getElementById("totales");
  contenedor.innerHTML = "";

  for (let plantel in data) {
    contenedor.innerHTML += `
      <div class="card">
        <h3>${plantel}</h3>
        <p>${data[plantel]} alumnos</p>
      </div>
    `;
  }
}

async function buscar() {
  const curp = document.getElementById("curpBuscar").value;

  const res = await fetch(`/api/superadmin/buscar/${curp}`);
  const data = await res.json();

  const div = document.getElementById("resultadoBusqueda");

  if (data.encontrado) {
    div.innerHTML = `
      <h3>Encontrado en ${data.plantel}</h3>
      <p>Nombre: ${data.alumno.datos_alumno.nombres}</p>
      <p>CURP: ${data.alumno.datos_alumno.curp}</p>
      <p>Folio: ${data.alumno.folio}</p>
    `;
  } else {
    div.innerHTML = "No encontrado";
  }
}

function exportar() {
  window.open("/api/superadmin/exportar-general");
}

function logout() {
  localStorage.removeItem("superToken");
  window.location.href = "/views/superadmin-login.html";
}

cargarTotales();

