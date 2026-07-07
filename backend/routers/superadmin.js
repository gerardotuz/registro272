const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const XLSX = require("xlsx");
const multer = require("multer");
const fs = require("fs");

const alumnoSchema = require("../models/Alumno").schema;

const ConfigSchema = new mongoose.Schema({
  bloqueo_registro: { type: Boolean, default: false }
});

const Config = require("../models/config.model");



/* =========================================
   CONFIGURACIÓN
========================================= */

const uri = process.env.MONGO_URI;

const planteles = [
  "registro214",
  "registro253",
  "registro272",
  "registro301",
  "registro309",
  "registro111",
  "registro72",
  "registro28"
];

/* =========================================
   MIDDLEWARE SUPERADMIN
========================================= */

function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Token requerido" });
  }

  const token = authHeader.split(" ")[1];

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(403).json({ error: "Token inválido" });
  }
}

/* =========================================
   CONEXIÓN DINÁMICA
========================================= */

function getConnection(dbName) {
  return mongoose.createConnection(uri, { dbName });
}

/* =========================================
   📊 RESUMEN GENERAL (para tarjetas)
========================================= */

router.get("/resumen", verificarToken, async (req, res) => {
  const resultados = {};

  for (const db of planteles) {
    const conn = getConnection(db);
    const Alumno = conn.model("Alumno", alumnoSchema);

    const total = await Alumno.countDocuments({
      registro_completado: true
    });

    resultados[db] = total;

    await conn.close();
  }

  res.json(resultados);
});

/* =========================================
   📋 LISTADO POR PLANTEL
========================================= */

router.get("/plantel/:db", verificarToken, async (req, res) => {
  const db = req.params.db;

  if (!planteles.includes(db)) {
    return res.status(400).json({ error: "Plantel inválido" });
  }

  const conn = getConnection(db);
  const Alumno = conn.model("Alumno", alumnoSchema);

  const alumnos = await Alumno.find({
    registro_completado: true
  }).lean();

  await conn.close();

  res.json(alumnos);
});

/* =========================================
   🔎 BUSCAR CURP GLOBAL
========================================= */

router.get("/buscar/:curp", verificarToken, async (req, res) => {
  const curp = req.params.curp.toUpperCase();
  const resultados = [];

  for (const db of planteles) {
    const conn = getConnection(db);
    const Alumno = conn.model("Alumno", alumnoSchema);

    const alumno = await Alumno.findOne({
      "datos_alumno.curp": curp,
      registro_completado: true
    }).lean();

    await conn.close();

    if (alumno) {
      resultados.push({
        plantel: db,
        nombres: alumno.datos_alumno?.nombres || "",
        primer_apellido: alumno.datos_alumno?.primer_apellido || "",
        curp: alumno.datos_alumno?.curp || "",
        folio: alumno.folio || ""
      });
    }
  }

  res.json(resultados);
});

/* =========================================
   📤 EXPORTAR EXCEL GENERAL
========================================= */

router.get("/exportar", verificarToken, async (req, res) => {
  let datos = [];

  for (const db of planteles) {
    const conn = getConnection(db);
    const Alumno = conn.model("Alumno", alumnoSchema);

    const alumnos = await Alumno.find({
      registro_completado: true
    }).lean();

    alumnos.forEach(a => {
      datos.push({
        plantel: db,
        nombre: a.datos_alumno?.nombres || "",
        apellido: a.datos_alumno?.primer_apellido || "",
        curp: a.datos_alumno?.curp || "",
        folio: a.folio || ""
      });
    });

    await conn.close();
  }

  const worksheet = XLSX.utils.json_to_sheet(datos);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "General");

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx"
  });

  res.setHeader(
    "Content-Disposition",
    "attachment; filename=general-planteles.xlsx"
  );

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );

  res.send(buffer);
});

router.get("/estadisticas", verificarToken, async (req, res) => {
  let totalGeneral = 0;
  let lider = { plantel: null, total: 0 };
  const detalle = {};

  for (const db of planteles) {
    const conn = getConnection(db);
    const Alumno = conn.model("Alumno", alumnoSchema);

    const total = await Alumno.countDocuments({
      registro_completado: true
    });

    detalle[db] = total;
    totalGeneral += total;

    if (total > lider.total) {
      lider = { plantel: db, total };
    }

    await conn.close();
  }

  res.json({
    totalGeneral,
    lider,
    detalle
  });
});

