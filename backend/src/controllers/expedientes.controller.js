// Controlador: Expediente Clinico / Diagnostico confidencial (Modulo 2)
// Acceso protegido por el middleware requireTempToken (RF-11, RF-33, RF-34):
// solo el Administrador o un usuario con token de acceso temporal vigente
// puede ver o modificar el contenido de este controlador.
//
// Sprint 4: los archivos adjuntos de estudios ya no se guardan en claro:
// Multer los recibe en memoria (con limite de tamano), la aplicacion los
// cifra con AES-256-GCM y persiste un sobre cifrado en el volumen. Los
// archivos historicos en claro siguen siendo legibles (fallback) y se
// recifran con scripts/recifrar-archivos.js.
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { prisma } from "../config/prisma.js";
import { encrypt, decrypt, leerArchivoCifrado } from "../utils/crypto.util.js";
import { ENCRYPTION_KEY, UPLOAD_MAX_MB_ESTUDIOS } from "../config/env.js";
import { ROLES } from "../utils/roles.util.js";
import { validarArchivo, guardarArchivoCifrado } from "../utils/archivos.util.js";

const KEY = ENCRYPTION_KEY;

// Los archivos de "Estudios y resultados" se guardan cifrados en disco (no
// en la base de datos) para no inflar las filas de Diagnostico; solo el
// nombre interno aleatorio y el pacienteId dueno quedan en
// DiagnosticoArchivo, para poder validar el acceso con el mismo token
// temporal que protege el diagnostico (RF-11).
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "diagnosticos");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Sprint 4: almacenamiento en memoria controlado — el archivo nunca toca
// disco en claro; se cifra antes de persistirlo. Limite configurable
// (UPLOAD_MAX_MB_ESTUDIOS, 5 MB por defecto).
export const uploadEstudios = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_MAX_MB_ESTUDIOS * 1024 * 1024 },
}).any();

// Lista solo metadatos (sin el contenido del diagnostico) para saber si
// un paciente ya tiene expediente registrado, sin exponer datos sensibles.
export async function listar(req, res) {
  const diagnosticos = await prisma.diagnostico.findMany({
    select: { id: true, pacienteId: true, codigoCie: true, creadoEn: true },
    orderBy: { creadoEn: "desc" },
    take: 50,
  });
  res.json(diagnosticos);
}

// Adjunta cada archivo de datos.estudios como data URI (base64) leido del
// volumen (descifrado en memoria), para que el frontend lo pueda mostrar o
// descargar sin un endpoint aparte — todo llega en la misma respuesta ya
// protegida por el token.
async function inlineUnArchivo(ref, pacienteId) {
  if (!ref?.archivoId) return;
  const archivo = await prisma.diagnosticoArchivo.findUnique({ where: { id: ref.archivoId } });
  if (!archivo || archivo.pacienteId !== pacienteId) return;
  try {
    const buffer = leerArchivoCifrado(path.join(UPLOAD_DIR, archivo.nombreArchivo), KEY);
    ref.archivoDataUrl = `data:${archivo.mimeType};base64,${buffer.toString("base64")}`;
    ref.archivoNombre = archivo.nombreOriginal;
  } catch {
    ref.archivoDataUrl = null;
  }
}

async function inlineArchivosEstudios(datos, pacienteId) {
  if (!datos) return;
  for (const estudio of datos.estudios || []) await inlineUnArchivo(estudio, pacienteId);
  await inlineUnArchivo(datos.archivoDiagnostico, pacienteId);
  for (const adjunto of datos.adjuntosAdicionales || []) await inlineUnArchivo(adjunto, pacienteId);
}

async function descifrarDiagnostico(diagnostico) {
  const texto = decrypt(
    { encrypted: diagnostico.textoCifrado, iv: diagnostico.iv, authTag: diagnostico.authTag },
    KEY
  );

  // El contenido cifrado es un JSON con la plantilla estructurada (motivo,
  // signos vitales, diagnostico principal, etc). Los diagnosticos creados
  // antes de esta plantilla guardaron texto plano: si el parseo falla, se
  // devuelve como texto libre para no romper expedientes viejos.
  let datos = null;
  let legacyTexto = null;
  try {
    datos = JSON.parse(texto);
    await inlineArchivosEstudios(datos, diagnostico.pacienteId);
  } catch {
    legacyTexto = texto;
  }

  return {
    id: diagnostico.id,
    pacienteId: diagnostico.pacienteId,
    ingresoId: diagnostico.ingresoId,
    codigoCie: diagnostico.codigoCie,
    tipoAtencion: diagnostico.tipoAtencion,
    servicio: diagnostico.servicio,
    salaCama: diagnostico.salaCama,
    datos,
    legacyTexto,
    registradoPor: diagnostico.registrador?.nombre,
    creadoEn: diagnostico.creadoEn,
  };
}

