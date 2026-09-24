import test from "node:test";
import assert from "node:assert/strict";
import "./_entorno.mjs";
const { normalizarCampos, extraerDatosConVision, LecturaVisionError } = await import("../../src/services/lecturaVision.service.js");
const { tipoRealDeImagen } = await import("../../src/controllers/lecturaExpediente.controller.js");

const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");

test("normaliza lo que devuelve el modelo (espacios, digitos, fechas)", () => {
  const n = normalizarCampos({ nombreCompleto: "  Juan   Lopez ", dpi: "3342 23595 1601", telefono: "5561-7262", historiaClinica: "HC-001", fechaNacimiento: "2000-03-01", direccion: "41. Calle 7-05 zona 4", fechaIngreso: null });
  assert.equal(n.nombreCompleto, "Juan Lopez");
  assert.equal(n.dpi, "3342235951601");
  assert.equal(n.telefono, "55617262");
  assert.equal(n.historiaClinica, "HC-001");
  assert.equal(n.fechaNacimiento, "2000-03-01");
  assert.equal(n.fechaIngreso, null);
});

test("descarta lo invalido en vez de inventarlo", () => {
  assert.equal(normalizarCampos({ dpi: "12345" }).dpi, null);
  assert.equal(normalizarCampos({ fechaIngreso: "2026-02-31" }).fechaIngreso, null, "31 de febrero");
  assert.equal(normalizarCampos({ fechaNacimiento: "1490-05-12" }).fechaNacimiento, null, "año imposible");
  assert.equal(normalizarCampos({ dpi: 123, nombreCompleto: null }).dpi, null, "tipos raros no truenan");
});

test("el telefono del membrete del hospital nunca es el del paciente", () => {
  assert.equal(normalizarCampos({ telefono: "7952-9724" }).telefono, null);
});

test("flujo con cliente simulado: pide imagen + salida estructurada y devuelve campos", async () => {
  let peticion;
  const cliente = { messages: { parse: async (p) => { peticion = p; return { stop_reason: "end_turn", parsed_output: { nombreCompleto: "Juan", direccion: null, dpi: "3342235951601", telefono: null, historiaClinica: "HC-001", fechaNacimiento: null, fechaIngreso: null } }; } } };
  const r = await extraerDatosConVision(PNG, "image/png", { cliente });
  assert.equal(r.dpi, "3342235951601");
  assert.equal(peticion.model, "claude-opus-5");
  assert.equal(peticion.messages[0].content[0].type, "image");
  assert.equal(peticion.messages[0].content[0].source.data, PNG.toString("base64"));
  assert.equal(peticion.output_config.format.type, "json_schema");
  assert.ok(!("temperature" in peticion), "temperature esta removido en los modelos actuales");
});

test("errores esperables llegan como LecturaVisionError con su codigo HTTP", async () => {
  const rechazo = { messages: { parse: async () => ({ stop_reason: "refusal", parsed_output: null }) } };
  await assert.rejects(() => extraerDatosConVision(PNG, "image/png", { cliente: rechazo }), (e) => e instanceof LecturaVisionError && e.status === 422);
  const vacio = { messages: { parse: async () => ({ stop_reason: "end_turn", parsed_output: null }) } };
  await assert.rejects(() => extraerDatosConVision(PNG, "image/png", { cliente: vacio }), (e) => e.status === 502);
  await assert.rejects(() => extraerDatosConVision(PNG, "application/pdf", { cliente: vacio }), (e) => e.status === 422);
});

test("sin ANTHROPIC_API_KEY la funcion esta apagada (501)", async () => {
  const guardada = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    await assert.rejects(() => extraerDatosConVision(PNG, "image/png"), (e) => e instanceof LecturaVisionError && e.status === 501);
  } finally {
    if (guardada) process.env.ANTHROPIC_API_KEY = guardada;
  }
});

test("el tipo de imagen se detecta por sus bytes, no por lo que diga el cliente", () => {
  assert.equal(tipoRealDeImagen(Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.alloc(8)])), "image/png");
  assert.equal(tipoRealDeImagen(Buffer.concat([Buffer.from("ffd8ffe0", "hex"), Buffer.alloc(12)])), "image/jpeg");
  assert.equal(tipoRealDeImagen(Buffer.from("%PDF-1.4 disfrazado de imagen")), null);
});
