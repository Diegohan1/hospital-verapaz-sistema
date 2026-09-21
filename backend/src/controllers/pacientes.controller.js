// Controlador: Registro y Admision (Modulo 1)
// Sprint 3: los datos clinicos de egreso (diagnostico, complicaciones,
// operaciones, autopsia, causa de muerte) se guardan cifrados en la entidad
// EgresoClinico, separados de los datos administrativos del Paciente. Los
// listados nunca exponen esos campos (DTO con select explicito).
import path from "node:path";
import crypto from "crypto";
import { prisma } from "../config/prisma.js";
import { encrypt, decrypt } from "../utils/crypto.util.js";
import { ENCRYPTION_KEY } from "../config/env.js";
import { registrarActividad } from "../services/actividad.service.js";
import { leerPaginacion } from "../utils/paginacion.util.js";
import { ROLES } from "../utils/roles.util.js";
import { validarPdf, guardarArchivoCifrado } from "../utils/archivos.util.js";

const DOCUMENTOS_DIR = path.join(process.cwd(), "uploads", "documentos");
const DOCUMENT_MAX_MB = Number(process.env.DOCUMENT_MAX_MB || 20);

// Campos administrativos, de ingreso y de egreso administrativo (no
// sensibles). Los campos clinicos de egreso NO van aqui: viajan cifrados en
// EgresoClinico.
const CAMPOS_PACIENTE = [
  "nombreCompleto", "dpi", "direccion", "lugarNacimiento", "fechaNacimiento",
  "telefono", "edad", "sexo", "tipoSangre", "estadoCivil", "ocupacion", "religion", "nacionalidad",
  "nombreConyuge", "nombrePadre", "nombreMadre", "contactoEmergencia", "telefonoEmergencia", "parentesco",
  "encargadoNombre", "encargadoTelefono",
  "referidoDe", "medicoReferenteId", "serviciosSolicitados", "impresionClinicaIngreso",
  "fechaIngreso", "fechaEgreso", "condicionEgreso",
];

// Select explicito para listados: garantiza que nunca se filtren columnas
// clinicas legacy en texto plano (regla del plan: DTOs sin datos sensibles).
const SELECT_LISTADO = {
  id: true, historiaClinica: true, nombreCompleto: true, dpi: true, direccion: true,
  lugarNacimiento: true, fechaNacimiento: true, telefono: true, edad: true, sexo: true,
  tipoSangre: true, estadoCivil: true, ocupacion: true, religion: true, nacionalidad: true,
  nombreConyuge: true, nombrePadre: true, nombreMadre: true,
  contactoEmergencia: true, telefonoEmergencia: true, parentesco: true,
  encargadoNombre: true, encargadoTelefono: true,
  referidoDe: true, medicoReferenteId: true, serviciosSolicitados: true,
  impresionClinicaIngreso: true, fechaIngreso: true, fechaEgreso: true, condicionEgreso: true,
  creadoEn: true,
};

// Campos clinicos de egreso que viajan en el payload cifrado
const CAMPOS_EGRESO_CLINICO = ["diagnosticoEgreso", "complicaciones", "operaciones", "autopsia", "causaMuerte"];

const CONDICIONES_FALLECIMIENTO = ["fallecido_antes_48", "fallecido_despues_48"];

function tomarCampos(body) {
  const data = {};
  for (const campo of CAMPOS_PACIENTE) {
    if (body[campo] === undefined) continue;
    if (["fechaNacimiento", "fechaIngreso", "fechaEgreso"].includes(campo)) {
      data[campo] = body[campo] ? new Date(body[campo]) : null;
    } else if (["edad", "medicoReferenteId"].includes(campo)) {
      // Dev-Mari: cuando el registro llega como multipart/form-data (flujo
      // de escaneo), estos campos numericos viajan como texto.
      data[campo] = body[campo] === "" || body[campo] == null ? null : Number(body[campo]);
    } else {
      data[campo] = body[campo];
    }
  }
  return data;
}