// RF-10/RF-11: obtener el diagnostico mas reciente de un paciente, descifrado,
// junto con el historial de versiones anteriores (nunca se sobrescriben,
// cada correccion queda como una fila nueva). Un solo token/acceso de
// Administrador da visibilidad de todo el historial, no solo la ultima
// version, para no obligar a pedir un token nuevo por cada version antigua.
export async function obtenerUno(req, res) {
  const pacienteId = Number(req.params.id);
  const registros = await prisma.diagnostico.findMany({
    where: { pacienteId },
    orderBy: { creadoEn: "desc" },
    include: { registrador: { select: { nombre: true } } },
  });
  if (!registros.length) return res.status(404).json({ error: "Este paciente no tiene diagnostico registrado" });

  const [actual, ...anteriores] = await Promise.all(registros.map(descifrarDiagnostico));

  // Admisiones del paciente, cada una con los diagnosticos que le
  // corresponden (RF-10): asi se puede revisar una admision a la vez sin
  // pedir un token nuevo por cada una.
  const ingresos = await prisma.ingreso.findMany({
    where: { pacienteId },
    orderBy: { fechaIngreso: "desc" },
  });
  const ingresosConDiagnosticos = ingresos.map((i) => ({
    ...i,
    diagnosticos: [actual, ...anteriores].filter((d) => d.ingresoId === i.id),
  }));

  // RNF-08: deja constancia de quien vio el diagnostico y cuando
  await prisma.accesoDiagnostico.create({
    data: {
      pacienteId,
      usuarioId: req.user.id,
      accion: "ver",
      viaToken: !req.user.roles.includes(ROLES.ADMIN),
      tokenId: req.tempToken?.id ?? null,
    },
  });

  res.json({ ...actual, historial: anteriores, ingresos: ingresosConDiagnosticos });
}

// RF-10: registrar el diagnostico, cifrado antes de guardarse. La peticion
// llega como multipart/form-data: "datos" es el JSON serializado. Cada
// archivo adjunto de un estudio usa el campo "estudio_<indice>"; el archivo
// general del diagnostico usa "diagnostico_adjunto" y los archivos
// adicionales "adjunto_extra_<i>".
export async function crear(req, res) {
  const pacienteId = Number(req.params.id ?? req.body.pacienteId);
  let datos;
  try {
    datos = typeof req.body.datos === "string" ? JSON.parse(req.body.datos) : req.body.datos;
  } catch {
    return res.status(400).json({ error: "datos no es un JSON valido" });
  }
  const { codigoCie, tipoAtencion, servicio, salaCama } = req.body;
  if (!datos || !pacienteId) {
    return res.status(400).json({ error: "pacienteId y datos son requeridos" });
  }

  // Admision a la que pertenece el diagnostico: la que manda el cliente o,
  // si no viene, la mas reciente del paciente (las admisiones previas siguen
  // conservando sus propios diagnosticos).
  let ingresoId = req.body.ingresoId ? Number(req.body.ingresoId) : null;
  if (ingresoId) {
    const ingreso = await prisma.ingreso.findFirst({ where: { id: ingresoId, pacienteId }, select: { id: true } });
    if (!ingreso) return res.status(404).json({ error: "El ingreso indicado no pertenece a este paciente" });
  } else {
    const ultimo = await prisma.ingreso.findFirst({ where: { pacienteId }, orderBy: { fechaIngreso: "desc" }, select: { id: true } });
    ingresoId = ultimo?.id ?? null;
  }

  // Sprint 4: validar tipos permitidos antes de persistir nada
  for (const file of req.files || []) {
    const error = validarArchivo(file);
    if (error) return res.status(422).json({ error });
  }

  // Los adjuntos del diagnostico: cada estudio puede tener su propio archivo
  // (estudio_<indice>), y ademas hay un archivo general del diagnostico
  // (diagnostico_adjunto) y archivos adicionales sueltos (adjunto_extra_<i>).
  // Todos se cifran antes de tocar disco; en la base solo queda el metadato.
  datos.adjuntosAdicionales = [];
  for (const file of req.files || []) {
    const matchEstudio = file.fieldname.match(/^estudio_(\d+)$/);
    if (matchEstudio) {
      const indice = Number(matchEstudio[1]);
      if (!datos.estudios?.[indice]) continue;
      const nombreArchivo = guardarArchivoCifrado(file.buffer, UPLOAD_DIR, KEY);
      const archivo = await prisma.diagnosticoArchivo.create({
        data: { pacienteId, nombreOriginal: file.originalname, nombreArchivo, mimeType: file.mimetype, tamano: file.size },
      });
      datos.estudios[indice].archivoId = archivo.id;
      datos.estudios[indice].archivoNombre = file.originalname;
      continue;
    }
    if (file.fieldname !== "diagnostico_adjunto" && !/^adjunto_extra_\d+$/.test(file.fieldname)) continue;
    const nombreArchivo = guardarArchivoCifrado(file.buffer, UPLOAD_DIR, KEY);
    const archivo = await prisma.diagnosticoArchivo.create({
      data: { pacienteId, nombreOriginal: file.originalname, nombreArchivo, mimeType: file.mimetype, tamano: file.size },
    });
    const ref = { archivoId: archivo.id, archivoNombre: file.originalname };
    if (file.fieldname === "diagnostico_adjunto") datos.archivoDiagnostico = ref;
    else datos.adjuntosAdicionales.push(ref);
  }

  const { encrypted, iv, authTag } = encrypt(JSON.stringify(datos), KEY);
  const diagnostico = await prisma.diagnostico.create({
    data: {
      pacienteId, ingresoId, textoCifrado: encrypted, iv, authTag, codigoCie,
      tipoAtencion, servicio, salaCama, registradoPor: req.user.id,
    },
  });

  // RNF-08: deja constancia de quien registro/edito el diagnostico y cuando
  await prisma.accesoDiagnostico.create({
    data: {
      pacienteId,
      usuarioId: req.user.id,
      accion: "registrar",
      viaToken: !req.user.roles.includes(ROLES.ADMIN),
      tokenId: req.tempToken?.id ?? null,
    },
  });

  res.status(201).json({ ok: true, id: diagnostico.id, pacienteId, codigoCie, creadoEn: diagnostico.creadoEn });
}
