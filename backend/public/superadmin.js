const token = localStorage.getItem("superadmin_token");

if (!token) {
  window.location.href = "/superadmin-login.html";
}

async function cargarEstadisticas() {
  const res = await fetch("/api/superadmin/estadisticas", {
    headers: {
      Authorization: "Bearer " + token
    }
  });

  const data = await res.json();

  document.getElementById("totalGeneral").textContent = data.totalGeneral;
  document.getElementById("liderPlantel").textContent =
    data.lider.plantel + " (" + data.lider.total + ")";

  const tbody = document.querySelector("#tablaPlanteles tbody");
  tbody.innerHTML = "";

  const labels = [];
  const valores = [];

  for (const plantel in data.detalle) {
    labels.push(plantel);
    valores.push(data.detalle[plantel]);

    tbody.innerHTML += `
      <tr>
        <td>${plantel}</td>
        <td>${data.detalle[plantel]}</td>
      </tr>
    `;
  }

  crearGrafica(labels, valores);
}

function crearGrafica(labels, valores) {
  const ctx = document.getElementById("graficaPlanteles");

  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Registros por Plantel",
        data: valores,
        backgroundColor: "#7a1e2c"
      }]
    }
  });
}




async function cargarRepetidas() {
  const res = await fetch("/api/superadmin/curps-repetidas", {
    headers: { Authorization: "Bearer " + token }
  });

  const data = await res.json();
  const tbody = document.querySelector("#tablaRepetidas tbody");
  tbody.innerHTML = "";

  data.forEach(item => {
    item.registros.forEach((reg, index) => {

      const conservar = index === 0 ? "✔ Conservar" : "";

      tbody.innerHTML += `
        <tr>
          <td>${item.curp}</td>
          <td>${item.apariciones}</td>
          <td>${reg.plantel}</td>
          <td>${reg.folio}</td>
          <td>${new Date(reg.fecha).toLocaleString()}</td>
          <td>
            ${index !== 0 ? 
              `<button onclick="eliminarRegistro('${reg.plantel}','${reg.folio}')">
                Eliminar
              </button>` 
              : conservar}
          </td>
        </tr>
      `;
    });
  });
}

async function eliminarRegistro(db, folio) {
  if (!confirm("¿Seguro que deseas eliminar este registro?")) return;

  await fetch(`/api/superadmin/eliminar/${db}/${folio}`, {
    method: "DELETE",
    headers: { Authorization: "Bearer " + token }
  });

  cargarRepetidas();
}


async function eliminarRegistro(db, folio) {
  if (!confirm("¿Seguro que deseas eliminar este registro?")) return;

  await fetch(`/api/superadmin/eliminar/${db}/${folio}`, {
    method: "DELETE",
    headers: { Authorization: "Bearer " + token }
  });

  cargarRepetidas();
}

async function cargarMatriz() {
  const res = await fetch("/api/superadmin/curps-matriz", {
    headers: { Authorization: "Bearer " + token }
  });

  const result = await res.json();

  const planteles = result.planteles;
  const data = result.data;

  const thead = document.querySelector("#tablaMatriz thead");
  const tbody = document.querySelector("#tablaMatriz tbody");

  thead.innerHTML = "";
  tbody.innerHTML = "";

  // Construir encabezados
  let headerRow = "<tr><th>CURP</th>";

  planteles.forEach(p => {
    headerRow += `<th>${p}</th>`;
  });

  headerRow += "</tr>";
  thead.innerHTML = headerRow;

  // Construir filas
  data.forEach(item => {
    let row = `<tr><td>${item.curp}</td>`;

    planteles.forEach(p => {
      if (item[p]) {
        row += `
          <td>
            Folio: ${item[p].folio}<br>
            Fecha: ${new Date(item[p].fecha).toLocaleString()}<br>
            <button onclick="eliminarRegistro('${p}','${item[p].folio}')">
              Eliminar
            </button>
          </td>
        `;
      } else {
        row += `<td>-</td>`;
      }
    });

    row += "</tr>";
    tbody.innerHTML += row;
  });
}


async function cargarBloqueo() {
  const res = await fetch("/api/superadmin/bloqueo");
  const data = await res.json();

  const switchEl = document.getElementById("bloqueoSwitch");
  const texto = document.getElementById("estadoTexto");

  switchEl.checked = data.bloqueo;

  texto.textContent = data.bloqueo ? "CERRADO" : "ABIERTO";
}

document.getElementById("bloqueoSwitch").addEventListener("change", async (e) => {
  await fetch("/api/superadmin/bloqueo", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ estado: e.target.checked })
  });

  cargarBloqueo();
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("superadmin_token");
  window.location.href = "/superadmin-login.html";
});

cargarEstadisticas();
cargarBloqueo();
