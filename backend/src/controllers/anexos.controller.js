// Controlador: Anexos y expedientes escaneados del paciente (Sprint 4).
// Repositorio general independiente de los adjuntos de estudios del
// diagnostico: documentos escaneados, identificaciones, referencias, etc.
//
// Toda la informacion es clinica confidencial: los endpoints exigen token
// temporal (o rol Administrador), igual que el diagnostico. El contenido
// binario vive cifrado (AES-256-GCM) en el volumen uploads/anexos; la tabla
// AnexoPaciente guarda solo metadatos no sensibles y el nombre interno
// aleatorio. La descarga siempre pasa por esta API autorizada — el volumen
// no se sirve estaticamente.
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { prisma } from "../config/prisma.js";
import { ENCRYPTION_KEY, UPLOAD_MAX_MB_ANEXOS } from "../config/env.js";
import { leerArchivoCifrado } from "../utils/crypto.util.js";
import { validarArchivo, guardarArchivoCifrado } from "../utils/archivos.util.js";
import { registrarActividad } from "../services/actividad.service.js";

const KEY = ENCRYPTION_KEY;
const ANEXOS_DIR = path.join(process.cwd(), "uploads", "anexos");
fs.mkdirSync(ANEXOS_DIR, { recursive: true });

// Carga multiple con limite configurable (UPLOAD_MAX_MB_ANEXOS, 15 MB por
// archivo por defecto). Almacenamiento en memoria: se cifra antes de tocar disco.
export const uploadAnexos = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_MAX_MB_ANEXOS * 1024 * 1024 },
}).any();

// Metadatos de los anexos del paciente: nombre, tamano, fecha y accion de
// apertura. Nunca expone la ruta fisica ni el contenido.
export async function listarAnexos(req, res) {
  const pacienteId = Number(req.params.id);
  const paciente = await prisma.paciente.findUnique({ where: { id: pacienteId }, select: { id: true } });
  if (!paciente) return res.status(404).json({ error: "Paciente no encontrado" });

  const anexos = await prisma.anexoPaciente.findMany({
    where: { pacienteId },
    select: { id: true, nombreOriginal: true, mimeType: true, tamano: true, creadoEn: true },
    orderBy: { creadoEn: "desc" },
  });
  await registrarActividad(req.user.id, "ver_anexos", `Anexos del paciente ${pacienteId}`);
  res.json(anexos);
}

// Carga multiple de anexos. Cada archivo se valida (tipo, extension, nombre),
// se cifra y se persiste con nombre interno aleatorio; la fila guarda solo
// metadatos. Si algun archivo es invalido se rechaza toda la peticion antes
// de escribir algo en disco (no quedan anexos huérfanos).
export async function subirAnexos(req, res) {
  const pacienteId = Number(req.params.id);
  const paciente = await prisma.paciente.findUnique({ where: { id: pacienteId }, select: { id: true } });
  if (!paciente) return res.status(404).json({ error: "Paciente no encontrado" });

  const archivos = req.files || [];
  if (!archivos.length) return res.status(400).json({ error: "Adjunte al menos un archivo" });

  for (const file of archivos) {
    const error = validarArchivo(file);
    if (error) return res.status(422).json({ error });
  }

  const creados = [];
  for (const file of archivos) {
    const nombreArchivo = guardarArchivoCifrado(file.buffer, ANEXOS_DIR, KEY);
    const anexo = await prisma.anexoPaciente.create({
      data: {
        pacienteId,
        nombreOriginal: file.originalname,
        nombreArchivo,
        mimeType: file.mimetype,
        tamano: file.size,
      },
      select: { id: true, nombreOriginal: true, mimeType: true, tamano: true, creadoEn: true },
    });
    creados.push(anexo);
  }

  await registrarActividad(req.user.id, "subir_anexos", `${creados.length} anexo(s) del paciente ${pacienteId}`);
  res.status(201).json({ ok: true, anexos: creados });
}

// Descarga/visualizacion de un anexo: siempre a traves de esta API (con
// token temporal o Administrador); el volumen nunca se sirve estaticamente.
export async function descargarAnexo(req, res) {
  const anexo = await prisma.anexoPaciente.findUnique({ where: { id: Number(req.params.id) } });
  if (!anexo) return res.status(404).json({ error: "Anexo no encontrado" });

  // El token temporal puede estar acotado a un paciente: verificar que el
  // anexo pertenece al paciente autorizado (si el token trae pacienteId).
  if (req.tempToken?.pacienteId && req.tempToken.pacienteId !== anexo.pacienteId) {
    return res.status(403).json({ error: "El token no autoriza a este paciente" });
  }

  const ruta = path.join(ANEXOS_DIR, anexo.nombreArchivo);
  if (!fs.existsSync(ruta)) return res.status(404).json({ error: "El archivo físico del anexo no existe" });

  try {
    const buffer = leerArchivoCifrado(ruta, KEY);
    await registrarActividad(req.user.id, "descargar_anexo", `${anexo.nombreOriginal} (paciente ${anexo.pacienteId})`);
    // Nombre de descarga sanitizado: nunca una ruta del usuario
    const nombreSeguro = path.basename(anexo.nombreOriginal).replace(/[^\w.\-() ]/g, "_");
    res.setHeader("Content-Disposition", `inline; filename="${nombreSeguro}"`);
    res.setHeader("Content-Type", anexo.mimeType);
    res.send(buffer);
  } catch {
    res.status(500).json({ error: "No se pudo descifrar el archivo (¿llave incorrecta o archivo corrupto?)" });
  }
}
