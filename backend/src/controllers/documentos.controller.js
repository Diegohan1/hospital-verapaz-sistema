// Controlador: Documentos del paciente (Cambios2 Sprint 5 + fusion con
// Anexos del 23/09/2026 -- ver nota en schema.prisma junto a
// DocumentoPaciente). Dos usos distintos comparten esta tabla:
// - El PDF del expediente fisico escaneado al registrar al paciente (solo
//   PDF, validado aparte en pacientes.controller.js con validarPdf, porque
//   ahi el paciente todavia no existe).
// - Documentos generales de un paciente ya existente (subir/listar/descargar
//   mas abajo): identificaciones, referencias, constancias u otro escaneo
//   suelto. Admite PDF, PNG o JPG (validarArchivo), igual que antes admitia
//   el modulo de Anexos. Nunca resultados de examenes: esos van ligados al
//   diagnostico (DiagnosticoArchivo), porque llevan historial clinico.
//
// Protegido por rol (ver pacientes.routes.js), sin token de acceso temporal
// -- a diferencia del diagnostico y de como era Anexos antes de la fusion:
// RegistroPage.jsx muestra esta lista dentro de la ficha del paciente sin
// flujo de token, para admision y personal clinico.
//
// El binario se cifra con AES-256-GCM antes de persistirse en el volumen
// privado uploads/documentos; la tabla guarda solo metadatos no sensibles,
// checksum de integridad y auditoria. La descarga siempre pasa por esta API
// autorizada: el volumen nunca se sirve estaticamente ni expone la ruta
// fisica.
import fs from "node:fs";
import path from "node:path";
import crypto from "crypto";
import multer from "multer";
import { prisma } from "../config/prisma.js";
import { leerArchivoCifrado } from "../utils/crypto.util.js";
import { guardarArchivoCifrado, validarArchivo } from "../utils/archivos.util.js";
import { registrarActividad } from "../services/actividad.service.js";

const DOCUMENTOS_DIR = path.join(process.cwd(), "uploads", "documentos");
fs.mkdirSync(DOCUMENTOS_DIR, { recursive: true });

const DOCUMENT_MAX_MB = Number(process.env.DOCUMENT_MAX_MB || 20);
const DOCUMENT_MAX_PAGES = Number(process.env.DOCUMENT_MAX_PAGES || 30);

// Carga en memoria con limite configurable; se cifra antes de tocar disco.
export const uploadDocumento = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DOCUMENT_MAX_MB * 1024 * 1024 },
}).single("documento");

// Metadatos que se exponen; nunca la ruta fisica ni el nombre interno
const SELECT_METADATOS = {
  id: true, nombreOriginal: true, mimeType: true, tamano: true,
  paginas: true, tipoDocumental: true, checksum: true, creadoEn: true,
  fechaDocumentoOriginal: true,
  registradoPor: true, registrador: { select: { nombre: true } },
};

// POST /api/pacientes/:id/documentos
// Recibe multipart/form-data: campo "documento" (PDF, PNG o JPG),
// "nombreOriginal" opcional, "tipoDocumental" opcional y "paginas" opcional
// (solo aplica a PDF). Valida rol, paciente, MIME real (magic bytes),
// extension, tamano y paginas; calcula checksum y persiste el binario
// cifrado con nombre interno aleatorio.
export async function subir(req, res) {
  const pacienteId = Number(req.params.id);
  const file = req.file;
  if (!file) return res.status(400).json({ error: "Adjunte un archivo" });

  const errorArchivo = validarArchivo(file);
  if (errorArchivo) return res.status(422).json({ error: errorArchivo });

  const nombreOriginal = path.basename(req.body.nombreOriginal || file.originalname || "documento").replace(/[^\w.\-() ]/g, "_");

  const paciente = await prisma.paciente.findUnique({ where: { id: pacienteId }, select: { id: true, nombreCompleto: true, historiaClinica: true } });
  if (!paciente) return res.status(404).json({ error: "Paciente no encontrado" });

  // El numero de paginas solo tiene sentido para un PDF; una imagen suelta es 1 pagina.
  const paginas = file.mimetype === "application/pdf" ? Number(req.body.paginas) || 1 : 1;
  if (!Number.isInteger(paginas) || paginas < 1 || paginas > DOCUMENT_MAX_PAGES) {
    return res.status(422).json({ error: `El número de páginas debe estar entre 1 y ${DOCUMENT_MAX_PAGES}` });
  }
  if (file.size > DOCUMENT_MAX_MB * 1024 * 1024) {
    return res.status(413).json({ error: `El archivo excede el máximo de ${DOCUMENT_MAX_MB} MB` });
  }

  const checksum = crypto.createHash("sha256").update(file.buffer).digest("hex");
  const nombreArchivo = guardarArchivoCifrado(file.buffer, DOCUMENTOS_DIR, process.env.ENCRYPTION_KEY);

  const documento = await prisma.documentoPaciente.create({
    data: {
      pacienteId,
      nombreOriginal,
      nombreArchivo,
      mimeType: file.mimetype,
      tamano: file.size,
      checksum,
      paginas,
      tipoDocumental: req.body.tipoDocumental || null,
      fechaDocumentoOriginal: req.body.fechaDocumentoOriginal ? new Date(req.body.fechaDocumentoOriginal) : null,
      registradoPor: req.user.id,
    },
    select: SELECT_METADATOS,
  });

  await registrarActividad(req.user.id, "subir_documento", `${nombreOriginal} (${documento.paginas} pág., paciente ${paciente.historiaClinica})`);
  res.status(201).json(documento);
}

