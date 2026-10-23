import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { ROLES } from "../utils/roles.util.js";

// Verifica que la peticion traiga un JWT valido (sesion iniciada) - RF-29
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "No autenticado" });

  try {
    const token = header.replace("Bearer ", "");
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Los roles se leen de la base en cada peticion, no solo del JWT: si al
    // usuario le cambiaron el rol (o el token quedo viejo), los permisos se
    // aplican de inmediato. Tambien evita que un Administrador siga viendo
    // como tal despues de que le quitaran el rol.
    const usuario = await prisma.usuario.findUnique({
      where: { id: payload.id },
      select: { id: true, nombre: true, roles: true },
    });
    if (!usuario) return res.status(401).json({ error: "Usuario no encontrado" });

    req.user = { ...payload, id: usuario.id, nombre: usuario.nombre, roles: usuario.roles };
    // "en linea": se actualiza sin bloquear la respuesta ni interrumpirla si falla
    prisma.usuario.update({ where: { id: req.user.id }, data: { ultimaActividad: new Date() } }).catch(() => {});
    next();
  } catch (err) {
    res.status(401).json({ error: "Token invalido o expirado" });
  }
}

// Restringe el acceso a ciertos roles (ej. solo Administrador) - RF-30/RF-32
// Un usuario puede tener varios roles a la vez: basta con que uno de los
// suyos coincida con alguno de los permitidos para esta ruta.
export function requireRole(...rolesPermitidos) {
  return (req, res, next) => {
    const rolesUsuario = req.user?.roles || [];
    const tienePermiso = rolesUsuario.some((r) => rolesPermitidos.includes(r));
    if (!tienePermiso) {
      return res.status(403).json({ error: "No tiene permiso para esta accion" });
    }
    next();
  };
}

// RF-11/RF-33/RF-34: exige un token de acceso temporal activo para ver o
// modificar el diagnostico confidencial. El Administrador tiene acceso
// permanente y no necesita token (RF-11). El token es de un solo uso y
// se marca como consumido al validarse (RNF-12).
export async function requireTempToken(req, res, next) {
  if (req.user?.roles?.includes(ROLES.ADMIN)) return next();

  const tokenValue = req.headers["x-temp-token"];
  if (!tokenValue) {
    return res.status(403).json({ error: "Requiere token de acceso temporal" });
  }

  const registro = await prisma.tokenTemporal.findUnique({ where: { token: tokenValue } });
  if (!registro) return res.status(403).json({ error: "Token invalido" });
  if (registro.usado) return res.status(403).json({ error: "El token ya fue utilizado" });
  if (registro.expiraEn < new Date()) return res.status(403).json({ error: "El token ha expirado" });
  if (registro.usuarioId !== req.user.id) {
    return res.status(403).json({ error: "El token no pertenece a este usuario" });
  }

  const pacienteId = req.params.id ? Number(req.params.id) : undefined;
  if (registro.pacienteId && pacienteId && registro.pacienteId !== pacienteId) {
    return res.status(403).json({ error: "El token no autoriza a este paciente" });
  }

  await prisma.tokenTemporal.update({ where: { id: registro.id }, data: { usado: true } });
  req.tempToken = registro;
  next();
}
