import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { LLAVE, OTRA_LLAVE } from "./_entorno.mjs";
import { encrypt, decrypt, encryptBuffer, decryptBuffer, leerArchivoCifrado } from "../../src/utils/crypto.util.js";
import { guardarArchivoCifrado } from "../../src/utils/archivos.util.js";

test("AES-256-GCM: cifra y descifra texto con acentos y simbolos", () => {
  const texto = JSON.stringify({ diagnostico: "Apendicitis aguda — señora Pérez ñ", codigo: "K35" });
  const sobre = encrypt(texto, LLAVE);
  assert.notEqual(sobre.encrypted, texto);
  assert.ok(!sobre.encrypted.includes("Apendicitis"));
  assert.equal(decrypt(sobre, LLAVE), texto);
});

test("cada cifrado usa un IV distinto (mismo texto, distinto resultado)", () => {
  const a = encrypt("igual", LLAVE);
  const b = encrypt("igual", LLAVE);
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.encrypted, b.encrypted);
});

test("una llave incorrecta no descifra", () => {
  const sobre = encrypt("secreto", LLAVE);
  assert.throws(() => decrypt(sobre, OTRA_LLAVE));
});

test("si alguien altera el texto cifrado o el authTag, la lectura falla (integridad)", () => {
  const sobre = encrypt("secreto clinico", LLAVE);
  const alterado = { ...sobre, encrypted: (sobre.encrypted[0] === "a" ? "b" : "a") + sobre.encrypted.slice(1) };
  assert.throws(() => decrypt(alterado, LLAVE));
  const otroTag = { ...sobre, authTag: "00".repeat(16) };
  assert.throws(() => decrypt(otroTag, LLAVE));
});

test("archivos binarios: ida y vuelta identica", () => {
  const binario = Buffer.from(Array.from({ length: 5000 }, (_, i) => (i * 37) % 256));
  const sobre = encryptBuffer(binario, LLAVE);
  assert.ok(!sobre.includes(binario.subarray(0, 64)));
  assert.ok(decryptBuffer(sobre, LLAVE).equals(binario));
  assert.throws(() => decryptBuffer(sobre, OTRA_LLAVE));
});

test("un PDF guardado en disco nunca queda en claro y se recupera igual", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "verapaz-test-"));
  try {
    const pdf = Buffer.from("%PDF-1.4\nexpediente confidencial de prueba\n");
    const nombre = guardarArchivoCifrado(pdf, dir, LLAVE);
    assert.match(nombre, /^enc_[0-9a-f]{48}\.bin$/, "nombre interno aleatorio, sin datos del cliente");
    const enDisco = fs.readFileSync(path.join(dir, nombre));
    assert.ok(!enDisco.includes(Buffer.from("confidencial")), "el contenido no debe verse en el disco");
    assert.ok(leerArchivoCifrado(path.join(dir, nombre), LLAVE).equals(pdf));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
