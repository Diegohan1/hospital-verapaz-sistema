// Sprint 1: migracion de datos historicos de egreso. Lee las columnas legacy
// de texto plano en Paciente (diagnosticoEgresoCodigo, complicacionesCodigo,
// operacionesCodigo, autopsia, causaMuerte), arma el payload JSON, lo cifra
// con AES-256-GCM y crea la fila EgresoClinico correspondiente. No elimina
// las columnas antiguas: eso queda para una migracion posterior, despues de
// validar conteos y con aprobacion (ver plan, seccion 7, riesgo 1).
//
// Uso: npm run migrar-egreso   (requiere backend/.env con DATABASE_URL y ENCRYPTION_KEY)
//
// El script es idempotente: si el paciente ya tiene EgresoClinico, se omite.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { encrypt } from "../src/utils/crypto.util.js";
import { ENCRYPTION_KEY } from "../src/config/env.js";

const prisma = new PrismaClient();

function payloadDesde(paciente) {
  const payload = {};
  let tieneDatos = false;
  if (paciente.diagnosticoEgresoCodigo != null) { payload.diagnosticoEgreso = paciente.diagnosticoEgresoCodigo; tieneDatos = true; }
  if (paciente.complicacionesCodigo != null) { payload.complicaciones = paciente.complicacionesCodigo; tieneDatos = true; }
  if (paciente.operacionesCodigo != null) { payload.operaciones = paciente.operacionesCodigo; tieneDatos = true; }
  if (paciente.autopsia != null) { payload.autopsia = paciente.autopsia; tieneDatos = true; }
  if (paciente.causaMuerte != null) { payload.causaMuerte = paciente.causaMuerte; tieneDatos = true; }
  return tieneDatos ? payload : null;
}

async function main() {
  const pacientes = await prisma.paciente.findMany({
    where: { egresoClinico: null },
    select: {
      id: true, nombreCompleto: true, historiaClinica: true,
      diagnosticoEgresoCodigo: true, complicacionesCodigo: true,
      operacionesCodigo: true, autopsia: true, causaMuerte: true,
    },
  });

  let migrados = 0;
  let omitidos = 0;
  for (const paciente of pacientes) {
    const payload = payloadDesde(paciente);
    if (!payload) { omitidos++; continue; }
    const { encrypted, iv, authTag } = encrypt(JSON.stringify(payload), ENCRYPTION_KEY);
    await prisma.egresoClinico.create({
      data: { pacienteId: paciente.id, textoCifrado: encrypted, iv, authTag },
    });
    migrados++;
    console.log(`Migrado: ${paciente.historiaClinica} - ${paciente.nombreCompleto}`);
  }

  console.log(`\nResumen: ${migrados} pacientes migrados, ${omitidos} sin datos de egreso, ${pacientes.length - migrados - omitidos} ya tenian egreso clinico.`);
  console.log("Verifique los conteos antes de aplicar la migracion que elimina las columnas legacy.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
