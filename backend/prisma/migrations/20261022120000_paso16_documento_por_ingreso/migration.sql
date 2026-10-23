-- El escaneo del expediente fisico pasa a poder asociarse a una admision
-- (Ingreso) concreta, para que cada ingreso tenga su propio set de fotos/PDF.
-- La columna es opcional: los documentos que ya existen quedan sin ingreso.
ALTER TABLE "DocumentoPaciente" ADD COLUMN "ingresoId" INTEGER;

-- CreateIndex
CREATE INDEX "DocumentoPaciente_ingresoId_idx" ON "DocumentoPaciente"("ingresoId");

-- AddForeignKey
ALTER TABLE "DocumentoPaciente" ADD CONSTRAINT "DocumentoPaciente_ingresoId_fkey" FOREIGN KEY ("ingresoId") REFERENCES "Ingreso"("id") ON DELETE SET NULL ON UPDATE CASCADE;
