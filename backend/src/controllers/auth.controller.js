// Controlador: Autenticacion y tokens de acceso temporal (Modulo 8)
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "../config/prisma.js";
import { ROLES } from "../utils/roles.util.js";
import { registrarActividad } from "../services/actividad.service.js";
import { enviarEnlaceRecuperacion, construirEnlaceReset } from "../services/notificacion.service.js";
import { PASSWORD_RESET_EXPIRES_MIN, PASSWORD_RESET_EXPOSE_TOKEN } from "../config/env.js";

function firmarSesion(usuario) {
  return jwt.sign(
    { id: usuario.id, nombre: usuario.nombre, roles: usuario.roles },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
  );
}

// RF-29: inicio de sesion con usuario y contrasena
export async function login(req, res) {
  const { correo, password } = req.body;
  if (!correo || !password) {
    return res.status(400).json({ error: "Correo y contraseña son requeridos" });
  }

  const usuario = await prisma.usuario.findUnique({ where: { correo } });
  if (!usuario) return res.status(401).json({ error: "Credenciales invalidas" });

  const passwordValida = await bcrypt.compare(password, usuario.passwordHash);
  if (!passwordValida) return res.status(401).json({ error: "Credenciales invalidas" });

  await prisma.usuario.update({ where: { id: usuario.id }, data: { ultimaActividad: new Date() } });
  await registrarActividad(usuario.id, "login", `${usuario.nombre} inició sesión`);

  res.json({
    token: firmarSesion(usuario),
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      correo: usuario.correo,
      roles: usuario.roles,
      puedeAutogenerarToken: usuario.puedeAutogenerarToken,
    },
  });
}

// Registra la hora de salida. El JWT sigue siendo valido hasta que expire
// (no hay lista de revocacion), pero queda constancia de cuando el usuario
// decidio cerrar sesion.
export async function logout(req, res) {
  await registrarActividad(req.user.id, "logout", "Cierre de sesión");
  res.json({ ok: true });
}

// Sprint 2: solicitud de recuperacion de contrasena. Respuesta
// anti-enumeracion: siempre devuelve el mismo mensaje y codigo, exista o no
// el correo, para no revelar que cuentas tienen acceso al sistema.
// Se guarda solo el hash SHA-256 del token; el token en claro viaja unicamente
// por el canal de notificacion (o, en laboratorio, en la respuesta).
export async function forgotPassword(req, res) {
  const { correo } = req.body;
  const respuestaGenerica = { ok: true, mensaje: "Si el correo corresponde a una cuenta, se envió un enlace de recuperación. El enlace expira en 30 minutos." };

  if (!correo) return res.status(400).json({ error: "correo es requerido" });

  const usuario = await prisma.usuario.findUnique({ where: { correo } });
  if (!usuario) return res.json(respuestaGenerica);

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiraEn = new Date(Date.now() + PASSWORD_RESET_EXPIRES_MIN * 60 * 1000);

  await prisma.passwordResetToken.create({ data: { usuarioId: usuario.id, tokenHash, expiraEn } });
  await registrarActividad(usuario.id, "solicitar_reset_password", `Enlace de recuperación solicitado para ${usuario.correo}`);

  const enlace = construirEnlaceReset(token);
  const entrega = await enviarEnlaceRecuperacion({ correo: usuario.correo, nombre: usuario.nombre, enlace });

  // Solo en laboratorio (PASSWORD_RESET_EXPOSE_TOKEN=true): devolver el token
  // para poder probar el flujo sin proveedor de correo. En produccion debe
  // ser false y el token llega unicamente por el canal contratado.
  if (PASSWORD_RESET_EXPOSE_TOKEN) {
    return res.json({ ...respuestaGenerica, token, modoEntrega: entrega.modo });
  }
  res.json(respuestaGenerica);
}

// Sprint 2: cambio de contrasena con el token de recuperacion. El token se
// busca por hash, debe estar vigente y no usado; se consume en la misma
// transaccion que cambia la contrasena para que no pueda reutilizarse.
export async function resetPassword(req, res) {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ error: "token y password son requeridos" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres" });
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const registro = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!registro) return res.status(400).json({ error: "Token inválido o no entregado" });
  if (registro.usado) return res.status(400).json({ error: "El token ya fue utilizado" });
  if (registro.expiraEn < new Date()) return res.status(400).json({ error: "El token ha expirado" });

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.$transaction([
    prisma.usuario.update({ where: { id: registro.usuarioId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: registro.id }, data: { usado: true } }),
  ]);

  await registrarActividad(registro.usuarioId, "reset_password", "Contraseña restablecida con token de recuperación");
  res.json({ ok: true, mensaje: "Contraseña actualizada. Ya puede iniciar sesión." });
}

async function emitirToken({ usuarioId, pacienteId, emitidoPor }) {
  const minutos = Number(process.env.TEMP_TOKEN_EXPIRES_MIN || 15);
  const token = crypto.randomBytes(24).toString("hex");
  const expiraEn = new Date(Date.now() + minutos * 60 * 1000);

  const registro = await prisma.tokenTemporal.create({
    data: { token, usuarioId, pacienteId: pacienteId ?? null, emitidoPor, expiraEn },
  });

  return { token: registro.token, expiraEn: registro.expiraEn };
}

// RF-33: el Administrador genera un token temporal para otro usuario
export async function solicitarTokenTemporal(req, res) {
  const { usuarioId, pacienteId } = req.body;
  if (!usuarioId) return res.status(400).json({ error: "usuarioId es requerido" });

  const usuarioDestino = await prisma.usuario.findUnique({ where: { id: Number(usuarioId) } });
  if (!usuarioDestino) return res.status(404).json({ error: "Usuario no encontrado" });

  const resultado = await emitirToken({
    usuarioId: Number(usuarioId),
    pacienteId: pacienteId ? Number(pacienteId) : null,
    emitidoPor: req.user.id,
  });
  res.status(201).json({ ok: true, ...resultado });
}

// RF-34: un usuario con permiso se autogenera su propio token
export async function autogenerarTokenTemporal(req, res) {
  const { pacienteId } = req.body;

  const usuario = await prisma.usuario.findUnique({ where: { id: req.user.id } });
  if (!usuario?.puedeAutogenerarToken && !usuario?.roles?.includes(ROLES.ADMIN)) {
    return res.status(403).json({ error: "No tiene permiso para autogenerar tokens. Solicítelo al Administrador" });
  }

  const resultado = await emitirToken({
    usuarioId: usuario.id,
    pacienteId: pacienteId ? Number(pacienteId) : null,
    emitidoPor: usuario.id,
  });
  res.status(201).json({ ok: true, ...resultado });
}
