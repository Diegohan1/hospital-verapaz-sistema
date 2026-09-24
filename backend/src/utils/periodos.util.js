// Rangos y periodos (dia / semana / mes) para los reportes, siempre en la
// zona horaria DEL HOSPITAL y no la del servidor: en Docker el servidor
// corre en UTC y una factura de las 8 p. m. de Guatemala (2 a. m. UTC del dia
// siguiente) caeria en el dia equivocado.
//
// Guatemala es UTC-6 todo el año (no usa horario de verano). Se puede
// cambiar con HOSPITAL_TZ / HOSPITAL_UTC_OFFSET si el sistema se usara en
// otra zona.
const ZONA = process.env.HOSPITAL_TZ || "America/Guatemala";
const OFFSET = process.env.HOSPITAL_UTC_OFFSET || "-06:00";

export const GRANULARIDADES = ["dia", "semana", "mes"];

const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

// "2026-09-20" -> instante 2026-09-20 00:00 hora del hospital (null si no es valido)
function inicioDelDia(texto) {
  if (!SOLO_FECHA.test(texto)) return null;
  const d = new Date(`${texto}T00:00:00${OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// "2026-09-20" -> instante 2026-09-20 23:59:59.999 hora del hospital
function finDelDia(texto) {
  if (!SOLO_FECHA.test(texto)) return null;
  const d = new Date(`${texto}T23:59:59.999${OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Filtro Prisma {gte, lte} para "desde"/"hasta" con formato AAAA-MM-DD. "Hasta"
// INCLUYE todo ese dia (antes se tomaba la medianoche de inicio y quedaban
// fuera las facturas del ultimo dia elegido). Valores invalidos se ignoran.
export function rangoFecha(desde, hasta) {
  const rango = {};
  const d = desde ? inicioDelDia(String(desde)) : null;
  const h = hasta ? finDelDia(String(hasta)) : null;
  if (d) rango.gte = d;
  if (h) rango.lte = h;
  return Object.keys(rango).length ? rango : undefined;
}

// Dia calendario (AAAA-MM-DD) de un instante, en la zona del hospital
const formateadorDia = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" });
export function diaEnHospital(instante) {
  return formateadorDia.format(new Date(instante));
}

// Lunes de la semana (AAAA-MM-DD) a la que pertenece un dia
function lunesDeLaSemana(dia) {
  const [y, m, d] = dia.split("-").map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d));
  const desdeLunes = (fecha.getUTCDay() + 6) % 7; // domingo=0 -> 6
  fecha.setUTCDate(fecha.getUTCDate() - desdeLunes);
  return fecha.toISOString().slice(0, 10);
}

// Clave del periodo al que pertenece un instante:
//   dia -> "2026-09-20"   semana -> "2026-09-14" (el lunes)   mes -> "2026-09"
export function clavePeriodo(instante, granularidad) {
  const dia = diaEnHospital(instante);
  if (granularidad === "dia") return dia;
  if (granularidad === "semana") return lunesDeLaSemana(dia);
  return dia.slice(0, 7);
}