// Sprint 3: validacion de entradas obligatorias y formatos.
//
// esEdicion=true (PUT): es una actualizacion PARCIAL — la pestaña
// "Ingreso / Egreso" solo manda los campos que edita, sin nombre ni DPI. Por
// eso ahi nombre y DPI no son obligatorios reenviarlos; pero si vienen, se
// validan igual (nombre no vacio, DPI de 13 digitos). Antes se exigia el
// nombre siempre y guardar ingreso/egreso/maternidad respondia 400.
export function validarPaciente(body, { esEdicion = false } = {}) {
  if (esEdicion) {
    if (body.nombreCompleto !== undefined && !String(body.nombreCompleto ?? "").trim()) return "El nombre no puede quedar vacío";
  } else {
    if (!body.nombreCompleto?.trim()) return "nombreCompleto es requerido";
    if (!body.dpi?.trim()) return "dpi es requerido";
  }
  if (body.dpi != null && body.dpi !== "" && !/^\d{13}$/.test(String(body.dpi).trim())) {
    return "El DPI debe tener 13 dígitos";
  }
  if (body.telefono != null && body.telefono !== "" && !/^\d{8}$/.test(String(body.telefono).trim())) {
    return "El teléfono debe tener 8 dígitos";
  }
  if (body.telefonoEmergencia != null && body.telefonoEmergencia !== "" && !/^\d{8}$/.test(String(body.telefonoEmergencia).trim())) {
    return "El teléfono de emergencia debe tener 8 dígitos";
  }
  if (body.encargadoTelefono != null && body.encargadoTelefono !== "" && !/^\d{8}$/.test(String(body.encargadoTelefono).trim())) {
    return "El teléfono del encargado debe tener 8 dígitos";
  }
  if (body.edad != null && body.edad !== "" && (body.edad < 0 || body.edad > 130)) {
    return "La edad debe estar entre 0 y 130 años";
  }
  return null;
}

// Datos del nacimiento: el DPI y telefono del padre son opcionales, pero si
// vienen deben tener formato valido (el recien nacido puede no tener DPI/CUI).
export function validarMaternidad(m) {
  if (!m) return null;
  if (m.padreDpi != null && m.padreDpi !== "" && !/^\d{13}$/.test(String(m.padreDpi).trim())) {
    return "El DPI del padre debe tener 13 dígitos";
  }
  if (m.padreTelefono != null && m.padreTelefono !== "" && !/^\d{8}$/.test(String(m.padreTelefono).trim())) {
    return "El teléfono del padre debe tener 8 dígitos";
  }
  return null;
}

// Mapeo de los campos legacy (texto plano en columnas administrativas) al
// payload cifrado nuevo, para compatibilidad con clientes que aun los envian.
const MAPA_LEGACY_EGRESO = {
  diagnosticoEgresoCodigo: "diagnosticoEgreso",
  complicacionesCodigo: "complicaciones",
  operacionesCodigo: "operaciones",
};

// Arma el payload clinico de egreso a partir de body.egresoClinico (forma
// nueva) o de los campos planos legacy (compatibilidad con clientes viejos);
// devuelve null si no hay nada que guardar.
export function tomarEgresoClinico(body) {
  // borrado explicito del egreso clinico
  if (body.egresoClinico === null) return null;

  // forma nueva: objeto egresoClinico con los nombres definitivos
  if (body.egresoClinico !== undefined) {
    const payload = {};
    let tieneDatos = false;
    for (const campo of CAMPOS_EGRESO_CLINICO) {
      if (body.egresoClinico[campo] === undefined) continue;
      payload[campo] = body.egresoClinico[campo] === "" ? null : body.egresoClinico[campo];
      tieneDatos = true;
    }
    return tieneDatos ? payload : {};
  }

  // forma legacy: campos planos (con sufijo *Codigo para los CIE)
  const payload = {};
  let tieneDatos = false;
  for (const [campoLegacy, campoNuevo] of Object.entries(MAPA_LEGACY_EGRESO)) {
    if (body[campoLegacy] === undefined) continue;
    payload[campoNuevo] = body[campoLegacy] === "" ? null : body[campoLegacy];
    tieneDatos = true;
  }
  for (const campo of ["autopsia", "causaMuerte"]) {
    if (body[campo] === undefined) continue;
    payload[campo] = body[campo] === "" ? null : body[campo];
    tieneDatos = true;
  }
  return tieneDatos ? payload : null;
}

