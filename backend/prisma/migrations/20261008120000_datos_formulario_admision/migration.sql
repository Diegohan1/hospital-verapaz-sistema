ALTER TABLE "Paciente"
  ADD COLUMN "direccionConyuge" TEXT,
  ADD COLUMN "telefonoConyuge" TEXT,
  ADD COLUMN "direccionEmergencia" TEXT,
  ADD COLUMN "otrasHospitalizaciones" TEXT,
  ADD COLUMN "referidoPor" TEXT;

ALTER TABLE "RegistroMaternidad"
  ADD COLUMN "autopsiaBebe" BOOLEAN,
  ADD COLUMN "causaMuerteBebe" TEXT,
  ADD COLUMN "fechaMuerteBebe" TIMESTAMP(3);
