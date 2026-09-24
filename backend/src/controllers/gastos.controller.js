// Controlador: Gastos del Hospital (Modulo 5 - Area Financiera, 23/09/2026).
// Registro manual de gastos/compras del hospital (proveedores, servicios,
// etc.), clasificados opcionalmente por categoria fiscal, para que el
// reporte financiero pueda calcular el ingreso neto (ingresos - gastos).
//
// Deliberadamente NO se llama "Egreso": ese nombre ya lo usa el egreso
// clinico del paciente (medico, no financiero).
//
// Pendiente de confirmar con Don Felix si este modulo se entrega o se queda
// solo desarrollado (mismo caso que los reportes de credito fiscal /
// contribuyente descartados antes) -- ver nota en schema.prisma.
import { prisma } from "../config/prisma.js";
import { registrarActividad } from "../services/actividad.service.js";
import { leerPaginacion } from "../utils/paginacion.util.js";
import { rangoFecha } from "../utils/periodos.util.js";

const INCLUDE_CATEGORIA = { categoriaFiscal: { select: { id: true, nombre: true, tasa: true } } };

// GET /api/facturacion/gastos?desde=&hasta=&categoriaFiscalId=&page=
export async function listar(req, res) {
  const { desde, hasta, categoriaFiscalId } = req.query;
  const where = {
    ...(rangoFecha(desde, hasta) ? { fecha: rangoFecha(desde, hasta) } : {}),
    ...(categoriaFiscalId ? { categoriaFiscalId: Number(categoriaFiscalId) } : {}),
  };

  if (req.query.page) {
    const { page, pageSize, skip, take } = leerPaginacion(req);
    const [items, total] = await Promise.all([
      prisma.gastoHospital.findMany({ where, orderBy: { fecha: "desc" }, skip, take, include: INCLUDE_CATEGORIA }),
      prisma.gastoHospital.count({ where }),
    ]);
    return res.json({ items, total, page, pageSize });
  }

  const gastos = await prisma.gastoHospital.findMany({ where, orderBy: { fecha: "desc" }, take: 100, include: INCLUDE_CATEGORIA });
  res.json(gastos);
}

// POST /api/facturacion/gastos
export async function crear(req, res) {
  const { fecha, proveedor, descripcion, numeroFactura, monto, categoriaFiscalId } = req.body;
  if (!fecha || !proveedor || monto === undefined) {
    return res.status(400).json({ error: "fecha, proveedor y monto son requeridos" });
  }
  if (Number.isNaN(Number(monto)) || Number(monto) <= 0) {
    return res.status(422).json({ error: "El monto debe ser un número mayor a 0" });
  }
  const fechaGasto = new Date(fecha);
  if (Number.isNaN(fechaGasto.getTime())) {
    return res.status(422).json({ error: "La fecha del gasto no es válida" });
  }

  // El impuesto estimado se calcula y se congela aqui (monto x tasa de la
  // categoria EN ESTE MOMENTO): si despues el Administrador cambia la tasa
  // de la categoria, los gastos ya registrados no deben moverse solos.
  let montoImpuestoEstimado = null;
  if (categoriaFiscalId) {
    const categoria = await prisma.categoriaFiscal.findUnique({ where: { id: Number(categoriaFiscalId) } });
    if (!categoria) return res.status(422).json({ error: "La categoría fiscal indicada no existe" });
    if (categoria.tasa != null) montoImpuestoEstimado = Number((Number(monto) * (Number(categoria.tasa) / 100)).toFixed(2));
  }

  const gasto = await prisma.gastoHospital.create({
    data: {
      fecha: fechaGasto,
      proveedor,
      descripcion: descripcion || null,
      numeroFactura: numeroFactura || null,
      monto: Number(monto),
      categoriaFiscalId: categoriaFiscalId ? Number(categoriaFiscalId) : null,
      montoImpuestoEstimado,
      registradoPor: req.user.id,
    },
    include: INCLUDE_CATEGORIA,
  });

  await registrarActividad(req.user.id, "registrar_gasto", `${proveedor}: Q${Number(monto).toFixed(2)}`);
  res.status(201).json(gasto);
}

// DELETE /api/facturacion/gastos/:id -- corrige un gasto mal capturado.
export async function eliminar(req, res) {
  const id = Number(req.params.id);
  const gasto = await prisma.gastoHospital.findUnique({ where: { id } });
  if (!gasto) return res.status(404).json({ error: "Gasto no encontrado" });

  await prisma.gastoHospital.delete({ where: { id } });
  await registrarActividad(req.user.id, "eliminar_gasto", `${gasto.proveedor}: Q${Number(gasto.monto).toFixed(2)}`);
  res.json({ ok: true });
}
