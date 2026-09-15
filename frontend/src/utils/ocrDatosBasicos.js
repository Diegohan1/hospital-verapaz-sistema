// Dev-Mari: lectura automatica de datos basicos (nombre, DPI, telefono,
// fecha) desde el expediente fisico escaneado en "Paciente nuevo".
//
// Alcance deliberadamente chico: el doctor llena el documento a mano, y el
// reconocimiento de letra manuscrita es poco confiable (mucho mas que texto
// impreso). Por eso solo se intentan campos con un patron reconocible
// (digitos: DPI, telefono, fecha); el nombre se intenta con una heuristica
// simple y puede fallar seguido. En todos los casos el resultado es un
// punto de partida editable — nunca se guarda sin que el personal lo revise.
import { createWorker } from "tesseract.js";

const PATRON_DPI = /\b(\d{4}\s?\d{5}\s?\d{4})\b/;
const PATRON_FECHA = /\b(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\b/;
const PATRON_TELEFONO = /\b(\d{4}\s?\d{4})\b/;

function normalizarFecha(bruto) {
  const m = bruto?.match(PATRON_FECHA);
  if (!m) return null;
  let [, d, mo, y] = m[1].match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/) || [];
  if (!d) return null;
  if (y.length === 2) y = (Number(y) > 50 ? "19" : "20") + y;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

// Heuristica para el nombre: busca una linea que contenga la palabra
// "nombre" y toma lo que sigue. Si el documento no trae esa etiqueta, o el
// OCR no la reconocio, se deja vacio para llenarlo a mano.
function buscarNombre(texto) {
  const linea = texto.split(/\r?\n/).find((l) => /nombre/i.test(l));
  if (!linea) return null;
  const resto = linea.replace(/.*nombre[^:a-záéíóúñ]*:?/i, "").trim();
  return resto.length >= 3 ? resto : null;
}

// Recibe las paginas ya procesadas (dataURL) del escaner y devuelve los
// campos que se pudieron reconocer. Nunca lanza: si el OCR falla, devuelve
// todo en null para que el formulario siga llenandose a mano sin bloquear
// el registro.
export async function extraerDatosBasicos(dataUrls) {
  if (!dataUrls?.length) return { nombreCompleto: null, dpi: null, telefono: null, fecha: null };

  let worker;
  try {
    worker = await createWorker("spa");
    let texto = "";
    // Solo la primera pagina: el documento de admision trae los datos
    // basicos al inicio, y cada pagina adicional cuesta varios segundos.
    const { data } = await worker.recognize(dataUrls[0]);
    texto = data.text || "";

    const dpiMatch = texto.match(PATRON_DPI);
    const dpi = dpiMatch ? dpiMatch[1].replace(/\s/g, "") : null;
    const textoSinDpi = dpiMatch ? texto.replace(dpiMatch[0], "") : texto;
    const telMatch = textoSinDpi.match(PATRON_TELEFONO);
    const telefono = telMatch ? telMatch[1].replace(/\s/g, "") : null;

    return {
      nombreCompleto: buscarNombre(texto),
      dpi,
      telefono,
      fecha: normalizarFecha(texto),
    };
  } catch {
    return { nombreCompleto: null, dpi: null, telefono: null, fecha: null };
  } finally {
    await worker?.terminate();
  }
}
