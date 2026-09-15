import { Router } from "express";
import * as controller from "../controllers/auth.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { createRateLimiter } from "../middlewares/rate-limit.middleware.js";
import { ROLES } from "../utils/roles.util.js";

// Modulo 8: Seguridad y Roles (RF-29, RF-30, RF-33, RF-34)
const router = Router();

// Sprint 2: limite de intentos por IP en los endpoints publicos de
// autenticacion; responde 429 con Retry-After.
const loginLimiter = createRateLimiter({ windowMs: 5 * 60 * 1000, max: 10, mensaje: "Demasiados intentos de inicio de sesión. Espere antes de volver a intentar" });
const resetLimiter = createRateLimiter({ windowMs: 5 * 60 * 1000, max: 5, mensaje: "Demasiadas solicitudes de recuperación. Espere antes de volver a intentar" });

router.post("/login", loginLimiter, controller.login);
router.post("/forgot-password", resetLimiter, controller.forgotPassword);
router.post("/reset-password", resetLimiter, controller.resetPassword);
router.post("/logout", requireAuth, controller.logout);
router.post("/token", requireAuth, requireRole(ROLES.ADMIN), controller.solicitarTokenTemporal); // RF-33
router.post("/token/auto", requireAuth, controller.autogenerarTokenTemporal); // RF-34

export default router;
