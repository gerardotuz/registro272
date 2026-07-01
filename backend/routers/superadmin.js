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
    "carrera",
    "nombre",
    "sexo",
    "promedio"
  ];

  const ejemplo = [
    { carrera: "Programación", nombre: "JUAN PEREZ LOPEZ", sexo: "H", promedio: 92.5 },
    { carrera: "Programación", nombre: "MARIA GARCIA RUIZ", sexo: "M", promedio: 89.75 },
    { carrera: "Contabilidad", nombre: "ANA LOPEZ MARTINEZ", sexo: "F", promedio: 95 }
  ];

  const instrucciones = [
    { campo: "carrera", descripcion: "Nombre de la carrera o especialidad. Debe coincidir con la configuración de grupos." },
    { campo: "nombre", descripcion: "Nombre completo del alumno." },
    { campo: "sexo", descripcion: "Acepta H/M, Hombre/Mujer, Masculino/Femenino o F." },
    { campo: "promedio", descripcion: "Promedio del examen de admisión. Usa número, por ejemplo 92.5." }
  ];

  const libro = XLSX.utils.book_new();
  const hojaAlumnos = XLSX.utils.json_to_sheet(ejemplo, { header: encabezados });
  XLSX.utils.sheet_add_aoa(hojaAlumnos, [encabezados], { origin: "A1" });
  hojaAlumnos["!cols"] = [
    { wch: 24 },
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
function asignarAlumnosPorCarrera(alumnos, configuracion) {
  const porCarrera = alumnos.reduce((acc, alumno) => {
    acc[alumno.carrera] = acc[alumno.carrera] || [];
    acc[alumno.carrera].push(alumno);
    return acc;
  }, {});

  const resultado = [];
  const resumen = [];

  for (const [carrera, lista] of Object.entries(porCarrera)) {
    const config = configuracion[carrera] || configuracion[normalizarTexto(carrera)] || {};
    const grupos = crearGruposParaCarrera(carrera, config, lista.length);
    const ordenados = [...lista].sort((a, b) => b.promedio - a.promedio);

    ordenados.forEach((alumno, index) => {
      const candidatos = grupos
        .map(grupo => ({ grupo, score: puntajeGrupo(grupo, alumno) }))
        .sort((a, b) => a.score - b.score || a.grupo.alumnos.length - b.grupo.alumnos.length);
      const elegido = candidatos[0].grupo;
      elegido.alumnos.push({ ...alumno, ordenPromedioCarrera: index + 1 });
    });

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

  return { resultado, resumen };
}
router.get("/asignacion-grupos/template", verificarToken, (req, res) => {
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
router.post("/asignacion-grupos", verificarToken, uploadAsignacion.single("excel"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se recibió archivo Excel" });

    const configuracion = JSON.parse(req.body.configuracion || "{}");
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    const alumnos = rows.map((row, index) => ({
      filaExcel: index + 2,
      carrera: String(obtenerValor(row, ["carrera", "especialidad", "programa"]) || "SIN CARRERA").trim(),
      nombre: String(obtenerValor(row, ["nombre", "alumno", "alumna", "nombre completo", "nombres"]) || "").trim(),
      sexo: detectarSexo(obtenerValor(row, ["sexo", "genero", "género"])),
      promedio: obtenerNumero(obtenerValor(row, ["promedio", "promedio examen", "promedio del examen de admisión", "examen", "calificacion", "calificación"]))
    })).filter(alumno => alumno.nombre && alumno.carrera);

    fs.unlinkSync(req.file.path);

    if (!alumnos.length) {
      return res.status(400).json({ error: "El Excel no contiene alumnos válidos. Revisa encabezados: carrera, nombre, sexo y promedio." });
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


module.exports = router;
