// Sprint 4 (Cambios2): pipeline de procesamiento documental tipo escaner,
// sin dependencias externas de vision (se evita inflar el bundle con
// OpenCV.js). Pasos: deteccion de esquinas por energia de bordes (Sobel +
// ajuste de lineas por minimos cuadrados), correccion de perspectiva por
// homografia con muestreo bilinear, rotacion de 90 grados y filtros
// color / grises / documento con estiramiento de contraste por percentiles.

const ANCHO_ANALISIS = 260; // resolucion del mapa de bordes (rapido y suficiente)

export function canvasDesdeDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext("2d").drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error("No se pudo leer la imagen capturada"));
    img.src = dataUrl;
  });
}

// ------- Deteccion de esquinas -------

function escalaGrises(canvas, anchoObjetivo) {
  const escala = anchoObjetivo / canvas.width;
  const w = Math.max(32, Math.round(canvas.width * escala));
  const h = Math.max(32, Math.round(canvas.height * escala));
  const chico = document.createElement("canvas");
  chico.width = w;
  chico.height = h;
  const ctx = chico.getContext("2d");
  ctx.drawImage(canvas, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const gris = new Float32Array(w * h);
  for (let i = 0; i < gris.length; i++) {
    gris[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }
  return { gris, w, h };
}

// Magnitud de Sobel + estadisticas para umbral adaptativo
function mapaBordes(gris, w, h) {
  const mag = new Float32Array(w * h);
  let suma = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -gris[i - w - 1] - 2 * gris[i - 1] - gris[i + w - 1] +
        gris[i - w + 1] + 2 * gris[i + 1] + gris[i + w + 1];
      const gy =
        -gris[i - w - 1] - 2 * gris[i - w] - gris[i - w + 1] +
        gris[i + w - 1] + 2 * gris[i + w] + gris[i + w + 1];
      const m = Math.hypot(gx, gy);
      mag[i] = m;
      suma += m;
    }
  }
  const media = suma / (w * h);
  let varianza = 0;
  for (let i = 0; i < mag.length; i++) varianza += (mag[i] - media) ** 2;
  return { mag, media, desviacion: Math.sqrt(varianza / mag.length) };
}

function ajustarLinea(puntos) {
  // minimos cuadrados y = a*x + b ; devuelve null si no hay puntos suficientes
  const n = puntos.length;
  if (n < 8) return null;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const [x, y] of puntos) { sx += x; sy += y; sxx += x * x; sxy += x * y; }
  const denominador = n * sxx - sx * sx;
  if (Math.abs(denominador) < 1e-6) return null;
  const a = (n * sxy - sx * sy) / denominador;
  const b = (sy - a * sx) / n;
  return { a, b };
}

function interseccion(h1, h2) {
  // h: {a,b} como y = a*x + b
  const x = (h2.b - h1.b) / (h1.a - h2.a || 1e-6);
  return { x, y: h1.a * x + h1.b };
}

// Busca, por cada columna (o fila), el primer borde fuerte desde el borde
// exterior hacia adentro y ajusta la linea de ese lado del documento.
function puntosDeLado(mag, w, h, umbral, lado) {
  const puntos = [];
  const desde = Math.floor(w * 0.1);
  const hasta = Math.floor(w * 0.9);
  if (lado === "arriba" || lado === "abajo") {
    for (let x = desde; x < hasta; x += 2) {
      for (let y = 2; y < h - 2; y++) {
        const yy = lado === "arriba" ? y : h - 1 - y;
        const i = yy * w + x;
        // exige 3 celdas consecutivas con borde para evitar ruido aislado
        if (mag[i] > umbral && mag[i + w] > umbral * 0.6 && mag[i - w] > umbral * 0.6) {
          puntos.push([x, yy]);
          break;
        }
      }
    }
  } else {
    const desdeY = Math.floor(h * 0.1);
    const hastaY = Math.floor(h * 0.9);
    for (let y = desdeY; y < hastaY; y += 2) {
      for (let x = 2; x < w - 2; x++) {
        const xx = lado === "izquierda" ? x : w - 1 - x;
        const i = y * w + xx;
        if (mag[i] > umbral && mag[i + 1] > umbral * 0.6 && mag[i - 1] > umbral * 0.6) {
          puntos.push([xx, y]);
          break;
        }
      }
    }
  }
  return puntos;
}

