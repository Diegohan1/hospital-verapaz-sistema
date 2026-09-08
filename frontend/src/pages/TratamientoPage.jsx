import React, { useState } from "react";
import { Printer } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Table } from "../components/Table";
import { Button } from "../components/Button";
import { Banner } from "../components/Banner";
import { Modal } from "../components/Modal";
import { RecetaImprimible } from "../components/RecetaImprimible";
import { FormField, TextInput, Select, TextArea } from "../components/FormField";
import { PacienteBuscador } from "../components/PacienteBuscador";
import { useFetch } from "../hooks/useFetch";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { COLORS } from "../styles/tokens";
import { ROLES, tieneRol } from "../utils/roles";

export function TratamientoPage({ pacienteIdInicial }) {
  const { usuario } = useAuth();
  const puedeRegistrar = tieneRol(usuario, ROLES.ENFERMERIA, ROLES.CONSULTA, ROLES.ADMIN);
  const puedeRecetar = tieneRol(usuario, ROLES.CONSULTA, ROLES.ADMIN);
  const esClinico = tieneRol(usuario, ROLES.CONSULTA);

  const [pacienteId, setPacienteId] = useState(pacienteIdInicial || null);
  // Un solo paciente por id (no una lista completa): con volumen alto de
  // pacientes, cargar todos de una vez para un <select> deja de ser viable.
  const { data: patient } = useFetch(pacienteId ? `/pacientes/${pacienteId}` : null, { enabled: !!pacienteId });

  const { data: items, loading, error, reload } = useFetch(pacienteId ? `/tratamientos?pacienteId=${pacienteId}` : null, { enabled: !!pacienteId });
  const { data: recetas, loading: cargandoRecetas, reload: reloadRecetas } = useFetch(pacienteId ? `/recetas?pacienteId=${pacienteId}` : null, { enabled: !!pacienteId });

  // Sprint 5: catalogo de medicos (rol clinico) para elegir al medico
  // responsable de la receta; el valor inicial es el propio usuario clinico.
  const { data: medicos } = useFetch(puedeRecetar ? "/usuarios/medicos" : null, { enabled: puedeRecetar });

  const [form, setForm] = useState({ descripcion: "", dosis: "", costo: "", origen: "intrahospitalario", cirujano: "", ayudante: "", instrumentista: "", anestesiologo: "" });
  const [esQuirurgico, setEsQuirurgico] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const [recetaForm, setRecetaForm] = useState({ medicamento: "", dosis: "", indicaciones: "", duracion: "", medicoId: "" });
  const [guardandoReceta, setGuardandoReceta] = useState(false);
  const [mensajeReceta, setMensajeReceta] = useState(null);
  const [recetaImprimir, setRecetaImprimir] = useState(null);

  // El medico autenticado es el valor inicial cuando es clinico
  React.useEffect(() => {
    if (esClinico && usuario?.id) {
      setRecetaForm((f) => (f.medicoId ? f : { ...f, medicoId: String(usuario.id) }));
    }
  }, [esClinico, usuario?.id]);

  // Autocompletado de colegiado y especialidad al seleccionar el medico
  const medicoSeleccionado = (medicos || []).find((m) => String(m.id) === String(recetaForm.medicoId));

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    setMensaje(null);
    try {
      await api.post("/tratamientos", { ...form, pacienteId, costo: Number(form.costo) });
      setMensaje({ tone: "success", texto: "Registrado correctamente." });
      setForm({ descripcion: "", dosis: "", costo: "", origen: "intrahospitalario", cirujano: "", ayudante: "", instrumentista: "", anestesiologo: "" });
      setEsQuirurgico(false);
      reload();
    } catch (err) {
      setMensaje({ tone: "error", texto: err.message });
    } finally {
      setGuardando(false);
    }
  }

  async function handleSubmitReceta(e) {
    e.preventDefault();
    setGuardandoReceta(true);
    setMensajeReceta(null);
    try {
      await api.post("/recetas", {
        ...recetaForm,
        pacienteId,
        medicoId: recetaForm.medicoId ? Number(recetaForm.medicoId) : undefined,
      });
      setMensajeReceta({ tone: "success", texto: "Receta registrada correctamente." });
      setRecetaForm((f) => ({ ...f, medicamento: "", dosis: "", indicaciones: "", duracion: "" }));
      reloadRecetas();
    } catch (err) {
      setMensajeReceta({ tone: "error", texto: err.message });
    } finally {
      setGuardandoReceta(false);
    }
  }

  return (
    <div>
      <PageHeader title="Tratamiento y Medicamentos Intrahospitalarios" subtitle={patient ? `Paciente: ${patient.nombreCompleto} · ${patient.historiaClinica}` : undefined} />
      <div className="mb-4">
        <PacienteBuscador pacienteSeleccionado={patient} onSelect={(p) => setPacienteId(p?.id || null)} mostrarListado />
      </div>

      {error && <Banner tone="error">{error}</Banner>}
      {pacienteId && (
      <Table
        headers={["Medicamento / Procedimiento", "Dosis", "Fecha", "Costo", "Origen"]}
        rows={loading ? [] : items || []}
        emptyMessage={loading ? "Cargando…" : "Sin registros para este paciente."}
        renderRow={(r) => (
          <>
            <td className="px-4 py-3">
              {r.descripcion}
              {(r.cirujano || r.ayudante || r.instrumentista || r.anestesiologo) && (
                <div className="text-xs mt-0.5" style={{ color: "#999" }}>
                  {[
                    r.cirujano && `Cirujano: ${r.cirujano}`,
                    r.ayudante && `Ayudante: ${r.ayudante}`,
                    r.instrumentista && `Instrumentista: ${r.instrumentista}`,
                    r.anestesiologo && `Anestesiólogo: ${r.anestesiologo}`,
                  ].filter(Boolean).join(" · ")}
                </div>
              )}
            </td>
            <td className="px-4 py-3">{r.dosis || "—"}</td>
            <td className="px-4 py-3">{new Date(r.fecha).toLocaleString()}</td>
            <td className="px-4 py-3">Q{Number(r.costo).toFixed(2)}</td>
            <td className="px-4 py-3" style={{ color: r.origen === "farmacia" ? COLORS.teal : "#333", fontWeight: r.origen === "farmacia" ? 600 : 400 }}>
              {r.origen === "farmacia" ? "Farmacia (venta directa)" : "Intrahospitalario"}
            </td>
          </>
        )}
      />
      )}

      {pacienteId && puedeRegistrar && (
        <Card style={{ marginTop: 16 }}>
          <div className="font-semibold text-sm mb-3">+ Registrar medicamento / procedimiento</div>
          {mensaje && <Banner tone={mensaje.tone}>{mensaje.texto}</Banner>}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <FormField label="Descripción"><TextInput required value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} /></FormField>
            <FormField label="Dosis"><TextInput value={form.dosis} onChange={(e) => setForm((f) => ({ ...f, dosis: e.target.value }))} /></FormField>
            <FormField label="Costo (Q)"><TextInput type="number" step="0.01" min="0" required value={form.costo} onChange={(e) => setForm((f) => ({ ...f, costo: e.target.value }))} /></FormField>
            <FormField label="Origen">
              <Select value={form.origen} onChange={(e) => setForm((f) => ({ ...f, origen: e.target.value }))}>
                <option value="intrahospitalario">Intrahospitalario</option>
                <option value="farmacia">Farmacia (venta directa)</option>
              </Select>
            </FormField>
            <div className="col-span-1 sm:col-span-2 lg:col-span-4">
              <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={esQuirurgico} onChange={(e) => setEsQuirurgico(e.target.checked)} />
                Es un procedimiento quirúrgico (RF-13) — registrar personal médico involucrado
              </label>
            </div>
            {esQuirurgico && (
              <>
                <FormField label="Cirujano"><TextInput value={form.cirujano} onChange={(e) => setForm((f) => ({ ...f, cirujano: e.target.value }))} /></FormField>
                <FormField label="Ayudante"><TextInput value={form.ayudante} onChange={(e) => setForm((f) => ({ ...f, ayudante: e.target.value }))} /></FormField>
                <FormField label="Instrumentista"><TextInput value={form.instrumentista} onChange={(e) => setForm((f) => ({ ...f, instrumentista: e.target.value }))} /></FormField>
                <FormField label="Anestesiólogo"><TextInput value={form.anestesiologo} onChange={(e) => setForm((f) => ({ ...f, anestesiologo: e.target.value }))} /></FormField>
              </>
            )}
            <div className="col-span-1 sm:col-span-2 lg:col-span-4">
              <Button type="submit" disabled={guardando}>{guardando ? "Guardando…" : "Registrar"}</Button>
            </div>
          </form>
        </Card>
      )}

      {pacienteId && (
      <Card style={{ marginTop: 16 }}>
        <div className="font-semibold text-sm mb-3">Recetas médicas</div>
        <Table
          headers={["Medicamento", "Dosis", "Duración", "Médico", "Fecha", ""]}
          rows={cargandoRecetas ? [] : recetas || []}
          emptyMessage={cargandoRecetas ? "Cargando…" : "Sin recetas registradas para este paciente."}
          renderRow={(r) => (
            <>
              <td className="px-4 py-3 font-semibold">{r.medicamento}</td>
              <td className="px-4 py-3" style={{ color: "#666" }}>{r.dosis}</td>
              <td className="px-4 py-3" style={{ color: "#666" }}>{r.duracion || "—"}</td>
              <td className="px-4 py-3" style={{ color: "#666" }}>
                {r.medico?.nombre}
                {r.medico?.colegiado && <div className="text-xs mt-0.5" style={{ color: "#999" }}>{r.medico.colegiado}{r.medico?.especialidad ? ` · ${r.medico.especialidad}` : ""}</div>}
              </td>
              <td className="px-4 py-3" style={{ color: "#666" }}>{new Date(r.creadoEn).toLocaleDateString()}</td>
              <td className="px-4 py-3">
                <button onClick={() => setRecetaImprimir(r)} className="flex items-center gap-1 text-xs font-semibold" style={{ color: COLORS.navy }}>
                  <Printer size={13} /> Imprimir
                </button>
              </td>
            </>
          )}
        />

        {puedeRecetar && (
          <form onSubmit={handleSubmitReceta} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end mt-4">
            {mensajeReceta && <div className="col-span-1 sm:col-span-2 lg:col-span-4"><Banner tone={mensajeReceta.tone}>{mensajeReceta.texto}</Banner></div>}
            <FormField label="Médico responsable">
              <Select required value={recetaForm.medicoId} onChange={(e) => setRecetaForm((f) => ({ ...f, medicoId: e.target.value }))}>
                <option value="">Seleccionar médico…</option>
                {(medicos || []).map((m) => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </Select>
              {medicoSeleccionado && (medicoSeleccionado.colegiado || medicoSeleccionado.especialidad) && (
                <p className="text-xs mt-1" style={{ color: COLORS.gold }}>
                  {[
                    medicoSeleccionado.colegiado && `Colegiado: ${medicoSeleccionado.colegiado}`,
                    medicoSeleccionado.especialidad && `Especialidad: ${medicoSeleccionado.especialidad}`,
                  ].filter(Boolean).join(" · ")}
                </p>
              )}
            </FormField>
            <FormField label="Medicamento"><TextInput required value={recetaForm.medicamento} onChange={(e) => setRecetaForm((f) => ({ ...f, medicamento: e.target.value }))} /></FormField>
            <FormField label="Dosis"><TextInput required placeholder="ej. 1 tableta cada 8 horas" value={recetaForm.dosis} onChange={(e) => setRecetaForm((f) => ({ ...f, dosis: e.target.value }))} /></FormField>
            <FormField label="Duración"><TextInput placeholder="ej. 7 días" value={recetaForm.duracion} onChange={(e) => setRecetaForm((f) => ({ ...f, duracion: e.target.value }))} /></FormField>
            <FormField label="Indicaciones"><TextInput placeholder="ej. Tomar con alimentos" value={recetaForm.indicaciones} onChange={(e) => setRecetaForm((f) => ({ ...f, indicaciones: e.target.value }))} /></FormField>
            <div className="col-span-1 sm:col-span-2 lg:col-span-4">
              <Button type="submit" disabled={guardandoReceta || !recetaForm.medicoId}>{guardandoReceta ? "Guardando…" : "Registrar receta"}</Button>
            </div>
          </form>
        )}
      </Card>
      )}

      <Modal open={!!recetaImprimir} onClose={() => setRecetaImprimir(null)} title="Receta médica" maxWidth={620}>
        {recetaImprimir && <RecetaImprimible receta={recetaImprimir} patient={patient} />}
      </Modal>
    </div>
  );
}
