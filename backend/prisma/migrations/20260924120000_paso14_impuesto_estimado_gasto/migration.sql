-- Monto de impuesto estimado por gasto (monto x tasa de la categoria fiscal
-- elegida, congelado al momento de registrar el gasto). Informativo.

-- AlterTable
ALTER TABLE "GastoHospital" ADD COLUMN "montoImpuestoEstimado" DECIMAL(10,2);
