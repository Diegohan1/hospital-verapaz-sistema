// Controlador: vinculacion por QR para escanear con la camara del telefono
// cuando la computadora no tiene camara (Dev-Mari).
//
// La sesion es un intercambio efimero: la PC (autenticada) crea una sesion
// de un solo uso, el telefono (SIN login, autorizado solo por conocer el id
// aleatorio de la sesion — como un enlace de un solo uso) sube el PDF que
// genero con su propia camara, y la PC lo recoge y lo entrega al flujo
// normal de registro de paciente. No se persiste en base de datos ni en
// disco: vive en memoria y expira sola a los 10 minutos.
import crypto from "crypto";

const TTL_MS = 10 * 60 * 1000;
const sesiones = new Map(); // id -> { creadoPor, expiraEn, estado, pdfBuffer, paginas, nombreOriginal }

function limpiarExpiradas() {
  const ahora = Date.now();
  for (const [id, s] of sesiones) {
    if (ahora > s.expiraEn) sesiones.delete(id);
  }
}

// --- Lado computadora (autenticado) ---

export function crear(req, res) {
  limpiarExpiradas();
  const id = crypto.randomUUID();
  sesiones.set(id, {
    creadoPor: req.user.id,
    expiraEn: Date.now() + TTL_MS,
    estado: "esperando",
    pdfBuffer: null,
    paginas: 0,
    nombreOriginal: null,
  });
  res.status(201).json({ id, expiraMinutos: TTL_MS / 60000 });
}

// null = no existe/expiro, undefined = existe pero es de otro usuario
function obtenerPropia(req) {
  const s = sesiones.get(req.params.id);
  if (!s || Date.now() > s.expiraEn) return null;
  if (s.creadoPor !== req.user.id) return undefined;
  return s;
}

export function estado(req, res) {
  const s = obtenerPropia(req);
  if (s === null) return res.status(404).json({ error: "Sesión no encontrada o expirada" });
  if (s === undefined) return res.status(403).json({ error: "No tiene acceso a esta sesión" });
  res.json({ estado: s.estado, paginas: s.paginas, nombreOriginal: s.nombreOriginal });
}

// Entrega el PDF una sola vez: al servirlo se borra la sesion, para que no
// quede el binario en memoria mas tiempo del necesario.
export function obtenerPdf(req, res) {
  const s = obtenerPropia(req);
  if (s === null) return res.status(404).json({ error: "Sesión no encontrada o expirada" });
  if (s === undefined) return res.status(403).json({ error: "No tiene acceso a esta sesión" });
  if (s.estado !== "listo" || !s.pdfBuffer) return res.status(409).json({ error: "Todavía no se ha recibido el documento" });
  res.setHeader("Content-Type", "application/pdf");
  res.send(s.pdfBuffer);
  sesiones.delete(req.params.id);
}

export function cancelar(req, res) {
  const s = obtenerPropia(req);
  if (s === undefined) return res.status(403).json({ error: "No tiene acceso a esta sesión" });
  sesiones.delete(req.params.id);
  res.json({ ok: true });
}

// --- Lado telefono (publico, sin login) ---

export function info(req, res) {
  limpiarExpiradas();
  const s = sesiones.get(req.params.id);
  res.json({ valido: !!s, estado: s?.estado });
}

export function subirPdf(req, res) {
  const s = sesiones.get(req.params.id);
  if (!s || Date.now() > s.expiraEn) return res.status(404).json({ error: "Sesión no encontrada o expirada" });
  if (s.estado === "listo") return res.status(409).json({ error: "Esta sesión ya recibió un documento" });

  const file = req.file;
  if (!file) return res.status(400).json({ error: "Adjunte el PDF generado" });
  const magic = file.buffer.subarray(0, 5).toString("latin1");
  if (magic !== "%PDF-") return res.status(422).json({ error: "El archivo no es un PDF válido" });

  s.pdfBuffer = file.buffer;
  s.paginas = Number(req.body.paginas) || 1;
  s.nombreOriginal = req.body.nombre || "documento.pdf";
  s.estado = "listo";
  res.json({ ok: true });
}