router.post("/bloqueo", verificarToken, async (req, res) => {
  const { estado } = req.body; // true o false

  let config = await Config.findOne();

  if (!config) {
    config = new Config();
  }

  config.bloqueo_registro = estado;
  await config.save();

  res.json({ bloqueo: estado });
});
router.get("/bloqueo", async (req, res) => {
  const config = await Config.findOne();
  res.json({ bloqueo: config?.bloqueo_registro || false });
});


/* =========================================
   🔁 CURPS REPETIDAS CON FECHA
========================================= */

router.get("/curps-repetidas", verificarToken, async (req, res) => {
  const mapaCurps = {};

  for (const db of planteles) {
    const conn = getConnection(db);
    const Alumno = conn.model("Alumno", alumnoSchema);

    const alumnos = await Alumno.find(
      { registro_completado: true },
      {
        "datos_alumno.curp": 1,
        folio: 1,
        fecha_registro: 1
      }
    ).lean();

    for (const alumno of alumnos) {
      const curp = alumno?.datos_alumno?.curp;
      if (!curp) continue;

      if (!mapaCurps[curp]) {
        mapaCurps[curp] = [];
      }

      mapaCurps[curp].push({
        plantel: db,
        folio: alumno.folio,
        fecha: alumno.fecha_registro || alumno._id.getTimestamp()
      });
    }

    await conn.close();
  }

  const repetidas = [];

  for (const curp in mapaCurps) {
    if (mapaCurps[curp].length > 1) {

      // Ordenar por fecha (más antiguo primero)
      mapaCurps[curp].sort(
        (a, b) => new Date(a.fecha) - new Date(b.fecha)
      );

      repetidas.push({
        curp,
        apariciones: mapaCurps[curp].length,
        registros: mapaCurps[curp]
      });
    }
  }

  res.json(repetidas);
});
/* =========================================
   🗑 ELIMINAR REGISTRO ESPECÍFICO
========================================= */

router.delete("/eliminar/:db/:folio", verificarToken, async (req, res) => {
  const { db, folio } = req.params;

  if (!planteles.includes(db)) {
    return res.status(400).json({ error: "Plantel inválido" });
  }

  const conn = getConnection(db);
  const Alumno = conn.model("Alumno", alumnoSchema);

  await Alumno.deleteOne({ folio });

  await conn.close();

  res.json({ mensaje: "Registro eliminado correctamente" });
});


/* =========================================
   📊 MATRIZ DE CURPS REPETIDAS POR PLANTEL
========================================= */

router.get("/curps-matriz", verificarToken, async (req, res) => {
  const mapaCurps = {};

  for (const db of planteles) {
    const conn = getConnection(db);
    const Alumno = conn.model("Alumno", alumnoSchema);

    const alumnos = await Alumno.find(
      { registro_completado: true },
      {
        "datos_alumno.curp": 1,
        folio: 1,
        fecha_registro: 1
      }
    ).lean();

    for (const alumno of alumnos) {
      const curp = alumno?.datos_alumno?.curp;
      if (!curp) continue;

      if (!mapaCurps[curp]) {
        mapaCurps[curp] = {};
      }

      mapaCurps[curp][db] = {
        folio: alumno.folio,
        fecha: alumno.fecha_registro || alumno._id.getTimestamp()
      };
    }

    await conn.close();
  }

  const resultado = [];

  for (const curp in mapaCurps) {
    const registros = Object.keys(mapaCurps[curp]);

    if (registros.length > 1) {
      resultado.push({
        curp,
        ...mapaCurps[curp]
      });
    }
  }

  res.json({
    planteles,
    data: resultado
  });
});

/* =========================================
   🧩 ASIGNACIÓN EQUILIBRADA DE GRUPOS
========================================= */
const uploadAsignacion = multer({ dest: "uploads/" });