// Autopsia y causa de muerte solo aplican a condiciones de fallecimiento
export function validarEgresoClinico(payload, condicionEfectiva) {
  if (!payload) return null;
  const marcaFallecimiento = (payload.autopsia != null && payload.autopsia !== "") || payload.causaMuerte;
  if (marcaFallecimiento && !CONDICIONES_FALLECIMIENTO.includes(condicionEfectiva)) {
    return "Autopsia y causa de muerte solo aplican a condiciones de egreso de fallecimiento";
  }
  return null;
}

function generarHistoriaClinica(id) {
  const anio = new Date().getFullYear();
  return `HC-${anio}-${String(id).padStart(6, "0")}`;
}

// Descifra el payload clinico de egreso; si no hay fila EgresoClinico pero
// existen datos legacy en texto plano (base migrada a medias), los usa como
// fallback solo para los roles autorizados.
async function egresoClinicoPara(paciente, autorizado) {
  if (!autorizado) return undefined;
  if (paciente.egresoClinico) {
    try {
      const fila = paciente.egresoClinico;
      return JSON.parse(decrypt(
        { encrypted: fila.textoCifrado, iv: fila.iv, authTag: fila.authTag },
        ENCRYPTION_KEY
      ));
    } catch {
      return null; // cifrado corrupto o llave rotada: no exponer nada
    }
  }
  const legacy = {};
  if (paciente.diagnosticoEgresoCodigo != null) legacy.diagnosticoEgreso = paciente.diagnosticoEgresoCodigo;
  if (paciente.complicacionesCodigo != null) legacy.complicaciones = paciente.complicacionesCodigo;
  if (paciente.operacionesCodigo != null) legacy.operaciones = paciente.operacionesCodigo;
  if (paciente.autopsia != null) legacy.autopsia = paciente.autopsia;
  if (paciente.causaMuerte != null) legacy.causaMuerte = paciente.causaMuerte;
  return Object.keys(legacy).length ? legacy : null;
}

// RF-02: buscar paciente existente por nombre, DPI o historia clinica.
// Nunca expone datos clinicos de egreso (SELECT explicito).
export async function listar(req, res) {
  const { buscar } = req.query;
  const where = buscar
    ? {
        OR: [
          { nombreCompleto: { contains: buscar, mode: "insensitive" } },
          { dpi: { contains: buscar } },
          { historiaClinica: { contains: buscar, mode: "insensitive" } },
        ],
      }
    : undefined;

  // Paginado solo si el caller manda "page" (la pantalla de "Pacientes
  // registrados"). Los <select> de otras pantallas siguen pidiendo la
  // lista completa (tope 50) igual que antes.
  if (req.query.page) {
    const { page, pageSize, skip, take } = leerPaginacion(req);
    // Dev-Mari: junto a la fecha de registro en el sistema (creadoEn), la
    // fecha escrita en el papel del expediente escaneado (si hay uno).
    const selectConFechaPapel = {
      ...SELECT_LISTADO,
      documentos: {
        where: { eliminadoEn: null, fechaDocumentoOriginal: { not: null } },
        orderBy: { fechaDocumentoOriginal: "asc" },
        take: 1,
        select: { fechaDocumentoOriginal: true },
      },
    };
    const [items, total] = await Promise.all([
      prisma.paciente.findMany({ where, orderBy: { creadoEn: "desc" }, skip, take, select: selectConFechaPapel }),
      prisma.paciente.count({ where }),
    ]);
    return res.json({ items, total, page, pageSize });
  }

  const pacientes = await prisma.paciente.findMany({
    where,
    orderBy: { creadoEn: "desc" },
    take: 50,
    select: SELECT_LISTADO,
  });
  res.json(pacientes);
}

// Datos administrativos de un paciente; el egreso clinico cifrado solo se
// descifra para roles autorizados a manejar ingreso/egreso (Recepcion,
// Administrador). El resto ve solo el minimo administrativo.
export async function obtenerUno(req, res) {
  const paciente = await prisma.paciente.findUnique({
    where: { id: Number(req.params.id) },
    include: { maternidad: true, medicoReferente: true, egresoClinico: true },
  });
  if (!paciente) return res.status(404).json({ error: "Paciente no encontrado" });

  const autorizado = req.user.roles.some((r) => [ROLES.ADMIN, ROLES.RECEPCION].includes(r));
  const egresoClinico = await egresoClinicoPara(paciente, autorizado);

  const { egresoClinico: _fila, ...camposRestantes } = paciente;
  res.json({ ...camposRestantes, ...(egresoClinico !== undefined ? { egresoClinico } : {}) });
}

