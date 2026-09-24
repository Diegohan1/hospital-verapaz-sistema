// Fusion Anexos + Documentos escaneados (decision del 23/09/2026): ambos
// modulos guardaban lo mismo -- un archivo suelto del paciente sin
// estructura clinica -- con dos tablas, dos APIs y dos niveles de proteccion
// distintos. Este script migra cada fila de AnexoPaciente a DocumentoPaciente
// (la tabla que sobrevive, ya tenia checksum y borrado logico) antes de que
// la migracion de Prisma elimine la tabla anexo_paciente.
//
// Por cada anexo: descifra el archivo, lo vuelve a cifrar en
// uploads/documentos con un nombre interno nuevo, calcula su checksum y crea
// la fila DocumentoPaciente equivalente (registradoPor queda a nombre del
// primer Administrador, porque AnexoPaciente nunca guardo quien lo subio).
// Solo despues de confirmar la fila nueva borra el anexo y su archivo fisico.
//
// IMPORTANTE: este script lee y borra la tabla AnexoPaciente por SQL crudo
// ($queryRaw/$executeRaw), no por el cliente generado de Prisma -- porque
// para cuando se corre, schema.prisma ya no declara ese modelo (se quito
// junto con esta fusion) y "npx prisma generate" ya lo elimino del cliente.
// Solo DocumentoPaciente y Usuario, que si siguen en el esquema, se tocan
// por el cliente normal.
//
// Uso: npm run migrar-anexos   (requiere backend/.env con ENCRYPTION_KEY)
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { leerArchivoCifrado } from "../src/utils/crypto.util.js";
import { guardarArchivoCifrado } from "../src/utils/archivos.util.js";
import { ENCRYPTION_KEY } from "../src/config/env.js";
import { ROLES } from "../src/utils/roles.util.js";

const prisma = new PrismaClient();
const ANEXOS_DIR = path.join(process.cwd(), "uploads", "anexos");
const DOCUMENTOS_DIR = path.join(process.cwd(), "uploads", "documentos");

function checksum(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function main() {
  // to_regclass() devuelve el tipo "regclass"; Prisma no lo puede
  // deserializar directo (P2010), asi que se castea a texto.
  const tablaExiste = await prisma.$queryRaw`SELECT to_regclass('public."AnexoPaciente"')::text AS existe`;
  if (!tablaExiste[0]?.existe) {
    console.log("La tabla AnexoPaciente ya no existe (la migracion de Prisma ya corrio antes). Nada que hacer.");
    return;
  }

  const anexos = await prisma.$queryRaw`SELECT * FROM "AnexoPaciente"`;
  if (!anexos.length) {
    console.log("No hay anexos que migrar.");
    return;
  }

  const admin = await prisma.usuario.findFirst({ where: { roles: { has: ROLES.ADMIN } }, select: { id: true } });
  if (!admin) throw new Error("No hay ningun Administrador en la base; se necesita uno para asignar registradoPor.");

  let migrados = 0;
  let fallidos = 0;

  for (const anexo of anexos) {
    try {
      const ruta = path.join(ANEXOS_DIR, anexo.nombreArchivo);
      const original = leerArchivoCifrado(ruta, ENCRYPTION_KEY);
      const nombreArchivo = guardarArchivoCifrado(original, DOCUMENTOS_DIR, ENCRYPTION_KEY);

      await prisma.documentoPaciente.create({
        data: {
          pacienteId: anexo.pacienteId,
          nombreOriginal: anexo.nombreOriginal,
          nombreArchivo,
          mimeType: anexo.mimeType,
          tamano: anexo.tamano,
          checksum: checksum(original),
          paginas: 1,
          tipoDocumental: null, // Anexo no distinguia subtipo
          registradoPor: admin.id,
          creadoEn: anexo.creadoEn, // conserva la fecha original de carga
        },
      });

      fs.rmSync(ruta, { force: true });
      await prisma.$executeRaw`DELETE FROM "AnexoPaciente" WHERE id = ${anexo.id}`;
      migrados++;
      console.log(`Migrado: anexo #${anexo.id} (${anexo.nombreOriginal}, paciente ${anexo.pacienteId}) -> documento nuevo`);
    } catch (err) {
      fallidos++;
      console.error(`FALLO: anexo #${anexo.id} (${anexo.nombreOriginal}): ${err.message}`);
    }
  }

  console.log(`\nResumen: ${migrados} migrados, ${fallidos} fallidos de ${anexos.length} anexos.`);
  if (fallidos) console.log("Revise los fallos antes de aplicar la migracion de Prisma que elimina anexo_paciente.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
