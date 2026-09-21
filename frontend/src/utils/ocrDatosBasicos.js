// Dev-Mari: lectura automatica de datos basicos desde la "Ficha General del
// Paciente / Hoja de Ingreso y Egreso" escaneada en "Paciente nuevo".
//
// Etapas separadas, para poder probar y afinar cada una:
//  1) reconocer(): Tesseract.js convierte la imagen en texto (dos modos de
//     segmentacion, porque uno a veces se salta renglones enteros) y relee
//     DPI y telefono varias veces solo como digitos.
//  2) extraerCampos(): busca en cada texto los datos basicos, anclandose a las
//     ETIQUETAS IMPRESAS de la hoja ("Nombre Completo:", "DPI:", "Historia
//     Clinica:"...) — la parte impresa se lee bien, y lo que el doctor escribio
//     a mano queda justo despues de cada etiqueta.
//  3) combinar(): junta los resultados; en DPI y telefono vota entre lecturas.
//
// Limite conocido: Tesseract esta pensado para texto impreso; la letra
// manuscrita la lee bastante peor (sobre todo digitos parecidos: 1/7, 0/8...).
// El resultado es siempre un punto de partida editable, nunca se guarda sin
// que el personal lo revise.
import { createWorker } from "tesseract.js";

// Etiquetas de la hoja (tolerantes a acentos/mayusculas y a los errores
// tipicos del OCR). Se usan tanto para ubicar un campo como para saber donde
// termina el valor cuando dos campos comparten renglon.
const ETIQUETAS = {
  // "compl" + hasta 3 letras del MISMO tipo (minusculas o mayusculas): tolera
  // "Completo:", "Complet" (OCR) o una etiqueta pegada al valor
  // ("CompletMaria") sin comerse la primera letra del valor. Sin flag i a
  // proposito: con i, la clase [a-z] tambien se comeria la "M" de "Maria".
  nombre: /(?:[Nn]ombre\s*[Cc]ompl[a-záéíóúñ]{0,3}|NOMBRE\s*COMPL[A-ZÁÉÍÓÚÑ]{0,3})/,
  direccion: /direcci[oó0]n/i,
  telefono: /tel[eé]fono/i,
  fechaNacimiento: /fecha\s*de\s*nacimiento/i,
  fechaIngreso: /fecha\s*de\s*ingres\S?/i, // el OCR a veces lee "INGRESG"/"INGRESE"
  dpi: /\bD\.?P\.?[Il1]\.?\b/i, // el OCR lee a veces "DPl" (ele minuscula)
  historia: /historia\s*cl[ií]nica/i,
};

// Cualquier etiqueta de la hoja que pueda aparecer en el mismo renglon y
// marque el fin del valor anterior.
const CORTE = /(tel[eé]fono|\bedad\b|\bsexo\b|religi[oó]n|ocupaci[oó]n|\bD\.?P\.?[Il1]\.?\b|parentesco|\bhora\b|fecha\s*de|estado\s*civil|nacionalidad|lugar\s*de|historia\s*cl[ií]nica|direcci[oó]n|nombre\s*(completo|del|de\s*la))/i;

const MESES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };

function limpiarRuido(texto) {
  // bordes de tabla, guiones bajos de rayas para escribir y espacios raros
  return texto.replace(/[|_¦[\]{}]+/g, " ").replace(/\s+/g, " ").trim();
}

// Texto que sigue a la etiqueta en su renglon, hasta la siguiente etiqueta.
function valorTrasEtiqueta(lineas, etiqueta) {
  for (const linea of lineas) {
    const m = linea.match(etiqueta);
    if (!m) continue;
    let resto = linea.slice(m.index + m[0].length).replace(/^[\s:.\-–—]+/, "");
    const corte = resto.match(CORTE);
    if (corte && corte.index !== undefined) resto = resto.slice(0, corte.index);
    resto = limpiarRuido(resto);
    if (resto) return resto;
  }
  return null;
}

// Confusiones tipicas del OCR entre letras y digitos, aplicadas solo a
// valores que deben ser numericos.
function comoDigitos(texto) {
  return texto
    .replace(/[Oo]/g, "0")
    .replace(/[Il|]/g, "1")
    .replace(/[Ss]/g, "5")
    .replace(/[Bb]/g, "8");
}

function soloDigitos(texto) {
  return comoDigitos(texto).replace(/\D/g, "");
}

