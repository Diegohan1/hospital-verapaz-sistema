import React, { useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Table } from "../components/Table";
import { Button } from "../components/Button";
import { Banner } from "../components/Banner";
import { FormField, TextInput } from "../components/FormField";
import { useFetch } from "../hooks/useFetch";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { ROLES, tieneRol } from "../utils/roles";

export function ReferidosPage() {
  const { usuario } = useAuth();
  const puedeRegistrar = tieneRol(usuario, ROLES.RECEPCION, ROLES.ADMIN);

  const { data: medicos, loading, error, reload } = useFetch("/referidos");
  const [form, setForm] = useState({ nombre: "", especialidad: "", comisionQ: "" });
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    setMensaje(null);
    try {
      await api.post("/referidos", { ...form, comisionQ: Number(form.comisionQ) });
      setMensaje({ tone: "success", texto: "Médico referente registrado." });
      setForm({ nombre: "", especialidad: "", comisionQ: "" });
      reload();
    } catch (err) {
      setMensaje({ tone: "error", texto: err.message });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <PageHeader title="Clientes Referidos" subtitle="Médicos externos que refieren pacientes, con su comisión asociada" />
      {error && <Banner tone="error">{error}</Banner>}
      <Table
        headers={["Médico referente", "Especialidad", "Pacientes referidos", "Comisión"]}
        rows={loading ? [] : medicos || []}
        emptyMessage={loading ? "Cargando…" : "Sin médicos referentes registrados."}
        renderRow={(r) => (
          <>
            <td className="px-4 py-3 font-semibold">{r.nombre}</td>
            <td className="px-4 py-3" style={{ color: "#666" }}>{r.especialidad || "—"}</td>
            <td className="px-4 py-3" style={{ color: "#666" }}>{r.pacientesReferidos}</td>
            <td className="px-4 py-3" style={{ color: "#666" }}>Q{Number(r.comisionQ).toFixed(2)}</td>
          </>
        )}
      />

      {puedeRegistrar && (
        <Card style={{ marginTop: 16 }}>
          <div className="font-semibold text-sm mb-3">+ Registrar médico referente</div>
          {mensaje && <Banner tone={mensaje.tone}>{mensaje.texto}</Banner>}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <FormField label="Nombre"><TextInput required value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} /></FormField>
            <FormField label="Especialidad"><TextInput value={form.especialidad} onChange={(e) => setForm((f) => ({ ...f, especialidad: e.target.value }))} /></FormField>
            <FormField label="Comisión (Q por paciente)"><TextInput type="number" step="0.01" min="0" required value={form.comisionQ} onChange={(e) => setForm((f) => ({ ...f, comisionQ: e.target.value }))} /></FormField>
            <div className="col-span-1 sm:col-span-2 lg:col-span-3">
              <Button type="submit" disabled={guardando}>{guardando ? "Guardando…" : "Registrar"}</Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