// GET /api/pacientes/:id/documentos — metadatos paginados, sin binario
export async function listar(req, res) {
  const pacienteId = Number(req.params.id);
  const paciente = await prisma.paciente.findUnique({ where: { id: pacienteId }, select: { id: true } });
  if (!paciente) return res.status(404).json({ error: "Paciente no encontrado" });

  const where = { pacienteId, eliminadoEn: null };
  if (req.query.page) {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const [items, total] = await Promise.all([
      prisma.documentoPaciente.findMany({ where, orderBy: { creadoEn: "desc" }, skip: (page - 1) * pageSize, take: pageSize, select: SELECT_METADATOS }),
      prisma.documentoPaciente.count({ where }),
    ]);
    return res.json({ items, total, page, pageSize });
  }
  const documentos = await prisma.documentoPaciente.findMany({ where, orderBy: { creadoEn: "desc" }, take: 100, select: SELECT_METADATOS });
  res.json(documentos);
}

// GET /api/pacientes/:id/documentos/:documentoId — descarga autorizada del
// documento (descifrado en memoria); nunca una ruta fisica.
export async function descargar(req, res) {
  const documentoId = Number(req.params.documentoId);
  const documento = await prisma.documentoPaciente.findUnique({
    where: { id: documentoId },
    select: { id: true, pacienteId: true, nombreOriginal: true, nombreArchivo: true, mimeType: true, eliminadoEn: true },
  });
  if (!documento || documento.pacienteId !== Number(req.params.id) || documento.eliminadoEn) {
    return res.status(404).json({ error: "Documento no encontrado" });
  }

  const ruta = path.join(DOCUMENTOS_DIR, documento.nombreArchivo);
  if (!fs.existsSync(ruta)) return res.status(404).json({ error: "El archivo físico del documento no existe" });

  try {
    const contenido = leerArchivoCifrado(ruta, process.env.ENCRYPTION_KEY);
    await registrarActividad(req.user.id, "descargar_documento", `${documento.nombreOriginal} (paciente ${documento.pacienteId})`);
    // Antes de la fusion con Anexos todo era PDF; ahora tambien puede ser
    // PNG/JPG, asi que el Content-Type real del archivo importa (si no, el
    // navegador intenta renderizar una imagen como si fuera un PDF).
    res.setHeader("Content-Type", documento.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${documento.nombreOriginal}"`);
    res.send(contenido);
  } catch {
    res.status(500).json({ error: "No se pudo descifrar el documento (¿llave incorrecta o archivo corrupto?)" });
  }
}

// DELETE /api/pacientes/:id/documentos/:documentoId — eliminacion logica
// (politica de retencion): el binario se conserva hasta la depuracion
// aprobada; el documento deja de listarse y descargarse.
export async function eliminar(req, res) {
  const documentoId = Number(req.params.documentoId);
  const documento = await prisma.documentoPaciente.findUnique({
    where: { id: documentoId },
    select: { id: true, pacienteId: true, nombreOriginal: true, eliminadoEn: true },
  });
  if (!documento || documento.pacienteId !== Number(req.params.id)) {
    return res.status(404).json({ error: "Documento no encontrado" });
  }
  if (documento.eliminadoEn) return res.status(409).json({ error: "El documento ya fue eliminado" });

  await prisma.documentoPaciente.update({ where: { id: documentoId }, data: { eliminadoEn: new Date() } });
  await registrarActividad(req.user.id, "eliminar_documento", `${documento.nombreOriginal} (paciente ${documento.pacienteId})`);
  res.json({ ok: true });
}
