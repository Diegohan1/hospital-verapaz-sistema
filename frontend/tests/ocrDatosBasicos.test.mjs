import test from "node:test";
import assert from "node:assert/strict";
import { extraerCampos, parsearFecha, combinar } from "../src/utils/ocrDatosBasicos.js";

// Texto tal como lo devolveria Tesseract sobre la Ficha General del hospital
const FICHA = `HOSPITAL VERAPAZ
8a. Calle 8-30 zona 10, Coban, Alta Verapaz
Telefono: 7952-9724
FECHA DE INGRESO: 15/09/2026      HORA: 08:30
FICHA GENERAL DEL PACIENTE
Hoja de Ingreso y Egreso
Historia Clinica: HC-001
Nombre Completo: Maria Fernanda Lopez Perez
Direccion: 41 Calle 7-05 zona 4 Telefono: 5561-7262
Lugar de Nacimiento: Coban, A.V.
Fecha de Nacimiento: 01/03/2000 Edad: 26 Sexo: F
Nacionalidad: Guatemalteca DPI: 1234 56789 0101
Nombre del Padre: Jose Lopez Nombre de la Madre: Ana Perez
En caso de emergencia notificar:
Telefono: 4444 5555`;

test("extrae los datos basicos anclandose a las etiquetas de la hoja", () => {
  const c = extraerCampos(FICHA);
  assert.equal(c.nombreCompleto, "Maria Fernanda Lopez Perez");
  assert.equal(c.direccion, "41 Calle 7-05 zona 4");
  assert.equal(c.dpi, "1234567890101");
  assert.equal(c.telefono, "55617262");
  assert.equal(c.historiaClinica, "HC-001");
  assert.equal(c.fechaNacimiento, "2000-03-01");
  assert.equal(c.fechaIngreso, "2026-09-15");
});

test("REGRESION: el telefono del membrete del hospital (7952-9724) no es el del paciente", () => {
  const soloMembrete = "HOSPITAL VERAPAZ\nTelefono: 7952-9724\nFICHA GENERAL DEL PACIENTE\nHistoria Clinica:";
  assert.equal(extraerCampos(soloMembrete).telefono, null);
  assert.equal(extraerCampos(FICHA).telefono, "55617262", "toma el del paciente, no el del membrete ni el de emergencia");
});

test("el nombre es el del paciente, no el del padre, madre o conyuge", () => {
  const t = "FICHA GENERAL DEL PACIENTE\nNombre del Padre: Jose Lopez Nombre de la Madre: Ana Perez\nNombre del Conyugue: Luis";
  assert.equal(extraerCampos(t).nombreCompleto, null);
});

test("la etiqueta pegada al valor no se come la primera letra (Complet + Maria)", () => {
  assert.equal(extraerCampos("FICHA GENERAL\nNombre CompletMaria Fernanda Lopez").nombreCompleto, "Maria Fernanda Lopez");
  assert.equal(extraerCampos("FICHA GENERAL\nNombre Completo:Maria Lopez").nombreCompleto, "Maria Lopez");
  assert.equal(extraerCampos("FICHA GENERAL\nNOMBRE COMPLETO: MARIA LOPEZ").nombreCompleto, "MARIA LOPEZ");
});

test("la historia clinica exige minimo 3 caracteres con al menos un digito (antes aceptaba '6')", () => {
  assert.equal(extraerCampos("FICHA GENERAL\nHistoria Clinica: 6").historiaClinica, null);
  assert.equal(extraerCampos("FICHA GENERAL\nHistoria Clinica: ___").historiaClinica, null);
  assert.equal(extraerCampos("FICHA GENERAL\nHistoria Clinica: 2026-0457").historiaClinica, "2026-0457");
});

test("fechas: formatos de la hoja y descarte de basura del OCR", () => {
  assert.equal(parsearFecha("01/03/2000"), "2000-03-01");
  assert.equal(parsearFecha("1-3-00"), "2000-03-01");
  assert.equal(parsearFecha("15 de septiembre de 2026"), "2026-09-15");
  assert.equal(parsearFecha("5/04/2.02.6"), null, "basura: antes se volvia una fecha inventada");
  assert.equal(parsearFecha("31/02/2026"), null, "REGRESION: no existe el 31 de febrero (antes se aceptaba)");
  assert.equal(parsearFecha("29/02/2024"), "2024-02-29", "año bisiesto valido");
  assert.equal(parsearFecha("29/02/2026"), null, "2026 no es bisiesto");
  assert.equal(parsearFecha("31/04/2026"), null, "abril tiene 30 dias");
  assert.equal(parsearFecha("12/05/1490"), null, "año imposible");
  assert.equal(parsearFecha(""), null);
});

test("DPI: entre lecturas que discrepan se prefiere la que pasa el digito verificador", () => {
  // Dos lecturas iguales pero con el verificador mal, y una correcta: sin el
  // verificador ganaria la mayoria equivocada.
  const r = combinar({ textos: [], dpiLecturas: ["1234567800101", "1234567800101", "1234567890101"] });
  assert.equal(r.dpi, "1234567890101");
});

test("DPI: si ninguna lectura pasa el verificador se usa la mas repetida (el formulario lo marcara)", () => {
  const r = combinar({ textos: [], dpiLecturas: ["2456759011601", "2456789011601", "2456789011601"] });
  assert.equal(r.dpi, "2456789011601");
});

test("combinar junta lo que cada lectura encontro y vota el telefono", () => {
  const r = combinar({
    textos: ["FICHA GENERAL\nNombre Completo: Ana Lopez", "FICHA GENERAL\nHistoria Clinica: HC-77\nFecha de Nacimiento: 01/03/2000"],
    telefonoLecturas: ["55512345", "55512345", "19524441"],
  });
  assert.equal(r.nombreCompleto, "Ana Lopez", "de la primera lectura");
  assert.equal(r.historiaClinica, "HC-77", "de la segunda (la primera no la vio)");
  assert.equal(r.fechaNacimiento, "2000-03-01");
  assert.equal(r.telefono, "55512345", "gana el mas repetido");
  assert.equal(r.dpi, null);
});
