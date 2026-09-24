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
// Extensiones que corresponden a cada tipo (un JPEG puede llamarse .jpg o
// .jpeg; los celulares guardan ambas).
const EXTENSIONES = {
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
};

// Primeros bytes que identifican cada formato (firma del archivo)
function firmaCoincide(mimetype, buffer) {
  if (!buffer || buffer.length < 8) return false;
  if (mimetype === "application/pdf") return buffer.subarray(0, 5).toString("latin1") === "%PDF-";
  if (mimetype === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimetype === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  return true; // tipo configurado por el hospital sin firma conocida: solo se valida MIME y extension
}

export function tiposPermitidos() {
  const raw = process.env.UPLOAD_TIPOS_PERMITIDOS;
  return raw ? raw.split(",").map((t) => t.trim()).filter(Boolean) : TIPOS_DEFAULT;
}

// Valida MIME, extension y contenido. Ni el nombre ni el MIME que manda el
// cliente son confiables, asi que se exige que los TRES coincidan: el MIME
// esta en la lista, la extension corresponde a ese MIME, y (si el archivo
// viene en memoria) sus primeros bytes son los de ese formato. Nunca se usa
// el nombre original para escribir en disco.
export function validarArchivo(file) {
  const permitidos = tiposPermitidos();
  const extension = path.extname(file.originalname || "").toLowerCase();
  const extensionesDelTipo = EXTENSIONES[file.mimetype];
  const tipoValido = permitidos.includes(file.mimetype) && (!extensionesDelTipo || extensionesDelTipo.includes(extension));
  if (!tipoValido) {
    return `Tipo de archivo no permitido: "${file.originalname}". Permitidos: PDF, PNG, JPG`;
  }
  if (/[\\/]|\.\./.test(file.originalname)) {
    return "El nombre del archivo contiene caracteres no permitidos";
  }
  if (file.buffer && !firmaCoincide(file.mimetype, file.buffer)) {
    return `El contenido de "${file.originalname}" no corresponde a un archivo ${file.mimetype.split("/")[1].toUpperCase()} válido`;
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

// Valida que el buffer sea realmente un PDF: el Content-Type que manda el
// cliente no es confiable, por eso tambien se revisan los magic bytes
// (%PDF- al inicio del archivo).
export function validarPdf(file) {
  const magic = file.buffer.subarray(0, 5).toString("latin1");
  if (magic !== "%PDF-") return "El archivo no es un PDF válido";
  if (file.mimetype !== "application/pdf") return "El MIME type no corresponde a un PDF";
  return null;
}

export function tamanoLegible(bytes) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
