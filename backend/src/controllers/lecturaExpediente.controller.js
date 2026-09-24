// Controlador: lectura avanzada (modelo de vision) de la ficha escaneada.
// Opcional — ver services/lecturaVision.service.js (privacidad y activacion).
import multer from "multer";
import { registrarActividad } from "../services/actividad.service.js";
import {
  extraerDatosConVision,
  lecturaAvanzadaDisponible,
  modeloConfigurado,
  LecturaVisionError,
} from "../services/lecturaVision.service.js";

// La imagen llega en memoria y nunca toca el disco.
export const uploadImagen = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
}).single("imagen");

// El Content-Type que manda el cliente no es confiable: se detecta el tipo
// real por los primeros bytes del archivo.
export function tipoRealDeImagen(buffer) {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.subarray(0, 4).toString("latin1") === "RIFF" && buffer.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

// GET /api/pacientes/lectura-avanzada/estado — para que la pantalla sepa si
// ofrecer esta lectura o ir directo al OCR local.
export function estado(req, res) {
  const disponible = lecturaAvanzadaDisponible();
  res.json({ disponible, modelo: disponible ? modeloConfigurado() : null });
}

// POST /api/pacientes/leer-expediente (multipart, campo "imagen")
export async function leer(req, res) {
  if (!lecturaAvanzadaDisponible()) {
    return res.status(501).json({ disponible: false, error: "La lectura avanzada no está configurada en el servidor" });
  }
  if (!req.file) return res.status(400).json({ error: "Adjunte la imagen del expediente (campo \"imagen\")" });

  const tipo = tipoRealDeImagen(req.file.buffer);
  if (!tipo) return res.status(422).json({ error: "El archivo no es una imagen JPEG, PNG o WebP válida" });

  try {
    const campos = await extraerDatosConVision(req.file.buffer, tipo);
    // Sin contenido clinico en la bitacora: solo que se uso la funcion.
    await registrarActividad(req.user.id, "leer_expediente_ia", "Lectura avanzada de un expediente escaneado");
    res.json({ campos, modelo: modeloConfigurado() });
  } catch (err) {
    if (err instanceof LecturaVisionError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
}