// Deteccion automatica del cuadrilatero dominante. Devuelve las 4 esquinas
// en coordenadas del canvas original (TL, TR, BR, BL) o null si no hay
// confianza suficiente — en ese caso se usa el recorte manual.
export function detectarEsquinas(canvas) {
  const { gris, w, h } = escalaGrises(canvas, ANCHO_ANALISIS);
  const { mag, media, desviacion } = mapaBordes(gris, w, h);
  const umbral = Math.max(60, media + 1.3 * desviacion);

  const lineas = {};
  for (const lado of ["arriba", "abajo", "izquierda", "derecha"]) {
    const puntos = puntosDeLado(mag, w, h, umbral, lado);
    lineas[lado] = puntos.length >= w * 0.08 ? ajustarLinea(puntos) : null;
  }
  if (!lineas.arriba || !lineas.abajo || !lineas.izquierda || !lineas.derecha) return null;

  const tl = interseccion(lineas.arriba, lineas.izquierda);
  const tr = interseccion(lineas.arriba, lineas.derecha);
  const br = interseccion(lineas.abajo, lineas.derecha);
  const bl = interseccion(lineas.abajo, lineas.izquierda);
  const esquinas = [tl, tr, br, bl];

  // Validaciones: dentro de margen, convexidad y area significativa
  const margen = 0.08;
  for (const e of esquinas) {
    if (e.x < -margen * w || e.x > w * (1 + margen) || e.y < -margen * h || e.y > h * (1 + margen)) return null;
  }
  function areaQuad([a, b, c, d]) {
    return Math.abs((a.x * b.y + b.x * c.y + c.x * d.y + d.x * a.y) - (a.y * b.x + b.y * c.x + c.y * d.x + d.y * a.x)) / 2;
  }
  if (areaQuad(esquinas) < 0.18 * w * h) return null;

  // Escalar de vuelta a la resolucion original
  const factor = canvas.width / w;
  return esquinas.map((e) => ({ x: Math.min(Math.max(e.x * factor, 0), canvas.width), y: Math.min(Math.max(e.y * factor, 0), canvas.height) }));
}

// ------- Correccion de perspectiva (homografia + muestreo bilinear) -------

function homografiaDesde(esquinas, ancho, alto) {
  // Resuelve la homografia que mapea el rectangulo destino (0,0)-(ancho,alto)
  // al cuadrilatero fuente, con 8 ecuaciones lineales (regla de Cramer).
  const [tl, tr, br, bl] = esquinas;
  const src = [tl, tr, br, bl];
  const dst = [
    { x: 0, y: 0 }, { x: ancho, y: 0 }, { x: ancho, y: alto }, { x: 0, y: alto },
  ];
  const A = [];
  const B = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = dst[i];
    const s = src[i];
    A.push([x, y, 1, 0, 0, 0, -s.x * x, -s.x * y]);
    B.push(s.x);
    A.push([0, 0, 0, x, y, 1, -s.y * x, -s.y * y]);
    B.push(s.y);
  }
  // Eliminacion gaussiana 8x8
  for (let col = 0; col < 8; col++) {
    let pivote = col;
    for (let fila = col + 1; fila < 8; fila++) if (Math.abs(A[fila][col]) > Math.abs(A[pivote][col])) pivote = fila;
    [A[col], A[pivote]] = [A[pivote], A[col]];
    [B[col], B[pivote]] = [B[pivote], B[col]];
    if (Math.abs(A[col][col]) < 1e-10) return null;
    for (let fila = col + 1; fila < 8; fila++) {
      const f = A[fila][col] / A[col][col];
      for (let k = col; k < 8; k++) A[fila][k] -= f * A[col][k];
      B[fila] -= f * B[col];
    }
  }
  const h = new Float64Array(8);
  for (let fila = 7; fila >= 0; fila--) {
    let suma = B[fila];
    for (let k = fila + 1; k < 8; k++) suma -= A[fila][k] * h[k];
    h[fila] = suma / A[fila][fila];
  }
  return h;
}

