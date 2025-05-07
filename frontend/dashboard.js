
function mostrarSeccion(id) {
  document.querySelectorAll(".contenido").forEach(s => s.style.display = "none");
  document.getElementById(id).style.display = "block";
}

document.getElementById("excelForm").addEventListener("submit", async e => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const res = await fetch("/api/alumno/subir-excel", {
    method: "POST",
    body: formData
  });
  const data = await res.json();
  document.getElementById("excelMsg").innerText = data.message;
});

async function cargarRegistros() {
  const res = await fetch("/api/alumno/listar");
  const data = await res.json();
  const tbody = document.querySelector("#tablaRegistros tbody");
  tbody.innerHTML = "";
  data.forEach(a => {
    const row = `<tr><td>${a._id}</td><td>${a.datos_alumno.nombres}</td><td>${a.datos_alumno.periodo_semestral}</td></tr>`;
    tbody.innerHTML += row;
  });
}
document.querySelector("button[onclick*='verRegistros']").addEventListener("click", cargarRegistros);

async function generarPDF() {
  const folio = document.getElementById("folioPDF").value;
  const res = await fetch(`/api/alumno/pdf/${folio}`);
  if (!res.ok) return alert("Folio no encontrado.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url);
}
