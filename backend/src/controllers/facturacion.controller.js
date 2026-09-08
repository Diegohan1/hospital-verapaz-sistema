// Controlador: Area Financiera (Modulo 5 - Facturacion Hospital)
import { prisma } from "../config/prisma.js";
import { generarFacturaHospital, reporteConsolidado } from "../services/facturacion.service.js";
import { registrarActividad } from "../services/actividad.service.js";

export async function listar(req, res) {
  const facturas = await prisma.facturaHospital.findMany({
    orderBy: { creadoEn: "desc" },
    take: 50,
    include: { paciente: { select: { nombreCompleto: true, historiaClinica: true } } },
  });
  res.json(facturas);
}

export async function obtenerUno(req, res) {
  const factura = await prisma.facturaHospital.findUnique({
    where: { id: Number(req.params.id) },
    include: { paciente: { select: { nombreCompleto: true, historiaClinica: true } } },
  });
  if (!factura) return res.status(404).json({ error: "Factura no encontrada" });
  res.json(factura);
}

// RF-17/RF-18/RF-19
export async function crear(req, res) {
  const { pacienteId, costoHospital, formaPago } = req.body;
  if (!pacienteId || costoHospital === undefined || !formaPago) {
    return res.status(400).json({ error: "pacienteId, costoHospital y formaPago son requeridos" });
  }
  if (!["transferencia", "efectivo"].includes(formaPago)) {
    return res.status(400).json({ error: 'formaPago debe ser "transferencia" o "efectivo"' });
  }
  if (Number.isNaN(Number(costoHospital)) || Number(costoHospital) < 0) {
    return res.status(422).json({ error: "El costo hospital debe ser un número mayor o igual a 0" });
  }

  try {
    const factura = await generarFacturaHospital({
      pacienteId: Number(pacienteId),
      costoHospital: Number(costoHospital),
      formaPago,
    });
    await registrarActividad(req.user.id, "generar_factura_hospital", `Factura #${factura.id} por Q${Number(factura.total).toFixed(2)}`);
    res.status(201).json(factura);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  }
}

// Sprint 6: costeo hospitalario de un paciente — agrupa los tratamientos
// aun no facturados por origen, con su total. Sirve como vista previa de lo
// que se sumara a la factura y para verificar que nada se cobre dos veces.
export async function costeoPaciente(req, res) {
  const pacienteId = Number(req.params.pacienteId);
  const paciente = await prisma.paciente.findUnique({
    where: { id: pacienteId },
    select: { id: true, nombreCompleto: true, historiaClinica: true },
  });
  if (!paciente) return res.status(404).json({ error: "Paciente no encontrado" });

  const pendientes = await prisma.tratamientoItem.findMany({
    where: { pacienteId, facturado: false },
    orderBy: { fecha: "desc" },
  });

  const porOrigen = {};
  for (const item of pendientes) {
    if (!porOrigen[item.origen]) porOrigen[item.origen] = { origen: item.origen, cantidad: 0, total: 0 };
    porOrigen[item.origen].cantidad++;
    porOrigen[item.origen].total += Number(item.costo);
  }

  const costoTratamiento = pendientes.reduce((suma, item) => suma + Number(item.costo), 0);
  res.json({
    paciente,
    items: pendientes,
    porOrigen: Object.values(porOrigen).map((g) => ({ ...g, total: Number(g.total.toFixed(2)) })),
    costoTratamientoPendiente: Number(costoTratamiento.toFixed(2)),
  });
}

// RF-21: reporte financiero consolidado (hospital + farmacia)
export async function reporte(req, res) {
  const { desde, hasta } = req.query;
  const datos = await reporteConsolidado({ desde, hasta });
  res.json(datos);
}
