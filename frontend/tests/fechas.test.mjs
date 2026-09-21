// Las fechas se muestran en la zona horaria del navegador; el hospital esta
// en Guatemala (UTC-6). Se fija aqui para que la prueba no dependa de la
// maquina donde corra.
process.env.TZ = "America/Guatemala";

import test from "node:test";
import assert from "node:assert/strict";
import { fechaDia, fechaLocal, fechaHoraLocal } from "../src/utils/fechas.js";

test("REGRESION: la fecha de nacimiento no se corre un dia atras (01/03/2000, no 29/2)", () => {
  assert.equal(fechaDia("2000-03-01T00:00:00.000Z"), "01/03/2000");
});

test("fechas de solo dia: cambios de mes y de año", () => {
  assert.equal(fechaDia("2026-09-10T00:00:00.000Z"), "10/09/2026");
  assert.equal(fechaDia("2025-12-31T00:00:00.000Z"), "31/12/2025");
  assert.equal(fechaDia("2026-01-01T00:00:00.000Z"), "01/01/2026");
});

test("un momento real (registro en el sistema) se muestra en hora de Guatemala", () => {
  assert.equal(fechaHoraLocal("2026-09-15T20:21:06.551Z"), "15/09/2026 14:21");
  // 02:00 UTC del 16 es todavia la noche del 15 en Guatemala
  assert.equal(fechaLocal("2026-09-16T02:00:00.000Z"), "15/09/2026");
});

test("valores vacios o invalidos devuelven null, no 'Invalid Date'", () => {
  assert.equal(fechaDia(null), null);
  assert.equal(fechaDia(""), null);
  assert.equal(fechaDia(undefined), null);
  assert.equal(fechaHoraLocal("basura"), null);
});
