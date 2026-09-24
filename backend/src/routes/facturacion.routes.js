import { Router } from "express";
import * as controller from "../controllers/facturacion.controller.js";
import * as gastos from "../controllers/gastos.controller.js";
import * as categoriasFiscales from "../controllers/categoriasFiscales.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { ROLES } from "../utils/roles.util.js";

// Modulo 5: Area Financiera - Facturacion Hospital. Actor: Facturacion.
const router = Router();

router.use(requireAuth);

router.get("/reporte", requireRole(ROLES.ADMIN, ROLES.FACTURACION), controller.reporte); // RF-21
router.get("/costeo/:pacienteId", requireRole(ROLES.ADMIN, ROLES.FACTURACION), controller.costeoPaciente); // Sprint 6

// 23/09/2026: Gastos del Hospital + catalogo de categorias fiscales. Van
// antes de "/:id" para que Express no confunda "/gastos" con un id de
// factura. Mismo actor que la facturacion (Facturacion/Administrador);
// el catalogo de categorias tambien lo puede editar Administrador.
router.get("/gastos", requireRole(ROLES.ADMIN, ROLES.FACTURACION), gastos.listar);
router.post("/gastos", requireRole(ROLES.ADMIN, ROLES.FACTURACION), gastos.crear);
router.delete("/gastos/:id", requireRole(ROLES.ADMIN, ROLES.FACTURACION), gastos.eliminar);
router.get("/categorias-fiscales", requireRole(ROLES.ADMIN, ROLES.FACTURACION), categoriasFiscales.listar);
router.post("/categorias-fiscales", requireRole(ROLES.ADMIN), categoriasFiscales.crear);
router.put("/categorias-fiscales/:id", requireRole(ROLES.ADMIN), categoriasFiscales.actualizar);

router.get("/", controller.listar);
router.get("/:id", controller.obtenerUno);
router.post("/", requireRole(ROLES.FACTURACION, ROLES.ADMIN), controller.crear); // RF-17/18/19

export default router;
