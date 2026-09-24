import React, { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList,
} from "recharts";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Table } from "../components/Table";
import { Button } from "../components/Button";
import { FormField, TextInput } from "../components/FormField";
import { useFetch } from "../hooks/useFetch";
import { usePaginatedFetch } from "../hooks/usePaginatedFetch";
import { Pagination } from "../components/Pagination";
import { useAuth } from "../context/AuthContext";
import { COLORS } from "../styles/tokens";
import { ROLES, tieneRol, etiquetasRoles } from "../utils/roles";
import { etiquetaCondicionEgreso } from "../utils/condicionesEgreso";

const tickStyle = { fontSize: 12, fill: COLORS.textMuted };
const tooltipStyle = { borderRadius: 10, border: `1px solid ${COLORS.border}`, fontSize: 13, boxShadow: "0 4px 16px rgba(16,24,40,0.08)" };

function formatoMes(mes) {
  const [y, m] = mes.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-GT", { month: "short", year: "2-digit" });
}
// El periodo llega como "2026-09" (mes), "2026-09-14" (lunes de la semana) o
// "2026-09-20" (dia), ya calculado en la zona horaria del hospital.
const GRANULARIDADES = [
  { valor: "dia", texto: "Por día" },
  { valor: "semana", texto: "Por semana" },
  { valor: "mes", texto: "Por mes" },
];
const TITULO_PERIODO = { dia: "día", semana: "semana", mes: "mes" };

function formatoPeriodo(periodo, granularidad) {
  if (granularidad === "mes") return formatoMes(periodo);
  const [y, m, d] = periodo.split("-").map(Number);
  const corto = new Date(y, m - 1, d).toLocaleDateString("es-GT", { day: "2-digit", month: "2-digit" });
  return granularidad === "semana" ? `Sem. ${corto}` : corto;
}
function etiquetaCompleta(periodo, granularidad) {
  if (granularidad === "mes") return formatoMes(periodo);
  const [y, m, d] = periodo.split("-").map(Number);
  const completo = new Date(y, m - 1, d).toLocaleDateString("es-GT", { day: "2-digit", month: "2-digit", year: "numeric" });
  return granularidad === "semana" ? `Semana del lunes ${completo}` : completo;
}
function formatoQ(v) {
  return `Q${Number(v).toLocaleString()}`;
}

