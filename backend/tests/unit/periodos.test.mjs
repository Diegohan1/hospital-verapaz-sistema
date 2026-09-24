import test from "node:test";
import assert from "node:assert/strict";
import "./_entorno.mjs";
const { rangoFecha, clavePeriodo, diaEnHospital } = await import("../../src/utils/periodos.util.js");

test("'desde' y 'hasta' cubren el dia completo en hora de Guatemala (UTC-6)", () => {
  const r = rangoFecha("2026-09-20", "2026-09-20");
  assert.equal(r.gte.toISOString(), "2026-09-20T06:00:00.000Z");
  assert.equal(r.lte.toISOString(), "2026-09-21T05:59:59.999Z");
});

test("una factura de las 8 p. m. del ultimo dia elegido SI entra (antes quedaba fuera)", () => {
  const r = rangoFecha("2026-09-20", "2026-09-20");
  const factura = new Date("2026-09-20T20:00:00-06:00"); // ya es 21 en UTC
  assert.ok(factura >= r.gte && factura <= r.lte);
});

test("el dia calendario se calcula en la zona del hospital, no en UTC", () => {
  assert.equal(diaEnHospital(new Date("2026-09-20T20:00:00-06:00")), "2026-09-20");
});

test("periodos: dia, mes y semana (empieza el lunes)", () => {
  const domingo8pm = new Date("2026-09-20T20:00:00-06:00");
  assert.equal(clavePeriodo(domingo8pm, "dia"), "2026-09-20");
  assert.equal(clavePeriodo(domingo8pm, "mes"), "2026-09");
  assert.equal(clavePeriodo(domingo8pm, "semana"), "2026-09-14");
  assert.equal(clavePeriodo(new Date("2026-09-14T12:00:00-06:00"), "semana"), "2026-09-14");
});

test("las semanas cruzan bien el fin de mes y de año", () => {
  assert.equal(clavePeriodo(new Date("2026-10-01T12:00:00-06:00"), "semana"), "2026-09-28");
  assert.equal(clavePeriodo(new Date("2026-01-01T12:00:00-06:00"), "semana"), "2025-12-29");
});

test("valores invalidos o ausentes se ignoran", () => {
  assert.equal(rangoFecha(undefined, undefined), undefined);
  assert.equal(rangoFecha("basura", "2026-13-45"), undefined);
});
