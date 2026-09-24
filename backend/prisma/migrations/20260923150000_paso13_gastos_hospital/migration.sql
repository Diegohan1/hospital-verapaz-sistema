-- Gastos del Hospital + catalogo editable de categorias fiscales
-- (23/09/2026). Deliberadamente NO se llama "Egreso": ese nombre ya lo usa
-- el egreso clinico del paciente y hubiera chocado con este, que es
-- financiero.

-- CreateTable
CREATE TABLE "CategoriaFiscal" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "tasa" DECIMAL(5,2),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoriaFiscal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GastoHospital" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "proveedor" TEXT NOT NULL,
    "descripcion" TEXT,
    "numeroFactura" TEXT,
    "monto" DECIMAL(10,2) NOT NULL,
    "categoriaFiscalId" INTEGER,
    "registradoPor" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GastoHospital_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaFiscal_nombre_key" ON "CategoriaFiscal"("nombre");
CREATE INDEX "GastoHospital_fecha_idx" ON "GastoHospital"("fecha");
CREATE INDEX "GastoHospital_categoriaFiscalId_idx" ON "GastoHospital"("categoriaFiscalId");

-- AddForeignKey
ALTER TABLE "GastoHospital" ADD CONSTRAINT "GastoHospital_categoriaFiscalId_fkey" FOREIGN KEY ("categoriaFiscalId") REFERENCES "CategoriaFiscal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GastoHospital" ADD CONSTRAINT "GastoHospital_registradoPor_fkey" FOREIGN KEY ("registradoPor") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
