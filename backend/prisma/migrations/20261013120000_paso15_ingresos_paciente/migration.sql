-- CreateTable
CREATE TABLE "Ingreso" (
    "id" SERIAL NOT NULL,
    "pacienteId" INTEGER NOT NULL,
    "fechaIngreso" TIMESTAMP(3) NOT NULL,
    "impresionClinicaIngreso" TEXT,
    "serviciosSolicitados" TEXT,
    "referidoDe" TEXT,
    "referidoPor" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ingreso_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Diagnostico" ADD COLUMN "ingresoId" INTEGER;

-- CreateIndex
CREATE INDEX "Ingreso_pacienteId_idx" ON "Ingreso"("pacienteId");
CREATE INDEX "Ingreso_fechaIngreso_idx" ON "Ingreso"("fechaIngreso");
CREATE INDEX "Diagnostico_ingresoId_idx" ON "Diagnostico"("ingresoId");

-- AddForeignKey
ALTER TABLE "Ingreso" ADD CONSTRAINT "Ingreso_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Diagnostico" ADD CONSTRAINT "Diagnostico_ingresoId_fkey" FOREIGN KEY ("ingresoId") REFERENCES "Ingreso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: cada paciente con fecha de ingreso ya registrada obtiene su
-- primer Ingreso, copiando los campos de admision que vivian en Paciente.
INSERT INTO "Ingreso" ("pacienteId", "fechaIngreso", "impresionClinicaIngreso", "serviciosSolicitados", "referidoDe", "referidoPor", "creadoEn")
SELECT "id", "fechaIngreso", "impresionClinicaIngreso", "serviciosSolicitados", "referidoDe", "referidoPor", CURRENT_TIMESTAMP
FROM "Paciente"
WHERE "fechaIngreso" IS NOT NULL;

-- Backfill: los diagnosticos existentes se enlazan al primer ingreso del paciente.
UPDATE "Diagnostico" d
SET "ingresoId" = i."id"
FROM "Ingreso" i
WHERE i."pacienteId" = d."pacienteId" AND d."ingresoId" IS NULL;
