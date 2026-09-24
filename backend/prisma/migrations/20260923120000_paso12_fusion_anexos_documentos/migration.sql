-- Fusion de los modulos Anexos y Documentos escaneados (23/09/2026): ambos
-- guardaban lo mismo -- un archivo suelto del paciente sin estructura
-- clinica -- con dos tablas y dos APIs distintas. DocumentoPaciente
-- sobrevive (ya tenia checksum y borrado logico); AnexoPaciente se elimina.
--
-- IMPORTANTE: antes de aplicar esta migracion hay que correr
-- "npm run migrar-anexos" (scripts/migrar-anexos-a-documentos.js), que copia
-- cada fila de AnexoPaciente a DocumentoPaciente y la borra. Si esta tabla
-- todavia tiene filas al aplicar esta migracion, se pierden.

-- DropForeignKey
ALTER TABLE "AnexoPaciente" DROP CONSTRAINT "AnexoPaciente_pacienteId_fkey";

-- DropTable
DROP TABLE "AnexoPaciente";
