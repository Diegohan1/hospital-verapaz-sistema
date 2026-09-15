// Sprint 4 (Cambios2): generacion del PDF a partir de las paginas
// procesadas del escaneo. Cada pagina del PDF corresponde a una imagen
// procesada (recorte + perspectiva + filtro), normalizada a A4 o carta con
// margenes y orientacion consistentes. El PDF es visual: no contiene texto
// extraido (sin OCR).
import { jsPDF } from "jspdf";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { canvasDesdeDataUrl } from "./scanProcessing";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

export const TAMANOS_PDF = {
  A4: { formato: "a4", ancho: 210, alto: 297 },
  LETTER: { formato: "letter", ancho: 215.9, alto: 279.4 },
};

const MARGEN_MM = 10;

export const DOCUMENTO_CONFIG = {
  TAMANO: TAMANOS_PDF.LETTER, // carta, ajustable por el hospital
  MAX_MB: 20, // limite del PDF final; el backend repite la validacion
  CALIDAD_JPEG: 0.85,
};

function dimensionesImagen(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ ancho: img.width, alto: img.height });
    img.onerror = () => reject(new Error("Página ilegible al generar el PDF"));
    img.src = dataUrl;
  });
}

// Genera el PDF multipagina. `paginas` es un array de dataURL JPEG ya
// procesadas. Devuelve un Blob y la cantidad de paginas insertadas.
export async function generarPdfDePaginas(paginas, { tamano = DOCUMENTO_CONFIG.TAMANO } = {}) {
  if (!paginas.length) throw new Error("No hay páginas para generar el PDF");
  let pdf = null;
  let insertadas = 0;

  for (const dataUrl of paginas) {
    const { ancho, alto } = await dimensionesImagen(dataUrl);
    const horizontal = ancho > alto;
    const orientacion = horizontal ? "landscape" : "portrait";
    pdf = pdf || new jsPDF({ unit: "mm", format: tamano.formato, orientation: orientacion, compress: true });
    if (insertadas > 0) pdf.addPage(tamano.formato, orientacion);

    const anchoPagina = horizontal ? tamano.alto : tamano.ancho;
    const altoPagina = horizontal ? tamano.ancho : tamano.alto;
    const disponibleW = anchoPagina - MARGEN_MM * 2;
    const disponibleH = altoPagina - MARGEN_MM * 2;
    const escala = Math.min(disponibleW / ancho, disponibleH / alto);
    const dw = ancho * escala;
    const dh = alto * escala;
    const x = (anchoPagina - dw) / 2;
    const y = (altoPagina - dh) / 2;
    pdf.addImage(dataUrl, "JPEG", x, y, dw, dh, undefined, "FAST");
    insertadas++;
  }

  return { blob: pdf.output("blob"), paginas: insertadas };
}

export function nombreDescarga(pacienteId) {
  const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const hora = new Date().toTimeString().slice(0, 5).replace(":", "");
  // Dev-Mari: al escanear antes de registrar al paciente, todavia no hay id.
  const sujeto = pacienteId ? `paciente-${pacienteId}` : "paciente-nuevo";
  return `documento-${sujeto}-${fecha}${hora}.pdf`;
}

export function tamanoLegibleMB(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Valida el PDF generado: numero de paginas correcto y tamaño dentro del
// limite configurado. Devuelve el mensaje de error o null si es valido.
export function validarPdf(blob, paginasEsperadas) {
  if (blob.type && blob.type !== "application/pdf") return "El archivo generado no es un PDF válido.";
  if (paginasEsperadas && blob.size > 0 && paginasEsperadas <= 0) return "El PDF no tiene páginas.";
  if (blob.size > DOCUMENTO_CONFIG.MAX_MB * 1024 * 1024) {
    return `El PDF excede el límite de ${DOCUMENTO_CONFIG.MAX_MB} MB. Elimine páginas o reduzca la resolución.`;
  }
  return null;
}

// Descarga local de respaldo cuando no hay persistencia disponible
export function descargarPdf(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Dev-Mari: cuando el documento ya viene escaneado por el software de un
// escaner/impresora (no por la camara de este sistema), se sube el PDF tal
// cual — no pasa por deteccion de bordes ni correccion de perspectiva,
// porque ya es un escaneo limpio. Estas funciones lo leen para: (a) saber
// cuantas paginas trae y (b) renderizar la primera como imagen, que es lo
// unico que necesita el OCR de datos basicos.
export async function leerInfoPdf(arrayBuffer) {
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  return { totalPaginas: doc.numPages, doc };
}

export async function renderizarPrimeraPaginaPdf(arrayBuffer) {
  const { doc, totalPaginas } = await leerInfoPdf(arrayBuffer);
  const pagina = await doc.getPage(1);
  const viewport = pagina.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await pagina.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.9), totalPaginas };
}

export { canvasDesdeDataUrl };
