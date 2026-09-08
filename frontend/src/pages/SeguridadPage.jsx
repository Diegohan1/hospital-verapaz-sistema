import React, { useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Table } from "../components/Table";
import { Button } from "../components/Button";
import { Banner } from "../components/Banner";
import { FormField, TextInput, Select } from "../components/FormField";
import { RolesChecklist } from "../components/RolesChecklist";
import { useFetch } from "../hooks/useFetch";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { COLORS } from "../styles/tokens";
import { ROLES, tieneRol, etiquetasRoles } from "../utils/roles";

const MINUTOS_EN_LINEA = 5;

function estadoConexion(ultimaActividad) {
  if (!ultimaActividad) return { enLinea: false, texto: "Nunca ha entrado" };
  const minutos = (Date.now() - new Date(ultimaActividad).getTime()) / 60000;
  if (minutos <= MINUTOS_EN_LINEA) return { enLinea: true, texto: "En línea" };
  if (minutos < 60) return { enLinea: false, texto: `Hace ${Math.round(minutos)} min` };
  if (minutos < 1440) return { enLinea: false, texto: `Hace ${Math.round(minutos / 60)} h` };
  return { enLinea: false, texto: new Date(ultimaActividad).toLocaleDateString() };
}

export function SeguridadPage() {
  const { usuario } = useAuth();

  if (!tieneRol(usuario, ROLES.ADMIN)) {
    return (
      <div>
        <PageHeader title="Seguridad y Roles de Usuario" />
        <Card>
          <div className="font-semibold text-sm mb-2">🔑 Tokens de acceso temporal</div>
          <p className="text-sm" style={{ color: "#666" }}>
            El Administrador asigna roles, funciones y permisos de token (RF-29, RF-30, RF-32, RF-33, RF-34).
            Duración del token: 5–15 minutos · Un solo uso. Solicítelo en el módulo de Expediente Clínico si necesita ver un diagnóstico.
          </p>
        </Card>
      </div>
    );
  }

  return <SeguridadAdmin />;
}