// RF-01/RF-03/RF-04: registrar paciente nuevo, generar historia clinica
// y evitar duplicados por DPI. Un DPI duplicado responde 409 sin crear
// datos parciales y sin exponer los datos del paciente existente.
//
// Dev-Mari: admite un PDF opcional (campo "documento", multipart/form-data)
// con el expediente fisico escaneado. Los datos del paciente pueden venir
// tecleados a mano o autorellenados por OCR a partir de ese mismo escaneo;
// en ambos casos es este unico endpoint el que registra todo junto, para
// nunca dejar un documento guardado sin su paciente o viceversa.
export async function crear(req, res) {
  const errorValidacion = validarPaciente(req.body);
  if (errorValidacion) return res.status(400).json({ error: errorValidacion });

  const { dpi } = req.body;
  const existente = await prisma.paciente.findUnique({ where: { dpi }, select: { id: true, historiaClinica: true } });
  if (existente) {
    return res.status(409).json({
      error: "Ya existe un paciente con este DPI",
      paciente: { id: existente.id, historiaClinica: existente.historiaClinica },
    });
  }

  const payloadEgreso = tomarEgresoClinico(req.body);
  const errorEgreso = validarEgresoClinico(payloadEgreso, req.body.condicionEgreso);
  if (errorEgreso) return res.status(422).json({ error: errorEgreso });

  // Dev-Mari: la hoja fisica ya trae una "Historia Clinica" escrita a mano.
  // Si se captura (al escanear un expediente existente), se respeta ese
  // numero tal cual; solo si viene vacia el sistema genera una (RF-03).
  const historiaManual = typeof req.body.historiaClinica === "string" ? req.body.historiaClinica.trim() : "";
  if (historiaManual) {
    if (historiaManual.length > 40) {
      return res.status(400).json({ error: "La historia clínica no puede exceder 40 caracteres" });
    }
    const repetida = await prisma.paciente.findUnique({ where: { historiaClinica: historiaManual }, select: { id: true, nombreCompleto: true } });
    if (repetida) {
      return res.status(409).json({ error: `La historia clínica "${historiaManual}" ya está asignada a otro paciente (${repetida.nombreCompleto})` });
    }
  }

  // El PDF se valida antes de tocar la base de datos: si no es un PDF
  // valido, no tiene sentido crear el paciente sin su respaldo escaneado.
  if (req.file) {
    const errorPdf = validarPdf(req.file);
    if (errorPdf) return res.status(422).json({ error: errorPdf });
  }

  const paciente = await prisma.$transaction(async (tx) => {
    const creado = await tx.paciente.create({
      data: { ...tomarCampos(req.body), historiaClinica: historiaManual || `PENDIENTE-${Date.now()}` },
      select: SELECT_LISTADO,
    });
    const conHistoria = historiaManual
      ? creado
      : await tx.paciente.update({
          where: { id: creado.id },
          data: { historiaClinica: generarHistoriaClinica(creado.id) },
          select: SELECT_LISTADO,
        });
    if (payloadEgreso && Object.keys(payloadEgreso).length) {
      const { encrypted, iv, authTag } = encrypt(JSON.stringify(payloadEgreso), ENCRYPTION_KEY);
      await tx.egresoClinico.create({ data: { pacienteId: creado.id, textoCifrado: encrypted, iv, authTag } });
    }
    if (req.file) {
      const checksum = crypto.createHash("sha256").update(req.file.buffer).digest("hex");
      const nombreArchivo = guardarArchivoCifrado(req.file.buffer, DOCUMENTOS_DIR, ENCRYPTION_KEY);
      const nombreOriginal = path
        .basename(req.body.nombreDocumento || req.file.originalname || "expediente.pdf")
        .replace(/[^\w.\-() ]/g, "_");
      await tx.documentoPaciente.create({
        data: {
          pacienteId: creado.id,
          nombreOriginal,
          nombreArchivo,
          mimeType: "application/pdf",
          tamano: req.file.size,
          checksum,
          paginas: Number(req.body.paginas) || 1,
          tipoDocumental: "expediente_admision",
          fechaDocumentoOriginal: req.body.fechaDocumentoOriginal ? new Date(req.body.fechaDocumentoOriginal) : null,
          registradoPor: req.user.id,
        },
      });
    }
    return conHistoria;
  });

  await registrarActividad(
    req.user.id,
    "crear_paciente",
    `${paciente.nombreCompleto} (${paciente.historiaClinica})${req.file ? " + expediente escaneado" : ""}`
  );
  res.status(201).json(paciente);
}

