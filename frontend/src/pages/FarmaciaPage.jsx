import React, { useEffect, useState } from "react";
import { ShoppingCart, Trash2, Printer, Pencil } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Table } from "../components/Table";
import { Button } from "../components/Button";
import { Banner } from "../components/Banner";
import { Modal } from "../components/Modal";
import { FacturaImprimible } from "../components/FacturaImprimible";
import { FormField, TextInput, Select, SearchInput } from "../components/FormField";
import { PacienteBuscador } from "../components/PacienteBuscador";
import { useFetch } from "../hooks/useFetch";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { COLORS } from "../styles/tokens";
import { ROLES, tieneRol } from "../utils/roles";

const ESTADO_LABEL = { ok: "OK", stock_bajo: "Stock bajo", por_vencer: "Por vencer" };

export function FarmaciaPage() {
  const { usuario } = useAuth();
  const puedeGestionar = tieneRol(usuario, ROLES.FARMACIA, ROLES.ADMIN);

  const { data: medicamentos, loading, error, reload } = useFetch("/farmacia");
  const [buscarMed, setBuscarMed] = useState("");
  const medicamentosFiltrados = (medicamentos || []).filter((m) =>
    m.nombre.toLowerCase().includes(buscarMed.trim().toLowerCase())
  );
  const { data: facturas, reload: reloadFacturas } = useFetch("/farmacia/ventas", { enabled: puedeGestionar });

  const [nuevoMed, setNuevoMed] = useState({ nombre: "", tipo: "", presentacion: "", stock: "", stockMinimo: "10", precioVenta: "", fechaVencimiento: "", proveedor: "" });
  const [mov, setMov] = useState({ medicamentoId: "", cantidad: "" });
  const [movPaciente, setMovPaciente] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  // Carrito de venta directa (RF-20/RF-24/RF-27): varios medicamentos en una sola factura
  const [carrito, setCarrito] = useState([]);
  const [itemForm, setItemForm] = useState({ medicamentoId: "", cantidad: "1" });
  const [carritoPaciente, setCarritoPaciente] = useState(null);
  const [cobrando, setCobrando] = useState(false);
  const [mensajeCarrito, setMensajeCarrito] = useState(null);
  const [facturaImprimir, setFacturaImprimir] = useState(null);

  // Editar medicamento existente (RF-22): no toca el stock, que solo se
  // mueve via entradas/salidas para no perder el rastro del kardex.
  const [medicamentoEditar, setMedicamentoEditar] = useState(null);
  const [editForm, setEditForm] = useState({ nombre: "", tipo: "", presentacion: "", stockMinimo: "", precioVenta: "", fechaVencimiento: "", proveedor: "" });
  const [guardandoEdit, setGuardandoEdit] = useState(false);
  const [mensajeEdit, setMensajeEdit] = useState(null);

  function abrirEditar(m) {
    setMedicamentoEditar(m);
    setEditForm({
      nombre: m.nombre,
      tipo: m.tipo || "",
      presentacion: m.presentacion || "",
      stockMinimo: m.stockMinimo,
      precioVenta: m.precioVenta,
      fechaVencimiento: m.fechaVencimiento ? m.fechaVencimiento.slice(0, 10) : "",
      proveedor: m.proveedor || "",
    });
    setMensajeEdit(null);
  }

  async function guardarEdicion(e) {
    e.preventDefault();
    setGuardandoEdit(true);
    setMensajeEdit(null);
    try {
      await api.put(`/farmacia/${medicamentoEditar.id}`, {
        ...editForm,
        stockMinimo: Number(editForm.stockMinimo || 0),
        precioVenta: Number(editForm.precioVenta || 0),
      });
      setMedicamentoEditar(null);
      reload();
    } catch (err) {
      setMensajeEdit({ tone: "error", texto: err.message });
    } finally {
      setGuardandoEdit(false);
    }
  }

  useEffect(() => {
    if (!mov.medicamentoId && medicamentos?.length) setMov((m) => ({ ...m, medicamentoId: medicamentos[0].id }));
    if (!itemForm.medicamentoId && medicamentos?.length) setItemForm((f) => ({ ...f, medicamentoId: medicamentos[0].id }));
  }, [medicamentos]); // eslint-disable-line

  const alertas = (medicamentos || []).filter((m) => m.estado.includes("stock_bajo") || m.estado.includes("por_vencer"));
  const totalCarrito = carrito.reduce((suma, i) => suma + i.precioVenta * i.cantidad, 0);

  async function crearMedicamento(e) {
    e.preventDefault();
    setGuardando(true);
    setMensaje(null);
    try {
      await api.post("/farmacia", {
        ...nuevoMed,
        stock: Number(nuevoMed.stock || 0),
        stockMinimo: Number(nuevoMed.stockMinimo || 10),
        precioVenta: Number(nuevoMed.precioVenta || 0),
      });
      setMensaje({ tone: "success", texto: "Medicamento agregado al inventario." });
      setNuevoMed({ nombre: "", tipo: "", presentacion: "", stock: "", stockMinimo: "10", precioVenta: "", fechaVencimiento: "", proveedor: "" });
      reload();
    } catch (err) {
      setMensaje({ tone: "error", texto: err.message });
    } finally {
      setGuardando(false);
    }
  }

  // RF-24/RF-15: salida por uso intrahospitalario (un medicamento, cargado al costeo del paciente)
  async function registrarMovimiento(e) {
    e.preventDefault();
    if (!movPaciente) {
      setMensaje({ tone: "error", texto: "Seleccione un paciente." });
      return;
    }
    setGuardando(true);
    setMensaje(null);
    try {
      await api.post(`/farmacia/${mov.medicamentoId}/salidas`, { cantidad: Number(mov.cantidad), pacienteId: movPaciente?.id });
      setMensaje({ tone: "success", texto: "Movimiento registrado y cargado al costeo del paciente." });
      setMov((m) => ({ ...m, cantidad: "" }));
      setMovPaciente(null);
      reload();
    } catch (err) {
      setMensaje({ tone: "error", texto: err.message });
    } finally {
      setGuardando(false);
    }
  }

  function agregarAlCarrito() {
    const medicamento = (medicamentos || []).find((m) => m.id === Number(itemForm.medicamentoId));
    const cantidad = Number(itemForm.cantidad);
    if (!medicamento || !cantidad || cantidad <= 0) return;

    setCarrito((c) => {
      const existente = c.find((i) => i.medicamentoId === medicamento.id);
      if (existente) {
        return c.map((i) => (i.medicamentoId === medicamento.id ? { ...i, cantidad: i.cantidad + cantidad } : i));
      }
      return [...c, { medicamentoId: medicamento.id, nombre: medicamento.nombre, precioVenta: Number(medicamento.precioVenta), cantidad }];
    });
    setItemForm((f) => ({ ...f, cantidad: "1" }));
  }

  function quitarDelCarrito(medicamentoId) {
    setCarrito((c) => c.filter((i) => i.medicamentoId !== medicamentoId));
  }

  async function cobrarCarrito() {
    setCobrando(true);
    setMensajeCarrito(null);
    try {
      const factura = await api.post("/farmacia/ventas", {
        pacienteId: carritoPaciente?.id,
        items: carrito.map((i) => ({ medicamentoId: i.medicamentoId, cantidad: i.cantidad })),
      });
      setMensajeCarrito({ tone: "success", texto: `Factura #${factura.id} generada por Q${Number(factura.montoTotal).toFixed(2)}` });
      setCarrito([]);
      setCarritoPaciente(null);
      reload();
      reloadFacturas();
    } catch (err) {
      setMensajeCarrito({ tone: "error", texto: err.message });
    } finally {
      setCobrando(false);
    }
  }

  return (
    <div>
      <PageHeader title="Farmacia — Inventario de Medicamentos" subtitle="Módulo independiente, con facturación propia" />

      {alertas.length > 0 && (
        <Banner tone="error">
          ⚠ {alertas.filter((a) => a.estado.includes("stock_bajo")).length} medicamento(s) con stock bajo el mínimo ·{" "}
          {alertas.filter((a) => a.estado.includes("por_vencer")).length} próximo(s) a vencer
        </Banner>
      )}
      {error && <Banner tone="error">{error}</Banner>}

      <div className="mb-4">
        <SearchInput
          placeholder="Buscar medicamento por nombre…"
          value={buscarMed}
          onChange={(e) => setBuscarMed(e.target.value)}
          onClear={setBuscarMed}
          containerStyle={{ maxWidth: 360 }}
        />
      </div>

      <Table
        headers={["Medicamento", "Tipo", "Stock", "Precio venta", "Vencimiento", "Proveedor", "Estado", ""]}
        rows={loading ? [] : medicamentosFiltrados}
        emptyMessage={loading ? "Cargando…" : buscarMed ? "Sin medicamentos que coincidan con la búsqueda." : "Sin medicamentos registrados."}
        renderRow={(r) => (
          <>
            <td className="px-4 py-3">{r.nombre}</td>
            <td className="px-4 py-3" style={{ color: "#666" }}>{r.tipo || "—"}</td>
            <td className="px-4 py-3">{r.stock}</td>
            <td className="px-4 py-3" style={{ color: "#666" }}>Q{Number(r.precioVenta).toFixed(2)}</td>
            <td className="px-4 py-3" style={{ color: "#666" }}>{r.fechaVencimiento ? new Date(r.fechaVencimiento).toLocaleDateString() : "—"}</td>
            <td className="px-4 py-3" style={{ color: "#666" }}>{r.proveedor || "—"}</td>
            <td className="px-4 py-3 font-semibold" style={{ color: r.estado.includes("ok") ? COLORS.green : COLORS.red }}>
              {r.estado.map((e) => ESTADO_LABEL[e]).join(" · ")}
            </td>
            <td className="px-4 py-3">
              {puedeGestionar && (
                <button onClick={() => abrirEditar(r)} className="flex items-center gap-1 text-xs font-semibold" style={{ color: COLORS.navy }}>
                  <Pencil size={13} /> Editar
                </button>
              )}
            </td>
          </>
        )}
      />

      {puedeGestionar && (
        <>
          <Card style={{ marginTop: 16 }}>
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart size={16} style={{ color: COLORS.navy }} />
              <div className="font-semibold text-sm">Venta directa</div>
            </div>
            <p className="text-xs mb-4" style={{ color: "#888" }}>
              Agregue uno o varios medicamentos al carrito. Puede asociarla a un paciente (para su registro) o dejarla sin paciente. Al cobrar se genera una sola factura con el detalle de cada medicamento.
            </p>
            {mensajeCarrito && <Banner tone={mensajeCarrito.tone}>{mensajeCarrito.texto}</Banner>}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end mb-4">
              <FormField label="Medicamento">
                <Select value={itemForm.medicamentoId} onChange={(e) => setItemForm((f) => ({ ...f, medicamentoId: e.target.value }))}>
                  {(medicamentos || []).map((m) => <option key={m.id} value={m.id}>{m.nombre} (Q{Number(m.precioVenta).toFixed(2)})</option>)}
                </Select>
              </FormField>
              <FormField label="Cantidad">
                <TextInput type="number" min="1" value={itemForm.cantidad} onChange={(e) => setItemForm((f) => ({ ...f, cantidad: e.target.value }))} />
              </FormField>
              <div>
                <Button variant="secondary" onClick={agregarAlCarrito}>+ Agregar al carrito</Button>
              </div>
            </div>

            {carrito.length > 0 && (
              <div className="mb-4 rounded-xl overflow-hidden border" style={{ borderColor: COLORS.border }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: "#F7F8FB" }}>
                      <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: "#888" }}>Medicamento</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold" style={{ color: "#888" }}>Cant.</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold" style={{ color: "#888" }}>Subtotal</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {carrito.map((i) => (
                      <tr key={i.medicamentoId} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                        <td className="px-3 py-2">{i.nombre}</td>
                        <td className="px-3 py-2 text-right">{i.cantidad}</td>
                        <td className="px-3 py-2 text-right">Q{(i.precioVenta * i.cantidad).toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">
                          <button onClick={() => quitarDelCarrito(i.medicamentoId)} className="text-gray-400 hover:text-red-500" aria-label="Quitar">
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <FormField label="Paciente (opcional)">
                <div style={{ minWidth: 260 }}>
                  <PacienteBuscador pacienteSeleccionado={carritoPaciente} onSelect={setCarritoPaciente} permitirVacio />
                </div>
              </FormField>
              <div className="flex-1 text-right sm:text-left">
                <div className="text-xs font-semibold" style={{ color: "#888" }}>TOTAL</div>
                <div className="text-xl font-bold" style={{ color: COLORS.navy }}>Q{totalCarrito.toFixed(2)}</div>
              </div>
              <Button onClick={cobrarCarrito} disabled={carrito.length === 0 || cobrando}>
                {cobrando ? "Generando factura…" : "Cobrar y generar factura"}
              </Button>
            </div>
          </Card>

          <Card style={{ marginTop: 16 }}>
            <div className="font-semibold text-sm mb-3">Salida por uso intrahospitalario</div>
            {mensaje && <Banner tone={mensaje.tone}>{mensaje.texto}</Banner>}
            <form onSubmit={registrarMovimiento} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <FormField label="Medicamento">
                <Select required value={mov.medicamentoId} onChange={(e) => setMov((m) => ({ ...m, medicamentoId: e.target.value }))}>
                  {(medicamentos || []).map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </Select>
              </FormField>
              <FormField label="Cantidad"><TextInput type="number" min="1" required value={mov.cantidad} onChange={(e) => setMov((m) => ({ ...m, cantidad: e.target.value }))} /></FormField>
              <FormField label="Paciente">
                <PacienteBuscador pacienteSeleccionado={movPaciente} onSelect={setMovPaciente} />
              </FormField>
              <div>
                <Button type="submit" disabled={guardando}>{guardando ? "Registrando…" : "Registrar"}</Button>
              </div>
            </form>
          </Card>

          <Card style={{ marginTop: 16 }}>
            <div className="font-semibold text-sm mb-3">Facturas de farmacia recientes</div>
            <Table
              headers={["Factura", "Paciente", "Medicamentos", "Total", "Fecha", ""]}
              rows={facturas || []}
              emptyMessage="Sin ventas registradas."
              renderRow={(f) => (
                <>
                  <td className="px-4 py-3 font-semibold">#{f.id}</td>
                  <td className="px-4 py-3" style={{ color: "#666" }}>{f.paciente?.nombreCompleto || "Venta mostrador"}</td>
                  <td className="px-4 py-3" style={{ color: "#666" }}>{f.items.map((i) => i.medicamento.nombre).join(", ")}</td>
                  <td className="px-4 py-3 font-semibold">Q{Number(f.montoTotal).toFixed(2)}</td>
                  <td className="px-4 py-3" style={{ color: "#666" }}>{new Date(f.creadoEn).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setFacturaImprimir(f)} className="flex items-center gap-1 text-xs font-semibold" style={{ color: COLORS.navy }}>
                      <Printer size={13} /> Imprimir
                    </button>
                  </td>
                </>
              )}
            />
          </Card>

          <Card style={{ marginTop: 16 }}>
            <div className="font-semibold text-sm mb-3">+ Nuevo medicamento</div>
            <form onSubmit={crearMedicamento} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <FormField label="Nombre"><TextInput required value={nuevoMed.nombre} onChange={(e) => setNuevoMed((f) => ({ ...f, nombre: e.target.value }))} /></FormField>
              <FormField label="Tipo"><TextInput value={nuevoMed.tipo} onChange={(e) => setNuevoMed((f) => ({ ...f, tipo: e.target.value }))} /></FormField>
              <FormField label="Presentación"><TextInput value={nuevoMed.presentacion} onChange={(e) => setNuevoMed((f) => ({ ...f, presentacion: e.target.value }))} /></FormField>
              <FormField label="Proveedor"><TextInput value={nuevoMed.proveedor} onChange={(e) => setNuevoMed((f) => ({ ...f, proveedor: e.target.value }))} /></FormField>
              <FormField label="Stock inicial"><TextInput type="number" min="0" value={nuevoMed.stock} onChange={(e) => setNuevoMed((f) => ({ ...f, stock: e.target.value }))} /></FormField>
              <FormField label="Stock mínimo"><TextInput type="number" min="0" value={nuevoMed.stockMinimo} onChange={(e) => setNuevoMed((f) => ({ ...f, stockMinimo: e.target.value }))} /></FormField>
              <FormField label="Precio de venta (Q)"><TextInput type="number" step="0.01" min="0" value={nuevoMed.precioVenta} onChange={(e) => setNuevoMed((f) => ({ ...f, precioVenta: e.target.value }))} /></FormField>
              <FormField label="Fecha de vencimiento"><TextInput type="date" value={nuevoMed.fechaVencimiento} onChange={(e) => setNuevoMed((f) => ({ ...f, fechaVencimiento: e.target.value }))} /></FormField>
              <div className="col-span-1 sm:col-span-2 lg:col-span-4">
                <Button type="submit" disabled={guardando}>{guardando ? "Guardando…" : "Agregar medicamento"}</Button>
              </div>
            </form>
          </Card>
        </>
      )}

      <Modal open={!!medicamentoEditar} onClose={() => setMedicamentoEditar(null)} title="Editar medicamento" maxWidth={520}>
        {medicamentoEditar && (
          <form onSubmit={guardarEdicion} className="flex flex-col gap-4">
            {mensajeEdit && <Banner tone={mensajeEdit.tone}>{mensajeEdit.texto}</Banner>}
            <FormField label="Nombre"><TextInput required value={editForm.nombre} onChange={(e) => setEditForm((f) => ({ ...f, nombre: e.target.value }))} /></FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Tipo"><TextInput value={editForm.tipo} onChange={(e) => setEditForm((f) => ({ ...f, tipo: e.target.value }))} /></FormField>
              <FormField label="Presentación"><TextInput value={editForm.presentacion} onChange={(e) => setEditForm((f) => ({ ...f, presentacion: e.target.value }))} /></FormField>
            </div>
            <FormField label="Proveedor"><TextInput value={editForm.proveedor} onChange={(e) => setEditForm((f) => ({ ...f, proveedor: e.target.value }))} /></FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Stock mínimo"><TextInput type="number" min="0" value={editForm.stockMinimo} onChange={(e) => setEditForm((f) => ({ ...f, stockMinimo: e.target.value }))} /></FormField>
              <FormField label="Precio de venta (Q)"><TextInput type="number" step="0.01" min="0" value={editForm.precioVenta} onChange={(e) => setEditForm((f) => ({ ...f, precioVenta: e.target.value }))} /></FormField>
            </div>
            <FormField label="Fecha de vencimiento"><TextInput type="date" value={editForm.fechaVencimiento} onChange={(e) => setEditForm((f) => ({ ...f, fechaVencimiento: e.target.value }))} /></FormField>
            <p className="text-xs" style={{ color: "#888" }}>El stock actual ({medicamentoEditar.stock} unidades) no se edita aquí — use entradas/salidas para moverlo, así el kardex queda completo.</p>
            <div>
              <Button type="submit" disabled={guardandoEdit}>{guardandoEdit ? "Guardando…" : "Guardar cambios"}</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!facturaImprimir} onClose={() => setFacturaImprimir(null)} title="Factura de farmacia" maxWidth={620}>
        {facturaImprimir && (
          <FacturaImprimible
            titulo="Factura de Farmacia"
            numero={facturaImprimir.id}
            fecha={facturaImprimir.creadoEn}
            paciente={facturaImprimir.paciente}
            atendidoPor={facturaImprimir.registrador?.nombre}
            lineas={facturaImprimir.items.map((i) => ({
              concepto: i.medicamento.nombre,
              cantidad: i.cantidad,
              precioUnitario: i.precioUnitario,
              subtotal: i.subtotal,
            }))}
            total={facturaImprimir.montoTotal}
          />
        )}
      </Modal>
    </div>
  );
}
