/* =========================
   CONFIGURACIÓN BASE
========================= */

const BASE_URL = window.location.origin.includes("localhost")
  ? "http://localhost:3001"
  : "https://registro272.onrender.com";

/* =========================
   CATÁLOGO ESTADOS / MUNICIPIOS / CIUDADES
========================= */

async function cargarCatalogo() {
  try {
    const res = await fetch("/catalogo.json");
    const data = await res.json();

    const estadoNac = document.getElementById("estado_nacimiento");
    const municipioNac = document.getElementById("municipio_nacimiento");
    const ciudadNac = document.getElementById("ciudad_nacimiento");

    const estadoRes = document.getElementById("estado_nacimiento_general");
    const municipioRes = document.getElementById("municipio_nacimiento_general");
    const ciudadRes = document.getElementById("ciudad_nacimiento_general");

    if (!estadoNac || !estadoRes) return;

    estadoNac.innerHTML = `<option value="">-- SELECCIONA ESTADO --</option>`;
    estadoRes.innerHTML = `<option value="">-- SELECCIONA ESTADO --</option>`;

    data.forEach(e => {
      estadoNac.add(new Option(e.estado, e.estado));
      estadoRes.add(new Option(e.estado, e.estado));
    });

    // NACIMIENTO
    estadoNac.addEventListener("change", () => {
      municipioNac.innerHTML = `<option value="">-- SELECCIONA MUNICIPIO --</option>`;
      ciudadNac.innerHTML = `<option value="">-- SELECCIONA CIUDAD --</option>`;
      municipioNac.disabled = false;
      ciudadNac.disabled = true;

      data
        .filter(d => d.estado === estadoNac.value)
        .forEach(m => municipioNac.add(new Option(m.municipio, m.municipio)));
    });

    municipioNac.addEventListener("change", () => {
      ciudadNac.innerHTML = `<option value="">-- SELECCIONA CIUDAD --</option>`;
      ciudadNac.disabled = false;

      data
        .filter(d =>
          d.estado === estadoNac.value &&
          d.municipio === municipioNac.value
        )
        .forEach(c => ciudadNac.add(new Option(c.localidad, c.localidad)));
    });

    // RESIDENCIA
    estadoRes.addEventListener("change", () => {
      municipioRes.innerHTML = `<option value="">-- SELECCIONA MUNICIPIO --</option>`;
      ciudadRes.innerHTML = `<option value="">-- SELECCIONA CIUDAD --</option>`;
      municipioRes.disabled = false;
      ciudadRes.disabled = true;

      data
        .filter(d => d.estado === estadoRes.value)
        .forEach(m => municipioRes.add(new Option(m.municipio, m.municipio)));
    });

    municipioRes.addEventListener("change", () => {
      ciudadRes.innerHTML = `<option value="">-- SELECCIONA CIUDAD --</option>`;
      ciudadRes.disabled = false;

      data
        .filter(d =>
          d.estado === estadoRes.value &&
          d.municipio === municipioRes.value
        )
        .forEach(c => ciudadRes.add(new Option(c.localidad, c.localidad)));
    });

  } catch (err) {
    console.error("❌ Error cargando catálogo:", err);
  }
}

/* =========================
   INICIALIZACIÓN
========================= */

document.addEventListener("DOMContentLoaded", () => {
  cargarCatalogo();

  const form = document.getElementById("registroForm");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // VALIDAR CAMPOS REQUIRED (NO SE ELIMINAN)
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

      alert(`✅ Registro exitoso\nFolio asignado: ${result.alumno.folio}`);

      if (result.pdf_url) {
        window.open(result.pdf_url, "_blank");
      }

      deshabilitarFormulario();

    } catch (err) {
      console.error(err);
      alert("❌ Error de conexión con el servidor");
    }
  });
});

/* =========================
   BLOQUEAR FORMULARIO
========================= */

function deshabilitarFormulario() {
  const form = document.getElementById("registroForm");
  Array.from(form.elements).forEach(el => el.disabled = true);
}