function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function obtenerValor(row, aliases) {
  const entradas = Object.entries(row);
  for (const alias of aliases) {
    const normalizado = normalizarTexto(alias);
    const encontrado = entradas.find(([key]) => normalizarTexto(key) === normalizado);
    if (encontrado) return encontrado[1];
  }
  return "";
}

function detectarSexo(valor) {
  const sexo = normalizarTexto(valor);
  if (["h", "hombre", "masculino", "m", "male"].includes(sexo)) return "H";
  if (["f", "mujer", "femenino", "female"].includes(sexo)) return "M";
  return "N/D";
}

function obtenerNumero(valor) {
  const numero = Number(String(valor || "").replace(",", "."));
  return Number.isFinite(numero) ? numero : 0;
}

function crearGruposParaCarrera(carrera, config, totalAlumnos) {
  const grupos = [];
  const matutino = Math.max(0, Number(config?.matutino || 0));
  const vespertino = Math.max(0, Number(config?.vespertino || 0));
  const capacidad = Math.max(1, Number(config?.capacidad || 50));

  for (let i = 1; i <= matutino; i++) {
    grupos.push({ carrera, turno: "Matutino", grupo: `M${i}`, capacidad, alumnos: [] });
  }

  for (let i = 1; i <= vespertino; i++) {
    grupos.push({ carrera, turno: "Vespertino", grupo: `V${i}`, capacidad, alumnos: [] });
  }

  if (grupos.length === 0) {
    const necesarios = Math.max(1, Math.ceil(totalAlumnos / capacidad));
    for (let i = 1; i <= necesarios; i++) {
      grupos.push({ carrera, turno: i % 2 ? "Matutino" : "Vespertino", grupo: `AUTO${i}`, capacidad, alumnos: [] });
    }
  }

  return grupos;
}

function puntajeGrupo(grupo, alumno) {
  const total = grupo.alumnos.length;
  const cupoPenalizacion = total >= grupo.capacidad ? 100000 : 0;
  const sexoActual = grupo.alumnos.filter(a => a.sexo === alumno.sexo).length;
  const promedioGrupo = total
    ? grupo.alumnos.reduce((sum, a) => sum + a.promedio, 0) / total
    : 0;

  return (total * 12) + (sexoActual * 8) + Math.abs(promedioGrupo - alumno.promedio) + cupoPenalizacion;
}

function crearWorkbookPlantillaAsignacion() {
  const encabezados = [
   
    "nombre",
    "sexo",
    "promedio"
  ];

  const ejemplo = [
   { nombre: "JUAN PEREZ LOPEZ", sexo: "H", promedio: 92.5 },
    { nombre: "MARIA GARCIA RUIZ", sexo: "M", promedio: 89.75 },
    { nombre: "ANA LOPEZ MARTINEZ", sexo: "F", promedio: 95 }
  ];

  const instrucciones = [
   
    { campo: "nombre", descripcion: "Nombre completo del alumno." },
    { campo: "sexo", descripcion: "Acepta H/M, Hombre/Mujer, Masculino/Femenino o F." },
    { campo: "promedio", descripcion: "Promedio del examen de admisión. Usa número, por ejemplo 92.5." }
  ];

  const libro = XLSX.utils.book_new();
  const hojaAlumnos = XLSX.utils.json_to_sheet(ejemplo, { header: encabezados });
  XLSX.utils.sheet_add_aoa(hojaAlumnos, [encabezados], { origin: "A1" });
  hojaAlumnos["!cols"] = [
    
    { wch: 34 },
    { wch: 12 },
    { wch: 14 }
  ];

  const hojaInstrucciones = XLSX.utils.json_to_sheet(instrucciones);
  hojaInstrucciones["!cols"] = [{ wch: 18 }, { wch: 80 }];

  XLSX.utils.book_append_sheet(libro, hojaAlumnos, "Alumnos");
  XLSX.utils.book_append_sheet(libro, hojaInstrucciones, "Instrucciones");
  return libro;
}

