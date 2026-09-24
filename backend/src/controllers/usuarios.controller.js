// Controlador: gestion de usuarios (Modulo 8 - Seguridad y Roles)
// Solo el Administrador puede listar, crear o reasignar roles/permisos (RF-32, RF-34).
// Un usuario puede tener mas de un rol a la vez (ej. Recepcion + Facturacion).
import bcrypt from "bcrypt";
import { prisma } from "../config/prisma.js";
import { ROLES, ROLES_VALIDOS } from "../utils/roles.util.js";
import { registrarActividad } from "../services/actividad.service.js";

const SELECT_PUBLICO = {
  id: true, nombre: true, correo: true, roles: true, puedeAutogenerarToken: true,
  colegiado: true, especialidad: true,
  ultimaActividad: true, creadoEn: true,
};

// Sprint 5: catalogo de medicos para el selector de recetas. Devuelve solo
// datos publicos del medico (nombre, colegiado, especialidad) de usuarios
// con rol clinico (Consulta). Un usuario sin rol clinico no puede
// seleccionarse como medico responsable.
const SELECT_MEDICO = {
  id: true, nombre: true, colegiado: true, especialidad: true, roles: true,
};

export async function listarMedicos(req, res) {
  const medicos = await prisma.usuario.findMany({
    where: { roles: { has: ROLES.CONSULTA } },
    select: SELECT_MEDICO,
    orderBy: { nombre: "asc" },
  });
  res.json(medicos);
}

function validarRoles(roles) {
  if (!Array.isArray(roles) || roles.length === 0) {
    return "roles es requerido (al menos un rol)";
  }
  const invalido = roles.find((r) => !ROLES_VALIDOS.includes(r));
  if (invalido) return `rol invalido: "${invalido}". Debe ser uno de: ${ROLES_VALIDOS.join(", ")}`;
  return null;
}

export async function listar(req, res) {
  const usuarios = await prisma.usuario.findMany({ select: SELECT_PUBLICO, orderBy: { nombre: "asc" } });
  res.json(usuarios);
}

export async function obtenerUno(req, res) {
  const usuario = await prisma.usuario.findUnique({ where: { id: Number(req.params.id) }, select: SELECT_PUBLICO });
  if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
  res.json(usuario);
}

export async function crear(req, res) {
  const { nombre, correo, password, roles, puedeAutogenerarToken, colegiado, especialidad } = req.body;
  if (!nombre || !correo || !password) {
    return res.status(400).json({ error: "nombre, correo y password son requeridos" });
  }
  const errorRoles = validarRoles(roles);
  if (errorRoles) return res.status(400).json({ error: errorRoles });

  const passwordHash = await bcrypt.hash(password, 10);
  const usuario = await prisma.usuario.create({
    data: {
      nombre, correo, passwordHash, roles,
      puedeAutogenerarToken: !!puedeAutogenerarToken,
      // Sprint 5: colegiado y especialidad solo aplican a usuarios clinicos
      colegiado: roles.includes(ROLES.CONSULTA) ? (colegiado || null) : null,
      especialidad: roles.includes(ROLES.CONSULTA) ? (especialidad || null) : null,
    },
    select: SELECT_PUBLICO,
  });
  await registrarActividad(req.user.id, "crear_usuario", `${usuario.nombre} (${usuario.roles.join(", ")})`);
  res.status(201).json(usuario);
}

// RF-32/RF-34: el Administrador reasigna roles y/o el permiso de autogenerar tokens
export async function actualizar(req, res) {
  const { nombre, roles, puedeAutogenerarToken, colegiado, especialidad } = req.body;
  if (roles !== undefined) {
    const errorRoles = validarRoles(roles);
    if (errorRoles) return res.status(400).json({ error: errorRoles });
  }

  try {
    // Sprint 5: si el usuario no queda con el rol clinico, colegiado/especialidad
    // dejan de aplicar y se limpian en la misma escritura (no en una segunda,
    // para no dejar la actualizacion sin su registro de auditoria).
    let rolesFinales = roles;
    if (rolesFinales === undefined) {
      const existente = await prisma.usuario.findUnique({ where: { id: Number(req.params.id) }, select: { roles: true } });
      if (!existente) return res.status(404).json({ error: "Usuario no encontrado" });
      rolesFinales = existente.roles;
    }
    const debeLimpiarClinico = !rolesFinales.includes(ROLES.CONSULTA);

    const usuario = await prisma.usuario.update({
      where: { id: Number(req.params.id) },
      data: {
        nombre, roles, puedeAutogenerarToken,
        colegiado: debeLimpiarClinico ? null : colegiado,
        especialidad: debeLimpiarClinico ? null : especialidad,
      },
      select: SELECT_PUBLICO,
    });

    await registrarActividad(req.user.id, "actualizar_usuario", `${usuario.nombre} → roles: ${usuario.roles.join(", ")}, autogenera token: ${usuario.puedeAutogenerarToken}`);
    res.json(usuario);
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Usuario no encontrado" });
    throw err;
  }
}