export function ReportesPage() {
  const { usuario } = useAuth();

  if (!tieneRol(usuario, ROLES.ADMIN)) {
    return (
      <div>
        <PageHeader title="Reportes" />
        <Card>
          <p className="text-sm" style={{ color: "#666" }}>Los reportes administrativos y financieros están disponibles solo para el Administrador (RF-31).</p>
        </Card>
      </div>
    );
  }

  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const rango = (desde ? `desde=${desde}` : "") + (desde && hasta ? "&" : "") + (hasta ? `hasta=${hasta}` : "");
  const conRango = (path) => (rango ? `${path}${path.includes("?") ? "&" : "?"}${rango}` : path);

  const { data: financiero } = useFetch(conRango("/reportes/financiero"));
  const { data: admisiones } = useFetch(conRango("/reportes/admisiones"));
  const { data: porFormaPago } = useFetch(conRango("/reportes/facturacion-por-forma-pago"));
  const [granularidad, setGranularidad] = useState("mes");
  const { data: ingresosPorMes } = useFetch(conRango(`/reportes/ingresos-por-mes?granularidad=${granularidad}`));
  const kardexPag = usePaginatedFetch(conRango("/reportes/inventario-kardex"), { pageSize: 20 });

  const datosAdmisiones = (admisiones?.porCondicionEgreso || []).map((c) => ({
    condicion: etiquetaCondicionEgreso(c.condicion),
    total: c.total,
  }));
  const datosFormaPago = (porFormaPago || []).map((f) => ({
    formaPago: f.formaPago === "efectivo" ? "Efectivo" : "Transferencia",
    total: f.total,
    cantidad: f.cantidad,
  }));

  const [mostrarAuditoria, setMostrarAuditoria] = useState(false);
  const [buscarInput, setBuscarInput] = useState("");
  const [buscarAuditoria, setBuscarAuditoria] = useState("");
  const [mostrarBitacora, setMostrarBitacora] = useState(false);
  const [buscarBitacoraInput, setBuscarBitacoraInput] = useState("");
  const [buscarBitacora, setBuscarBitacora] = useState("");
  const [accionBitacora, setAccionBitacora] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setBuscarAuditoria(buscarInput), 300);
    return () => clearTimeout(timeout);
  }, [buscarInput]);

  useEffect(() => {
    const timeout = setTimeout(() => setBuscarBitacora(buscarBitacoraInput), 300);
    return () => clearTimeout(timeout);
  }, [buscarBitacoraInput]);

  const auditoriaPag = usePaginatedFetch(
    conRango(`/reportes/auditoria-diagnostico${buscarAuditoria ? `?buscar=${encodeURIComponent(buscarAuditoria)}` : ""}`),
    { pageSize: 20, enabled: mostrarAuditoria }
  );

  // Sprint 7: bitacora general de actividad (login/logout, creaciones,
  // actualizaciones y acciones financieras), separada de la auditoria del
  // diagnostico confidencial.
  const bitacoraPath = `/reportes/actividad${accionBitacora || buscarBitacora ? "?" : ""}${accionBitacora ? `accion=${accionBitacora}` : ""}${accionBitacora && buscarBitacora ? "&" : ""}${buscarBitacora ? `buscar=${encodeURIComponent(buscarBitacora)}` : ""}`;
  const bitacoraPag = usePaginatedFetch(conRango(bitacoraPath), { pageSize: 20, enabled: mostrarBitacora });

  return (
    <div>
      <PageHeader title="Reportes" subtitle="Reportes administrativos y financieros para apoyar la toma de decisiones (RF-31)" />

      <div className="flex items-end gap-3 flex-wrap mb-4">
        <FormField label="Desde"><TextInput type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></FormField>
        <FormField label="Hasta"><TextInput type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></FormField>
        {(desde || hasta) && (
          <button
            onClick={() => { setDesde(""); setHasta(""); }}
            className="text-xs font-semibold mb-2.5"
            style={{ color: COLORS.navy }}
          >
            Limpiar rango
          </button>
        )}
        <p className="text-xs mb-2.5" style={{ color: "#888" }}>El rango aplica a todas las gráficas y tablas de esta página.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
        <Card>
          <div className="text-xs font-semibold" style={{ color: "#888" }}>INGRESOS HOSPITAL</div>
          <div className="text-2xl font-bold mt-1" style={{ color: COLORS.navy }}>Q {financiero?.ingresosHospital?.toLocaleString() ?? "—"}</div>
        </Card>
        <Card>
          <div className="text-xs font-semibold" style={{ color: "#888" }}>INGRESOS FARMACIA</div>
          <div className="text-2xl font-bold mt-1" style={{ color: COLORS.gold }}>Q {financiero?.ingresosFarmacia?.toLocaleString() ?? "—"}</div>
        </Card>
        <Card>
          <div className="text-xs font-semibold" style={{ color: "#888" }}>TOTAL CONSOLIDADO</div>
          <div className="text-2xl font-bold mt-1" style={{ color: COLORS.text }}>Q {financiero?.totalConsolidado?.toLocaleString() ?? "—"}</div>
        </Card>
        <Card>
          <div className="text-xs font-semibold" style={{ color: "#888" }}>GASTOS DEL HOSPITAL</div>
          <div className="text-2xl font-bold mt-1" style={{ color: COLORS.red }}>Q {financiero?.totalGastos?.toLocaleString() ?? "—"}</div>
        </Card>
        <Card>
          <div className="text-xs font-semibold" style={{ color: "#888" }}>INGRESO NETO</div>
          <div className="text-2xl font-bold mt-1" style={{ color: (financiero?.ingresoNeto ?? 0) >= 0 ? COLORS.navy : COLORS.red }}>Q {financiero?.ingresoNeto?.toLocaleString() ?? "—"}</div>
        </Card>
      </div>

      {financiero?.gastosPorCategoria?.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div className="font-semibold text-sm mb-1">Gastos por categoría fiscal</div>
          <p className="text-xs mb-3" style={{ color: "#888" }}>
            Desglose del período elegido, con el impuesto estimado de cada categoría — captura y corrección en
            "Gastos del Hospital".
          </p>
          <Table
            headers={["Categoría fiscal", "Monto", "Impuesto estimado"]}
            rows={financiero.gastosPorCategoria}
            renderRow={(g) => (
              <>
                <td className="px-4 py-3">{g.categoria}</td>
                <td className="px-4 py-3 font-semibold">Q{g.total.toLocaleString()}</td>
                <td className="px-4 py-3" style={{ color: "#666" }}>{g.impuestoEstimado ? `Q${g.impuestoEstimado.toLocaleString()}` : "—"}</td>
              </>
            )}
          />
        </Card>
      )}

      <Card style={{ marginBottom: 16 }}>
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div>
            <div className="font-semibold text-sm mb-1">Ingresos por {TITULO_PERIODO[granularidad]}</div>
            <p className="text-xs" style={{ color: "#888" }}>Hospital vs. farmacia, agrupado por {TITULO_PERIODO[granularidad]} (RF-21). Solo aparecen los períodos con movimiento.</p>
          </div>
          <div className="flex gap-1" role="group" aria-label="Agrupar ingresos por">
            {GRANULARIDADES.map((g) => (
              <button
                key={g.valor}
                onClick={() => setGranularidad(g.valor)}
                aria-pressed={granularidad === g.valor}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={granularidad === g.valor ? { backgroundColor: COLORS.navy, color: "white" } : { border: `1px solid ${COLORS.border}`, color: COLORS.text }}
              >
                {g.texto}
              </button>
            ))}
          </div>
        </div>
        {ingresosPorMes?.length ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={ingresosPorMes} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4}>
              <CartesianGrid vertical={false} stroke={COLORS.border} />
              <XAxis dataKey="periodo" tickFormatter={(p) => formatoPeriodo(p, granularidad)} tick={tickStyle} axisLine={{ stroke: COLORS.border }} tickLine={false} />
              <YAxis tickFormatter={formatoQ} tick={tickStyle} axisLine={false} tickLine={false} width={72} />
              <Tooltip formatter={(v, name) => [formatoQ(v), name]} labelFormatter={(p) => etiquetaCompleta(p, granularidad)} contentStyle={tooltipStyle} cursor={{ fill: COLORS.lightBg }} />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={(value) => <span style={{ color: COLORS.textMuted }}>{value}</span>} />
              <Bar dataKey="ingresosHospital" name="Hospital" fill={COLORS.navy} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="ingresosFarmacia" name="Farmacia" fill={COLORS.gold} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm py-6 text-center" style={{ color: "#888" }}>Todavía no hay facturas registradas para graficar.</p>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <div className="font-semibold text-sm mb-1">Admisiones por condición de egreso</div>
          <p className="text-xs mb-3" style={{ color: "#888" }}>Total de ingresos en el periodo: {admisiones?.totalIngresos ?? "—"}</p>
          {datosAdmisiones.length ? (
            <ResponsiveContainer width="100%" height={Math.max(140, datosAdmisiones.length * 44)}>
              <BarChart data={datosAdmisiones} layout="vertical" margin={{ top: 4, right: 28, left: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} stroke={COLORS.border} />
                <XAxis type="number" allowDecimals={false} tick={tickStyle} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="condicion" tick={tickStyle} axisLine={false} tickLine={false} width={150} />
                <Tooltip formatter={(v) => [v, "Pacientes"]} contentStyle={tooltipStyle} cursor={{ fill: COLORS.lightBg }} />
                <Bar dataKey="total" fill={COLORS.navy} radius={[0, 4, 4, 0]} maxBarSize={20}>
                  <LabelList dataKey="total" position="right" style={{ fill: COLORS.text, fontSize: 12 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm py-6 text-center" style={{ color: "#888" }}>Sin condiciones de egreso registradas todavía.</p>
          )}
        </Card>
        <Card>
          <div className="font-semibold text-sm mb-3">Facturación por forma de pago</div>
          {datosFormaPago.length ? (
            <ResponsiveContainer width="100%" height={Math.max(120, datosFormaPago.length * 60)}>
              <BarChart data={datosFormaPago} layout="vertical" margin={{ top: 4, right: 60, left: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} stroke={COLORS.border} />
                <XAxis type="number" tickFormatter={formatoQ} tick={tickStyle} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="formaPago" tick={tickStyle} axisLine={false} tickLine={false} width={90} />
                <Tooltip formatter={(v, n, p) => [`${formatoQ(v)} (${p.payload.cantidad} facturas)`, "Total"]} contentStyle={tooltipStyle} cursor={{ fill: COLORS.lightBg }} />
                <Bar dataKey="total" fill={COLORS.navy} radius={[0, 4, 4, 0]} maxBarSize={28}>
                  <LabelList dataKey="total" position="right" formatter={formatoQ} style={{ fill: COLORS.text, fontSize: 12 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm py-6 text-center" style={{ color: "#888" }}>Sin facturas registradas todavía.</p>
          )}
        </Card>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div className="font-semibold text-sm mb-3">Kardex de inventario de farmacia (RNF-10)</div>
        <Table
          headers={["Medicamento", "Tipo", "Cantidad", "Motivo", "Fecha"]}
          rows={kardexPag.loading ? [] : kardexPag.items}
          emptyMessage={kardexPag.loading ? "Cargando…" : "Sin movimientos registrados."}
          renderRow={(m) => (
            <>
              <td className="px-4 py-3">{m.medicamento?.nombre}</td>
              <td className="px-4 py-3" style={{ color: m.tipo === "entrada" ? COLORS.green : COLORS.red }}>{m.tipo}</td>
              <td className="px-4 py-3">{m.cantidad}</td>
              <td className="px-4 py-3" style={{ color: "#666" }}>{m.motivo || "—"}</td>
              <td className="px-4 py-3" style={{ color: "#666" }}>{new Date(m.fecha).toLocaleString()}</td>
            </>
          )}
        />
        <Pagination page={kardexPag.page} totalPages={kardexPag.totalPages} total={kardexPag.total} onChange={kardexPag.setPage} />
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="font-semibold text-sm mb-1">Auditoría de accesos al diagnóstico confidencial (RNF-08)</div>
            <p className="text-xs" style={{ color: "#888" }}>
              Quién vio el diagnóstico de cada paciente, cuándo, y si fue como Administrador (acceso directo) o con un token temporal.
            </p>
          </div>
          <Button variant="secondary" onClick={() => setMostrarAuditoria((v) => !v)}>
            <span className="flex items-center gap-1.5">
              {mostrarAuditoria ? <EyeOff size={15} /> : <Eye size={15} />}
              {mostrarAuditoria ? "Ocultar auditoría" : "Ver auditoría"}
            </span>
          </Button>
        </div>

        {mostrarAuditoria && (
          <div className="mt-4 animate-fade-in">
            <TextInput
              placeholder="Buscar por usuario, paciente o historia clínica…"
              value={buscarInput}
              onChange={(e) => setBuscarInput(e.target.value)}
              style={{ maxWidth: 360, marginBottom: 12 }}
            />
            <Table
              headers={["Usuario", "Rol", "Paciente", "Acción", "Tipo de acceso", "Fecha"]}
              rows={auditoriaPag.loading ? [] : auditoriaPag.items}
              emptyMessage={auditoriaPag.loading ? "Cargando…" : "Sin accesos registrados."}
              renderRow={(a) => (
                <>
                  <td className="px-4 py-3 font-semibold">{a.usuario?.nombre}</td>
                  <td className="px-4 py-3" style={{ color: "#666" }}>{etiquetasRoles(a.usuario?.roles)}</td>
                  <td className="px-4 py-3">{a.paciente?.nombreCompleto} <span style={{ color: "#999" }}>({a.paciente?.historiaClinica})</span></td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs font-semibold px-2 py-1 rounded-full"
                      style={
                        a.accion === "registrar"
                          ? { backgroundColor: "#FBF2E1", color: COLORS.gold }
                          : { backgroundColor: "#E5F6EE", color: COLORS.navy }
                      }
                    >
                      {a.accion === "registrar" ? "Registro / edición" : "Visualización"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold" style={{ color: a.viaToken ? COLORS.gold : COLORS.navy }}>
                    {a.viaToken ? "Con token temporal" : "Administrador (directo)"}
                  </td>
                  <td className="px-4 py-3" style={{ color: "#666" }}>{new Date(a.fecha).toLocaleString()}</td>
                </>
              )}
            />
            <Pagination page={auditoriaPag.page} totalPages={auditoriaPag.totalPages} total={auditoriaPag.total} onChange={auditoriaPag.setPage} />
          </div>
        )}
      </Card>

      <Card style={{ marginTop: 16 }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="font-semibold text-sm mb-1">Bitácora general de actividad</div>
            <p className="text-xs" style={{ color: "#888" }}>
              Quién hizo qué y cuándo: inicios de sesión, creaciones, actualizaciones y acciones financieras de todos los módulos.
              El rango de fechas de arriba aplica también a esta tabla.
            </p>
          </div>
          <Button variant="secondary" onClick={() => setMostrarBitacora((v) => !v)}>
            <span className="flex items-center gap-1.5">
              {mostrarBitacora ? <EyeOff size={15} /> : <Eye size={15} />}
              {mostrarBitacora ? "Ocultar bitácora" : "Ver bitácora"}
            </span>
          </Button>
        </div>

        {mostrarBitacora && (
          <div className="mt-4 animate-fade-in flex flex-wrap gap-3 items-end">
            <TextInput
              placeholder="Buscar por usuario o detalle…"
              value={buscarBitacoraInput}
              onChange={(e) => setBuscarBitacoraInput(e.target.value)}
              style={{ maxWidth: 300 }}
            />
            <FormField label="Acción">
              <select
                value={accionBitacora}
                onChange={(e) => setAccionBitacora(e.target.value)}
                className="text-sm rounded-xl border px-3 py-2.5"
                style={{ borderColor: COLORS.border }}
              >
                <option value="">Todas</option>
                {["login", "logout", "crear_paciente", "actualizar_paciente", "crear_usuario", "actualizar_usuario",
                  "crear_receta", "registrar_tratamiento", "generar_factura_hospital", "venta_farmacia",
                  "entrada_inventario", "salida_uso_intrahospitalario", "registrar_visita", "subir_documento",
                  "descargar_documento", "eliminar_documento", "registrar_gasto", "eliminar_gasto",
                  "crear_categoria_fiscal", "actualizar_categoria_fiscal",
                  "solicitar_reset_password", "reset_password"].map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </FormField>
            <Table
              headers={["Usuario", "Acción", "Detalle", "Fecha"]}
              rows={bitacoraPag.loading ? [] : bitacoraPag.items}
              emptyMessage={bitacoraPag.loading ? "Cargando…" : "Sin actividad registrada."}
              renderRow={(l) => (
                <>
                  <td className="px-4 py-3 font-semibold">{l.usuario?.nombre || "—"}</td>
                  <td className="px-4 py-3"><span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: "#E5F6EE", color: COLORS.navy }}>{l.accion}</span></td>
                  <td className="px-4 py-3" style={{ color: "#666" }}>{l.detalle || "—"}</td>
                  <td className="px-4 py-3" style={{ color: "#666" }}>{new Date(l.fecha).toLocaleString()}</td>
                </>
              )}
            />
            <Pagination page={bitacoraPag.page} totalPages={bitacoraPag.totalPages} total={bitacoraPag.total} onChange={bitacoraPag.setPage} />
          </div>
        )}
      </Card>
    </div>
  );
}
