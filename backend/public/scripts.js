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
    const catalogo = await res.json();

    // ⛑️ FILTRAR SOLO REGISTROS VÁLIDOS
    const datosValidos = catalogo.filter(e =>
      e.estado && e.municipio && e.localidad
    );

    const estadoNac = document.getElementById("estado_nacimiento");
    const municipioNac = document.getElementById("municipio_nacimiento");
    const ciudadNac = document.getElementById("ciudad_nacimiento");

    const estadoRes = document.getElementById("estado_nacimiento_general");
    const municipioRes = document.getElementById("municipio_nacimiento_general");
    const ciudadRes = document.getElementById("ciudad_nacimiento_general");

    if (!estadoNac || !estadoRes) return;

    // ===== ESTADOS ÚNICOS =====
    const estadosUnicos = [
      ...new Set(
        datosValidos.map(e => e.estado.toString().toUpperCase())
      )
    ];

    estadoNac.innerHTML = `<option value="">-- SELECCIONA ESTADO --</option>`;
    estadoRes.innerHTML = `<option value="">-- SELECCIONA ESTADO --</option>`;

    estadosUnicos.forEach(estado => {
      estadoNac.add(new Option(estado, estado));
      estadoRes.add(new Option(estado, estado));
    });

    /* ========= NACIMIENTO ========= */

    estadoNac.addEventListener("change", () => {
      municipioNac.innerHTML = `<option value="">-- SELECCIONA MUNICIPIO --</option>`;
      ciudadNac.innerHTML = `<option value="">-- SELECCIONA CIUDAD --</option>`;
      municipioNac.disabled = false;
      ciudadNac.disabled = true;

      const municipios = [
        ...new Set(
          datosValidos
            .filter(e => e.estado.toUpperCase() === estadoNac.value)
            .map(e => e.municipio.toUpperCase())
        )
      ];

      municipios.forEach(m => municipioNac.add(new Option(m, m)));
    });

    municipioNac.addEventListener("change", () => {
      ciudadNac.innerHTML = `<option value="">-- SELECCIONA CIUDAD --</option>`;
      ciudadNac.disabled = false;

      datosValidos
        .filter(e =>
          e.estado.toUpperCase() === estadoNac.value &&
          e.municipio.toUpperCase() === municipioNac.value
        )
        .forEach(c =>
          ciudadNac.add(
            new Option(c.localidad.toUpperCase(), c.localidad.toUpperCase())
          )
        );
    });

    /* ========= RESIDENCIA ========= */

    estadoRes.addEventListener("change", () => {
      municipioRes.innerHTML = `<option value="">-- SELECCIONA MUNICIPIO --</option>`;
      ciudadRes.innerHTML = `<option value="">-- SELECCIONA CIUDAD --</option>`;
      municipioRes.disabled = false;
      ciudadRes.disabled = true;

      const municipios = [
        ...new Set(
          datosValidos
            .filter(e => e.estado.toUpperCase() === estadoRes.value)
            .map(e => e.municipio.toUpperCase())
        )
      ];

      municipios.forEach(m => municipioRes.add(new Option(m, m)));
    });

    municipioRes.addEventListener("change", () => {
      ciudadRes.innerHTML = `<option value="">-- SELECCIONA CIUDAD --</option>`;
      ciudadRes.disabled = false;

      datosValidos
        .filter(e =>
          e.estado.toUpperCase() === estadoRes.value &&
          e.municipio.toUpperCase() === municipioRes.value
        )
        .forEach(c =>
          ciudadRes.add(
            new Option(c.localidad.toUpperCase(), c.localidad.toUpperCase())
          )
        );
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
});
