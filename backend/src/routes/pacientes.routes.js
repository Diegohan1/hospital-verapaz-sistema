import { Router } from "express";
import * as controller from "../controllers/pacientes.controller.js";
import * as documentos from "../controllers/documentos.controller.js";
import * as lectura from "../controllers/lecturaExpediente.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { ROLES } from "../utils/roles.util.js";

// Modulo 1: Registro y Admision. Actor principal: Recepcion/Admision.
const router = Router();

router.use(requireAuth);

router.get("/", controller.listar);

// Dev-Mari: lectura avanzada (modelo de vision) de la ficha escaneada.
// Opcional y apagada por defecto (requiere ANTHROPIC_API_KEY en el servidor).
router.get("/lectura-avanzada/estado", requireRole(ROLES.RECEPCION, ROLES.ADMIN), lectura.estado);
router.post("/leer-expediente", requireRole(ROLES.RECEPCION, ROLES.ADMIN), lectura.uploadImagen, lectura.leer);

router.get("/:id", controller.obtenerUno);
// Dev-Mari: el PDF del expediente escaneado (si lo hay) es opcional y
// viaja en el mismo POST del registro del paciente (multipart/form-data).
// uploadDocumento no exige el archivo: si la peticion es JSON normal
// (registro manual, sin escaneo), multer no hace nada y sigue de largo.
router.post("/", requireRole(ROLES.RECEPCION, ROLES.ADMIN), documentos.uploadDocumento, controller.crear);
router.put("/:id", requireRole(ROLES.RECEPCION, ROLES.ADMIN), controller.actualizar);

// Cambios2 Sprint 5: documentos escaneados del paciente (PDF del escaner).
// Escritura: Recepcion/Administracion. Lectura: personal clinico y admision.
router.get("/:id/documentos", requireRole(ROLES.ADMIN, ROLES.RECEPCION, ROLES.CONSULTA, ROLES.ENFERMERIA), documentos.listar);
router.get(
  "/:id/documentos/:documentoId",
  requireRole(ROLES.ADMIN, ROLES.RECEPCION, ROLES.CONSULTA, ROLES.ENFERMERIA),
  documentos.descargar
);
router.post(
  "/:id/documentos",
  requireRole(ROLES.RECEPCION, ROLES.ADMIN),
  documentos.uploadDocumento,
  documentos.subir
);
router.delete(
  "/:id/documentos/:documentoId",
  requireRole(ROLES.RECEPCION, ROLES.ADMIN),
  documentos.eliminar
);

export default router;