function crearGruposDesdeConfiguracion(configuracion, totalAlumnos) {
  const entradas = Object.entries(configuracion || {}).filter(([carrera]) => carrera.trim());

  if (!entradas.length) {
    return crearGruposParaCarrera("GENERAL", {}, totalAlumnos);
  }

  return entradas.flatMap(([carrera, config]) => crearGruposParaCarrera(carrera.trim(), config, totalAlumnos));
}

function agregarResumenYResultado(grupos, resultado, resumen) {
  grupos.forEach(grupo => {
    const hombres = grupo.alumnos.filter(a => a.sexo === "H").length;
    const mujeres = grupo.alumnos.filter(a => a.sexo === "M").length;
    const promedio = grupo.alumnos.length
      ? grupo.alumnos.reduce((sum, a) => sum + a.promedio, 0) / grupo.alumnos.length
      : 0;

    resumen.push({
      carrera: grupo.carrera,
      turno: grupo.turno,
      grupo: grupo.grupo,
      total: grupo.alumnos.length,
      hombres,
      mujeres,
      sin_dato_sexo: grupo.alumnos.length - hombres - mujeres,
      promedio_grupo: Number(promedio.toFixed(2))
    });

    grupo.alumnos
      .sort((a, b) => b.promedio - a.promedio)
      .forEach((alumno, posicion) => {
        resultado.push({
          carrera: grupo.carrera,
          turno: grupo.turno,
          grupo: grupo.grupo,
          numero_lista: posicion + 1,
          nombre: alumno.nombre,
          sexo: alumno.sexo,
          promedio_examen: alumno.promedio,
          orden_promedio_carrera: alumno.ordenPromedioCarrera
        });
      });
  });
}

function asignarListaEnGrupos(lista, grupos) {
  const ordenados = [...lista].sort((a, b) => b.promedio - a.promedio);

  ordenados.forEach((alumno, index) => {
    const candidatos = grupos
      .map(grupo => ({ grupo, score: puntajeGrupo(grupo, alumno) }))
      .sort((a, b) => a.score - b.score || a.grupo.alumnos.length - b.grupo.alumnos.length);
    const elegido = candidatos[0].grupo;
    elegido.alumnos.push({ ...alumno, ordenPromedioCarrera: index + 1 });
  });
}

function asignarAlumnosPorCarrera(alumnos, configuracion) {
   const resultado = [];
  const resumen = [];
  const todosSinCarrera = alumnos.every(alumno => !alumno.carrera);

  if (todosSinCarrera) {
    const grupos = crearGruposDesdeConfiguracion(configuracion, alumnos.length);
    asignarListaEnGrupos(alumnos, grupos);
    agregarResumenYResultado(grupos, resultado, resumen);
    return { resultado, resumen };
  }
  const porCarrera = alumnos.reduce((acc, alumno) => {
  const carrera = alumno.carrera || "GENERAL";
    acc[carrera] = acc[carrera] || [];
    acc[carrera].push(alumno);
    return acc;
  }, {});

 

  for (const [carrera, lista] of Object.entries(porCarrera)) {
    const config = configuracion[carrera] || configuracion[normalizarTexto(carrera)] || {};
    const grupos = crearGruposParaCarrera(carrera, config, lista.length);
    asignarListaEnGrupos(lista, grupos);
    agregarResumenYResultado(grupos, resultado, resumen);
  }

  return { resultado, resumen };
}
router.get("/asignacion-grupos/template", (req, res) => {
  try {
    const libro = crearWorkbookPlantillaAsignacion();
    const buffer = XLSX.write(libro, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", "attachment; filename=plantilla-asignacion-grupos.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (error) {
    console.error("ERROR PLANTILLA ASIGNACION GRUPOS:", error);
    res.status(500).json({ error: "Error al generar la plantilla de asignación de grupos" });
  }
});

router.post("/asignacion-grupos", uploadAsignacion.single("excel"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se recibió archivo Excel" });

    const configuracion = JSON.parse(req.body.configuracion || "{}");
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    const alumnos = rows.map((row, index) => ({
      filaExcel: index + 2,
       carrera: String(obtenerValor(row, ["carrera", "especialidad", "programa"]) || "").trim(),
      nombre: String(obtenerValor(row, ["nombre", "alumno", "alumna", "nombre completo", "nombres"]) || "").trim(),
      sexo: detectarSexo(obtenerValor(row, ["sexo", "genero", "género"])),
      promedio: obtenerNumero(obtenerValor(row, ["promedio", "promedio examen", "promedio del examen de admisión", "examen", "calificacion", "calificación"]))
   })).filter(alumno => alumno.nombre);

    fs.unlinkSync(req.file.path);

    if (!alumnos.length) {
       return res.status(400).json({ error: "El Excel no contiene alumnos válidos. Revisa encabezados: nombre, sexo y promedio." });
    }

    const { resultado, resumen } = asignarAlumnosPorCarrera(alumnos, configuracion);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(resultado), "Asignacion");
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(resumen), "Resumen");

    const buffer = XLSX.write(libro, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Disposition", "attachment; filename=asignacion-grupos.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error("ERROR ASIGNACION GRUPOS:", error);
    res.status(500).json({ error: "Error al generar asignación de grupos" });
  }
});


