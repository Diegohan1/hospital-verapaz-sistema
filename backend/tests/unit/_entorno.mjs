// Variables minimas para importar modulos que validan el entorno al cargarse
// (config/env.js). Valores de prueba: no tocan ninguna base de datos real.
process.env.DATABASE_URL ||= "postgresql://prueba:prueba@localhost:5432/prueba";
process.env.JWT_SECRET ||= "secreto-de-prueba-para-tests";
process.env.ENCRYPTION_KEY = "0123456789abcdef".repeat(4); // 64 hex
process.env.HOSPITAL_TZ = "America/Guatemala";
process.env.HOSPITAL_UTC_OFFSET = "-06:00";
export const LLAVE = process.env.ENCRYPTION_KEY;
export const OTRA_LLAVE = "fedcba9876543210".repeat(4);
