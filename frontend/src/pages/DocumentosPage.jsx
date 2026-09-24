import React, { useState } from "react";
import { Eye, Upload, Trash2 } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Table } from "../components/Table";
import { Button } from "../components/Button";
import { Banner } from "../components/Banner";
import { PacienteBuscador } from "../components/PacienteBuscador";
import { FormField } from "../components/FormField";
import { api } from "../services/api";
import { useFetch } from "../hooks/useFetch";
import { COLORS } from "../styles/tokens";
import { fechaDia, fechaHoraLocal } from "../utils/fechas";

function tamanoLegible(bytes) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Documentos del paciente: identificaciones, referencias, constancias y el
// expediente físico escaneado. Fusiona lo que antes eran dos módulos
// separados — "Anexos" y "Documentos escaneados" — que guardaban exactamente
// lo mismo (un archivo suelto sin estructura clínica) con dos APIs distintas
// (23/09/2026). No incluye resultados de exámenes: esos siguen en Expediente
// Clínico, ligados al diagnóstico, porque llevan historial versionado.
//
// Protegido por rol en el backend (Administrador, Recepción, Consulta,
// Enfermería), sin token de acceso temporal: a diferencia de Anexos, esta
// misma lista ya se ve sin token dentro de la ficha del paciente en
// Registro/Ingreso, así que aquí se mantuvo igual de directo.
export function DocumentosPage({ pacienteIdInicial }) {
  const [selectedId, setSelectedId] = useState(pacienteIdInicial || null);
  const [paciente, setPaciente] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [subiendo, setSubiendo] = useState(false);

  const { data: documentos, reload } = useFetch(
    selectedId ? `/pacientes/${selectedId}/documentos` : null,
    { enabled: !!selectedId }
  );

  async function subirDocumentos(e) {
    e.preventDefault();
    const archivos = Array.from(e.target.files?.files || []);
    if (!archivos.length) return;

    setSubiendo(true);
    setMensaje(null);
    try {
      for (const archivo of archivos) {
        const fd = new FormData();
        fd.append("documento", archivo);
        await api.post(`/pacientes/${selectedId}/documentos`, fd);
      }
      setMensaje({ tone: "success", texto: `${archivos.length} documento(s) guardado(s) y cifrado(s) correctamente.` });
      reload();
    } catch (err) {
      setMensaje({ tone: "error", texto: err.message });
    } finally {
      setSubiendo(false);
      e.target.files.value = "";
    }
  }

  async function abrirDocumento(doc) {
    setMensaje(null);
    try {
      const blob = await api.getBlob(`/pacientes/${selectedId}/documentos/${doc.id}`);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      setMensaje({ tone: "error", texto: err.message });
    }
  }

  async function eliminarDocumento(doc) {
    if (!window.confirm(`¿Eliminar "${doc.nombreOriginal}"? Podrá recuperarse solo con respaldo del servidor.`)) return;
    setMensaje(null);
    try {
      await api.del(`/pacientes/${selectedId}/documentos/${doc.id}`);
      setMensaje({ tone: "success", texto: `"${doc.nombreOriginal}" eliminado.` });
      reload();
    } catch (err) {
      setMensaje({ tone: "error", texto: err.message });
    }
  }

  return (
    <div>
      <PageHeader title="Documentos del Paciente" />
      <Card>
        <p className="text-xs font-semibold mb-4" style={{ color: "#888" }}>
          Repositorio por paciente: identificaciones, referencias, constancias y el expediente físico escaneado.
          <strong> No es para resultados de exámenes</strong> — esos van en Expediente Clínico, junto al diagnóstico.
          Los archivos se guardan cifrados (AES-256-GCM). Formatos permitidos: PDF, PNG, JPG (máx. 20 MB por archivo).
        </p>

        <FormField label="Paciente">
          <PacienteBuscador
            pacienteSeleccionado={paciente}
            onSelect={(p) => {
              setSelectedId(p?.id || null);
              setPaciente(p || null);
              setMensaje(null);
            }}
            mostrarListado
          />
        </FormField>

        {mensaje && <div className="mt-4"><Banner tone={mensaje.tone}>{mensaje.texto}</Banner></div>}

        {selectedId && (
          <div className="mt-6 flex flex-col gap-6">
            <form onSubmit={subirDocumentos} className="flex flex-wrap items-end gap-3">
              <FormField label="Adjuntar documentos (puede seleccionar varios)">
                <input type="file" name="files" multiple accept=".pdf,.png,.jpg,.jpeg" className="text-sm" />
              </FormField>
              <Button type="submit" disabled={subiendo}>
                <span className="flex items-center gap-1.5"><Upload size={14} /> {subiendo ? "Subiendo…" : "Subir y cifrar"}</span>
              </Button>
            </form>

            <Table
              headers={["Nombre", "Tipo", "Tamaño", "Fecha del documento", "Registrado en el sistema", ""]}
              rows={documentos || []}
              emptyMessage={documentos ? "Este paciente no tiene documentos registrados." : "Cargando…"}
              renderRow={(d) => (
                <>
                  <td className="px-4 py-3">{d.nombreOriginal}</td>
                  <td className="px-4 py-3">{d.mimeType}</td>
                  <td className="px-4 py-3">{tamanoLegible(d.tamano)}</td>
                  <td className="px-4 py-3">{fechaDia(d.fechaDocumentoOriginal) || "—"}</td>
                  <td className="px-4 py-3">{fechaHoraLocal(d.creadoEn)}</td>
                  <td className="px-4 py-3">
                    <span className="flex gap-2">
                      <button className="text-xs font-semibold flex items-center gap-1" style={{ color: COLORS.navy }} onClick={() => abrirDocumento(d)}>
                        <Eye size={13} /> Abrir
                      </button>
                      <button className="text-xs font-semibold flex items-center gap-1" style={{ color: COLORS.red }} onClick={() => eliminarDocumento(d)}>
                        <Trash2 size={13} /> Eliminar
                      </button>
                    </span>
                  </td>
                </>
              )}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
