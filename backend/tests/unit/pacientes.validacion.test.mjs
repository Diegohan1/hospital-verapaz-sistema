import test from "node:test";
import assert from "node:assert/strict";
import "./_entorno.mjs";
const { validarPaciente, validarMaternidad, tomarEgresoClinico, validarEgresoClinico, normalizarObjetosMultipart } = await import("../../src/controllers/pacientes.controller.js");

const valido = {
  nombreCompleto: "Juan López", dpi: "3342235951601", historiaClinica: "123456",
  direccion: "Cobán", telefono: "55512345", lugarNacimiento: "Cobán",
  fechaNacimiento: "2000-03-01", edad: 26, sexo: "Masculino", estadoCivil: "S",
  ocupacion: "Comerciante", religion: "Ninguna", nacionalidad: "Guatemalteca",
  fechaIngreso: "2026-10-08T14:30:00.000Z",
};

test("registro nuevo: todos los datos básicos indicados son obligatorios", () => {
  assert.equal(validarPaciente(valido), null);
  for (const campo of ["fechaIngreso", "historiaClinica", "nombreCompleto", "direccion", "telefono", "lugarNacimiento", "fechaNacimiento", "edad", "sexo", "estadoCivil", "ocupacion", "religion", "nacionalidad", "dpi"]) {
    assert.ok(validarPaciente({ ...valido, [campo]: "" }), `${campo} debe ser obligatorio`);
  }
});

test("historia clínica contiene solo números y el estado civil usa S/C/U/D/V", () => {
  assert.match(validarPaciente({ ...valido, historiaClinica: "HC-001" }), /solo números/);
  assert.match(validarPaciente({ ...valido, historiaClinica: "1".repeat(41) }), /40/);
  assert.match(validarPaciente({ ...valido, estadoCivil: "Soltero/a" }), /estado civil/);
  for (const estadoCivil of ["S", "C", "U", "D", "V"]) assert.equal(validarPaciente({ ...valido, estadoCivil }), null);
});

test("el DPI debe tener exactamente 13 digitos", () => {
  for (const malo of ["123", "33422359516011", "3342 2359 5160", "abcdefghijklm"]) {
    assert.match(validarPaciente({ ...valido, dpi: malo }), /13 dígitos/, malo);
  }
});

test("REGRESION: la edicion parcial (Ingreso/Egreso) sin nombre ni DPI es valida", () => {
  // Bug real: la pestaña solo manda lo que edita y el servidor respondia 400
  assert.equal(validarPaciente({ tipoSangre: "O+", serviciosSolicitados: "Consulta" }, { esEdicion: true }), null);
  assert.equal(validarPaciente({ egresoClinico: { autopsia: true } }, { esEdicion: true }), null);
});

test("en edicion, si vienen nombre o DPI se validan igual", () => {
  assert.match(validarPaciente({ nombreCompleto: "  " }, { esEdicion: true }), /vacío/);
  assert.match(validarPaciente({ dpi: "123" }, { esEdicion: true }), /13 dígitos/);
  assert.equal(validarPaciente({ nombreCompleto: "Ana", dpi: valido.dpi }, { esEdicion: true }), null);
});

test("telefonos (paciente, emergencia, encargado) de 8 digitos si se escriben", () => {
  assert.equal(validarPaciente({ ...valido, telefono: "55512345", telefonoEmergencia: "", encargadoTelefono: null }), null);
  assert.match(validarPaciente({ ...valido, telefono: "555" }), /teléfono debe/);
  assert.match(validarPaciente({ ...valido, telefonoEmergencia: "12" }), /emergencia/);
  assert.match(validarPaciente({ ...valido, telefonoConyuge: "123" }), /cónyuge/);
  assert.match(validarPaciente({ ...valido, encargadoTelefono: "abc" }), /encargado/);
});

test("la edad debe estar entre 0 y 130", () => {
  assert.equal(validarPaciente({ ...valido, edad: 0 }), null);
  assert.equal(validarPaciente({ ...valido, edad: "35" }), null);
  assert.match(validarPaciente({ ...valido, edad: 200 }), /edad/);
  assert.match(validarPaciente({ ...valido, edad: -1 }), /edad/);
});

