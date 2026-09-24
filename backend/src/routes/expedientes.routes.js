import { Router } from "express";
import * as controller from "../controllers/expedientes.controller.js";
import { requireAuth, requireTempToken } from "../middlewares/auth.middleware.js";

// Modulo 2: Expediente Clinico. El diagnostico esta protegido por
// requireTempToken: solo Administrador o quien tenga un token de acceso
// temporal vigente puede leerlo o escribirlo (RF-10, RF-11, RF-33, RF-34).
//
// Los anexos y expedientes escaneados que antes vivian aqui (Sprint 4) se
// fusionaron el 23/09/2026 con el modulo de Documentos del paciente: ambos
// guardaban lo mismo (un archivo suelto sin estructura clinica) con dos
// APIs distintas. Ver /pacientes/:id/documentos en pacientes.routes.js.
const router = Router();

router.use(requireAuth);

router.get("/", controller.listar); // metadatos, sin contenido del diagnostico
router.get("/paciente/:id", requireTempToken, controller.obtenerUno);
// Cada registro es una entrada nueva (no se sobrescribe): mantiene un
// historial auditable de quien registro o corrigio el diagnostico (RNF-08).
router.post("/paciente/:id", controller.uploadEstudios, requireTempToken, controller.crear);

export default router;
