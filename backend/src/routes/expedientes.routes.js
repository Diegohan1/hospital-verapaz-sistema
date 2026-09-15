import { Router } from "express";
import * as controller from "../controllers/expedientes.controller.js";
import * as anexos from "../controllers/anexos.controller.js";
import { requireAuth, requireTempToken } from "../middlewares/auth.middleware.js";

// Modulo 2: Expediente Clinico. El diagnostico esta protegido por
// requireTempToken: solo Administrador o quien tenga un token de acceso
// temporal vigente puede leerlo o escribirlo (RF-10, RF-11, RF-33, RF-34).
// Sprint 4: los anexos y expedientes escaneados del paciente comparten la
// misma autorizacion clinica.
const router = Router();

router.use(requireAuth);

router.get("/", controller.listar); // metadatos, sin contenido del diagnostico
router.get("/paciente/:id", requireTempToken, controller.obtenerUno);
// Cada registro es una entrada nueva (no se sobrescribe): mantiene un
// historial auditable de quien registro o corrigio el diagnostico (RNF-08).
router.post("/paciente/:id", controller.uploadEstudios, requireTempToken, controller.crear);

// Sprint 4: anexos y expedientes escaneados a nivel de paciente
router.get("/anexos/paciente/:id", requireTempToken, anexos.listarAnexos);
router.post("/anexos/paciente/:id", anexos.uploadAnexos, requireTempToken, anexos.subirAnexos);
// El parametro se llama anexoId (no "id") a proposito: requireTempToken
// compara req.params.id contra el pacienteId del token, y aqui el recurso
// de la ruta es el anexo, no el paciente. Con otro nombre de parametro el
// middleware no intenta ese cotejo y se deja la verificacion (correcta) que
// ya hace el propio controlador comparando anexo.pacienteId.
router.get("/anexos/:anexoId/descargar", requireTempToken, anexos.descargarAnexo);

export default router;
