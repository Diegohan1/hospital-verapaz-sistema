import { Router } from "express";
import * as controller from "../controllers/farmacia.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { ROLES } from "../utils/roles.util.js";

// Modulo 6: Farmacia (inventario y ventas propias). Actor: Farmacia.
const router = Router();

router.use(requireAuth);

const soloFarmacia = requireRole(ROLES.FARMACIA, ROLES.ADMIN);

// Rutas de venta directa (carrito) van antes de "/:id" para que "ventas"
// no se interprete como un id de medicamento.
router.get("/ventas", soloFarmacia, controller.listarVentas);
router.post("/ventas", soloFarmacia, controller.registrarVenta); // RF-20/RF-24/RF-27
router.get("/ventas/:id", requireRole(ROLES.ADMIN, ROLES.FARMACIA, ROLES.FACTURACION), controller.obtenerVenta); // para la vista imprimible

router.get("/", soloFarmacia, controller.listar); // RF-22
router.get("/:id", soloFarmacia, controller.obtenerUno);
router.post("/", soloFarmacia, controller.crear);
router.put("/:id", soloFarmacia, controller.actualizar);
router.post("/:id/entradas", soloFarmacia, controller.registrarEntrada); // RF-23
router.post("/:id/salidas", soloFarmacia, controller.registrarSalida); // RF-24/RF-15 (uso intrahospitalario)

export default router;
