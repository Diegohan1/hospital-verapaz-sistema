// Controlador: Registro y Admision (Modulo 1)
// Sprint 3: los datos clinicos de egreso (diagnostico, complicaciones,
// operaciones, autopsia, causa de muerte) se guardan cifrados en la entidad
// EgresoClinico, separados de los datos administrativos del Paciente. Los
// listados nunca exponen esos campos (DTO con select explicito).
import path from "node:path";
import fs from "node:fs";
import crypto from "crypto";
import { prisma } from "../config/prisma.js";
import { encrypt, decrypt } from "../utils/crypto.util.js";
import { ENCRYPTION_KEY } from "../config/env.js";
import { registrarActividad } from "../services/actividad.service.js";
import { leerPaginacion } from "../utils/paginacion.util.js";
import { ROLES } from "../utils/roles.util.js";
import { validarPdf, guardarArchivoCifrado, validarArchivo } from "../utils/archivos.util.js";

const DOCUMENTOS_DIR = path.join(process.cwd(), "uploads", "documentos");
const DIAGNOSTICOS_DIR = path.join(process.cwd(), "uploads", "diagnosticos");
const DOCUMENT_MAX_MB = Number(process.env.DOCUMENT_MAX_MB || 20);

// Campos administrativos, de ingreso y de egreso administrativo (no
// sensibles). Los campos clinicos de egreso NO van aqui: viajan cifrados en
// EgresoClinico.
const CAMPOS_PACIENTE = [
  "nombreCompleto", "dpi", "direccion", "lugarNacimiento", "fechaNacimiento",
  "telefono", "edad", "sexo", "tipoSangre", "estadoCivil", "ocupacion", "religion", "nacionalidad",
  "nombreConyuge", "direccionConyuge", "telefonoConyuge", "nombrePadre", "nombreMadre",
  "contactoEmergencia", "direccionEmergencia", "telefonoEmergencia", "parentesco",
  "otrasHospitalizaciones", "referidoPor",
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
  nombreConyuge: true, direccionConyuge: true, telefonoConyuge: true, nombrePadre: true, nombreMadre: true,
  contactoEmergencia: true, direccionEmergencia: true, telefonoEmergencia: true, parentesco: true,
  otrasHospitalizaciones: true, referidoPor: true,
  encargadoNombre: true, encargadoTelefono: true,
  referidoDe: true, medicoReferenteId: true, serviciosSolicitados: true,
  impresionClinicaIngreso: true, fechaIngreso: true, fechaEgreso: true, condicionEgreso: true,
  creadoEn: true,
};

// Campos clinicos de egreso que viajan en el payload cifrado
const CAMPOS_EGRESO_CLINICO = [
  "diagnosticoEgreso", "complicaciones", "operaciones", "autopsia", "causaMuerte",
  "diagnosticosEgreso", "complicacionesEgreso", "operacionesLista",
];

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
    const requeridos = [
      ["fechaIngreso", "fecha de ingreso"], ["historiaClinica", "historia clínica"],
      ["nombreCompleto", "nombre completo"], ["direccion", "dirección"], ["telefono", "teléfono"],
      ["lugarNacimiento", "lugar de nacimiento"], ["fechaNacimiento", "fecha de nacimiento"],
      ["edad", "edad"], ["sexo", "sexo"], ["estadoCivil", "estado civil"],
      ["ocupacion", "ocupación"], ["religion", "religión"], ["nacionalidad", "nacionalidad"], ["dpi", "DPI"],
    ];
    for (const [campo, etiqueta] of requeridos) {
      if (body[campo] == null || String(body[campo]).trim() === "") return `${etiqueta} es requerido`;
    }
    if (!/^\d{1,40}$/.test(String(body.historiaClinica).trim())) return "La historia clínica debe contener solo números (máximo 40)";
    if (!/^\d{13}$/.test(String(body.dpi).trim())) return "El DPI debe contener 13 dígitos";
    if (!Number.isInteger(Number(body.edad)) || Number(body.edad) < 0 || Number(body.edad) > 130) return "La edad debe ser un número entero entre 0 y 130 años";
    if (!["S", "C", "U", "D", "V"].includes(body.estadoCivil)) return "Seleccione un código válido para el estado civil";
    if (typeof body.fechaIngreso !== "string" || !/T\d{2}:\d{2}/.test(body.fechaIngreso)) return "La hora de ingreso es requerida";
    for (const campo of ["fechaIngreso", "fechaNacimiento"]) {
      if (!Number.isFinite(new Date(body[campo]).getTime())) return `La ${campo === "fechaIngreso" ? "fecha de ingreso" : "fecha de nacimiento"} no es válida`;
    }
  }
  if (body.dpi != null && body.dpi !== "" && !/^\d{13}$/.test(String(body.dpi).trim())) {
    return "El DPI debe tener 13 dígitos";
  }
  const telefonos = [
    ["telefono", "El teléfono"], ["telefonoConyuge", "El teléfono del cónyuge"],
    ["telefonoEmergencia", "El teléfono de emergencia"], ["encargadoTelefono", "El teléfono del encargado"],
  ];
  for (const [campo, etiqueta] of telefonos) {
    if (body[campo] != null && body[campo] !== "" && !/^\d{8}$/.test(String(body[campo]).trim())) {
      return `${etiqueta} debe tener 8 dígitos`;
    }
  }
  if (body.edad != null && body.edad !== "" && (!Number.isInteger(Number(body.edad)) || Number(body.edad) < 0 || Number(body.edad) > 130)) {
    return "La edad debe ser un entero entre 0 y 130 años";
  }
  return null;
}

