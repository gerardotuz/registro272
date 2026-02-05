/* =========================
   CONFIGURACIÓN BASE
========================= */

const BASE_URL = window.location.origin.includes("localhost")
  ? "http://localhost:3001"
  : "https://registro272.onrender.com";

/* =========================
   INICIALIZACIÓN
========================= */

document.addEventListener("DOMContentLoaded", () => {
  cargarCatalogo("nacimiento");
  cargarCatalogo("nacimiento_general");

  const form = document.getElementById("registroForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // 🔒 VALIDAR CAMPOS REQUIRED
    const obligatorios = form.querySelectorAll("[required]");
    for (const campo of obligatorios) {
      if (!campo.value || !campo.value.trim()) {
        alert(`⚠️ Completa el campo: ${campo.name}`);
        campo.focus();
        return;
      }
    }

    const formData = new FormData(form);

    const nuevoRegistro = {
      datos_alumno: {
        nombres: formData.get("nombres"),
        primer_apellido: formData.get("primer_apellido"),
        segundo_apellido: formData.get("segundo_apellido"),
        curp: formData.get("curp"),
        fecha_nacimiento: formData.get("fecha_nacimiento"),
        edad: formData.get("edad"),
        sexo: formData.get("sexo"),
        estado_civil: formData.get("estado_civil"),
        nacionalidad: formData.get("nacionalidad"),
        pais_extranjero: formData.get("pais_extranjero"),
        primera_opcion: formData.get("primera_opcion"),
        segunda_opcion: formData.get("segunda_opcion"),
        tercera_opcion: formData.get("tercera_opcion"),
        cuarta_opcion: formData.get("cuarta_opcion")
      },
      datos_generales: {
        colonia: formData.get("colonia"),
        domicilio: formData.get("domicilio"),
        codigo_postal: formData.get("codigo_postal"),
        telefono_alumno: formData.get("telefono_alumno"),
        correo_alumno: formData.get("correo_alumno")
      },
      secundaria_origen: {
        nombre_secundaria: formData.get("nombre_secundaria"),
        regimen: formData.get("regimen"),
        promedio_general: formData.get("promedio_general"),
        modalidad: formData.get("modalidad")
      },
      tutor_responsable: {
        nombre_padre: formData.get("nombre_padre"),
        telefono_padre: formData.get("telefono_padre"),
        nombre_madre: formData.get("nombre_madre"),
        telefono_madre: formData.get("telefono_madre"),
        vive_con: formData.get("vive_con")
      }
    };

    try {
      const res = await fetch(`${BASE_URL}/api/guardar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevoRegistro)
      });

      const result = await res.json();

      if (!res.ok) {
        alert(result.message || "❌ Error al guardar");
        return;
      }

      alert(`✅ Registro exitoso\nFolio: ${result.alumno.folio}`);
      if (result.pdf_url) window.open(result.pdf_url, "_blank");

      deshabilitarFormulario();

    } catch (err) {
      console.error(err);
      alert("❌ Error de conexión con el servidor");
    }
  });
});

/* =========================
   CARGA DE CATÁLOGO (CORRECTA)
========================= */

function cargarCatalogo(sufijo) {
  fetch("/catalogo.json")
    .then(res => res.json())
    .then(data => cargarSelectores(sufijo, data))
    .catch(err => console.error("❌ Error cargando catálogo:", err));
}

function cargarSelectores(sufijo, data) {
  const estado = document.getElementById(`estado_${sufijo}`);
  const municipio = document.getElementById(`municipio_${sufijo}`);
  const ciudad = document.getElementById(`ciudad_${sufijo}`);

  if (!estado || !municipio || !ciudad) return;

  estado.innerHTML = `<option value="">-- SELECCIONA ESTADO --</option>`;
  municipio.innerHTML = `<option value="">-- SELECCIONA MUNICIPIO --</option>`;
  ciudad.innerHTML = `<option value="">-- SELECCIONA CIUDAD --</option>`;

  data.forEach(est => {
    const opt = document.createElement("option");
    opt.value = est.nombre;
    opt.dataset.municipios = JSON.stringify(est.municipios || []);
    opt.textContent = est.nombre;
    estado.appendChild(opt);
  });

  estado.addEventListener("change", () => {
    const municipios = JSON.parse(
      estado.selectedOptions[0]?.dataset.municipios || "[]"
    );

    municipio.innerHTML = `<option value="">-- SELECCIONA MUNICIPIO --</option>`;
    ciudad.innerHTML = `<option value="">-- SELECCIONA CIUDAD --</option>`;
    municipio.disabled = municipios.length === 0;
    ciudad.disabled = true;

    municipios.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m.nombre;
      opt.dataset.localidades = JSON.stringify(m.localidades || []);
      opt.textContent = m.nombre;
      municipio.appendChild(opt);
    });
  });

  municipio.addEventListener("change", () => {
    const localidades = JSON.parse(
      municipio.selectedOptions[0]?.dataset.localidades || "[]"
    );

    ciudad.innerHTML = `<option value="">-- SELECCIONA CIUDAD --</option>`;
    ciudad.disabled = localidades.length === 0;

    localidades.forEach(l => {
      const opt = document.createElement("option");
      opt.value = l.nombre;
      opt.textContent = l.nombre;
      ciudad.appendChild(opt);
    });
  });
}

/* =========================
   BLOQUEAR FORMULARIO
========================= */

function deshabilitarFormulario() {
  const form = document.getElementById("registroForm");
  Array.from(form.elements).forEach(el => el.disabled = true);
}