// Rectifica el cuadrilatero a un frente de documento. Devuelve un canvas
// nuevo; el original no se modifica. Limita la resolucion de salida.
export function rectificarPerspectiva(canvasFuente, esquinas, maxAncho = 1600) {
  const tl = esquinas[0], tr = esquinas[1], br = esquinas[2], bl = esquinas[3];
  const anchoArriba = Math.hypot(tr.x - tl.x, tr.y - tl.y);
  const anchoAbajo = Math.hypot(br.x - bl.x, br.y - bl.y);
  const altoIzq = Math.hypot(bl.x - tl.x, bl.y - tl.y);
  const altoDer = Math.hypot(br.x - tr.x, br.y - tr.y);
  let ancho = Math.round((anchoArriba + anchoAbajo) / 2);
  let alto = Math.round((altoIzq + altoDer) / 2);
  const escala = Math.min(1, maxAncho / Math.max(ancho, 1));
  ancho = Math.max(16, Math.round(ancho * escala));
  alto = Math.max(16, Math.round(alto * escala));

  const h = homografiaDesde(esquinas, ancho, alto);
  if (!h) return null;

  const salida = document.createElement("canvas");
  salida.width = ancho;
  salida.height = alto;
  const ctxS = salida.getContext("2d");
  const ctxF = canvasFuente.getContext("2d");
  const fuente = ctxF.getImageData(0, 0, canvasFuente.width, canvasFuente.height);
  const destino = ctxS.createImageData(ancho, alto);
  const fd = fuente.data;
  const fw = canvasFuente.width;
  const fh = canvasFuente.height;
  const dd = destino.data;

  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const denom = h[6] * x + h[7] * y + 1;
      const sx = (h[0] * x + h[1] * y + h[2]) / denom;
      const sy = (h[3] * x + h[4] * y + h[5]) / denom;
      const di = (y * ancho + x) * 4;
      if (sx < 0 || sy < 0 || sx >= fw - 1 || sy >= fh - 1) {
        dd[di + 3] = 255;
        continue;
      }
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      const fx = sx - x0, fy = sy - y0;
      const i00 = (y0 * fw + x0) * 4;
      // muestreo bilinear
      for (let c = 0; c < 3; c++) {
        const v =
          fd[i00 + c] * (1 - fx) * (1 - fy) +
          fd[i00 + 4 + c] * fx * (1 - fy) +
          fd[i00 + fw * 4 + c] * (1 - fx) * fy +
          fd[i00 + fw * 4 + 4 + c] * fx * fy;
        dd[di + c] = v;
      }
      dd[di + 3] = 255;
    }
  }
  ctxS.putImageData(destino, 0, 0);
  return salida;
}

// ------- Rotacion y filtros -------

export function rotar90(canvas) {
  const salida = document.createElement("canvas");
  salida.width = canvas.height;
  salida.height = canvas.width;
  const ctx = salida.getContext("2d");
  ctx.translate(salida.width / 2, salida.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return salida;
}

// modos: "color" (sin cambio), "grises" (luminancia) y "documento"
// (luminancia + estiramiento de contraste por percentiles 2-98, que elimina
// sombras moderadas y mejora la legibilidad del texto sin perder trazo fino).
export function aplicarFiltro(canvas, modo) {
  if (modo === "color") return canvas;
  const ctx = canvas.getContext("2d");
  const imagen = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imagen.data;

  if (modo === "grises") {
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = g;
    }
  } else if (modo === "documento") {
    const luminancias = new Uint8Array(canvas.width * canvas.height);
    const histograma = new Uint32Array(256);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
      luminancias[p] = g;
      histograma[g]++;
    }
    const total = luminancias.length;
    let acumulado = 0;
    let min = 0, max = 255;
    // percentil 2% inferior
    for (let v = 0; v < 256; v++) { acumulado += histograma[v]; if (acumulado >= total * 0.02) { min = v; break; } }
    // percentil 98% superior
    acumulado = 0;
    for (let v = 255; v >= 0; v--) { acumulado += histograma[v]; if (acumulado >= total * 0.02) { max = v; break; } }
    const rango = Math.max(1, max - min);
    for (let p = 0, i = 0; p < luminancias.length; p++, i += 4) {
      const g = Math.max(0, Math.min(255, ((luminancias[p] - min) * 255) / rango));
      d[i] = d[i + 1] = d[i + 2] = g;
    }
  }
  ctx.putImageData(imagen, 0, 0);
  return canvas;
}

// Pipeline completo de una pagina: rectifica las esquinas indicadas, rota y
// aplica el filtro. Devuelve el canvas procesado listo para el PDF.
export async function procesarPagina(dataUrl, { esquinas, rotaciones = 0, filtro = "color", maxAncho = 1600 }) {
  const base = await canvasDesdeDataUrl(dataUrl);
  let canvas = esquinas ? rectificarPerspectiva(base, esquinas, maxAncho) : base;
  if (!canvas) canvas = base;
  for (let i = 0; i < ((rotaciones % 4) + 4) % 4; i++) canvas = rotar90(canvas);
  return aplicarFiltro(canvas, filtro);
}