// Datos del nacimiento: el DPI y telefono del padre son opcionales, pero si
// vienen deben tener formato valido (el recien nacido puede no tener DPI/CUI).
export function validarMaternidad(m) {
  if (!m) return null;
  if (m.numeroHijo != null && m.numeroHijo !== "" && (!Number.isInteger(Number(m.numeroHijo)) || Number(m.numeroHijo) < 1)) {
    return "El número de hijo debe ser un entero mayor que cero";
  }
  if (m.fecha && !Number.isFinite(new Date(m.fecha).getTime())) return "La fecha de nacimiento del bebé no es válida";
  if (m.padreDpi != null && m.padreDpi !== "" && !/^\d{13}$/.test(String(m.padreDpi).trim())) {
    return "El DPI del padre debe tener 13 dígitos";
  }
  if (m.padreTelefono != null && m.padreTelefono !== "" && !/^\d{8}$/.test(String(m.padreTelefono).trim())) {
    return "El teléfono del padre debe tener 8 dígitos";
  }
  if (m.hora != null && m.hora !== "" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(m.hora))) {
    return "La hora de nacimiento debe tener formato HH:MM";
  }
  if (m.autopsiaBebe === true && (!String(m.causaMuerteBebe || "").trim() || !m.fechaMuerteBebe)) {
    return "Si se realizó autopsia al bebé, indique la causa y la fecha de muerte";
  }
  if (m.fechaMuerteBebe && !Number.isFinite(new Date(m.fechaMuerteBebe).getTime())) {
    return "La fecha de muerte del bebé no es válida";
  }
  return null;
}

function tomarCamposMaternidad(m) {
  return {
    numeroHijo: m.numeroHijo == null || m.numeroHijo === "" ? null : Number(m.numeroHijo),
    fecha: m.fecha ? new Date(m.fecha) : m.fecha === null ? null : undefined,
    hora: m.hora,
    sexo: m.sexo,
    condicionEgresoBebe: m.condicionEgresoBebe,
    autopsiaBebe: m.autopsiaBebe,
    causaMuerteBebe: m.causaMuerteBebe,
    fechaMuerteBebe: m.fechaMuerteBebe ? new Date(m.fechaMuerteBebe) : m.fechaMuerteBebe === null ? null : undefined,
    bebeNombre: m.bebeNombre,
    padreNombre: m.padreNombre,
    padreDpi: m.padreDpi,
    padreTelefono: m.padreTelefono,
  };
}

