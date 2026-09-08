import { Router } from "express";
import * as controller from "../controllers/reportes.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { ROLES } from "../utils/roles.util.js";

// Modulo 9: Reportes administrativos y financieros. Actor: Administrador (RF-31).
const router = Router();

router.use(requireAuth, requireRole(ROLES.ADMIN));

router.get("/financiero", controller.financiero); // RF-21
router.get("/ingresos-por-mes", controller.ingresosPorMes);
router.get("/admisiones", controller.admisiones);
router.get("/facturacion-por-forma-pago", controller.facturacionPorFormaPago);
router.get("/inventario-kardex", controller.inventarioKardex); // RNF-10
router.get("/auditoria-diagnostico", controller.auditoriaDiagnostico); // RNF-08
router.get("/actividad", controller.actividad); // Sprint 7: bitacora general administrativa

export default router;