/* =========================================
   🤝 MATCH SEP VS ALUMNOS NUEVO INGRESO
========================================= */
const uploadMatchSep = multer({ dest: "uploads/" });

function normalizarNombreMatch(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Ñ/g, "N")
    .replace(/ñ/g, "n")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function separarNombreAlumno(alumno) {
  const datos = alumno?.datos_alumno || {};
  return [datos.nombres, datos.primer_apellido, datos.segundo_apellido]
    .filter(Boolean)
    .join(" ");
}

function crearRegistroMatchSep(row, index) {
  const nombreCompleto = obtenerValor(row, [
    "nombre completo",
    "nombre",
    "alumno",
    "alumna",
    "aspirante",
    "nombres"
  ]);

  const nombres = obtenerValor(row, ["nombres", "nombre(s)", "nombre s"]);
  const primerApellido = obtenerValor(row, ["primer apellido", "apellido paterno", "paterno"]);
  const segundoApellido = obtenerValor(row, ["segundo apellido", "apellido materno", "materno"]);
  const nombreArmado = [nombres, primerApellido, segundoApellido].filter(Boolean).join(" ");

  return {
    fila_excel: index + 2,
    folio_sep: String(obtenerValor(row, ["folio sep", "folio", "folio asignado", "folio_asignado", "foliosep"]) || "").trim(),
    nombre_sep: String(nombreCompleto || nombreArmado || "").trim(),
    nombre_normalizado: normalizarNombreMatch(nombreCompleto || nombreArmado)
  };
}

function crearFilaCoincidente(registroSep, alumno, estado, ordenPrioridad = "") {
  const datos = alumno?.datos_alumno || {};
  const fechaPreregristro = alumno?.fecha_registro || alumno?.createdAt || alumno?._id?.getTimestamp?.();

  return {
    estado_match: estado,
    prioridad: ordenPrioridad,
    fila_excel_sep: registroSep.fila_excel,
    folio_sep: registroSep.folio_sep,
    nombre_sep: registroSep.nombre_sep,
    folio_sistema: alumno?.folio || "",
    curp: datos.curp || "",
    nombres: datos.nombres || "",
    primer_apellido: datos.primer_apellido || "",
    segundo_apellido: datos.segundo_apellido || "",
    nombre_sistema: separarNombreAlumno(alumno),
    fecha_preregistro: fechaPreregristro ? new Date(fechaPreregristro).toISOString() : "",
    registro_completado: alumno?.registro_completado === true ? "SI" : "NO"
  };
}

function crearFilaSinCoincidencia(registroSep) {
  return {
    estado_match: "SIN COINCIDENCIA",
    fila_excel_sep: registroSep.fila_excel,
    folio_sep: registroSep.folio_sep,
    nombre_sep: registroSep.nombre_sep
  };
}

function ajustarColumnas(worksheet, rows) {
  const headers = Object.keys(rows[0] || {});
  worksheet["!cols"] = headers.map(header => ({
    wch: Math.min(42, Math.max(header.length + 2, ...rows.map(row => String(row[header] || "").length + 2)))
  }));
}

