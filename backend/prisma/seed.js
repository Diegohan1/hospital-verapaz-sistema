// Datos iniciales para poder probar el sistema de punta a punta.
// Ejecutar con: npm run prisma:seed
import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { ROLES } from "../src/utils/roles.util.js";
import { CIE10_CATALOGO } from "./data/cie10.js";

const prisma = new PrismaClient();

async function usuario(nombre, correo, password, roles, extra = {}) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.usuario.upsert({
    where: { correo },
    update: {},
    create: { nombre, correo, passwordHash, roles, ...extra },
  });
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@hospitalverapaz.gt";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "CambiarEsta123";

  await usuario("Administrador General", adminEmail, adminPassword, [ROLES.ADMIN]);
  await usuario("Recepción / Admisión", "recepcion@hospitalverapaz.gt", "Recepcion123", [ROLES.RECEPCION]);
  // Sprint 1/5: medicos de prueba con numero de colegiado y especialidad
  await usuario("Dra. Ana Choc", "aChoc@hospitalverapaz.gt", "Consulta123", [ROLES.CONSULTA], {
    puedeAutogenerarToken: true, // RF-34
    colegiado: "C-12345",
    especialidad: "Medicina Interna",
  });
  await usuario("Dr. Luis Pop", "lPop@hospitalverapaz.gt", "Consulta123", [ROLES.CONSULTA], {
    colegiado: "C-67890",
    especialidad: "Cirugía General",
  });
  await usuario("Enfermería Turno Mañana", "enfermeria@hospitalverapaz.gt", "Enfermeria123", [ROLES.ENFERMERIA]);
  // ejemplo de un usuario con mas de un rol a la vez
  await usuario("Facturación", "facturacion@hospitalverapaz.gt", "Facturacion123", [ROLES.FACTURACION, ROLES.RECEPCION]);
  await usuario("Farmacia", "farmacia@hospitalverapaz.gt", "Farmacia123", [ROLES.FARMACIA]);

  await prisma.medicamentoInventario.createMany({
    data: [
      { nombre: "Paracetamol 500mg", tipo: "Analgésico", stock: 320, stockMinimo: 50, precioVenta: 2.5, proveedor: "Farmaquímica S.A." },
      { nombre: "Amoxicilina 500mg", tipo: "Antibiótico", stock: 8, stockMinimo: 20, precioVenta: 4.0, proveedor: "Distribuidora Cobán" },
      { nombre: "Insulina Glargina", tipo: "Hormona", stock: 15, stockMinimo: 10, precioVenta: 85.0, proveedor: "MedSupply GT", fechaVencimiento: new Date("2026-09-01") },
    ],
    skipDuplicates: true,
  });

  await prisma.catalogoCie10.createMany({ data: CIE10_CATALOGO, skipDuplicates: true });

  console.log("Seed completado.");
  console.log(`Administrador: ${adminEmail} / ${adminPassword}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