// RF-05 a RF-09: actualizar datos administrativos, egreso clinico cifrado y
// maternidad dentro de una sola transaccion (edicion atomica).
export async function actualizar(req, res) {
  const id = Number(req.params.id);

  const errorValidacion = validarPaciente(req.body, { esEdicion: true }) || validarMaternidad(req.body.maternidad);
  if (errorValidacion) return res.status(400).json({ error: errorValidacion });

  // Dev-Mari: corregir la historia clinica (p. ej. un numero mal copiado del
  // papel). Es un identificador: unico y nunca vacio.
  const datosPaciente = tomarCampos(req.body);
  if (typeof req.body.historiaClinica === "string" && req.body.historiaClinica.trim()) {
    const historia = req.body.historiaClinica.trim();
    if (historia.length > 40) return res.status(400).json({ error: "La historia clínica no puede exceder 40 caracteres" });
    const otra = await prisma.paciente.findUnique({ where: { historiaClinica: historia }, select: { id: true, nombreCompleto: true } });
    if (otra && otra.id !== id) {
      return res.status(409).json({ error: `La historia clínica "${historia}" ya está asignada a otro paciente (${otra.nombreCompleto})` });
    }
    datosPaciente.historiaClinica = historia;
  }

  try {
    const paciente = await prisma.$transaction(async (tx) => {
      const actual = await tx.paciente.update({ where: { id }, data: datosPaciente, select: SELECT_LISTADO });

      const payloadEgreso = tomarEgresoClinico(req.body);
      if (payloadEgreso !== null || req.body.egresoClinico === null) {
        // condicion efectiva: la que viene en el body o la que ya tenia
        const condicionEfectiva = req.body.condicionEgreso !== undefined ? req.body.condicionEgreso : actual.condicionEgreso;
        const errorEgreso = validarEgresoClinico(payloadEgreso, condicionEfectiva);
        if (errorEgreso) throw Object.assign(new Error(errorEgreso), { status: 422 });

        if (payloadEgreso && Object.keys(payloadEgreso).length) {
          const { encrypted, iv, authTag } = encrypt(JSON.stringify(payloadEgreso), ENCRYPTION_KEY);
          await tx.egresoClinico.upsert({
            where: { pacienteId: id },
            create: { pacienteId: id, textoCifrado: encrypted, iv, authTag },
            update: { textoCifrado: encrypted, iv, authTag },
          });
        } else {
          // egreso clinico vacio: se elimina la fila cifrada
          await tx.egresoClinico.deleteMany({ where: { pacienteId: id } });
        }
      }

      if (req.body.maternidad) {
        const m = req.body.maternidad;
        const datosMaternidad = {
          numeroHijo: m.numeroHijo,
          fecha: m.fecha ? new Date(m.fecha) : undefined,
          hora: m.hora,
          sexo: m.sexo,
          condicionEgresoBebe: m.condicionEgresoBebe,
          bebeNombre: m.bebeNombre,
          padreNombre: m.padreNombre,
          padreDpi: m.padreDpi,
          padreTelefono: m.padreTelefono,
        };
        await tx.registroMaternidad.upsert({
          where: { pacienteId: id },
          create: { pacienteId: id, ...datosMaternidad },
          update: datosMaternidad,
        });
      }

      return actual;
    });

    await registrarActividad(req.user.id, "actualizar_paciente", `${paciente.nombreCompleto} (${paciente.historiaClinica})`);
    res.json(paciente);
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Paciente no encontrado" });
    if (err.code === "P2002") return res.status(409).json({ error: "Ya existe un paciente con este DPI" });
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  }
}
