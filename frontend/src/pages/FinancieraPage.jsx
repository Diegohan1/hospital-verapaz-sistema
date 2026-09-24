import React, { useState } from "react";
import { Printer } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Table } from "../components/Table";
import { Button } from "../components/Button";
import { Banner } from "../components/Banner";
import { Modal } from "../components/Modal";
import { FacturaImprimible } from "../components/FacturaImprimible";
import { FormField, TextInput, Select } from "../components/FormField";
import { PacienteBuscador } from "../components/PacienteBuscador";
import { useFetch } from "../hooks/useFetch";
import { usePaginatedFetch } from "../hooks/usePaginatedFetch";
import { Pagination } from "../components/Pagination";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { COLORS } from "../styles/tokens";
import { ROLES, tieneRol } from "../utils/roles";

export function FinancieraPage() {
  const { usuario } = useAuth();
  const puedeFacturar = tieneRol(usuario, ROLES.FACTURACION, ROLES.ADMIN);

  const { data: reporte, reload: reloadReporte } = useFetch("/facturacion/reporte");
  // Sprint 7: listado de facturas paginado
  const facturasPag = usePaginatedFetch("/facturacion", { pageSize: 20 });
  const { loading, error, reload: reloadFacturas } = facturasPag;
  const [facturaImprimir, setFacturaImprimir] = useState(null);

  const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null);
  const pacienteId = pacienteSeleccionado?.id;

  // Sprint 6: vista previa del costeo pendiente (tratamientos no facturados
  // agrupados por origen) antes de generar la factura.
  const { data: costeo, reload: reloadCosteo } = useFetch(
    pacienteId && puedeFacturar ? `/facturacion/costeo/${pacienteId}` : null,
    { enabled: !!(pacienteId && puedeFacturar) }
  );

  const [form, setForm] = useState({ costoHospital: "", formaPago: "efectivo" });
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    setMensaje(null);
    try {
      const factura = await api.post("/facturacion", { pacienteId, costoHospital: Number(form.costoHospital), formaPago: form.formaPago });
      setMensaje({ tone: "success", texto: `Factura generada por Q${Number(factura.total).toFixed(2)}` });
      setForm({ costoHospital: "", formaPago: "efectivo" });
      reloadFacturas();
      reloadReporte();
      reloadCosteo();
    } catch (err) {
      setMensaje({ tone: "error", texto: err.message });
    } finally {
      setGuardando(false);
    }
  }

  const stats = reporte
    ? [
        { label: "INGRESOS HOSPITAL", value: `Q ${reporte.ingresosHospital.toLocaleString()}`, color: COLORS.navy },
        { label: "INGRESOS FARMACIA", value: `Q ${reporte.ingresosFarmacia.toLocaleString()}`, color: COLORS.gold },
        { label: "TOTAL CONSOLIDADO", value: `Q ${reporte.totalConsolidado.toLocaleString()}`, color: COLORS.text },
        { label: "GASTOS DEL HOSPITAL", value: `Q ${reporte.totalGastos.toLocaleString()}`, color: COLORS.red },
        { label: "IMPUESTOS PAGADOS (ESTIMADO)", value: `Q ${reporte.totalImpuestosEstimados.toLocaleString()}`, color: COLORS.red },
        { label: "INGRESO NETO", value: `Q ${reporte.ingresoNeto.toLocaleString()}`, color: reporte.ingresoNeto >= 0 ? COLORS.navy : COLORS.red },
      ]
    : [];

  return (
    <div>
      <PageHeader title="Área Financiera" subtitle="Reporte consolidado: ingresos (hospital y farmacia), gastos, impuestos e ingreso neto (RF-21). El detalle de gastos se captura en Gastos del Hospital." />
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <div className="text-xs font-semibold" style={{ color: "#888" }}>{s.label}</div>
            <div className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</div>
          </Card>
        ))}
      </div>

      {error && <Banner tone="error">{error}</Banner>}
      <Table
        headers={["Paciente", "Costo hospital", "Costo tratamiento", "Total", "Forma de pago", "Fecha", ""]}
        rows={loading ? [] : facturasPag.items}
        emptyMessage={loading ? "Cargando…" : "Sin facturas registradas."}
        renderRow={(f) => (
          <>
            <td className="px-4 py-3">{f.paciente?.nombreCompleto} <span style={{ color: "#999" }}>({f.paciente?.historiaClinica})</span></td>
            <td className="px-4 py-3">Q{Number(f.costoHospital).toFixed(2)}</td>
            <td className="px-4 py-3">Q{Number(f.costoTratamiento).toFixed(2)}</td>
            <td className="px-4 py-3 font-semibold">Q{Number(f.total).toFixed(2)}</td>
            <td className="px-4 py-3" style={{ color: "#666" }}>{f.formaPago === "efectivo" ? "Efectivo" : "Transferencia"}</td>
            <td className="px-4 py-3" style={{ color: "#666" }}>{new Date(f.creadoEn).toLocaleDateString()}</td>
            <td className="px-4 py-3">
              <button onClick={() => setFacturaImprimir(f)} className="flex items-center gap-1 text-xs font-semibold" style={{ color: COLORS.navy }}>
                <Printer size={13} /> Imprimir
              </button>
            </td>
          </>
        )}
      />
      <Pagination page={facturasPag.page} totalPages={facturasPag.totalPages} total={facturasPag.total} onChange={facturasPag.setPage} />

      {puedeFacturar && (
        <Card style={{ marginTop: 16 }}>
          <div className="font-semibold text-sm mb-1">5.1 Facturación Hospital</div>
          <p className="text-xs mb-4" style={{ color: "#888" }}>
            El costo de tratamiento intrahospitalario pendiente se suma automáticamente al costo base (RF-17, RF-19).
          </p>
          {mensaje && <Banner tone={mensaje.tone}>{mensaje.texto}</Banner>}
          <div className="mb-4">
            <FormField label="Paciente">
              <PacienteBuscador pacienteSeleccionado={pacienteSeleccionado} onSelect={setPacienteSeleccionado} mostrarListado />
            </FormField>
          </div>

          {pacienteId && costeo && (
            <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: "#FAFAFB", border: `1px solid ${COLORS.border}` }}>
              <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: COLORS.navy }}>
                Costeo pendiente del paciente (se sumará automáticamente a la factura)
              </div>
              {costeo.items.length === 0 ? (
                <p className="text-sm" style={{ color: "#888" }}>Sin tratamientos pendientes de facturar.</p>
              ) : (
                <>
                  <ul className="text-sm flex flex-col gap-1 mb-2" style={{ color: "#444" }}>
                    {costeo.items.map((i) => (
                      <li key={i.id} className="flex justify-between gap-3">
                        <span>
                          {i.descripcion}
                          <span className="text-xs ml-2" style={{ color: "#999" }}>
                            {i.origen === "farmacia" ? "Farmacia" : "Intrahospitalario"}
                            {i.dosis ? ` · ${i.dosis}` : ""}
                          </span>
                        </span>
                        <span className="font-semibold">Q{Number(i.costo).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="text-sm font-bold pt-2" style={{ borderTop: `1px solid ${COLORS.border}`, color: COLORS.navy }}>
                    Total tratamiento pendiente: Q{costeo.costoTratamientoPendiente.toFixed(2)}
                  </div>
                </>
              )}
            </div>
          )}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <FormField label="Costo base hospital (Q)"><TextInput type="number" step="0.01" min="0" required value={form.costoHospital} onChange={(e) => setForm((f) => ({ ...f, costoHospital: e.target.value }))} /></FormField>
            <FormField label="Forma de pago">
              <Select value={form.formaPago} onChange={(e) => setForm((f) => ({ ...f, formaPago: e.target.value }))}>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
              </Select>
            </FormField>
            <div className="col-span-1 sm:col-span-2 lg:col-span-3">
              <Button type="submit" disabled={guardando}>{guardando ? "Generando…" : "Generar factura"}</Button>
            </div>
          </form>
        </Card>
      )}

      <Modal open={!!facturaImprimir} onClose={() => setFacturaImprimir(null)} title="Factura de hospital" maxWidth={620}>
        {facturaImprimir && (
          <FacturaImprimible
            titulo="Factura de Hospital"
            numero={facturaImprimir.id}
            fecha={facturaImprimir.creadoEn}
            paciente={facturaImprimir.paciente}
            formaPago={facturaImprimir.formaPago}
            lineas={[
              { concepto: "Costo base hospital", subtotal: facturaImprimir.costoHospital },
              { concepto: "Costo de tratamiento intrahospitalario", subtotal: facturaImprimir.costoTratamiento },
            ]}
            total={facturaImprimir.total}
          />
        )}
      </Modal>
    </div>
  );
}