function SeguridadAdmin() {
  const { data: usuarios, loading, error, reload } = useFetch("/usuarios");

  const [nuevo, setNuevo] = useState({ nombre: "", correo: "", password: "", roles: [ROLES.RECEPCION], puedeAutogenerarToken: false, colegiado: "", especialidad: "" });
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const [tokenForm, setTokenForm] = useState({ usuarioId: "" });
  const [tokenResultado, setTokenResultado] = useState(null);
  const [emitiendoToken, setEmitiendoToken] = useState(false);

  // Refresca el estado "en linea" periodicamente sin que el Administrador tenga que recargar la pagina
  useEffect(() => {
    const intervalo = setInterval(reload, 30000);
    return () => clearInterval(intervalo);
  }, [reload]);

  async function crearUsuario(e) {
    e.preventDefault();
    if (nuevo.roles.length === 0) {
      setMensaje({ tone: "error", texto: "Seleccione al menos un rol." });
      return;
    }
    setGuardando(true);
    setMensaje(null);
    try {
      await api.post("/usuarios", {
        ...nuevo,
        colegiado: nuevo.roles.includes(ROLES.CONSULTA) ? (nuevo.colegiado || null) : null,
        especialidad: nuevo.roles.includes(ROLES.CONSULTA) ? (nuevo.especialidad || null) : null,
      });
      setMensaje({ tone: "success", texto: "Usuario creado." });
      setNuevo({ nombre: "", correo: "", password: "", roles: [ROLES.RECEPCION], puedeAutogenerarToken: false, colegiado: "", especialidad: "" });
      reload();
    } catch (err) {
      setMensaje({ tone: "error", texto: err.message });
    } finally {
      setGuardando(false);
    }
  }

  async function actualizarUsuario(id, cambios) {
    try {
      await api.put(`/usuarios/${id}`, cambios);
      reload();
    } catch (err) {
      setMensaje({ tone: "error", texto: err.message });
    }
  }

  function onCambiarRoles(u, nuevosRoles) {
    if (nuevosRoles.length === 0) {
      setMensaje({ tone: "error", texto: `${u.nombre} debe conservar al menos un rol.` });
      return;
    }
    actualizarUsuario(u.id, { roles: nuevosRoles });
  }

  async function emitirToken(e) {
    e.preventDefault();
    setEmitiendoToken(true);
    setTokenResultado(null);
    try {
      const data = await api.post("/auth/token", { usuarioId: Number(tokenForm.usuarioId) });
      setTokenResultado(data);
    } catch (err) {
      setMensaje({ tone: "error", texto: err.message });
    } finally {
      setEmitiendoToken(false);
    }
  }

  return (
    <div>
      <PageHeader title="Seguridad y Roles de Usuario" subtitle="El Administrador asigna roles, funciones y permisos de token (RF-29, RF-30, RF-32, RF-33, RF-34)" />
      {mensaje && <Banner tone={mensaje.tone}>{mensaje.texto}</Banner>}
      {error && <Banner tone="error">{error}</Banner>}

      <Table
        headers={["Usuario", "Correo", "Roles (un usuario puede tener varios)", "Colegiado / Especialidad", "Autogenera token", "Estado"]}
        rows={loading ? [] : usuarios || []}
        emptyMessage={loading ? "Cargando…" : "Sin usuarios registrados."}
        renderRow={(u) => {
          const estado = estadoConexion(u.ultimaActividad);
          return (
            <>
              <td className="px-4 py-3 font-semibold align-top">{u.nombre}</td>
              <td className="px-4 py-3 align-top" style={{ color: "#666" }}>{u.correo}</td>
              <td className="px-4 py-3 align-top" style={{ minWidth: 260 }}>
                <RolesChecklist value={u.roles} onChange={(roles) => onCambiarRoles(u, roles)} />
              </td>
              <td className="px-4 py-3 align-top" style={{ minWidth: 150 }}>
                {u.roles.includes(ROLES.CONSULTA) ? (
                  <div className="flex flex-col gap-1.5">
                    <TextInput
                      placeholder="Colegiado…"
                      defaultValue={u.colegiado || ""}
                      onBlur={(e) => {
                        if ((e.target.value || null) !== (u.colegiado || null)) {
                          actualizarUsuario(u.id, { colegiado: e.target.value || null });
                        }
                      }}
                      style={{ fontSize: 12, padding: "6px 10px" }}
                    />
                    <TextInput
                      placeholder="Especialidad…"
                      defaultValue={u.especialidad || ""}
                      onBlur={(e) => {
                        if ((e.target.value || null) !== (u.especialidad || null)) {
                          actualizarUsuario(u.id, { especialidad: e.target.value || null });
                        }
                      }}
                      style={{ fontSize: 12, padding: "6px 10px" }}
                    />
                  </div>
                ) : (
                  <span className="text-xs" style={{ color: "#AAA" }}>—</span>
                )}
              </td>
              <td className="px-4 py-3 align-top">
                <label className="flex items-center gap-2 text-xs" style={{ color: "#666" }}>
                  <input type="checkbox" checked={u.puedeAutogenerarToken} onChange={(e) => actualizarUsuario(u.id, { puedeAutogenerarToken: e.target.checked })} />
                  RF-34
                </label>
              </td>
              <td className="px-4 py-3 align-top">
                <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: estado.enLinea ? COLORS.green : "#888" }}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: estado.enLinea ? COLORS.green : "#C4C9D4" }} />
                  {estado.texto}
                </span>
              </td>
            </>
          );
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <Card>
          <div className="font-semibold text-sm mb-3">+ Nuevo usuario</div>
          <form onSubmit={crearUsuario} className="flex flex-col gap-4">
            <FormField label="Nombre"><TextInput required value={nuevo.nombre} onChange={(e) => setNuevo((f) => ({ ...f, nombre: e.target.value }))} /></FormField>
            <FormField label="Correo"><TextInput type="email" required value={nuevo.correo} onChange={(e) => setNuevo((f) => ({ ...f, correo: e.target.value }))} /></FormField>
            <FormField label="Contraseña temporal"><TextInput type="password" required value={nuevo.password} onChange={(e) => setNuevo((f) => ({ ...f, password: e.target.value }))} /></FormField>
            <FormField label="Roles (puede marcar más de uno)">
              <RolesChecklist value={nuevo.roles} onChange={(roles) => setNuevo((f) => ({ ...f, roles }))} />
            </FormField>
            {nuevo.roles.includes(ROLES.CONSULTA) && (
              <>
                <FormField label="No. de colegiado">
                  <TextInput placeholder="ej. C-12345" value={nuevo.colegiado} onChange={(e) => setNuevo((f) => ({ ...f, colegiado: e.target.value }))} />
                </FormField>
                <FormField label="Especialidad">
                  <TextInput placeholder="ej. Medicina Interna" value={nuevo.especialidad} onChange={(e) => setNuevo((f) => ({ ...f, especialidad: e.target.value }))} />
                </FormField>
              </>
            )}
            <label className="flex items-center gap-2 text-sm" style={{ color: "#444" }}>
              <input type="checkbox" checked={nuevo.puedeAutogenerarToken} onChange={(e) => setNuevo((f) => ({ ...f, puedeAutogenerarToken: e.target.checked }))} />
              Puede autogenerar sus propios tokens (RF-34)
            </label>
            <div>
              <Button type="submit" disabled={guardando}>{guardando ? "Creando…" : "Crear usuario"}</Button>
            </div>
          </form>
        </Card>

        <Card>
          <div className="font-semibold text-sm mb-1">🔑 Emitir token de acceso temporal (RF-33)</div>
          <p className="text-xs mb-3" style={{ color: "#888" }}>Genera un token de un solo uso para que un usuario consulte el diagnóstico confidencial. Cópielo y compártalo por un canal seguro: solo se muestra una vez.</p>
          <form onSubmit={emitirToken} className="flex flex-col gap-4">
            <FormField label="Usuario">
              <Select required value={tokenForm.usuarioId} onChange={(e) => setTokenForm({ usuarioId: e.target.value })}>
                <option value="">Seleccionar…</option>
                {(usuarios || []).filter((u) => !u.roles.includes(ROLES.ADMIN)).map((u) => (
                  <option key={u.id} value={u.id}>{u.nombre} ({etiquetasRoles(u.roles)})</option>
                ))}
              </Select>
            </FormField>
            <div>
              <Button type="submit" disabled={emitiendoToken}>{emitiendoToken ? "Generando…" : "Generar token"}</Button>
            </div>
          </form>
          {tokenResultado && (
            <div className="rounded-xl p-3 text-sm mt-3" style={{ backgroundColor: "#FAFAFB", border: `1px solid ${COLORS.border}` }}>
              <div className="font-mono text-xs break-all">{tokenResultado.token}</div>
              <div className="text-xs mt-1" style={{ color: "#888" }}>Expira: {new Date(tokenResultado.expiraEn).toLocaleString()}</div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
