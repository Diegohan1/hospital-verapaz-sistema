// Sprint 4: recifrado controlado de archivos historicos guardados en claro
// (antes de la migracion a sobres cifrados). Recorre uploads/diagnosticos,
// cifra cada archivo plano como enc_<random>.bin, valida el checksum del
// contenido descifrado contra el original y actualiza la fila
// DiagnosticoArchivo; el original en claro se elimina solo despues de
// validar. Idempotente: los archivos enc_* ya cifrados se omiten.
//
// Uso: npm run recifrar-archivos   (requiere backend/.env con ENCRYPTION_KEY)
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { encryptBuffer, decryptBuffer } from "../src/utils/crypto.util.js";
import { ENCRYPTION_KEY } from "../src/config/env.js";

const prisma = new PrismaClient();
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "diagnosticos");

function checksum(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function main() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    console.log("No existe el directorio de uploads; nada que recifrar.");
    return;
  }

  const archivos = fs.readdirSync(UPLOAD_DIR);
  const planos = archivos.filter((n) => !n.startsWith("enc_"));
  if (!planos.length) {
    console.log("Todos los archivos ya están cifrados. Nada que hacer.");
    return;
  }

  let recifrados = 0;
  let fallidos = 0;

  for (const nombre of planos) {
    const ruta = path.join(UPLOAD_DIR, nombre);
    try {
      const original = fs.readFileSync(ruta);

      // Buscar la fila correspondiente en la base
      const registro = await prisma.diagnosticoArchivo.findFirst({ where: { nombreArchivo: nombre } });
      if (!registro) {
        console.warn(`AVISO: "${nombre}" no tiene fila en DiagnosticoArchivo; se recifra igualmente pero quede pendiente de revisión.`);
      }

      // Cifrar y validar round-trip antes de eliminar el original
      const nuevoNombre = `enc_${crypto.randomBytes(24).toString("hex")}.bin`;
      const sobre = encryptBuffer(original, ENCRYPTION_KEY);
      fs.writeFileSync(path.join(UPLOAD_DIR, nuevoNombre), sobre);

      const descifrado = decryptBuffer(sobre, ENCRYPTION_KEY);
      if (checksum(descifrado) !== checksum(original)) {
        throw new Error("el checksum del contenido descifrado no coincide; no se elimina el original");
      }

      if (registro) {
        await prisma.diagnosticoArchivo.update({
          where: { id: registro.id },
          data: { nombreArchivo: nuevoNombre },
        });
      }

      // Eliminacion segura del original solo despues de validar el checksum
      fs.rmSync(ruta);
      recifrados++;
      console.log(`Recifrado: ${nombre} -> ${nuevoNombre}`);
    } catch (err) {
      fallidos++;
      console.error(`FALLO: ${nombre}: ${err.message}`);
    }
  }

  console.log(`\nResumen: ${recifrados} recifrados, ${fallidos} fallidos, ${archivos.length - planos.length} ya estaban cifrados.`);
  if (fallidos) {
    console.log("Revise los fallos antes de volver a ejecutar; los originales fallidos siguen en claro.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
