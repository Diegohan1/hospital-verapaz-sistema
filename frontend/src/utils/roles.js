// Roles tal como los devuelve el backend (backend/src/utils/roles.util.js)
export const ROLES = {
  ADMIN: "Administrador",
  RECEPCION: "Recepcion",
  CONSULTA: "Consulta",
  ENFERMERIA: "Enfermeria",
  FACTURACION: "Facturacion",
  FARMACIA: "Farmacia",
};

export const ROLE_LABELS = {
  Administrador: "Administrador",
  Recepcion: "Recepción / Admisión",
  Consulta: "Personal de Consulta",
  Enfermeria: "Enfermería / Secretaría",
  Facturacion: "Facturación",
  Farmacia: "Farmacia",
};

// Un usuario puede tener mas de un rol a la vez (ej. Recepcion + Facturacion).
// true si alguno de los roles del usuario esta entre los permitidos.
export function tieneRol(usuario, ...rolesPermitidos) {
  return (usuario?.roles || []).some((r) => rolesPermitidos.includes(r));
}

export function etiquetasRoles(roles) {
  return (roles || []).map((r) => ROLE_LABELS[r] || r).join(", ");
}

// Modulos del menu lateral que puede ver cada rol. El Administrador ve
// todos. Recepcion (secretaria de admision), Enfermeria (secretaria) y
// Consulta (doctor) trabajan unicamente con Registro y Expediente Clinico.
// El resto de roles conserva los modulos de su area.
const MODULOS_POR_ROL = {
  [ROLES.ADMIN]: null, // null = todos
  [ROLES.RECEPCION]: ["registro", "expediente"],
  [ROLES.ENFERMERIA]: ["registro", "expediente"],
  [ROLES.CONSULTA]: ["registro", "expediente"],
  [ROLES.FACTURACION]: ["registro", "expediente", "financiera", "gastos", "referidos"],
  [ROLES.FARMACIA]: ["registro", "farmacia"],
};

// Devuelve el conjunto de modulos permitidos para el usuario, o null si
// puede ver todos (Administrador). Si tiene varios roles, se suman sus
// permisos.
export function modulosPermitidos(usuario) {
  const roles = usuario?.roles || [];
  if (roles.includes(ROLES.ADMIN)) return null;
  const permitidos = new Set();
  for (const rol of roles) {
    const modulos = MODULOS_POR_ROL[rol];
    if (!modulos) continue;
    for (const m of modulos) permitidos.add(m);
  }
  // Un usuario sin rol reconocido no ve ningun modulo (minimo privilegio).
  return permitidos;
}

// true si el usuario puede entrar al modulo indicado (clave del menu).
export function puedeVerModulo(usuario, modulo) {
  const permitidos = modulosPermitidos(usuario);
  if (permitidos === null) return true;
  return permitidos.has(modulo);
}
