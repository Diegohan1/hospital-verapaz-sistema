// Controlador: Recetas medicas (parte del Modulo 3 - Tratamiento y Medicamentos)
// Sprint 5: la receta lleva un medico responsable seleccionable (medicoId),
// que debe ser un usuario con rol clinico (Consulta). El medico autenticado
// es el valor inicial cuando quien receta es clinico. El listado y la vista
// imprimible incluyen los datos publicos del medico: nombre, colegiado y
// especialidad.
import { prisma } from "../config/prisma.js";
import { ROLES } from "../utils/roles.util.js";
import { registrarActividad } from "../services/actividad.service.js";

const SELECT_MEDICO = { nombre: true, colegiado: true, especialidad: true };

export async function listar(req, res) {
  const { pacienteId } = req.query;
  const recetas = await prisma.receta.findMany({
    where: pacienteId ? { pacienteId: Number(pacienteId) } : undefined,
    orderBy: { creadoEn: "desc" },
    take: 100,
    include: {
      paciente: { select: { nombreCompleto: true, historiaClinica: true } },
      medico: { select: SELECT_MEDICO },
    },
  });
  res.json(recetas);
}

// Para la vista imprimible de la receta
export async function obtenerUno(req, res) {
  const receta = await prisma.receta.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      paciente: { select: { nombreCompleto: true, historiaClinica: true, edad: true, sexo: true } },
      medico: { select: SELECT_MEDICO },
    },
  });
  if (!receta) return res.status(404).json({ error: "Receta no encontrada" });
  res.json(receta);
}

export async function crear(req, res) {
  const { pacienteId, medicoId, medicamento, dosis, indicaciones, duracion } = req.body;
  if (!pacienteId || !medicamento || !dosis) {
    return res.status(400).json({ error: "pacienteId, medicamento y dosis son requeridos" });
  }

  const paciente = await prisma.paciente.findUnique({ where: { id: Number(pacienteId) }, select: { id: true } });
  if (!paciente) return res.status(404).json({ error: "Paciente no encontrado" });

  // Sprint 5: medico responsable. Por defecto es el propio usuario si es
  // clinico; si se selecciona otro, se valida que tenga rol clinico — un
  // usuario no clinico no puede figurar como medico en una receta.
  const responsableId = medicoId ? Number(medicoId) : req.user.id;
  const medico = await prisma.usuario.findUnique({
    where: { id: responsableId },
    select: { id: true, nombre: true, roles: true, colegiado: true, especialidad: true },
  });
  if (!medico) return res.status(404).json({ error: "Médico responsable no encontrado" });
  if (!medico.roles.includes(ROLES.CONSULTA)) {
    return res.status(422).json({ error: "El médico responsable debe ser un usuario con rol clínico (Consulta)" });
  }

  const receta = await prisma.receta.create({
    data: {
      pacienteId: Number(pacienteId),
      medicoId: responsableId,
      medicamento,
      dosis,
      indicaciones: indicaciones || "",
      duracion: duracion || "",
    },
    include: { medico: { select: SELECT_MEDICO } },
  });
  await registrarActividad(req.user.id, "crear_receta", `${medicamento} — médico: ${medico.nombre}`);
  res.status(201).json(receta);
}