router.post("/match-sep", verificarToken, uploadMatchSep.single("excel"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se recibió archivo Excel" });

    const limitePrioridad = Math.max(1, Number(req.body.limite || 500));
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    const registrosSep = rows
      .map(crearRegistroMatchSep)
      .filter(registro => registro.nombre_normalizado);

    fs.unlinkSync(req.file.path);

    if (!registrosSep.length) {
      return res.status(400).json({ error: "El Excel no contiene nombres válidos. Usa una columna nombre, nombre completo o nombres." });
    }

    const nombresSep = new Set(registrosSep.map(registro => registro.nombre_normalizado));
    const sepPorNombre = registrosSep.reduce((acc, registro) => {
      acc[registro.nombre_normalizado] = acc[registro.nombre_normalizado] || [];
      acc[registro.nombre_normalizado].push(registro);
      return acc;
    }, {});

    const conn = getConnection("registro272");
    const Alumno = conn.model("Alumno", alumnoSchema);
    const alumnos = await Alumno.find({}, {
      folio: 1,
      registro_completado: 1,
      fecha_registro: 1,
      createdAt: 1,
      "datos_alumno.nombres": 1,
      "datos_alumno.primer_apellido": 1,
      "datos_alumno.segundo_apellido": 1,
      "datos_alumno.curp": 1
    }).lean();
    await conn.close();

    const usados = new Set();
    const coincidencias = [];

    alumnos.forEach(alumno => {
      const nombreNormalizado = normalizarNombreMatch(separarNombreAlumno(alumno));
      if (!nombresSep.has(nombreNormalizado)) return;

      const candidatosSep = sepPorNombre[nombreNormalizado] || [];
      const registroSep = candidatosSep.find(registro => !usados.has(registro.fila_excel));
      if (!registroSep) return;

      usados.add(registroSep.fila_excel);
      coincidencias.push({ registroSep, alumno });
    });

    coincidencias.sort((a, b) => {
      const fechaA = new Date(a.alumno.fecha_registro || a.alumno.createdAt || a.alumno._id?.getTimestamp?.() || 0);
      const fechaB = new Date(b.alumno.fecha_registro || b.alumno.createdAt || b.alumno._id?.getTimestamp?.() || 0);
      return fechaA - fechaB;
    });

    const prioritarios = coincidencias.slice(0, limitePrioridad).map((item, index) =>
      crearFilaCoincidente(item.registroSep, item.alumno, "PRIORIDAD", index + 1)
    );
    const restoCoincidencias = coincidencias.slice(limitePrioridad).map(item =>
      crearFilaCoincidente(item.registroSep, item.alumno, "COINCIDENTE SIN PRIORIDAD")
    );
    const sinCoincidencia = registrosSep
      .filter(registro => !usados.has(registro.fila_excel))
      .map(crearFilaSinCoincidencia);

    const resumen = [{
      total_excel_sep: registrosSep.length,
      total_coincidencias: coincidencias.length,
      prioridad_exportada: prioritarios.length,
      resto_coincidentes: restoCoincidencias.length,
      sin_coincidencia: sinCoincidencia.length,
      criterio_match: "Nombre completo normalizado",
      criterio_prioridad: "Fecha de preregistro más antigua primero"
    }];

    const libro = XLSX.utils.book_new();
    [
      ["Prioridad_500", prioritarios],
      ["Resto_coincidentes", restoCoincidencias],
      ["Sin_coincidencia", sinCoincidencia],
      ["Resumen", resumen]
    ].forEach(([nombre, datos]) => {
      const hoja = XLSX.utils.json_to_sheet(datos.length ? datos : [{ mensaje: "Sin registros" }]);
      ajustarColumnas(hoja, datos.length ? datos : [{ mensaje: "Sin registros" }]);
      XLSX.utils.book_append_sheet(libro, hoja, nombre);
    });

    const buffer = XLSX.write(libro, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Disposition", "attachment; filename=match-sep-alumnos.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error("ERROR MATCH SEP:", error);
    res.status(500).json({ error: "Error al generar match SEP vs alumnos" });
  }
});

module.exports = router;