export function parsearFecha(texto) {
  if (!texto) return null;
  // Mismo separador en ambos lados (\2) y año de 2 o 4 digitos exactos: evita
  // armar fechas falsas a partir de basura del OCR como "5/04/2.02.6".
  const numerica = texto.match(/(?<!\d)(\d{1,2})\s*([\/\-.])\s*(\d{1,2})\s*\2\s*(\d{4}|\d{2})(?!\d)/);
  let d, mo, y;
  if (numerica) {
    [, d, , mo, y] = numerica;
  } else {
    const larga = texto.match(/(\d{1,2})\s*(?:de)?\s*([a-záéíóú]+)\s*(?:de|del)?\s*(\d{2,4})/i);
    if (!larga) return null;
    const mes = MESES[larga[2].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")];
    if (!mes) return null;
    [, d] = larga;
    mo = String(mes);
    y = larga[3];
  }
  if (y.length === 2) y = (Number(y) > 50 ? "19" : "20") + y;
  const dia = Number(d), mes = Number(mo);
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;
  const anio = Number(y);
  if (anio < 1900 || anio > new Date().getFullYear() + 1) return null;
  return `${y}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

// Etapa 2 (pura, sin OCR): texto crudo -> campos. Devuelve null en lo que no
// se encontro; nunca inventa valores.
export function extraerCampos(textoCrudo) {
  const lineas = (textoCrudo || "").split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);

  // Nombre: solo la etiqueta "Nombre Completo" (la hoja tambien trae nombre
  // del conyugue, padre y madre, que no deben confundirse con el del paciente).
  let nombreCompleto = valorTrasEtiqueta(lineas, ETIQUETAS.nombre);
  if (nombreCompleto && nombreCompleto.replace(/[^a-záéíóúñ]/gi, "").length < 3) nombreCompleto = null;

  const direccion = valorTrasEtiqueta(lineas, ETIQUETAS.direccion);

  // DPI: el valor tras la etiqueta (13 digitos, con o sin espacios); si no, un
  // grupo de 13 digitos en cualquier parte del texto.
  let dpi = null;
  const tasDpi = valorTrasEtiqueta(lineas, ETIQUETAS.dpi);
  if (tasDpi) {
    const d = soloDigitos(tasDpi);
    if (d.length === 13) dpi = d;
  }
  if (!dpi) {
    const suelto = (textoCrudo || "").match(/\b\d{4}\s?\d{5}\s?\d{4}\b/);
    if (suelto) dpi = suelto[0].replace(/\s/g, "");
  }

  // Telefono del paciente: primera aparicion de la etiqueta (la hoja repite
  // "Telefono" para el conyugue y el contacto de emergencia mas abajo).
  let telefono = null;
  const tasTel = valorTrasEtiqueta(lineas, ETIQUETAS.telefono);
  if (tasTel) {
    const d = soloDigitos(tasTel);
    if (d.length === 8) telefono = d;
    else if (d.length > 8) telefono = d.slice(0, 8);
  }

  // Historia clinica: alfanumerica con guiones/diagonales (el hospital la
  // asigna a mano; el formato exacto puede variar).
  let historiaClinica = null;
  const tasHistoria = valorTrasEtiqueta(lineas, ETIQUETAS.historia);
  if (tasHistoria) {
    const token = tasHistoria.match(/[A-Za-z0-9][A-Za-z0-9\-\/.]{0,38}/);
    if (token && /\d/.test(token[0])) historiaClinica = token[0];
  }

  const fechaNacimiento = parsearFecha(valorTrasEtiqueta(lineas, ETIQUETAS.fechaNacimiento));
  const fechaIngreso = parsearFecha(valorTrasEtiqueta(lineas, ETIQUETAS.fechaIngreso));

  return { nombreCompleto, direccion, dpi, telefono, historiaClinica, fechaNacimiento, fechaIngreso };
}

const VACIO = { nombreCompleto: null, direccion: null, dpi: null, telefono: null, historiaClinica: null, fechaNacimiento: null, fechaIngreso: null };

// El valor mas repetido entre varias lecturas (en empate, el primero).
function votar(candidatos) {
  if (!candidatos.length) return null;
  const cuenta = new Map();
  for (const c of candidatos) cuenta.set(c, (cuenta.get(c) || 0) + 1);
  let mejor = null;
  let max = 0;
  for (const [valor, n] of cuenta) {
    if (n > max) { mejor = valor; max = n; }
  }
  return mejor;
}

// Etapa 3 (pura): junta los resultados de varias pasadas. Para cada campo
// gana la primera pasada que lo encontro; en DPI y telefono se vota entre
// todas las lecturas (solo-digitos + las derivadas del texto).
export function combinar({ textos = [], dpiLecturas = [], telefonoLecturas = [] }) {
  const porTexto = textos.map(extraerCampos);
  const primero = (campo) => porTexto.map((c) => c[campo]).find(Boolean) || null;
  return {
    nombreCompleto: primero("nombreCompleto"),
    direccion: primero("direccion"),
    historiaClinica: primero("historiaClinica"),
    fechaNacimiento: primero("fechaNacimiento"),
    fechaIngreso: primero("fechaIngreso"),
    dpi: votar([...dpiLecturas, ...porTexto.map((c) => c.dpi).filter(Boolean)]),
    telefono: votar([...telefonoLecturas, ...porTexto.map((c) => c.telefono).filter(Boolean)]),
  };
}

// Agranda la imagen antes del OCR: las etiquetas impresas de una hoja
// completa quedan chicas a 1600px de ancho, y Tesseract lee mejor con texto
// de mayor altura. Solo en navegador.
async function prepararImagen(dataUrl, anchoObjetivo = 2400) {
  if (typeof document === "undefined") return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (img.width >= anchoObjetivo) return resolve(dataUrl);
      const escala = anchoObjetivo / img.width;
      const canvas = document.createElement("canvas");
      canvas.width = anchoObjetivo;
      canvas.height = Math.round(img.height * escala);
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function lineasDe(data) {
  const lineas = [];
  for (const b of data.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) lineas.push(l);
  return lineas;
}

// Zona (rectangulo) que ocupa el valor numerico justo despues de una etiqueta,
// segun las posiciones de palabra que reporta Tesseract. Se detiene en la
// primera palabra con letras (otra etiqueta o texto).
function rectanguloTrasEtiqueta(lineas, etiqueta, pad = 8) {
  for (const linea of lineas) {
    const palabras = linea.words || [];
    const i = palabras.findIndex((w) => etiqueta.test(w.text));
    if (i < 0) continue;
    const valor = [];
    for (let j = i + 1; j < palabras.length; j++) {
      if (/[a-záéíóúñ]{3,}/i.test(palabras[j].text)) break;
      valor.push(palabras[j]);
    }
    if (!valor.length) continue;
    const x0 = Math.max(0, Math.min(...valor.map((w) => w.bbox.x0)) - pad);
    const y0 = Math.max(0, Math.min(...valor.map((w) => w.bbox.y0)) - pad);
    const x1 = Math.max(...valor.map((w) => w.bbox.x1)) + pad;
    const y1 = Math.max(...valor.map((w) => w.bbox.y1)) + pad;
    return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
  }
  return null;
}

// Relectura solo de digitos sobre el valor de un campo numerico: al
// restringir el alfabeto a 0-9 desaparecen las confusiones letra/digito
// (O/0, l/1, S/5...) que la pasada general comete en DPI y telefono.
async function leerDigitos(worker, imagen, rect, largoEsperado, psm) {
  if (!rect) return null;
  await worker.setParameters({ tessedit_char_whitelist: "0123456789 -", tessedit_pageseg_mode: psm });
  const { data } = await worker.recognize(imagen, { rectangle: rect });
  const digitos = (data.text || "").replace(/\D/g, "");
  return digitos.length === largoEsperado ? digitos : null;
}

// Etapa 1: imagen -> textos crudos (+ lecturas solo-digitos de DPI y
// telefono). Lanza si Tesseract falla.
export async function reconocer(dataUrl, { psms = ["6", "4"] } = {}) {
  const worker = await createWorker("spa");
  try {
    const imagen = await prepararImagen(dataUrl);

    // Se leen la hoja con dos modos de segmentacion porque cada uno se salta
    // renglones distintos (PSM 6: bloque uniforme; PSM 4: una columna).
    const pasadas = [];
    for (const psm of psms) {
      await worker.setParameters({ tessedit_pageseg_mode: psm, tessedit_char_whitelist: "", preserve_interword_spaces: "1" });
      const { data } = await worker.recognize(imagen, {}, { blocks: true });
      pasadas.push({ texto: data.text || "", lineas: lineasDe(data) });
    }

    const dpiLecturas = [];
    const telefonoLecturas = [];
    try {
      for (const p of pasadas) {
        const rectDpi = rectanguloTrasEtiqueta(p.lineas, ETIQUETAS.dpi);
        const rectTel = rectanguloTrasEtiqueta(p.lineas, ETIQUETAS.telefono);
        for (const psm of ["7", "8", "13"]) {
          const d = await leerDigitos(worker, imagen, rectDpi, 13, psm);
          if (d) dpiLecturas.push(d);
          const t = await leerDigitos(worker, imagen, rectTel, 8, psm);
          if (t) telefonoLecturas.push(t);
        }
      }
    } catch {
      // la relectura de digitos es una mejora opcional; si falla, se queda
      // con lo que salio del texto.
    }
    return { textos: pasadas.map((p) => p.texto), dpiLecturas, telefonoLecturas };
  } finally {
    await worker.terminate();
  }
}

// Punto de entrada para la UI. Nunca lanza: si algo falla, devuelve el error
// y todo en null, para que el formulario siga llenandose a mano. Devuelve
// tambien el texto crudo leido, para poder ver que "vio" el OCR.
export async function extraerDatosBasicos(dataUrls) {
  if (!dataUrls?.length) return { ...VACIO, textoCrudo: "", error: null };
  try {
    const lecturas = await reconocer(dataUrls[0]);
    return { ...combinar(lecturas), textoCrudo: lecturas.textos.join("\n----- (segunda lectura) -----\n"), error: null };
  } catch (err) {
    return { ...VACIO, textoCrudo: "", error: err?.message || String(err) };
  }
}
