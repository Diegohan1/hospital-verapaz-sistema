import "dotenv/config";
import "./config/env.js"; // valida variables criticas al arranque (falla rapido)
import "express-async-errors"; // permite que los errores en controladores async lleguen al errorHandler
import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import usuariosRoutes from "./routes/usuarios.routes.js";
import pacientesRoutes from "./routes/pacientes.routes.js";
import expedientesRoutes from "./routes/expedientes.routes.js";
import tratamientosRoutes from "./routes/tratamientos.routes.js";
import recetasRoutes from "./routes/recetas.routes.js";
import referidosRoutes from "./routes/referidos.routes.js";
import facturacionRoutes from "./routes/facturacion.routes.js";
import farmaciaRoutes from "./routes/farmacia.routes.js";
import bitacoraRoutes from "./routes/bitacora.routes.js";
import reportesRoutes from "./routes/reportes.routes.js";
import cie10Routes from "./routes/cie10.routes.js";
import { prisma } from "./config/prisma.js";

const app = express();

app.use(cors());
app.use(express.json());

// Rutas por modulo (RF-01 a RF-36, ver docs/Estructura_y_Requerimientos.docx)
app.use("/api/auth", authRoutes);               // Modulo 8 - Seguridad y Roles
app.use("/api/usuarios", usuariosRoutes);       // Modulo 8 - Seguridad y Roles
app.use("/api/pacientes", pacientesRoutes);     // Modulo 1 - Registro y Admision
app.use("/api/expedientes", expedientesRoutes); // Modulo 2 - Expediente Clinico
app.use("/api/tratamientos", tratamientosRoutes); // Modulo 3 - Tratamiento
app.use("/api/recetas", recetasRoutes);         // Modulo 3 - Recetas medicas
app.use("/api/referidos", referidosRoutes);     // Modulo 4 - Clientes Referidos
app.use("/api/facturacion", facturacionRoutes); // Modulo 5 - Area Financiera
app.use("/api/farmacia", farmaciaRoutes);       // Modulo 6 - Farmacia
app.use("/api/bitacora", bitacoraRoutes);       // Modulo 7 - Bitacora de Visitas
app.use("/api/reportes", reportesRoutes);       // Modulo 9 - Reportes
app.use("/api/cie10", cie10Routes);             // Catalogo de codigos CIE-10

// Sprint 8: healthcheck con verificacion de la base de datos, para que el
// orchestrator (docker compose) y el smoke test post-despliegue detecten
// tanto caida de la API como perdida de conexion con PostgreSQL.
app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "ok" });
  } catch {
    res.status(503).json({ status: "degraded", db: "error" });
  }
});

// Manejador de errores centralizado (captura errores lanzados por los
// controladores async gracias a express-async-errors)
app.use((err, req, res, next) => {
  if (err.code === "P2002") {
    return res.status(409).json({ error: "Ya existe un registro con ese valor único" });
  }
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(422).json({ error: "El archivo excede el tamaño máximo permitido" });
  }
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Error interno del servidor" });
});

export default app;
