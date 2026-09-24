import React, { useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Table } from "../components/Table";
import { Button } from "../components/Button";
import { Banner } from "../components/Banner";
import { FormField, TextInput, Select } from "../components/FormField";
import { useFetch } from "../hooks/useFetch";
import { usePaginatedFetch } from "../hooks/usePaginatedFetch";
import { Pagination } from "../components/Pagination";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { COLORS } from "../styles/tokens";
import { ROLES, tieneRol } from "../utils/roles";

function ahoraFecha() { return new Date().toISOString().slice(0, 10); }

// 23/09/2026: Gastos del Hospital (compras, servicios, proveedores) y su
// catálogo de categorías fiscales, en módulo aparte (antes vivía dentro de
// Área Financiera, pero acumulaba demasiado en una sola pantalla). Deja el
// ingreso neto calculado en Área Financiera/Reportes; aquí solo se captura
// y se corrige. Pendiente de que Don Félix confirme si este módulo se
// entrega o se queda solo desarrollado (mismo caso que los reportes de
// crédito fiscal/contribuyente descartados antes).
export function GastosPage() {
  const { usuario } = useAuth();
  const puedeFacturar = tieneRol(usuario, ROLES.FACTURACION, ROLES.ADMIN);
  const esAdmin = tieneRol(usuario, ROLES.ADMIN);

  const gastosPag = usePaginatedFetch(puedeFacturar ? "/facturacion/gastos" : null, { pageSize: 20 });
  const { data: categoriasFiscales, reload: reloadCategorias } = useFetch(
    puedeFacturar ? "/facturacion/categorias-fiscales?activo=true" : null,
    { enabled: !!puedeFacturar }
  );
  const [formGasto, setFormGasto] = useState({ fecha: ahoraFecha(), proveedor: "", descripcion: "", numeroFactura: "", monto: "", categoriaFiscalId: "" });
  const [guardandoGasto, setGuardandoGasto] = useState(false);
  const [mensajeGasto, setMensajeGasto] = useState(null);

  // Vista previa del impuesto estimado (monto x tasa de la categoría
  // elegida) mientras se captura, antes de guardar. El backend calcula y
  // congela el valor real al registrar el gasto.
  const categoriaSeleccionada = (categoriasFiscales || []).find((c) => String(c.id) === String(formGasto.categoriaFiscalId));
  const montoNumero = Number(formGasto.monto);
  const impuestoEstimadoPreview =
    categoriaSeleccionada?.tasa != null && montoNumero > 0 ? montoNumero * (Number(categoriaSeleccionada.tasa) / 100) : null;

  async function handleSubmitGasto(e) {
    e.preventDefault();
    setGuardandoGasto(true);
    setMensajeGasto(null);
    try {
      await api.post("/facturacion/gastos", {
        ...formGasto,
        monto: Number(formGasto.monto),
        categoriaFiscalId: formGasto.categoriaFiscalId || undefined,
      });
      setMensajeGasto({ tone: "success", texto: "Gasto registrado." });
      setFormGasto({ fecha: ahoraFecha(), proveedor: "", descripcion: "", numeroFactura: "", monto: "", categoriaFiscalId: "" });
      gastosPag.reload();
    } catch (err) {
      setMensajeGasto({ tone: "error", texto: err.message });
    } finally {
      setGuardandoGasto(false);
    }
  }

  async function eliminarGasto(gasto) {
    if (!window.confirm(`¿Eliminar el gasto "${gasto.proveedor}" por Q${Number(gasto.monto).toFixed(2)}?`)) return;
    try {
      await api.del(`/facturacion/gastos/${gasto.id}`);
      gastosPag.reload();
    } catch (err) {
      setMensajeGasto({ tone: "error", texto: err.message });
    }
  }

  // Solo Administrador puede dar de alta o editar categorías (el backend lo
  // exige igual); Facturación solo las usa en el desplegable de arriba.
  const [nuevaCategoria, setNuevaCategoria] = useState({ nombre: "", tasa: "" });
  const [guardandoCategoria, setGuardandoCategoria] = useState(false);

  async function agregarCategoria(e) {
    e.preventDefault();
    if (!nuevaCategoria.nombre.trim()) return;
    setGuardandoCategoria(true);
    setMensajeGasto(null);
    try {
      await api.post("/facturacion/categorias-fiscales", {
        nombre: nuevaCategoria.nombre.trim(),
        tasa: nuevaCategoria.tasa || undefined,
      });
      setNuevaCategoria({ nombre: "", tasa: "" });
      reloadCategorias();
    } catch (err) {
      setMensajeGasto({ tone: "error", texto: err.message });
    } finally {
      setGuardandoCategoria(false);
    }
  }

  if (!puedeFacturar) {
    return (
      <div>
        <PageHeader title="Gastos del Hospital" />
        <Card><p className="text-sm" style={{ color: "#666" }}>Este módulo está disponible solo para Facturación y Administrador.</p></Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Gastos del Hospital"
        subtitle='Compras, servicios y pagos a proveedores, clasificados por categoría fiscal. No es el "Egreso Clínico" del paciente — ese es médico, esto es financiero.'
      />
      <Card>
        {mensajeGasto && <Banner tone={mensajeGasto.tone}>{mensajeGasto.texto}</Banner>}

        <form onSubmit={handleSubmitGasto} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end mb-4">
          <FormField label="Fecha del gasto">
            <TextInput type="date" required value={formGasto.fecha} onChange={(e) => setFormGasto((f) => ({ ...f, fecha: e.target.value }))} />
          </FormField>
          <FormField label="Proveedor">
            <TextInput required value={formGasto.proveedor} onChange={(e) => setFormGasto((f) => ({ ...f, proveedor: e.target.value }))} />
          </FormField>
          <FormField label="Monto (Q)">
            <TextInput type="number" step="0.01" min="0.01" required value={formGasto.monto} onChange={(e) => setFormGasto((f) => ({ ...f, monto: e.target.value }))} />
          </FormField>
          <FormField label="Categoría fiscal">
            <Select value={formGasto.categoriaFiscalId} onChange={(e) => setFormGasto((f) => ({ ...f, categoriaFiscalId: e.target.value }))}>
              <option value="">Sin clasificar</option>
              {(categoriasFiscales || []).map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Número de factura/DTE (opcional)">
            <TextInput value={formGasto.numeroFactura} onChange={(e) => setFormGasto((f) => ({ ...f, numeroFactura: e.target.value }))} />
          </FormField>
          <FormField label="Descripción (opcional)">
            <TextInput value={formGasto.descripcion} onChange={(e) => setFormGasto((f) => ({ ...f, descripcion: e.target.value }))} />
          </FormField>

          {impuestoEstimadoPreview != null && (
            <div className="col-span-1 sm:col-span-2 lg:col-span-3 rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: "#FAFAFB", border: `1px solid ${COLORS.border}` }}>
              <span style={{ color: "#888" }}>Impuesto estimado ({Number(categoriaSeleccionada.tasa)}% de Q{montoNumero.toFixed(2)}):</span>{" "}
              <strong style={{ color: COLORS.navy }}>Q {impuestoEstimadoPreview.toFixed(2)}</strong>
              <span className="block text-xs mt-1" style={{ color: "#999" }}>
                Cálculo informativo a partir de la tasa registrada en la categoría — no reemplaza el cálculo real del contador.
              </span>
            </div>
          )}

          <div className="col-span-1 sm:col-span-2 lg:col-span-3">
            <Button type="submit" disabled={guardandoGasto}>{guardandoGasto ? "Guardando…" : "Registrar gasto"}</Button>
          </div>
        </form>

        <Table
          headers={["Fecha", "Proveedor", "Categoría fiscal", "Factura/DTE", "Monto", "Impuesto estimado", ""]}
          rows={gastosPag.loading ? [] : gastosPag.items}
          emptyMessage={gastosPag.loading ? "Cargando…" : "Sin gastos registrados."}
          renderRow={(g) => (
            <>
              <td className="px-4 py-3">{new Date(g.fecha).toLocaleDateString()}</td>
              <td className="px-4 py-3">{g.proveedor}{g.descripcion ? <span className="block text-xs" style={{ color: "#999" }}>{g.descripcion}</span> : null}</td>
              <td className="px-4 py-3">{g.categoriaFiscal?.nombre || <span style={{ color: "#999" }}>Sin clasificar</span>}</td>
              <td className="px-4 py-3" style={{ color: "#666" }}>{g.numeroFactura || "—"}</td>
              <td className="px-4 py-3 font-semibold">Q{Number(g.monto).toFixed(2)}</td>
              <td className="px-4 py-3" style={{ color: "#666" }}>{g.montoImpuestoEstimado != null ? `Q${Number(g.montoImpuestoEstimado).toFixed(2)}` : "—"}</td>
              <td className="px-4 py-3">
                <button onClick={() => eliminarGasto(g)} className="flex items-center gap-1 text-xs font-semibold" style={{ color: COLORS.red }}>
                  <Trash2 size={13} /> Eliminar
                </button>
              </td>
            </>
          )}
        />
        <Pagination page={gastosPag.page} totalPages={gastosPag.totalPages} total={gastosPag.total} onChange={gastosPag.setPage} />
      </Card>

      {esAdmin && (
        <Card style={{ marginTop: 16 }}>
          <div className="font-semibold text-sm mb-1">Categorías fiscales</div>
          <p className="text-xs mb-3" style={{ color: "#888" }}>
            Catálogo editable: confirme con su contador los regímenes y tasas antes de usarlos para declarar, la SAT los puede cambiar.
          </p>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {(categoriasFiscales || []).map((c) => (
              <span key={c.id} className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: "#FAFAFB", border: `1px solid ${COLORS.border}`, color: "#555" }}>
                {c.nombre}{c.tasa != null ? ` (${c.tasa}%)` : ""}
              </span>
            ))}
          </div>
          <form onSubmit={agregarCategoria} className="flex flex-wrap items-end gap-3">
            <FormField label="Nueva categoría">
              <TextInput value={nuevaCategoria.nombre} onChange={(e) => setNuevaCategoria((c) => ({ ...c, nombre: e.target.value }))} placeholder='ej. "ISR Régimen sobre Utilidades (25%)"' style={{ minWidth: 280 }} />
            </FormField>
            <FormField label="Tasa % (opcional)">
              <TextInput type="number" step="0.01" min="0" value={nuevaCategoria.tasa} onChange={(e) => setNuevaCategoria((c) => ({ ...c, tasa: e.target.value }))} style={{ maxWidth: 120 }} />
            </FormField>
            <Button type="submit" variant="secondary" disabled={guardandoCategoria || !nuevaCategoria.nombre.trim()}>
              <span className="flex items-center gap-1.5"><Plus size={14} /> Agregar</span>
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
