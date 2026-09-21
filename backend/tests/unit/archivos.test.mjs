import test from "node:test";
import assert from "node:assert/strict";
import "./_entorno.mjs";
import { validarPdf, validarArchivo, nombreInternoAleatorio, tamanoLegible } from "../../src/utils/archivos.util.js";

const pdf = (extra = {}) => ({ buffer: Buffer.from("%PDF-1.4\ncontenido"), mimetype: "application/pdf", originalname: "exp.pdf", ...extra });

test("un PDF real se acepta; uno falso (bytes o MIME) se rechaza", () => {
  assert.equal(validarPdf(pdf()), null);
  assert.match(validarPdf(pdf({ buffer: Buffer.from("no soy pdf") })), /no es un PDF/);
  assert.match(validarPdf(pdf({ mimetype: "image/png" })), /MIME/);
});

test("solo PDF, PNG y JPG; se rechazan extensiones raras y rutas en el nombre", () => {
  assert.equal(validarArchivo({ originalname: "a.pdf", mimetype: "application/pdf" }), null);
  assert.equal(validarArchivo({ originalname: "a.PNG", mimetype: "image/png" }), null);
  assert.match(validarArchivo({ originalname: "virus.exe", mimetype: "application/octet-stream" }), /no permitido/);
  assert.match(validarArchivo({ originalname: "a.pdf", mimetype: "image/png" }), /no permitido/, "extension y MIME deben coincidir");
  assert.match(validarArchivo({ originalname: "../etc/passwd.pdf", mimetype: "application/pdf" }), /no permitidos/);
  assert.match(validarArchivo({ originalname: "a\\b.pdf", mimetype: "application/pdf" }), /no permitidos/, "barra invertida");
});

test("REGRESION: las fotos .jpeg de los celulares se aceptan (antes solo .jpg)", () => {
  assert.equal(validarArchivo({ originalname: "IMG_2026.jpeg", mimetype: "image/jpeg" }), null);
  assert.equal(validarArchivo({ originalname: "IMG_2026.JPG", mimetype: "image/jpeg" }), null);
});

test("el contenido debe ser del formato que dice: un archivo disfrazado se rechaza", () => {
  const png = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.alloc(16)]);
  const jpg = Buffer.concat([Buffer.from("ffd8ffe0", "hex"), Buffer.alloc(16)]);
  assert.equal(validarArchivo({ originalname: "a.png", mimetype: "image/png", buffer: png }), null);
  assert.equal(validarArchivo({ originalname: "a.jpg", mimetype: "image/jpeg", buffer: jpg }), null);
  assert.equal(validarArchivo({ originalname: "a.pdf", mimetype: "application/pdf", buffer: Buffer.from("%PDF-1.4\nok") }), null);
  const html = Buffer.from("<html><script>alert(1)</script></html>");
  assert.match(validarArchivo({ originalname: "a.png", mimetype: "image/png", buffer: html }), /no corresponde/);
  assert.match(validarArchivo({ originalname: "a.pdf", mimetype: "application/pdf", buffer: png }), /no corresponde/);
});

test("el nombre interno es aleatorio y no revela datos del archivo", () => {
  const a = nombreInternoAleatorio(), b = nombreInternoAleatorio();
  assert.notEqual(a, b);
  assert.match(a, /^enc_[0-9a-f]{48}\.bin$/);
});

test("tamano legible", () => {
  assert.equal(tamanoLegible(500), "500 B");
  assert.equal(tamanoLegible(2048), "2.0 KB");
  assert.equal(tamanoLegible(5 * 1024 * 1024), "5.0 MB");
  assert.equal(tamanoLegible(null), "—");
});
