import { Router } from "express";
import multer from "multer";
import * as controller from "../controllers/escaneoMovil.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { ROLES } from "../utils/roles.util.js";

const router = Router();
const uploadPdf = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }).single("documento");

// Computadora (autenticada): crea la sesion y recoge el resultado.
router.post("/sesiones", requireAuth, requireRole(ROLES.RECEPCION, ROLES.ADMIN), controller.crear);
router.get("/sesiones/:id/estado", requireAuth, controller.estado);
router.get("/sesiones/:id/pdf", requireAuth, controller.obtenerPdf);
router.delete("/sesiones/:id", requireAuth, controller.cancelar);

// Telefono (sin login; autorizado solo por conocer el id de sesion, como un
// enlace de un solo uso vigente 10 minutos).
router.get("/sesiones/:id/info", controller.info);
router.post("/sesiones/:id/subir", uploadPdf, controller.subirPdf);

export default router;
