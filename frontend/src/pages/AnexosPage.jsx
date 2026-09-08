import React, { useState } from "react";
import { FolderOpen, Eye, Upload, KeyRound } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Table } from "../components/Table";
import { Button } from "../components/Button";
import { Banner } from "../components/Banner";
import { Modal } from "../components/Modal";
import { PacienteBuscador } from "../components/PacienteBuscador";
import { FormField, TextInput } from "../components/FormField";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { ROLES, tieneRol } from "../utils/roles";
import { COLORS } from "../styles/tokens";

function tamanoLegible(bytes) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Sprint 4: vista independiente de "Anexos y expedientes escaneados" a nivel
// de paciente. La informacion es clinica confidencial: requiere token de
// acceso temporal (o rol Administrador) para listar, subir y abrir. Cada
// accion consume su propio token (RNF-12: un solo uso). La ruta fisica de
// los archivos nunca se expone; la apertura pasa por la API autorizada.
export function AnexosPage({ pacienteIdInicial }) {
  const { usuario } = useAuth();
  const esAdmin = tieneRol(usuario, ROLES.ADMIN);

  const [selectedId, setSelectedId] = useState(pacienteIdInicial || null);
  const [paciente, setPaciente] = useState(null);

  const [anexos, setAnexos] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [tokenInfo, setTokenInfo] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [cargandoLista, setCargandoLista] = useState(false);

  function headersToken() {
    return esAdmin ? {} : { "x-temp-token": tempToken };
  }

  function abrirModal() {
    setMensaje(null);
    setModalAbierto(true);
  }

  async function autogenerarToken() {
    setMensaje(null);
    try {
      const data = await api.post("/auth/token/auto", { pacienteId: selectedId });
      setTempToken(data.token);
      setTokenInfo(`Token generado, expira ${new Date(data.expiraEn).toLocaleTimeString()}`);
    } catch (err) {
      setMensaje({ tone: "error", texto: err.message });
    }
  }

  async function listarAnexos() {
    setCargandoLista(true);
    setMensaje(null);
    try {
      const data = await api.get(`/expedientes/anexos/paciente/${selectedId}`, { headers: headersToken() });
      setAnexos(data);
      setModalAbierto(false);
      setTempToken(""); // el token ya se consumio (un solo uso)
      setTokenInfo(null);
    } catch (err) {
      setMensaje({ tone: "error", texto: err.message });
    } finally {
      setCargandoLista(false);
    }
  }

  async function subirAnexos(e) {
    e.preventDefault();
    const archivos = Array.from(e.target.files?.files || []);
    if (!archivos.length) return;
    if (!esAdmin && !tempToken) return abrirModal();

    setSubiendo(true);
    setMensaje(null);
    try {
      const fd = new FormData();
      for (const archivo of archivos) fd.append("anexos", archivo);
      await api.post(`/expedientes/anexos/paciente/${selectedId}`, fd, { headers: headersToken() });
      setMensaje({ tone: "success", texto: `${archivos.length} anexo(s) guardado(s) y cifrado(s) correctamente.` });
      setTempToken("");
      setTokenInfo(null);
      await new Promise((r) => setTimeout(r, 100));
      // recargar lista pide un token nuevo; guiamos al usuario
      setAnexos(null);
      setMensaje((m) => ({ ...m, texto: `${m.texto} Genere otro token para ver la lista actualizada.` }));
    } catch (err) {
      setMensaje({ tone: "error", texto: err.message });
    } finally {
      setSubiendo(false);
      e.target.files.value = "";
    }
  }

  async function abrirAnexo(anexo) {
    if (!esAdmin && !tempToken) return abrirModal();
    setMensaje(null);
    try {
      const blob = await api.getBlob(`/expedientes/anexos/${anexo.id}/descargar`, { headers: headersToken() });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTempToken("");
      setTokenInfo(null);
    } catch (err) {
      setMensaje({ tone: "error", texto: err.message });
    }
  }

  return (
    <div>
      <PageHeader title="Anexos y expedientes escaneados" />
      <Card>
        <p className="text-xs font-semibold mb-4" style={{ color: "#888" }}>
          Repositorio por paciente: documentos escaneados, identificaciones, referencias y constancias.
          Los archivos se guardan cifrados (AES-256-GCM) y solo se abren a través de esta API con autorización clínica.
          Formatos permitidos: PDF, PNG, JPG (máx. 15 MB por archivo).
        </p>

        <FormField label="Paciente">
          <PacienteBuscador
            pacienteSeleccionado={paciente}
            onSelect={(p) => {
              setSelectedId(p?.id || null);
              setPaciente(p || null);
              setAnexos(null);
              setTempToken("");
              setTokenInfo(null);
            }}
            mostrarListado
          />
        </FormField>

        {mensaje && <div className="mt-4"><Banner tone={mensaje.tone}>{mensaje.texto}</Banner></div>}

        {selectedId && (
          <div className="mt-6 flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              {!esAdmin && (
                <>
                  <Button variant="secondary" onClick={abrirModal}>
                    <span className="flex items-center gap-1.5"><KeyRound size={14} /> Token de acceso</span>
                  </Button>
                  {tokenInfo && <span className="text-xs font-semibold" style={{ color: COLORS.gold }}>{tokenInfo}</span>}
                </>
              )}
              <Button variant="secondary" onClick={listarAnexos} disabled={cargandoLista || (!esAdmin && !tempToken)}>
                <span className="flex items-center gap-1.5"><FolderOpen size={14} /> {cargandoLista ? "Listando…" : "Ver anexos del paciente"}</span>
              </Button>
            </div>

            <form onSubmit={subirAnexos} className="flex flex-wrap items-end gap-3">
              <FormField label="Adjuntar anexos (puede seleccionar varios)">
                <input type="file" name="files" multiple accept=".pdf,.png,.jpg,.jpeg" className="text-sm" />
              </FormField>
              <Button type="submit" disabled={subiendo || (!esAdmin && !tempToken)}>
                <span className="flex items-center gap-1.5"><Upload size={14} /> {subiendo ? "Subiendo…" : "Subir y cifrar"}</span>
              </Button>
            </form>

            {anexos && (
              <Table
                headers={["Nombre", "Tipo", "Tamaño", "Fecha", ""]}
                rows={anexos}
                emptyMessage="Este paciente no tiene anexos registrados."
                renderRow={(a) => (
                  <>
                    <td className="px-4 py-3">{a.nombreOriginal}</td>
                    <td className="px-4 py-3">{a.mimeType}</td>
                    <td className="px-4 py-3">{tamanoLegible(a.tamano)}</td>
                    <td className="px-4 py-3">{new Date(a.creadoEn).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <button className="text-xs font-semibold flex items-center gap-1" style={{ color: COLORS.navy }} onClick={() => abrirAnexo(a)}>
                        <Eye size={13} /> Abrir
                      </button>
                    </td>
                  </>
                )}
              />
            )}
          </div>
        )}
      </Card>

      <Modal open={modalAbierto} onClose={() => setModalAbierto(false)} title="Autorización de acceso a anexos" maxWidth={520}>
        <Banner tone="info">
          Los anexos del paciente son información clínica confidencial. Pegue un token temporal vigente
          (solicítelo al Administrador o genérelo si tiene permiso).
        </Banner>
        <div className="mt-4 flex flex-col gap-3">
          <TextInput value={tempToken} onChange={(e) => setTempToken(e.target.value)} placeholder="Pegue aquí el token" />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={autogenerarToken}>Autogenerar token</Button>
            <Button onClick={listarAnexos} disabled={!tempToken}>Ver anexos</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
