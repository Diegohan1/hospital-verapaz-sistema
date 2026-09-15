// Sprint 2: limite de intentos por IP para proteger el login y la
// recuperacion de contrasena contra fuerza bruta. Implementacion en memoria
// (suficiente para un monolito de una instancia); si el sistema crece a
// varias instancias detras de un balanceador, mover a Redis o un gateway.
//
// Responde 429 con el encabezado estandar Retry-After (segundos restantes
// hasta que la ventana se libere).
function ahora() {
  return Date.now();
}

// Mapas de todos los limitadores creados, para poder limpiarlos en pruebas
// (cada limitador tiene el suyo propio; esto solo los recorre a todos).
const todasLasVentanas = [];

export function createRateLimiter({ windowMs = 5 * 60 * 1000, max = 10, mensaje = "Demasiados intentos, espere un momento" } = {}) {
  // Un Map por limitador (no global): asi los intentos en /forgot-password
  // no consumen ni bloquean el cupo de /login, aunque vengan de la misma IP.
  const ventanas = new Map(); // clave -> { inicio, contador }
  todasLasVentanas.push(ventanas);

  function limpiarExpiradas() {
    if (ventanas.size > 10000) {
      const t = ahora();
      for (const [clave, estado] of ventanas) {
        if (t - estado.inicio >= windowMs) ventanas.delete(clave);
      }
    }
  }

  return function rateLimiter(req, res, next) {
    limpiarExpiradas();
    const clave = req.ip || req.socket?.remoteAddress || "desconocida";
    const t = ahora();
    let estado = ventanas.get(clave);

    if (!estado || t - estado.inicio >= windowMs) {
      estado = { inicio: t, contador: 0 };
      ventanas.set(clave, estado);
    }
    estado.contador++;

    const reintentaEnSeg = Math.ceil((estado.inicio + windowMs - t) / 1000);
    res.setHeader("Retry-After", String(Math.max(1, reintentaEnSeg)));

    if (estado.contador > max) {
      return res.status(429).json({ error: mensaje, reintentaEnSeg });
    }
    next();
  };
}

// Solo para pruebas: reinicia el estado de todos los limitadores creados
export function _resetVentanas() {
  for (const ventanas of todasLasVentanas) ventanas.clear();
}
