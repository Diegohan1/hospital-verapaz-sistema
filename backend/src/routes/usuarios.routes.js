import { Router } from "express";
import * as controller from "../controllers/usuarios.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { ROLES } from "../utils/roles.util.js";

// Modulo 8: Seguridad y Roles. Gestion de usuarios, solo Administrador (RF-32, RF-34).
// Sprint 5: el catalogo de medicos (/medicos) queda antes de la restriccion
// de Administrador porque lo necesitan los roles clinicos para elegir el
// medico responsable de una receta.
const router = Router();

router.use(requireAuth);
router.get("/medicos", controller.listarMedicos);
router.use(requireRole(ROLES.ADMIN));

router.get("/", controller.listar);
router.get("/:id", controller.obtenerUno);
router.post("/", controller.crear);
router.put("/:id", controller.actualizar);

export default router;
