import crypto from "crypto";
import fs from "node:fs";
import path from "node:path";

// Cifrado del diagnostico clinico (RF-10). Usa AES-256-GCM.
// En produccion, la llave debe vivir en variables de entorno / gestor de secretos.
const ALGORITHM = "aes-256-gcm";

export function encrypt(text, keyHex) {
  const key = Buffer.from(keyHex, "hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { encrypted: encrypted.toString("hex"), iv: iv.toString("hex"), authTag: authTag.toString("hex") };
}

export function decrypt({ encrypted, iv, authTag }, keyHex) {
  const key = Buffer.from(keyHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(authTag, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encrypted, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}

// Sprint 4: cifrado de archivos binarios (estudios y anexos). El "sobre" en
// disco es: [IV 12 bytes][authTag 16 bytes][ciphertext]. El nombre interno
// de los archivos cifrados lleva el prefijo "enc_" para distinguirlos de los
// historicos guardados en claro (que se recifran con scripts/recifrar-archivos.js).
export function encryptBuffer(buffer, keyHex) {
  const key = Buffer.from(keyHex, "hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
}

export function decryptBuffer(sobre, keyHex) {
  const key = Buffer.from(keyHex, "hex");
  const iv = sobre.subarray(0, 12);
  const authTag = sobre.subarray(12, 28);
  const ciphertext = sobre.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

// Lee un archivo del volumen: si es un sobre cifrado (prefijo enc_) lo
// descifra; si es historico en claro lo devuelve tal cual. Lanza error si el
// sobre esta corrupto o la llave no corresponde (deteccion de manipulacion).
export function leerArchivoCifrado(ruta, keyHex) {
  const contenido = fs.readFileSync(ruta);
  if (path.basename(ruta).startsWith("enc_")) {
    return decryptBuffer(contenido, keyHex);
  }
  return contenido;
}
