// Lectura avanzada de la Ficha General del Paciente con un modelo de vision
// (Claude). Es OPCIONAL y esta APAGADA por defecto: solo funciona si se
// define ANTHROPIC_API_KEY en backend/.env.
//
// Por que existe: el OCR local (Tesseract) lee bien lo impreso pero casi
// nada de la letra manuscrita a lapiz que trae el expediente real. Un modelo
// de vision si la lee.
//
// PRIVACIDAD — leer antes de activarlo: al usarlo, la imagen de la primera
// pagina del expediente escaneado se ENVIA a la API de Anthropic (un servicio
// externo). Es informacion clinica: activarlo es una decision del hospital.
// La imagen y los datos leidos solo viven en memoria durante la peticion:
// no se guardan ni se escriben en logs.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

// Telefono impreso en el membrete de la hoja: nunca es el del paciente.
const TELEFONO_HOSPITAL = "79529724";

const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Todos los campos admiten null: si algo no se lee con seguridad, null
// (mejor vacio que inventado — el personal lo completa a mano).
const EsquemaFicha = z.object({
  nombreCompleto: z.string().nullable(),
  direccion: z.string().nullable(),
  dpi: z.string().nullable(),
  telefono: z.string().nullable(),
  historiaClinica: z.string().nullable(),
  fechaNacimiento: z.string().nullable(),
  fechaIngreso: z.string().nullable(),
});

const SISTEMA = `Eres un asistente que transcribe datos de la "Ficha General del Paciente / Hoja de Ingreso y Egreso" del Hospital Verapaz (Guatemala), a partir de una foto o escaneo. Las etiquetas estan impresas; lo que llena el personal esta escrito a mano (a menudo a lapiz, tenue).

Devuelve SOLO los datos del PACIENTE, tal como estan escritos en el papel:
- nombreCompleto: valor de "Nombre Completo" (no el del conyuge, padre o madre).
- direccion: valor de la primera "Direccion" de la ficha (la del paciente; no la del conyuge ni la del contacto de emergencia).
- dpi: valor de "DPI" (13 digitos).
- telefono: valor del primer "Telefono" que esta dentro de la tabla de datos del paciente (8 digitos).
- historiaClinica: valor manuscrito junto a "Historia Clinica", tal cual (por ejemplo "HC-001").
- fechaNacimiento: valor de "Fecha de Nacimiento", en formato AAAA-MM-DD.
- fechaIngreso: valor manuscrito de "FECHA DE INGRESO" del encabezado, en formato AAAA-MM-DD.

Reglas estrictas:
- Ignora por completo el membrete impreso del hospital: su direccion (8a. Calle 8-30 zona 10, Coban) y su telefono (7952-9724) NO son datos del paciente.
- Ignora el texto tenue de otra hoja que se transparenta por el reverso del papel.
- Si un dato esta en blanco, ilegible o no estas seguro, devuelve null. Nunca adivines ni completes datos que no se ven.
- Las fechas de la hoja vienen como dia/mes/ano (formato guatemalteco): 01/03/2000 es el 1 de marzo de 2000 -> 2000-03-01.`;

let clienteCompartido = null;
function obtenerCliente() {
  if (!clienteCompartido) clienteCompartido = new Anthropic(); // toma ANTHROPIC_API_KEY del entorno
  return clienteCompartido;
}

export function lecturaAvanzadaDisponible() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function modeloConfigurado() {
  return process.env.ANTHROPIC_MODEL || "claude-opus-5";
}

// ---- normalizacion de lo que devuelve el modelo (defensa en profundidad:
// aunque el esquema garantiza la forma, el contenido puede ser incorrecto) ----

function textoLimpio(valor, max = 200) {
  if (typeof valor !== "string") return null;
  const t = valor.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
}

function soloDigitos(valor, largo) {
  if (typeof valor !== "string") return null;
  const d = valor.replace(/\D/g, "");
  return d.length === largo ? d : null;
}

function fechaIso(valor) {
  if (typeof valor !== "string") return null;
  const m = valor.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  if (anio < 1900 || anio > new Date().getFullYear() + 1) return null;
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  if (d.getUTCMonth() !== mes - 1) return null; // p. ej. 31 de febrero
  return valor.trim();
}

export function normalizarCampos(crudo) {
  const telefono = soloDigitos(crudo?.telefono, 8);
  return {
    nombreCompleto: textoLimpio(crudo?.nombreCompleto, 120),
    direccion: textoLimpio(crudo?.direccion, 200),
    dpi: soloDigitos(crudo?.dpi, 13),
    telefono: telefono === TELEFONO_HOSPITAL ? null : telefono,
    historiaClinica: textoLimpio(crudo?.historiaClinica, 40),
    fechaNacimiento: fechaIso(crudo?.fechaNacimiento),
    fechaIngreso: fechaIso(crudo?.fechaIngreso),
  };
}

// Lanzada cuando la lectura avanzada no esta disponible o fallo de forma
// esperable; el controlador la traduce a un codigo HTTP y el frontend
// recurre al OCR local.
export class LecturaVisionError extends Error {
  constructor(mensaje, status = 502) {
    super(mensaje);
    this.status = status;
  }
}

// `cliente` es inyectable para pruebas; en produccion se usa el del entorno.
export async function extraerDatosConVision(buffer, mediaType, { cliente } = {}) {
  if (!TIPOS_IMAGEN.includes(mediaType)) {
    throw new LecturaVisionError(`Tipo de imagen no soportado: ${mediaType}`, 422);
  }
  if (!cliente && !lecturaAvanzadaDisponible()) {
    throw new LecturaVisionError("La lectura avanzada no está configurada en el servidor", 501);
  }
  const api = cliente || obtenerCliente();

  let respuesta;
  try {
    respuesta = await api.messages.parse({
      model: modeloConfigurado(),
      max_tokens: 2000,
      system: SISTEMA,
      // effort bajo: es una transcripcion de 7 campos, no razonamiento profundo
      output_config: { effort: "low", format: zodOutputFormat(EsquemaFicha) },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: buffer.toString("base64") } },
            { type: "text", text: "Transcribe los datos del paciente de esta ficha." },
          ],
        },
      ],
    });
  } catch (err) {
    // Orden de lo mas especifico a lo mas general (clases tipadas del SDK)
    if (err instanceof Anthropic.AuthenticationError) {
      throw new LecturaVisionError("La clave de la API de Anthropic configurada en el servidor no es válida", 502);
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new LecturaVisionError("Límite de uso de la API alcanzado; intente de nuevo en un momento", 429);
    }
    if (err instanceof Anthropic.BadRequestError) {
      throw new LecturaVisionError("La API rechazó la solicitud (revise el modelo configurado y la imagen)", 502);
    }
    if (err instanceof Anthropic.APIConnectionError) {
      throw new LecturaVisionError("No se pudo conectar con la API de Anthropic", 502);
    }
    if (err instanceof Anthropic.APIError) {
      throw new LecturaVisionError(`Error de la API de Anthropic (${err.status})`, 502);
    }
    throw err;
  }

  if (respuesta.stop_reason === "refusal") {
    throw new LecturaVisionError("El modelo declinó leer este documento", 422);
  }
  if (!respuesta.parsed_output) {
    throw new LecturaVisionError("El modelo no devolvió datos en el formato esperado", 502);
  }
  return normalizarCampos(respuesta.parsed_output);
}
