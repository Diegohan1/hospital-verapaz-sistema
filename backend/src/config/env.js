// Sprint 1: validacion de variables de entorno al arranque. Falla rapido y
// con mensaje claro si falta algo critico, en lugar de fallar despues con
// errores cripticos en medio de una peticion.
const errores = [];

if (!process.env.DATABASE_URL) {
  errores.push("DATABASE_URL es requerida (postgresql://usuario:password@host:5432/hospital_verapaz)");
}

if (!process.env.JWT_SECRET) {
  errores.push("JWT_SECRET es requerido para firmar las sesiones");
} else if (process.env.JWT_SECRET.length < 16) {
  errores.push("JWT_SECRET debe tener al menos 16 caracteres");
}

if (!process.env.ENCRYPTION_KEY) {
  errores.push("ENCRYPTION_KEY es requerido para el cifrado clinico (AES-256-GCM)");
} else if (!/^[0-9a-fA-F]{64}$/.test(process.env.ENCRYPTION_KEY)) {
  errores.push("ENCRYPTION_KEY debe ser una llave de 32 bytes en hexadecimal (exactamente 64 caracteres hex)");
}

if (errores.length) {
  console.error("Error de configuracion: faltan o son invalidas variables de entorno:");
  for (const e of errores) console.error(`  - ${e}`);
  console.error("Copie backend/.env.example a backend/.env y complete los valores antes de iniciar.");
  process.exit(1);
}

export const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
export const JWT_SECRET = process.env.JWT_SECRET;
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";
export const TEMP_TOKEN_EXPIRES_MIN = Number(process.env.TEMP_TOKEN_EXPIRES_MIN || 15);
export const PASSWORD_RESET_EXPIRES_MIN = Number(process.env.PASSWORD_RESET_EXPIRES_MIN || 30);
// Solo para laboratorio: expone el token de recuperacion en la respuesta de
// forgot-password mientras no haya proveedor de correo configurado.
export const PASSWORD_RESET_EXPOSE_TOKEN = process.env.PASSWORD_RESET_EXPOSE_TOKEN === "true";
// Limites de carga por tipo de archivo (MB), ajustables por configuracion.
// Los documentos del paciente (antes tambien "anexos", fusionados el
// 23/09/2026) usan DOCUMENT_MAX_MB, leida directamente en documentos.controller.js.
export const UPLOAD_MAX_MB_ESTUDIOS = Number(process.env.UPLOAD_MAX_MB_ESTUDIOS || 5);
