// Logica de negocio de facturacion, con transacciones que garantizan que
// costeo + factura se registren como una sola operacion atomica (RNF-13):
// si un paso falla, Prisma revierte todo lo hecho dentro del $transaction.
// Sprint 6: los totales monetarios se redondean a 2 decimales antes de
// persistirse, para evitar arrastres de coma flotante en los reportes.
import { prisma } from "../config/prisma.js";
import { rangoFecha } from "../utils/periodos.util.js";

function round2(valor) {
  return Number(valor.toFixed(2));
}

// RF-17/RF-18/RF-19: calcula el costo de tratamiento pendiente del paciente,
// lo suma al costo base del hospital y genera la factura en una sola transaccion.
export async function generarFacturaHospital({ pacienteId, costoHospital, formaPago }) {
  return prisma.$transaction(async (tx) => {
    const paciente = await tx.paciente.findUnique({ where: { id: pacienteId } });
    if (!paciente) {
      const error = new Error("Paciente no encontrado");
      error.status = 404;
      throw error;
    }

    // RF-15: tanto los insumos intrahospitalarios como los medicamentos de
    // farmacia consumidos durante la estadia (origen "farmacia" por uso
    // intrahospitalario, distinto de una venta directa) se cargan al costeo
    // del paciente. Solo las ventas directas de farmacia (VentaFarmacia) se
    // facturan aparte.
    const pendientes = await tx.tratamientoItem.findMany({
      where: { pacienteId, facturado: false },
    });
    const costoTratamiento = pendientes.reduce((suma, item) => suma + Number(item.costo), 0);
    const total = round2(Number(costoHospital) + costoTratamiento);

    const factura = await tx.facturaHospital.create({
      data: { pacienteId, costoHospital, costoTratamiento: round2(costoTratamiento), total, formaPago },
    });

    if (pendientes.length > 0) {
      await tx.tratamientoItem.updateMany({
        where: { id: { in: pendientes.map((i) => i.id) } },
        data: { facturado: true },
      });
    }

    return factura;
  });
}

// RF-20/RF-24/RF-27: una venta directa de farmacia puede incluir varios
// medicamentos (carrito) y opcionalmente quedar a nombre de un paciente.
// Descuenta stock, deja kardex (movimiento) por cada linea, y genera UNA
// sola factura con todo el detalle, en una sola transaccion.
export async function registrarVentaFarmacia({ pacienteId, items, registradoPor }) {
  return prisma.$transaction(async (tx) => {
    let montoTotal = 0;
    const lineas = [];

    for (const item of items) {
      const medicamento = await tx.medicamentoInventario.findUnique({ where: { id: item.medicamentoId } });
      if (!medicamento) {
        const error = new Error(`Medicamento ${item.medicamentoId} no encontrado`);
        error.status = 404;
        throw error;
      }
      if (medicamento.stock < item.cantidad) {
        const error = new Error(`Stock insuficiente para ${medicamento.nombre}`);
        error.status = 409;
        throw error;
      }
      const precioUnitario = Number(medicamento.precioVenta);
      const subtotal = round2(precioUnitario * item.cantidad);
      montoTotal += subtotal;
      lineas.push({ medicamentoId: item.medicamentoId, cantidad: item.cantidad, precioUnitario, subtotal });
    }

    const factura = await tx.facturaFarmacia.create({
      data: { pacienteId: pacienteId ?? null, montoTotal: round2(montoTotal), registradoPor },
    });

    for (const linea of lineas) {
      await tx.ventaFarmacia.create({ data: { facturaId: factura.id, ...linea } });
      await tx.movimientoInventario.create({
        data: { medicamentoId: linea.medicamentoId, tipo: "salida", cantidad: linea.cantidad, motivo: "venta directa" },
      });
      await tx.medicamentoInventario.update({
        where: { id: linea.medicamentoId },
        data: { stock: { decrement: linea.cantidad } },
      });
    }

    return tx.facturaFarmacia.findUnique({
      where: { id: factura.id },
      include: {
        items: { include: { medicamento: { select: { nombre: true, tipo: true, presentacion: true } } } },
        paciente: { select: { nombreCompleto: true, historiaClinica: true, dpi: true } },
        registrador: { select: { nombre: true } },
      },
    });
  });
}

// RF-21: reporte financiero consolidado (hospital + farmacia, por separado y en conjunto)
export async function reporteConsolidado({ desde, hasta } = {}) {
  const rango = rangoFecha(desde, hasta);
  const where = rango ? { creadoEn: rango } : undefined;

  const [facturasHospital, facturasFarmacia] = await Promise.all([
    prisma.facturaHospital.findMany({ where }),
    prisma.facturaFarmacia.findMany({ where }),
  ]);

  const ingresosHospital = facturasHospital.reduce((suma, f) => suma + Number(f.total), 0);
  const ingresosFarmacia = facturasFarmacia.reduce((suma, f) => suma + Number(f.montoTotal), 0);

  return {
    ingresosHospital: Number(ingresosHospital.toFixed(2)),
    ingresosFarmacia: Number(ingresosFarmacia.toFixed(2)),
    totalConsolidado: Number((ingresosHospital + ingresosFarmacia).toFixed(2)),
    cantidadFacturasHospital: facturasHospital.length,
    cantidadFacturasFarmacia: facturasFarmacia.length,
  };
}