test("maternidad: DPI y telefono del padre opcionales pero con formato valido", () => {
  assert.equal(validarMaternidad(undefined), null);
  assert.equal(validarMaternidad({ padreNombre: "Carlos" }), null);
  assert.equal(validarMaternidad({ padreDpi: "2456789011601", padreTelefono: "55512345" }), null);
  assert.match(validarMaternidad({ padreDpi: "123" }), /DPI del padre/);
  assert.match(validarMaternidad({ padreTelefono: "1" }), /teléfono del padre/);
});

test("maternidad: hora HH:MM y autopsia del bebé exige causa y fecha", () => {
  assert.equal(validarMaternidad({ hora: "14:30", autopsiaBebe: false }), null);
  assert.match(validarMaternidad({ hora: "1430" }), /HH:MM/);
  assert.match(validarMaternidad({ autopsiaBebe: true, causaMuerteBebe: "Complicación" }), /causa y la fecha/);
  assert.equal(validarMaternidad({ autopsiaBebe: true, causaMuerteBebe: "Complicación", fechaMuerteBebe: "2026-10-01" }), null);
  assert.match(validarMaternidad({ numeroHijo: 0 }), /entero mayor que cero/);
});

test("egreso clinico: forma nueva con campos definitivos", () => {
  const p = tomarEgresoClinico({ egresoClinico: { diagnosticoEgreso: "A00", causaMuerte: "", autopsia: true } });
  assert.deepEqual(p, { diagnosticoEgreso: "A00", causaMuerte: null, autopsia: true });
});

test("egreso clínico valida listas ordenadas de diagnósticos, complicaciones y operaciones", () => {
  const payload = {
    diagnosticosEgreso: [{ descripcion: "Bronquitis", codigo: "J40" }],
    complicacionesEgreso: [{ descripcion: "Infección", codigo: "B99" }],
    operacionesLista: ["Apendicectomía", "Sutura"],
  };
  assert.equal(validarEgresoClinico(payload), null);
  assert.match(validarEgresoClinico({ diagnosticosEgreso: ["J40"] }), /descripciones y códigos/);
  assert.match(validarEgresoClinico({ operacionesLista: [4] }), /operaciones/);
});

test("el registro con PDF interpreta los objetos JSON de egreso y maternidad", () => {
  const body = {
    egresoClinico: JSON.stringify({ diagnosticosEgreso: [{ descripcion: "Bronquitis", codigo: "J40" }] }),
    maternidad: JSON.stringify({ sexo: "F" }),
  };
  assert.equal(normalizarObjetosMultipart(body), null);
  assert.deepEqual(body.egresoClinico.diagnosticosEgreso, [{ descripcion: "Bronquitis", codigo: "J40" }]);
  assert.deepEqual(body.maternidad, { sexo: "F" });
  assert.match(normalizarObjetosMultipart({ maternidad: "{" }), /JSON válido/);
});

test("REGRESION egreso clinico legacy: mapea los 5 campos, no solo autopsia y causa", () => {
  const p = tomarEgresoClinico({ diagnosticoEgresoCodigo: "A00", complicacionesCodigo: "B01", operacionesCodigo: "C02", autopsia: false, causaMuerte: "x" });
  assert.deepEqual(p, { diagnosticoEgreso: "A00", complicaciones: "B01", operaciones: "C02", autopsia: false, causaMuerte: "x" });
});

test("egreso clinico: null borra, sin datos no toca, objeto vacio queda vacio", () => {
  assert.equal(tomarEgresoClinico({ egresoClinico: null }), null);
  assert.equal(tomarEgresoClinico({ tipoSangre: "O+" }), null);
  assert.deepEqual(tomarEgresoClinico({ egresoClinico: {} }), {});
});

test("autopsia y causa de muerte solo aplican a pacientes fallecidos", () => {
  assert.equal(validarEgresoClinico({ autopsia: true }, "fallecido_antes_48"), null);
  assert.equal(validarEgresoClinico({ causaMuerte: "x" }, "fallecido_despues_48"), null);
  assert.match(validarEgresoClinico({ autopsia: true }, "vivo_mejorado"), /fallecimiento/);
  assert.match(validarEgresoClinico({ causaMuerte: "x" }, undefined), /fallecimiento/);
  assert.equal(validarEgresoClinico({ diagnosticoEgreso: "A00" }, "vivo_mejorado"), null);
  assert.equal(validarEgresoClinico(null, "vivo_mejorado"), null);
});
