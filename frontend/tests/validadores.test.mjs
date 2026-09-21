import test from "node:test";
import assert from "node:assert/strict";
import { limpiarDPI, formatearDPI, validarDPI } from "../src/utils/dpi.js";
import { limpiarTelefono, formatearTelefono, telefonoIncompleto } from "../src/utils/telefono.js";

test("DPI: se limpia y se formatea como en la cedula (4-5-4)", () => {
  assert.equal(limpiarDPI("1234 56789 0101"), "1234567890101");
  assert.equal(limpiarDPI("12a34-5"), "12345");
  assert.equal(limpiarDPI("12345678901012345"), "1234567890101", "maximo 13 digitos");
  assert.equal(formatearDPI("1234567890101"), "1234 56789 0101");
  assert.equal(formatearDPI("12345"), "1234 5");
  assert.equal(limpiarDPI(undefined), "");
});

test("DPI: valido con verificador correcto y departamento 1-22", () => {
  assert.equal(validarDPI("1234567890101").estado, "valido");
  assert.equal(validarDPI("").estado, "vacio");
  assert.equal(validarDPI("12345").estado, "incompleto");
});

test("DPI: rechaza verificador incorrecto y departamento fuera de rango", () => {
  assert.equal(validarDPI("1234567800101").estado, "invalido");
  assert.match(validarDPI("1234567800101").mensaje, /verificador/);
  // mismo numero base con departamento 99 (y verificador recalculado igual: 9)
  assert.equal(validarDPI("1234567899901").estado, "invalido");
  assert.match(validarDPI("1234567899901").mensaje, /departamento/);
});

test("telefono: solo digitos, 8 maximo, formato 0000 0000", () => {
  assert.equal(limpiarTelefono("5551-2345"), "55512345");
  assert.equal(limpiarTelefono("555123456789"), "55512345");
  assert.equal(formatearTelefono("55512345"), "5551 2345");
  assert.equal(telefonoIncompleto("555"), true);
  assert.equal(telefonoIncompleto("55512345"), false);
  assert.equal(telefonoIncompleto(""), false, "vacio no es 'incompleto': el telefono es opcional");
});
