// Formato de fechas para pantalla e impresion, siempre dia/mes/año.
//
// Hay dos tipos de fecha en el sistema y se muestran distinto:
//
//  - "De solo dia" (fecha de nacimiento, fecha escrita en el papel): se
//    guardan como medianoche UTC del dia elegido ("2000-03-01T00:00:00Z").
//    Hay que mostrarlas en UTC; en hora local de Guatemala (UTC-6) esa
//    medianoche cae en la tarde del dia ANTERIOR y se veria 29/02/2000.
//
//  - "Instante" (fecha en que se registro en el sistema, ingreso con hora):
//    es un momento real y se muestra en la hora local del navegador.

const FORMATO_DIA = { day: "2-digit", month: "2-digit", year: "numeric" };
const FORMATO_HORA = { hour: "2-digit", minute: "2-digit", hour12: false };

function valida(valor) {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Fecha de solo dia -> "01/03/2000" (o null si no hay valor)
export function fechaDia(valor) {
  const d = valida(valor);
  return d ? d.toLocaleDateString("es-GT", { ...FORMATO_DIA, timeZone: "UTC" }) : null;
}

// Momento real -> "15/09/2026" (hora local)
export function fechaLocal(valor) {
  const d = valida(valor);
  return d ? d.toLocaleDateString("es-GT", FORMATO_DIA) : null;
}

// Momento real -> "15/09/2026 14:30" (hora local)
export function fechaHoraLocal(valor) {
  const d = valida(valor);
  return d ? `${d.toLocaleDateString("es-GT", FORMATO_DIA)} ${d.toLocaleTimeString("es-GT", FORMATO_HORA)}` : null;
}
