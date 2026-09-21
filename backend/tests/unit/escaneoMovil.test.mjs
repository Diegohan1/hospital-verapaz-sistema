import test from "node:test";
import assert from "node:assert/strict";
import "./_entorno.mjs";
const c = await import("../../src/controllers/escaneoMovil.controller.js");

function res() {
  return { codigo: 200, cuerpo: null, cabeceras: {}, status(x) { this.codigo = x; return this; }, json(b) { this.cuerpo = b; return this; }, setHeader(k, v) { this.cabeceras[k] = v; }, send(b) { this.cuerpo = b; return this; } };
}
const usuario = (id) => ({ user: { id } });
const PDF = Buffer.from("%PDF-1.4\nprueba");

test("ciclo completo: la PC crea, el telefono sube sin login, la PC recoge una sola vez", () => {
  let r = res(); c.crear({ ...usuario(1) }, r);
  assert.equal(r.codigo, 201);
  const id = r.cuerpo.id;

  r = res(); c.info({ params: { id } }, r);
  assert.deepEqual({ valido: r.cuerpo.valido, estado: r.cuerpo.estado }, { valido: true, estado: "esperando" });

  r = res(); c.estado({ ...usuario(1), params: { id } }, r);
  assert.equal(r.cuerpo.estado, "esperando");

  r = res(); c.subirPdf({ params: { id }, file: { buffer: PDF }, body: { paginas: "3", nombre: "m.pdf" } }, r);
  assert.equal(r.codigo, 200);

  r = res(); c.estado({ ...usuario(1), params: { id } }, r);
  assert.deepEqual({ estado: r.cuerpo.estado, paginas: r.cuerpo.paginas }, { estado: "listo", paginas: 3 });

  r = res(); c.obtenerPdf({ ...usuario(1), params: { id } }, r);
  assert.ok(Buffer.isBuffer(r.cuerpo) && r.cuerpo.equals(PDF));

  r = res(); c.estado({ ...usuario(1), params: { id } }, r);
  assert.equal(r.codigo, 404, "la sesion se borra tras entregarse (un solo uso)");
});

test("otro usuario no puede ver ni recoger una sesion ajena", () => {
  let r = res(); c.crear(usuario(1), r);
  const id = r.cuerpo.id;
  r = res(); c.estado({ ...usuario(2), params: { id } }, r);
  assert.equal(r.codigo, 403);
  r = res(); c.obtenerPdf({ ...usuario(2), params: { id } }, r);
  assert.equal(r.codigo, 403);
  r = res(); c.cancelar({ ...usuario(2), params: { id } }, r);
  assert.equal(r.codigo, 403);
});

test("el telefono no puede subir algo que no sea PDF, ni dos veces, ni a una sesion inexistente", () => {
  let r = res(); c.crear(usuario(1), r);
  const id = r.cuerpo.id;
  r = res(); c.subirPdf({ params: { id }, file: { buffer: Buffer.from("no soy pdf") }, body: {} }, r);
  assert.equal(r.codigo, 422);
  r = res(); c.subirPdf({ params: { id }, body: {} }, r);
  assert.equal(r.codigo, 400);
  r = res(); c.subirPdf({ params: { id }, file: { buffer: PDF }, body: {} }, r);
  assert.equal(r.codigo, 200);
  r = res(); c.subirPdf({ params: { id }, file: { buffer: PDF }, body: {} }, r);
  assert.equal(r.codigo, 409, "segunda subida rechazada");
  r = res(); c.subirPdf({ params: { id: "no-existe" }, file: { buffer: PDF }, body: {} }, r);
  assert.equal(r.codigo, 404);
});

test("no se puede recoger el PDF antes de que el telefono lo suba (409)", () => {
  let r = res(); c.crear(usuario(1), r);
  const id = r.cuerpo.id;
  r = res(); c.obtenerPdf({ ...usuario(1), params: { id } }, r);
  assert.equal(r.codigo, 409);
});

test("cancelar borra la sesion", () => {
  let r = res(); c.crear(usuario(1), r);
  const id = r.cuerpo.id;
  r = res(); c.cancelar({ ...usuario(1), params: { id } }, r);
  assert.equal(r.codigo, 200);
  r = res(); c.info({ params: { id } }, r);
  assert.equal(r.cuerpo.valido, false);
});
