// Controlador: Reportes administrativos y financieros (Modulo 9, RF-31)
import { prisma } from "../config/prisma.js";
import { reporteConsolidado } from "../services/facturacion.service.js";
import { leerPaginacion } from "../utils/paginacion.util.js";

function rangoFecha(desde, hasta) {
  const rango = {};
  if (desde) rango.gte = new Date(desde);
  if (hasta) rango.lte = new Date(hasta);
  return Object.keys(rango).length ? rango : undefined;
}

// Ingresos/egresos del hospital + farmacia en un periodo
export async function financiero(req, res) {
  const { desde, hasta } = req.query;
  const datos = await reporteConsolidado({ desde, hasta });
  res.json(datos);
}

// Admisiones y egresos: totales por condicion de egreso en un periodo
export async function admisiones(req, res) {
  const { desde, hasta } = req.query;
  const where = { fechaIngreso: rangoFecha(desde, hasta) };

  const [totalIngresos, porCondicion] = await Promise.all([
    prisma.paciente.count({ where }),
    prisma.paciente.groupBy({
      by: ["condicionEgreso"],
      where: { ...where, condicionEgreso: { not: null } },
      _count: { _all: true },
    }),
  ]);

  res.json({
    totalIngresos,
    porCondicionEgreso: porCondicion.map((c) => ({ condicion: c.condicionEgreso, total: c._count._all })),
  });
}

// Facturacion por forma de pago (transferencia / efectivo)
export async function facturacionPorFormaPago(req, res) {
  const { desde, hasta } = req.query;
  const grupos = await prisma.facturaHospital.groupBy({
    by: ["formaPago"],
    where: { creadoEn: rangoFecha(desde, hasta) },
    _sum: { total: true },
    _count: { _all: true },
  });
  res.json(grupos.map((g) => ({ formaPago: g.formaPago, total: Number(g._sum.total || 0), cantidad: g._count._all })));
}

// Ingresos de hospital y farmacia agrupados por mes, para el dashboard de
// tendencia del modulo de Reportes (grafica de lineas/barras en el frontend).
export async function ingresosPorMes(req, res) {
  const { desde, hasta } = req.query;
  const where = { creadoEn: rangoFecha(desde, hasta) };
  const [facturasHospital, facturasFarmacia] = await Promise.all([
    prisma.facturaHospital.findMany({ where, select: { total: true, creadoEn: true } }),
    prisma.facturaFarmacia.findMany({ where, select: { montoTotal: true, creadoEn: true } }),
  ]);

  function clave(fecha) {
    const d = new Date(fecha);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  const meses = {};
  function bucket(mes) {
    if (!meses[mes]) meses[mes] = { mes, ingresosHospital: 0, ingresosFarmacia: 0 };
    return meses[mes];
  }
  facturasHospital.forEach((f) => { bucket(clave(f.creadoEn)).ingresosHospital += Number(f.total); });
  facturasFarmacia.forEach((f) => { bucket(clave(f.creadoEn)).ingresosFarmacia += Number(f.montoTotal); });

  const resultado = Object.values(meses)
    .map((m) => ({
      mes: m.mes,
      ingresosHospital: Number(m.ingresosHospital.toFixed(2)),
      ingresosFarmacia: Number(m.ingresosFarmacia.toFixed(2)),
      total: Number((m.ingresosHospital + m.ingresosFarmacia).toFixed(2)),
    }))
    .sort((a, b) => a.mes.localeCompare(b.mes));

  res.json(resultado);
}

// RNF-10: kardex de movimientos de inventario de farmacia
export async function inventarioKardex(req, res) {
  const { medicamentoId, desde, hasta } = req.query;
  const where = {
    medicamentoId: medicamentoId ? Number(medicamentoId) : undefined,
    fecha: rangoFecha(desde, hasta),
  };

  if (req.query.page) {
    const { page, pageSize, skip, take } = leerPaginacion(req);
    const [items, total] = await Promise.all([
      prisma.movimientoInventario.findMany({ where, orderBy: { fecha: "desc" }, skip, take, include: { medicamento: { select: { nombre: true } } } }),
      prisma.movimientoInventario.count({ where }),
    ]);
    return res.json({ items, total, page, pageSize });
  }

  const movimientos = await prisma.movimientoInventario.findMany({
    where,
    orderBy: { fecha: "desc" },
    take: 200,
    include: { medicamento: { select: { nombre: true } } },
  });
  res.json(movimientos);
}

// Sprint 7: consulta administrativa de la bitacora general (LogActividad):
// quien hizo que y cuando, con filtros por usuario, accion y rango de
// fechas. Queda separada de la auditoria de accesos al diagnostico
// (auditoriaDiagnostico, RNF-08).
export async function actividad(req, res) {
  const { usuarioId, accion, desde, hasta, buscar } = req.query;
  const where = {
    usuarioId: usuarioId ? Number(usuarioId) : undefined,
    accion: accion || undefined,
    fecha: rangoFecha(desde, hasta),
    ...(buscar
      ? {
          OR: [
            { usuario: { nombre: { contains: buscar, mode: "insensitive" } } },
            { detalle: { contains: buscar, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const include = { usuario: { select: { nombre: true, roles: true } } };

  if (req.query.page) {
    const { page, pageSize, skip, take } = leerPaginacion(req);
    const [items, total] = await Promise.all([
      prisma.logActividad.findMany({ where, orderBy: { fecha: "desc" }, skip, take, include }),
      prisma.logActividad.count({ where }),
    ]);
    return res.json({ items, total, page, pageSize });
  }

  const logs = await prisma.logActividad.findMany({ where, orderBy: { fecha: "desc" }, take: 100, include });
  res.json(logs);
}

// RNF-08: quien vio el diagnostico confidencial de cada paciente y cuando.
// "buscar" filtra por nombre de usuario o del paciente/historia clinica,
// para no tener que revisar registro por registro si hay mucho volumen.
export async function auditoriaDiagnostico(req, res) {
  const { pacienteId, desde, hasta, buscar } = req.query;
  const where = {
    pacienteId: pacienteId ? Number(pacienteId) : undefined,
    fecha: rangoFecha(desde, hasta),
    ...(buscar
      ? {
          OR: [
            { usuario: { nombre: { contains: buscar, mode: "insensitive" } } },
            { paciente: { nombreCompleto: { contains: buscar, mode: "insensitive" } } },
            { paciente: { historiaClinica: { contains: buscar, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const include = {
    usuario: { select: { nombre: true, roles: true } },
    paciente: { select: { nombreCompleto: true, historiaClinica: true } },
  };

  if (req.query.page) {
    const { page, pageSize, skip, take } = leerPaginacion(req);
    const [items, total] = await Promise.all([
      prisma.accesoDiagnostico.findMany({ where, orderBy: { fecha: "desc" }, skip, take, include }),
      prisma.accesoDiagnostico.count({ where }),
    ]);
    return res.json({ items, total, page, pageSize });
  }

  const accesos = await prisma.accesoDiagnostico.findMany({
    where, orderBy: { fecha: "desc" }, take: 200, include,
  });
  res.json(accesos);
}
