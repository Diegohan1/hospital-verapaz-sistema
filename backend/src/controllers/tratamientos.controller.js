// Controlador: Tratamiento y Medicamentos Intrahospitalarios (Modulo 3)
import { prisma } from "../config/prisma.js";
import { registrarActividad } from "../services/actividad.service.js";

// RF-13: listar los medicamentos/procedimientos de un paciente
export async function listar(req, res) {
  const { pacienteId } = req.query;
  const items = await prisma.tratamientoItem.findMany({
    where: pacienteId ? { pacienteId: Number(pacienteId) } : undefined,
    orderBy: { fecha: "desc" },
    take: 100,
  });
  res.json(items);
}

export async function obtenerUno(req, res) {
  const item = await prisma.tratamientoItem.findUnique({ where: { id: Number(req.params.id) } });
  if (!item) return res.status(404).json({ error: "Registro no encontrado" });
  res.json(item);
}

// RF-13/RF-14/RF-15: registrar medicamento o procedimiento con costo y origen.
// cirujano/ayudante/instrumentista/anestesiologo son opcionales: solo aplican
// cuando el registro es un procedimiento quirurgico.
export async function crear(req, res) {
  const { pacienteId, descripcion, dosis, costo, origen, cirujano, ayudante, instrumentista, anestesiologo } = req.body;
  if (!pacienteId || !descripcion || costo === undefined || !origen) {
    return res.status(400).json({ error: "pacienteId, descripcion, costo y origen son requeridos" });
  }
  if (!["intrahospitalario", "farmacia"].includes(origen)) {
    return res.status(400).json({ error: 'origen debe ser "intrahospitalario" o "farmacia"' });
  }
  // Sprint 5: validacion de costo (monetario, no negativo) y paciente
  if (Number.isNaN(Number(costo)) || Number(costo) < 0) {
    return res.status(422).json({ error: "El costo debe ser un número mayor o igual a 0" });
  }
  const paciente = await prisma.paciente.findUnique({ where: { id: Number(pacienteId) }, select: { id: true } });
  if (!paciente) return res.status(404).json({ error: "Paciente no encontrado" });

  const item = await prisma.tratamientoItem.create({
    data: { pacienteId: Number(pacienteId), descripcion, dosis, costo, origen, cirujano, ayudante, instrumentista, anestesiologo },
  });
  await registrarActividad(req.user.id, "registrar_tratamiento", descripcion);
  res.status(201).json(item);
}

export async function actualizar(req, res) {
  const { descripcion, dosis, costo } = req.body;
  try {
    const item = await prisma.tratamientoItem.update({
      where: { id: Number(req.params.id) },
      data: { descripcion, dosis, costo },
    });
    res.json(item);
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Registro no encontrado" });
    throw err;
  }
}
