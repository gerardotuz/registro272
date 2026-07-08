const assert = require('assert');
const {
  MAX_PARAESCOLAR,
  normalizarParaescolar,
  construirResumenParaescolares,
  contarParaescolares,
  puedeAsignarParaescolar
} = require('../backend/utils/paraescolares');

function crearModelo(docs) {
  return {
    find() {
      return {
        lean: async () => docs
      };
    }
  };
}

async function run() {
  assert.strictEqual(MAX_PARAESCOLAR, 50);
  assert.strictEqual(normalizarParaescolar(' oratoria y declamación '), 'ORATORIA - DECLAMACIÓN');
  assert.strictEqual(normalizarParaescolar('ORATORIADECLAMACION'), 'ORATORIA - DECLAMACIÓN');
  assert.strictEqual(normalizarParaescolar('Oratoria-Declamacion'), 'ORATORIA - DECLAMACIÓN');

  const alumnos = Array.from({ length: 49 }, (_, i) => ({
    _id: `alumno-${i}`,
    folio: `F-${i}`,
    datos_alumno: { curp: `CURP${i}` },
    datos_generales: { paraescolar: 'oratoria y declamación' }
  }));
  const paraescolares = [
    { _id: 'p-1', numero_control: 'NC-1', curp: 'CURP0', paraescolar: 'ORATORIADECLAMACION' },
    { _id: 'p-2', numero_control: 'NC-2', curp: 'CURP49', paraescolar: 'ORATORIA-DECLAMACION' }
  ];

  const conteos = await contarParaescolares({
    Alumno: crearModelo(alumnos),
    Paraescolar: crearModelo(paraescolares)
  });

  assert.strictEqual(conteos.get('ORATORIA - DECLAMACIÓN'), 50);
  assert.strictEqual(await puedeAsignarParaescolar({
    Alumno: crearModelo(alumnos),
    Paraescolar: crearModelo(paraescolares),
    paraescolar: 'ORATORIA Y DECLAMACIÓN'
  }), false);

  const resumen = construirResumenParaescolares(conteos).find((item) => item.nombre === 'ORATORIA - DECLAMACIÓN');
  assert.deepStrictEqual(
    { ocupados: resumen.ocupados, disponibles: resumen.disponibles, limite: resumen.limite, lleno: resumen.lleno },
    { ocupados: 50, disponibles: 0, limite: 50, lleno: true }
  );

  console.log('✅ paraescolares.test.js passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