export function normalizarObjetosMultipart(body) {
  for (const campo of ["egresoClinico", "maternidad"]) {
    if (typeof body[campo] !== "string") continue;
    try {
      const valor = JSON.parse(body[campo]);
      if (!valor || typeof valor !== "object" || Array.isArray(valor)) throw new Error();
      body[campo] = valor;
    } catch {
      return `El campo ${campo} no contiene un objeto JSON válido`;
    }
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
  for (const campo of ["diagnosticosEgreso", "complicacionesEgreso"]) {
    if (payload[campo] !== undefined && (!Array.isArray(payload[campo]) || payload[campo].some((item) => !item || typeof item.descripcion !== "string" || typeof item.codigo !== "string"))) {
      return `La lista ${campo} debe contener descripciones y códigos de texto`;
    }
  }
  if (payload.operacionesLista !== undefined && (!Array.isArray(payload.operacionesLista) || payload.operacionesLista.some((item) => typeof item !== "string"))) {
    return "La lista de operaciones debe contener texto";
  }
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
    include: { maternidad: true, medicoReferente: true, egresoClinico: true, ingresos: { orderBy: { fechaIngreso: "desc" } } },
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
  const errorJson = normalizarObjetosMultipart(req.body);
  if (errorJson) return res.status(400).json({ error: errorJson });
  const errorValidacion = validarPaciente(req.body) || validarMaternidad(req.body.maternidad);
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

  // La historia clínica ahora es obligatoria y se captura numéricamente.
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
  const documento = req.files?.documento?.[0] || null;
  const adjuntos = req.files?.adjuntos || [];
  if (documento) {
    const errorPdf = validarPdf(documento);
    if (errorPdf) return res.status(422).json({ error: errorPdf });
  }
  for (const archivo of adjuntos) {
    const errorAdjunto = validarArchivo(archivo);
    if (errorAdjunto) return res.status(422).json({ error: `Adjunto "${archivo.originalname}": ${errorAdjunto}` });
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
    if (documento) {
      const checksum = crypto.createHash("sha256").update(documento.buffer).digest("hex");
      const nombreArchivo = guardarArchivoCifrado(documento.buffer, DOCUMENTOS_DIR, ENCRYPTION_KEY);
      const nombreOriginal = path
        .basename(req.body.nombreDocumento || documento.originalname || "expediente.pdf")
        .replace(/[^\w.\-() ]/g, "_");
      await tx.documentoPaciente.create({
        data: {
          pacienteId: creado.id,
          nombreOriginal,
          nombreArchivo,
          mimeType: "application/pdf",
          tamano: documento.size,
          checksum,
          paginas: Number(req.body.paginas) || 1,
          tipoDocumental: "expediente_admision",
          fechaDocumentoOriginal: req.body.fechaDocumentoOriginal ? new Date(req.body.fechaDocumentoOriginal) : null,
          registradoPor: req.user.id,
        },
      });
    }
    for (const archivo of adjuntos) {
      const checksum = crypto.createHash("sha256").update(archivo.buffer).digest("hex");
      const nombreArchivo = guardarArchivoCifrado(archivo.buffer, DOCUMENTOS_DIR, ENCRYPTION_KEY);
      const nombreOriginal = path.basename(archivo.originalname || "resultado_clinico").replace(/[^\w.\-() ]/g, "_");
      await tx.documentoPaciente.create({
        data: {
          pacienteId: creado.id,
          nombreOriginal,
          nombreArchivo,
          mimeType: archivo.mimetype,
          tamano: archivo.size,
          checksum,
          paginas: 1,
          tipoDocumental: "resultado_clinico",
          registradoPor: req.user.id,
        },
      });
    }
    if (req.body.maternidad) {
      await tx.registroMaternidad.create({
        data: { pacienteId: creado.id, ...tomarCamposMaternidad(req.body.maternidad) },
      });
    }
    // El primer registro del paciente es tambien su primer ingreso: se crea
    // la fila de Ingreso para que el historial de admisiones quede completo.
    const fechaPrimerIngreso = req.body.fechaIngreso ? new Date(req.body.fechaIngreso) : null;
    if (fechaPrimerIngreso && Number.isFinite(fechaPrimerIngreso.getTime())) {
      await tx.ingreso.create({
        data: {
          pacienteId: creado.id,
          fechaIngreso: fechaPrimerIngreso,
          impresionClinicaIngreso: req.body.impresionClinicaIngreso || null,
          serviciosSolicitados: req.body.serviciosSolicitados || null,
          referidoDe: req.body.referidoDe || null,
          referidoPor: req.body.referidoPor || null,
        },
      });
    }
    return conHistoria;
  });

  await registrarActividad(
    req.user.id,
    "crear_paciente",
    `${paciente.nombreCompleto} (${paciente.historiaClinica})${documento ? " + expediente escaneado" : ""}`
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
        const datosMaternidad = tomarCamposMaternidad(req.body.maternidad);
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

// Admisiones de un paciente: una identidad (nombre, DPI, demograficos) puede
// volver a ingresar varias veces. Cada ingreso tiene su propia fecha/hora e
// impresion clinica de admision, y agrupa los diagnosticos de esa admision.
export function validarIngreso(body) {
  if (!body.fechaIngreso || !Number.isFinite(new Date(body.fechaIngreso).getTime())) {
    return "La fecha de ingreso es requerida y debe ser válida";
  }
  return null;
}

export async function listarIngresos(req, res) {
  const pacienteId = Number(req.params.id);
  const paciente = await prisma.paciente.findUnique({ where: { id: pacienteId }, select: { id: true } });
  if (!paciente) return res.status(404).json({ error: "Paciente no encontrado" });
  const ingresos = await prisma.ingreso.findMany({ where: { pacienteId }, orderBy: { fechaIngreso: "desc" } });
  res.json(ingresos);
}

export async function crearIngreso(req, res) {
  const pacienteId = Number(req.params.id);
  const paciente = await prisma.paciente.findUnique({
    where: { id: pacienteId },
    select: { id: true, nombreCompleto: true, historiaClinica: true },
  });
  if (!paciente) return res.status(404).json({ error: "Paciente no encontrado" });

  const errorValidacion = validarIngreso(req.body);
  if (errorValidacion) return res.status(400).json({ error: errorValidacion });

  const ingreso = await prisma.ingreso.create({
    data: {
      pacienteId,
      fechaIngreso: new Date(req.body.fechaIngreso),
      impresionClinicaIngreso: req.body.impresionClinicaIngreso || null,
      serviciosSolicitados: req.body.serviciosSolicitados || null,
      referidoDe: req.body.referidoDe || null,
      referidoPor: req.body.referidoPor || null,
    },
  });
  await registrarActividad(req.user.id, "crear_ingreso", `${paciente.nombreCompleto} (${paciente.historiaClinica})`);
  res.status(201).json(ingreso);
}

// Elimina por completo un paciente y todo su expediente. Es una accion
// destructiva e irreversible: borra en una sola transaccion las admisiones,
// los diagnosticos cifrados, sus archivos adjuntos, los documentos, los
// tratamientos, las recetas, las facturas y los accesos de auditoria; los
// archivos en disco se eliminan despues (best-effort). Solo Recepcion y
// Administracion. La bitacora de actividad del propio sistema se conserva.
export async function eliminar(req, res) {
  const id = Number(req.params.id);
  const paciente = await prisma.paciente.findUnique({
    where: { id },
    select: { id: true, nombreCompleto: true, historiaClinica: true },
  });
  if (!paciente) return res.status(404).json({ error: "Paciente no encontrado" });

  // Los nombres de archivo en disco se recuperan antes de borrar las filas,
  // para poder limpiar los uploads una vez confirmada la transaccion.
  const [documentos, adjuntos] = await Promise.all([
    prisma.documentoPaciente.findMany({ where: { pacienteId: id }, select: { nombreArchivo: true } }),
    prisma.diagnosticoArchivo.findMany({ where: { pacienteId: id }, select: { nombreArchivo: true } }),
  ]);

  await prisma.$transaction([
    prisma.accesoDiagnostico.deleteMany({ where: { pacienteId: id } }),
    prisma.tratamientoItem.deleteMany({ where: { pacienteId: id } }),
    prisma.receta.deleteMany({ where: { pacienteId: id } }),
    prisma.diagnostico.deleteMany({ where: { pacienteId: id } }),
    prisma.diagnosticoArchivo.deleteMany({ where: { pacienteId: id } }),
    prisma.documentoPaciente.deleteMany({ where: { pacienteId: id } }),
    prisma.egresoClinico.deleteMany({ where: { pacienteId: id } }),
    prisma.registroMaternidad.deleteMany({ where: { pacienteId: id } }),
    prisma.ingreso.deleteMany({ where: { pacienteId: id } }),
    prisma.bitacoraVisita.deleteMany({ where: { pacienteId: id } }),
    prisma.facturaHospital.deleteMany({ where: { pacienteId: id } }),
    prisma.facturaFarmacia.updateMany({ where: { pacienteId: id }, data: { pacienteId: null } }),
    prisma.tokenTemporal.deleteMany({ where: { pacienteId: id } }),
    prisma.paciente.delete({ where: { id } }),
  ]);

  for (const doc of documentos) {
    try { fs.unlinkSync(path.join(DOCUMENTOS_DIR, doc.nombreArchivo)); } catch { /* archivo ya no existe */ }
  }
  for (const adj of adjuntos) {
    try { fs.unlinkSync(path.join(DIAGNOSTICOS_DIR, adj.nombreArchivo)); } catch { /* archivo ya no existe */ }
  }

  await registrarActividad(req.user.id, "eliminar_paciente", `${paciente.nombreCompleto} (${paciente.historiaClinica})`);
  res.json({ ok: true });
}
