import { Router } from "express";
import * as controller from "../controllers/facturacion.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { ROLES } from "../utils/roles.util.js";

// Modulo 5: Area Financiera - Facturacion Hospital. Actor: Facturacion.
const router = Router();

router.use(requireAuth);

router.get("/reporte", requireRole(ROLES.ADMIN, ROLES.FACTURACION), controller.reporte); // RF-21
router.get("/costeo/:pacienteId", requireRole(ROLES.ADMIN, ROLES.FACTURACION), controller.costeoPaciente); // Sprint 6
router.get("/", controller.listar);
router.get("/:id", controller.obtenerUno);
router.post("/", requireRole(ROLES.FACTURACION, ROLES.ADMIN), controller.crear); // RF-17/18/19

export default router;
