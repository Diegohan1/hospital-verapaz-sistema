// Sprint 4: utilidades compartidas para el manejo seguro de archivos
// clinicos (estudios del diagnostico y anexos del paciente).
//
// Reglas del plan (seccion 3.6):
// - El nombre original y el MIME type son datos no confiables: el nombre
//   interno es aleatorio y el MIME se valida contra una lista de permitidos.
// - No se usan rutas provistas por el usuario para leer ni escribir disco.
import crypto from "crypto";
import fs from "node:fs";
import path from "node:path";
import { encryptBuffer } from "./crypto.util.js";

// Tipos autorizados por configuracion (PDF, PNG, JPG por defecto)
const TIPOS_DEFAULT = ["application/pdf", "image/png", "image/jpeg"];
const EXTENSIONES = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
};

export function tiposPermitidos() {
  const raw = process.env.UPLOAD_TIPOS_PERMITIDOS;
  return raw ? raw.split(",").map((t) => t.trim()).filter(Boolean) : TIPOS_DEFAULT;
}

// Valida extension y MIME contra la lista de permitidos. El cliente puede
// falsificar el MIME, por eso tambien se valida la extension y nunca se usa
// el nombre original para escribir en disco.
export function validarArchivo(file) {
  const permitidos = tiposPermitidos();
  const extension = path.extname(file.originalname || "").toLowerCase();
  const extensionValida = permitidos.some((tipo) => EXTENSIONES[tipo] === extension);
  if (!permitidos.includes(file.mimetype) || !extensionValida) {
    return `Tipo de archivo no permitido: "${file.originalname}". Permitidos: PDF, PNG, JPG`;
  }
  if (/[\\/]|\.\./.test(file.originalname)) {
    return "El nombre del archivo contiene caracteres no permitidos";
  }
  return null;
}

// Genera un nombre interno aleatorio con prefijo enc_ (identifica el sobre
// cifrado en disco; ver crypto.util.js).
export function nombreInternoAleatorio() {
  return `enc_${crypto.randomBytes(24).toString("hex")}.bin`;
}

// Cifra el buffer y lo persiste en el directorio indicado. Devuelve el
// nombre interno generado (nunca una ruta provista por el cliente).
export function guardarArchivoCifrado(buffer, directorio, keyHex) {
  fs.mkdirSync(directorio, { recursive: true });
  const nombre = nombreInternoAleatorio();
  const sobre = encryptBuffer(buffer, keyHex);
  fs.writeFileSync(path.join(directorio, nombre), sobre);
  return nombre;
}

export function tamanoLegible(bytes) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
