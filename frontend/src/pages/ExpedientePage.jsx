import React, { useEffect, useState } from "react";
import { ShieldAlert, KeyRound, Plus, Trash2, History, EyeOff, FileText, X, Camera } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Banner } from "../components/Banner";
import { Modal } from "../components/Modal";
import { CameraScannerModal } from "../components/CameraScannerModal";
import { FormField, TextInput, Select, TextArea } from "../components/FormField";
import { Cie10Input } from "../components/Cie10Input";
import { PacienteBuscador } from "../components/PacienteBuscador";
import { abrirArchivoDataUrl } from "../utils/archivos";
import { useFetch } from "../hooks/useFetch";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { COLORS } from "../styles/tokens";
import { ROLES, tieneRol } from "../utils/roles";

const TIPOS_ATENCION = [
  { value: "consulta_externa", label: "Consulta externa" },
  { value: "emergencia", label: "Emergencia" },
  { value: "hospitalizacion", label: "Hospitalización" },
  { value: "seguimiento", label: "Seguimiento" },
];

const SIGNOS_SINTOMAS = [
  "Dolor", "Fiebre", "Náuseas", "Vómitos", "Diarrea",
  "Tos", "Dificultad respiratoria", "Sangrado", "Alteración del estado de conciencia",
];

const SISTEMAS_EXPLORACION = [
  { key: "general", label: "General" },
  { key: "cabezaCuello", label: "Cabeza / Cuello" },
  { key: "cardiovascular", label: "Cardiovascular" },
  { key: "respiratorio", label: "Respiratorio" },
  { key: "abdomen", label: "Abdomen" },
  { key: "neurologico", label: "Neurológico" },
  { key: "extremidades", label: "Extremidades" },
  { key: "piel", label: "Piel" },
  { key: "otros", label: "Otros hallazgos" },
];

const TIPOS_DIAGNOSTICO = ["Presuntivo", "Definitivo"];
const PRIORIDADES_DIAGNOSTICO = ["Principal", "Secundario"];
const ESTADOS_DIAGNOSTICO = ["Activo", "Resuelto", "Crónico"];

function ahoraFecha() { return new Date().toISOString().slice(0, 10); }
function ahoraHora() { return new Date().toTimeString().slice(0, 5); }

function datosVacios() {
  return {
    fecha: ahoraFecha(),
    hora: ahoraHora(),
    especialidad: "",
    motivoConsulta: "",
    historiaEnfermedad: "",
    signosSintomas: [],
    signosSintomasOtros: "",
    signosVitales: { pa: "", fc: "", fr: "", temp: "", spo2: "", peso: "", talla: "" },
    exploracionFisica: { general: "", cabezaCuello: "", cardiovascular: "", respiratorio: "", abdomen: "", neurologico: "", extremidades: "", piel: "", otros: "" },
    estudios: [],
    diagnosticoPrincipal: { diagnostico: "", codigoCie: "", tipo: "Definitivo", prioridad: "Principal", estado: "Activo", fecha: ahoraFecha() },
    diagnosticosSecundarios: [],
    impresionClinica: "",
    planConducta: "",
  };
}

function calcularIMC(peso, talla) {
  const p = Number(peso), t = Number(talla);
  if (!p || !t) return null;
  return (p / (t * t)).toFixed(1);
}

// Reutilizado tanto para el diagnostico vigente como para cada entrada del
// historial (ver mas abajo) — mismo formato de lectura en los dos casos.
function DiagnosticoDetalle({ d }) {
  return (
    <>
      <p className="text-xs mb-4" style={{ color: "#888" }}>
        Registrado: {new Date(d.creadoEn).toLocaleString()}
        {d.registradoPor && <> · {d.registradoPor}</>}
        {d.tipoAtencion && <> · {TIPOS_ATENCION.find((t) => t.value === d.tipoAtencion)?.label || d.tipoAtencion}</>}
        {d.servicio && <> · {d.servicio}</>}
        {d.salaCama && <> · Sala/Cama: {d.salaCama}</>}
      </p>

      {d.legacyTexto ? (
        <div className="rounded-xl p-3 text-sm" style={{ backgroundColor: "#FAFAFB", border: `1px solid ${COLORS.border}` }}>
          <p className="text-xs mb-2" style={{ color: "#888" }}>Registrado antes de la plantilla estructurada — texto libre. Código CIE: {d.codigoCie || "—"}</p>
          {d.legacyTexto}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {d.datos?.motivoConsulta && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#888" }}>Motivo de consulta</div>
              <div className="text-sm">{d.datos.motivoConsulta}</div>
            </div>
          )}
          {d.datos?.historiaEnfermedad && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#888" }}>Historia de la enfermedad actual</div>
              <div className="text-sm whitespace-pre-wrap">{d.datos.historiaEnfermedad}</div>
            </div>
          )}
          {d.datos?.signosSintomas?.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#888" }}>Signos y síntomas</div>
              <div className="text-sm">{d.datos.signosSintomas.join(", ")}{d.datos.signosSintomasOtros ? `, ${d.datos.signosSintomasOtros}` : ""}</div>
            </div>
          )}
          {d.datos?.signosVitales && Object.values(d.datos.signosVitales).some(Boolean) && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#888" }}>Signos vitales</div>
              <div className="text-sm flex flex-wrap gap-x-5 gap-y-1">
                {d.datos.signosVitales.pa && <span><strong>PA:</strong> {d.datos.signosVitales.pa}</span>}
                {d.datos.signosVitales.fc && <span><strong>FC:</strong> {d.datos.signosVitales.fc} lpm</span>}
                {d.datos.signosVitales.fr && <span><strong>FR:</strong> {d.datos.signosVitales.fr} rpm</span>}
                {d.datos.signosVitales.temp && <span><strong>Temp:</strong> {d.datos.signosVitales.temp} °C</span>}
                {d.datos.signosVitales.spo2 && <span><strong>SpO₂:</strong> {d.datos.signosVitales.spo2}%</span>}
                {d.datos.signosVitales.peso && <span><strong>Peso:</strong> {d.datos.signosVitales.peso} kg</span>}
                {d.datos.signosVitales.talla && <span><strong>Talla:</strong> {d.datos.signosVitales.talla} m</span>}
                {calcularIMC(d.datos.signosVitales.peso, d.datos.signosVitales.talla) && (
                  <span><strong>IMC:</strong> {calcularIMC(d.datos.signosVitales.peso, d.datos.signosVitales.talla)}</span>
                )}
              </div>
            </div>
          )}
          {d.datos?.exploracionFisica && Object.values(d.datos.exploracionFisica).some(Boolean) && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#888" }}>Exploración física</div>
              <div className="flex flex-col gap-1 text-sm">
                {SISTEMAS_EXPLORACION.filter((s) => d.datos.exploracionFisica[s.key]).map((s) => (
                  <div key={s.key}><strong>{s.label}:</strong> {d.datos.exploracionFisica[s.key]}</div>
                ))}
              </div>
            </div>
          )}
          {d.datos?.estudios?.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#888" }}>Estudios y resultados</div>
              <div className="flex flex-col gap-1 text-sm">
                {d.datos.estudios.map((e, i) => (
                  <div key={i}>
                    <strong>{e.tipo || "Estudio"}</strong>{e.fecha ? ` (${new Date(e.fecha).toLocaleDateString()})` : ""}: {e.resultado || "—"}
                    {e.archivoDataUrl && (
                      <button
                        type="button"
                        onClick={() => abrirArchivoDataUrl(e.archivoDataUrl)}
                        className="ml-2 font-semibold"
                        style={{ color: COLORS.navy }}
                      >
                        Ver archivo{e.archivoNombre ? ` (${e.archivoNombre})` : ""}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {d.datos?.diagnosticoPrincipal?.diagnostico && (
            <div className="rounded-xl p-3" style={{ backgroundColor: "#FAFAFB", border: `1px solid ${COLORS.border}` }}>
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#888" }}>Diagnóstico 1 · Principal</div>
              <div className="text-sm font-semibold">{d.datos.diagnosticoPrincipal.diagnostico}</div>
              <div className="text-xs mt-1" style={{ color: "#666" }}>
                Código CIE-10: {d.datos.diagnosticoPrincipal.codigoCie || "—"} · Prioridad: {d.datos.diagnosticoPrincipal.prioridad || "Principal"} · {d.datos.diagnosticoPrincipal.tipo} · {d.datos.diagnosticoPrincipal.estado}
              </div>
            </div>
          )}
          {d.datos?.diagnosticosSecundarios?.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#888" }}>Diagnósticos adicionales · en orden de importancia</div>
              <ol className="list-decimal pl-5 flex flex-col gap-1 text-sm">
                {d.datos.diagnosticosSecundarios.map((s, i) => (
                  <li key={i}>
                    <span className="font-medium">{s.diagnostico}</span>
                    <span className="ml-2 text-xs" style={{ color: "#666" }}>Código CIE-10: {s.codigoCie || "—"} · Prioridad: {s.prioridad || "Secundario"} · {s.estado}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {(d.datos?.archivoDiagnostico?.archivoDataUrl || (d.datos?.adjuntosAdicionales || []).some((a) => a.archivoDataUrl)) && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#888" }}>Archivos adjuntos</div>
              <div className="flex flex-col gap-1 text-sm">
                {d.datos?.archivoDiagnostico?.archivoDataUrl && (
                  <button
                    type="button"
                    onClick={() => abrirArchivoDataUrl(d.datos.archivoDiagnostico.archivoDataUrl)}
                    className="text-left font-semibold"
                    style={{ color: COLORS.navy }}
                  >
                    Ver archivo del diagnóstico{d.datos.archivoDiagnostico.archivoNombre ? ` (${d.datos.archivoDiagnostico.archivoNombre})` : ""}
                  </button>
                )}
                {(d.datos?.adjuntosAdicionales || []).map((a, i) => a.archivoDataUrl && (
                  <button
                    key={i}
                    type="button"
                    onClick={() => abrirArchivoDataUrl(a.archivoDataUrl)}
                    className="text-left font-semibold"
                    style={{ color: COLORS.navy }}
                  >
                    Ver archivo adicional{a.archivoNombre ? ` (${a.archivoNombre})` : ""}
                  </button>
                ))}
              </div>
            </div>
          )}
          {d.datos?.impresionClinica && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#888" }}>Impresión clínica</div>
              <div className="text-sm whitespace-pre-wrap">{d.datos.impresionClinica}</div>
            </div>
          )}
          {d.datos?.planConducta && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#888" }}>Plan y conducta</div>
              <div className="text-sm whitespace-pre-wrap">{d.datos.planConducta}</div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function SeccionTitulo({ n, children }) {
  return (
    <div className="font-semibold text-sm mb-3 flex items-center gap-1.5" style={{ color: COLORS.navy }}>
      <span className="text-xs font-bold" style={{ color: COLORS.gold }}>{n}.</span> {children}
    </div>
  );
}

export function ExpedientePage({ pacienteIdInicial }) {
  const { usuario } = useAuth();
  const esAdmin = tieneRol(usuario, ROLES.ADMIN);

  const [selectedId, setSelectedId] = useState(pacienteIdInicial || null);
  // Un solo paciente por id (no una lista completa): con volumen alto de
  // pacientes, cargar todos de una vez para un <select> deja de ser viable.
  const { data: patient, reload: recargarPaciente } = useFetch(selectedId ? `/pacientes/${selectedId}` : null, { enabled: !!selectedId });
  // Escaneos del paciente, para mostrar en cada ingreso el suyo (por ingresoId).
  const { data: documentosPaciente, reload: recargarDocumentos } = useFetch(
    selectedId ? `/pacientes/${selectedId}/documentos` : null,
    { enabled: !!selectedId }
  );
  const listaDocumentos = Array.isArray(documentosPaciente) ? documentosPaciente : documentosPaciente?.items || [];

  const [modalAbierto, setModalAbierto] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [tokenInfo, setTokenInfo] = useState(null);
  const [diagnostico, setDiagnostico] = useState(null);
  const [estado, setEstado] = useState("idle"); // idle | cargando | visible | sin-registro
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [mensajeError, setMensajeError] = useState(null);
  const [sistemaActivo, setSistemaActivo] = useState("general");

  // RF-10 detras de un boton: el formulario de diagnostico ya no esta
  // siempre visible, para no llenar la pantalla del expediente.
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  // Cada admision (ingreso) del paciente agrupa sus propios diagnosticos.
  const [ingresoId, setIngresoId] = useState("");
  const [mostrarNuevoIngreso, setMostrarNuevoIngreso] = useState(false);
  const [guardandoIngreso, setGuardandoIngreso] = useState(false);
  // Escaneo del expediente fisico de ESTE ingreso (fotos -> PDF), igual que
  // en Registro y Admision. Se sube al guardar el ingreso y queda ligado a
  // su admision.
  const [escanerIngresoAbierto, setEscanerIngresoAbierto] = useState(false);
  const [documentoIngreso, setDocumentoIngreso] = useState(null);
  const [mensajeIngreso, setMensajeIngreso] = useState(null);
  const [ingresoForm, setIngresoForm] = useState({ fecha: ahoraFecha(), hora: ahoraHora(), impresionClinicaIngreso: "", serviciosSolicitados: "", referidoPor: "" });

  const ingresos = patient?.ingresos || [];

  // Al cambiar de paciente, el diagnostico nuevo se asocia por defecto al
  // ingreso mas reciente.
  useEffect(() => {
    setIngresoId(ingresos[0] ? String(ingresos[0].id) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient?.id, patient?.ingresos?.length]);

  const [tipoAtencion, setTipoAtencion] = useState("");
  const [servicio, setServicio] = useState("");
  const [salaCama, setSalaCama] = useState("");

  // Sala/Cama solo tiene sentido si al paciente le asignaron una cama
  // (hospitalizacion o emergencia); en consulta externa o seguimiento no
  // aplica, asi que se oculta y se limpia si el usuario cambia de opcion.
  const requiereSalaCama = tipoAtencion === "hospitalizacion" || tipoAtencion === "emergencia";
  function handleTipoAtencionChange(valor) {
    setTipoAtencion(valor);
    if (valor !== "hospitalizacion" && valor !== "emergencia") setSalaCama("");
  }
  const [datos, setDatos] = useState(datosVacios());
  const [archivosEstudios, setArchivosEstudios] = useState([]); // File[] paralelo a datos.estudios, no viaja en el JSON
  const [archivoDiagnostico, setArchivoDiagnostico] = useState(null); // File general del diagnostico (opcional)
  const [archivosAdicionales, setArchivosAdicionales] = useState([]); // File[] adjuntos sueltos del diagnostico
  const [guardando, setGuardando] = useState(false);
  const [mensajeGuardado, setMensajeGuardado] = useState(null);

  function headersToken() {
    return esAdmin ? {} : { "x-temp-token": tempToken };
  }

  function abrirModal() {
    setMensajeError(null);
    setModalAbierto(true);
  }

  async function autogenerarToken() {
    setMensajeError(null);
    try {
      const data = await api.post("/auth/token/auto", { pacienteId: selectedId });
      setTempToken(data.token);
      setTokenInfo(`Token generado, expira ${new Date(data.expiraEn).toLocaleTimeString()}`);
    } catch (err) {
      setMensajeError(err.message);
    }
  }

  // RF-11: el Administrador confirma sin token; los demas roles necesitan
  // uno vigente (RF-33/RF-34). El modal es el unico punto de entrada para
  // ver el diagnostico, para dejar claro que es una accion sensible (RNF-08).
  //
  // Al ver el diagnostico se abre ademas el PDF escaneado del expediente
  // fisico (el que se genero al fotografiar el expediente en Registro y
  // Admision). Se abre en una pestaña nueva; si el paciente no tiene ningun
  // escaneo, la vista del diagnostico funciona igual que antes.
  async function abrirExpedienteEscaneado() {
    // La pestaña se abre YA (dentro del gesto del usuario) y se le pone la
    // URL despues: si se abriera tras los await, el bloqueador de popups la
    // mataria por no considerarla parte del clic.
    let ventana = null;
    try { ventana = window.open("", "_blank"); } catch { ventana = null; }
    try {
      const documentos = await api.get(`/pacientes/${selectedId}/documentos`);
      const lista = Array.isArray(documentos) ? documentos : documentos?.items || [];
      // Preferimos el expediente de admision; si no, cualquier PDF o imagen.
      const expediente =
        lista.find((d) => d.tipoDocumental === "expediente_admision") ||
        lista.find((d) => d.mimeType === "application/pdf") ||
        lista[0];
      if (!expediente) {
        if (ventana) ventana.close();
        return false;
      }
      const blob = await api.getBlob(`/pacientes/${selectedId}/documentos/${expediente.id}`);
      const url = URL.createObjectURL(blob);
      if (ventana) ventana.location.href = url;
      else window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return true;
    } catch {
      if (ventana) ventana.close();
      return false;
    }
  }

  async function confirmarYVer() {
    setEstado("cargando");
    setMensajeError(null);
    try {
      const data = await api.get(`/expedientes/paciente/${selectedId}`, { headers: headersToken() });
      setDiagnostico(data);
      setEstado("visible");
      setModalAbierto(false);
      // Se abre el PDF escaneado del expediente (Registro y Admision) junto
      // al diagnostico, en la misma accion de "ver".
      abrirExpedienteEscaneado();
      // el token es de un solo uso (RNF-12): ya se consumio al verificar,
      // asi que no lo dejamos activo para el formulario de "Registrar diagnostico"
      setTempToken("");
      setTokenInfo(null);
    } catch (err) {
      if (err.message.includes("no tiene diagnostico")) {
        setEstado("sin-registro");
        setModalAbierto(false);
      } else {
        setEstado("idle");
        setMensajeError(err.message);
      }
    }
  }

  function setCampoDatos(campo, valor) {
    setDatos((d) => ({ ...d, [campo]: valor }));
  }
  function setCampoVital(campo, valor) {
    setDatos((d) => ({ ...d, signosVitales: { ...d.signosVitales, [campo]: valor } }));
  }
  function setCampoExploracion(valor) {
    setDatos((d) => ({ ...d, exploracionFisica: { ...d.exploracionFisica, [sistemaActivo]: valor } }));
  }
  function toggleSintoma(s) {
    setDatos((d) => ({
      ...d,
      signosSintomas: d.signosSintomas.includes(s) ? d.signosSintomas.filter((x) => x !== s) : [...d.signosSintomas, s],
    }));
  }
  function setCampoPrincipal(campo, valor) {
    setDatos((d) => ({ ...d, diagnosticoPrincipal: { ...d.diagnosticoPrincipal, [campo]: valor } }));
  }

  function agregarEstudio() {
    setDatos((d) => ({ ...d, estudios: [...d.estudios, { tipo: "", fecha: ahoraFecha(), resultado: "" }] }));
    setArchivosEstudios((a) => [...a, null]);
  }
  function actualizarEstudio(i, campo, valor) {
    setDatos((d) => ({ ...d, estudios: d.estudios.map((e, idx) => (idx === i ? { ...e, [campo]: valor } : e)) }));
  }
  function quitarEstudio(i) {
    setDatos((d) => ({ ...d, estudios: d.estudios.filter((_, idx) => idx !== i) }));
    setArchivosEstudios((a) => a.filter((_, idx) => idx !== i));
  }
  function setArchivoEstudio(i, file) {
    setArchivosEstudios((a) => a.map((f, idx) => (idx === i ? file : f)));
  }

  function agregarSecundario() {
    setDatos((d) => ({ ...d, diagnosticosSecundarios: [...d.diagnosticosSecundarios, { diagnostico: "", codigoCie: "", estado: "Activo" }] }));
  }
  function actualizarSecundario(i, campo, valor) {
    setDatos((d) => ({ ...d, diagnosticosSecundarios: d.diagnosticosSecundarios.map((s, idx) => (idx === i ? { ...s, [campo]: valor } : s)) }));
  }
  function quitarSecundario(i) {
    setDatos((d) => ({ ...d, diagnosticosSecundarios: d.diagnosticosSecundarios.filter((_, idx) => idx !== i) }));
  }

  async function guardarDiagnostico(e) {
    e.preventDefault();
    setGuardando(true);
    setMensajeGuardado(null);
    try {
      const formData = new FormData();
      formData.append("datos", JSON.stringify(datos));
      formData.append("codigoCie", datos.diagnosticoPrincipal.codigoCie || "");
      formData.append("tipoAtencion", tipoAtencion);
      formData.append("servicio", servicio);
      formData.append("salaCama", salaCama);
      if (ingresoId) formData.append("ingresoId", ingresoId);
      archivosEstudios.forEach((file, i) => { if (file) formData.append(`estudio_${i}`, file); });
      if (archivoDiagnostico) formData.append("diagnostico_adjunto", archivoDiagnostico);
      archivosAdicionales.forEach((file, i) => formData.append(`adjunto_extra_${i}`, file));

      await api.post(`/expedientes/paciente/${selectedId}`, formData, { headers: headersToken() });
      setMensajeGuardado({ tone: "success", texto: "Diagnóstico registrado correctamente." });
      setDatos(datosVacios());
      setArchivosEstudios([]);
      setArchivoDiagnostico(null);
      setArchivosAdicionales([]);
      setSistemaActivo("general");
      setEstado("idle");
      setDiagnostico(null);
      setMostrarHistorial(false);
    } catch (err) {
      setMensajeGuardado({ tone: "error", texto: err.message });
    } finally {
      setGuardando(false);
    }
  }

  // "Nuevo ingreso": el paciente (identidad, demograficos, historia clinica)
  // ya existe y no cambia; solo se registra una nueva admision con su fecha,
  // hora e impresion clinica de ingreso.
  async function guardarIngreso(e) {
    e.preventDefault();
    setGuardandoIngreso(true);
    setMensajeIngreso(null);
    try {
      const fechaIngreso = new Date(`${ingresoForm.fecha}T${ingresoForm.hora || "00:00"}`).toISOString();
      const ingreso = await api.post(`/pacientes/${selectedId}/ingresos`, {
        fechaIngreso,
        impresionClinicaIngreso: ingresoForm.impresionClinicaIngreso,
        serviciosSolicitados: ingresoForm.serviciosSolicitados,
        referidoPor: ingresoForm.referidoPor,
      });
      // El escaneo del expediente fisico de este ingreso se sube ya con el
      // ingresoId, para que quede ligado a ESTA admision (no al paciente en
      // general). Igual que en Registro y Admision: fotos -> PDF.
      if (documentoIngreso?.blob) {
        const fd = new FormData();
        fd.append("documento", documentoIngreso.blob, documentoIngreso.nombre || "expediente.pdf");
        fd.append("tipoDocumental", "expediente_admision");
        fd.append("paginas", String(documentoIngreso.paginas || 1));
        fd.append("ingresoId", String(ingreso.id));
        if (documentoIngreso.fechaDocumentoOriginal) fd.append("fechaDocumentoOriginal", documentoIngreso.fechaDocumentoOriginal);
        await api.post(`/pacientes/${selectedId}/documentos`, fd);
      }
      setMensajeIngreso({ tone: "success", texto: "Ingreso registrado correctamente." });
      setIngresoForm({ fecha: ahoraFecha(), hora: ahoraHora(), impresionClinicaIngreso: "", serviciosSolicitados: "", referidoPor: "" });
      setDocumentoIngreso(null);
      setMostrarNuevoIngreso(false);
      recargarPaciente();
      recargarDocumentos();
    } catch (err) {
      setMensajeIngreso({ tone: "error", texto: err.message });
    } finally {
      setGuardandoIngreso(false);
    }
  }

  const imc = calcularIMC(datos.signosVitales.peso, datos.signosVitales.talla);

  function seleccionarPaciente(p) {
    setSelectedId(p.id);
    setEstado("idle");
    setDiagnostico(null);
    setTempToken("");
    setTokenInfo(null);
    setMostrarHistorial(false);
    setMostrarFormulario(false);
    setMostrarNuevoIngreso(false);
    setMensajeIngreso(null);
  }

  return (
    <div>
      <PageHeader title="Expediente Clínico" />
      <div className="mb-4">
        <PacienteBuscador pacienteSeleccionado={patient} onSelect={seleccionarPaciente} mostrarListado />
      </div>

      {patient && (
        <Card style={{ marginBottom: 16 }}>
          <div className="font-semibold text-sm mb-2">Datos básicos del paciente</div>
          <div className="text-sm" style={{ color: "#666" }}>
            {patient.nombreCompleto} · {patient.historiaClinica} · {patient.edad ?? "—"} años · {patient.sexo ?? "—"} · Sangre: {patient.tipoSangre ?? "—"}
          </div>
        </Card>
      )}

      {patient && (
        <Card style={{ marginBottom: 16 }}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="font-semibold text-sm">Historial de ingresos</div>
            {(esAdmin || tempToken) && (
              <Button variant="secondary" onClick={() => setMostrarNuevoIngreso((v) => !v)}>
                <span className="flex items-center gap-1.5"><Plus size={14} /> Nuevo ingreso</span>
              </Button>
            )}
          </div>

          {ingresos.length > 0 ? (
            <div className="flex flex-col gap-2">
              {ingresos.map((ing, i) => {
                const diagIngreso = diagnostico?.ingresos?.find((x) => x.id === ing.id);
                return (
                  <div key={ing.id} className="rounded-xl p-3 text-sm" style={{ border: `1px solid ${COLORS.border}` }}>
                    <div className="font-medium flex items-center gap-2">
                      {new Date(ing.fechaIngreso).toLocaleString()}
                      {i === 0 && <span className="text-xs" style={{ color: COLORS.green }}>· Ingreso más reciente</span>}
                    </div>
                    {ing.serviciosSolicitados && <div className="text-xs mt-1" style={{ color: "#666" }}>Servicios solicitados: {ing.serviciosSolicitados}</div>}
                    {ing.referidoPor && <div className="text-xs" style={{ color: "#666" }}>Referido por: {ing.referidoPor}</div>}
                    {ing.impresionClinicaIngreso && <div className="text-xs mt-1 whitespace-pre-wrap" style={{ color: "#666" }}>Impresión clínica de ingreso: {ing.impresionClinicaIngreso}</div>}
                    {diagIngreso && (
                      <div className="text-xs mt-1" style={{ color: "#666" }}>
                        Diagnósticos registrados en este ingreso: {diagIngreso.diagnosticos.length}
                      </div>
                    )}
                    {(() => {
                      const docsIngreso = listaDocumentos.filter((d) => d.ingresoId === ing.id);
                      if (!docsIngreso.length) return null;
                      return (
                        <div className="text-xs mt-1" style={{ color: "#666" }}>
                          Expediente escaneado:{" "}
                          {docsIngreso.map((d, k) => (
                            <button
                              key={d.id}
                              type="button"
                              className="font-semibold underline"
                              style={{ color: COLORS.navy }}
                              onClick={async () => {
                                const blob = await api.getBlob(`/pacientes/${selectedId}/documentos/${d.id}`);
                                const url = URL.createObjectURL(blob);
                                window.open(url, "_blank");
                                setTimeout(() => URL.revokeObjectURL(url), 60000);
                              }}
                            >
                              {d.nombreOriginal}{k < docsIngreso.length - 1 ? ", " : ""}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                    {(esAdmin || tempToken) && (
                      <button
                        type="button"
                        className="text-xs font-semibold mt-2"
                        style={{ color: COLORS.navy }}
                        onClick={() => { setIngresoId(String(ing.id)); setMostrarFormulario(true); }}
                      >
                        Registrar / ver diagnóstico de este ingreso →
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm" style={{ color: "#888" }}>No hay ingresos registrados para este paciente.</p>
          )}

          {mostrarNuevoIngreso && (
            <form onSubmit={guardarIngreso} className="flex flex-col gap-4 mt-4 pt-4" style={{ borderTop: `1px solid ${COLORS.border}` }}>
              {mensajeIngreso && <Banner tone={mensajeIngreso.tone}>{mensajeIngreso.texto}</Banner>}
              <p className="text-xs" style={{ color: "#888" }}>
                Paciente: <strong style={{ color: COLORS.text }}>{patient.nombreCompleto}</strong> · Historia clínica: <strong style={{ color: COLORS.text }}>{patient.historiaClinica}</strong> · DPI: {patient.dpi || "—"} · {patient.edad ?? "—"} años · {patient.sexo ?? "—"}.
                Los datos demográficos y la historia clínica no cambian entre ingresos; solo se registra la nueva admisión.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Fecha de ingreso"><TextInput type="date" required value={ingresoForm.fecha} onChange={(e) => setIngresoForm((f) => ({ ...f, fecha: e.target.value }))} /></FormField>
                <FormField label="Hora de ingreso"><TextInput type="time" value={ingresoForm.hora} onChange={(e) => setIngresoForm((f) => ({ ...f, hora: e.target.value }))} /></FormField>
              </div>
              <FormField label="Impresión clínica de ingreso"><TextArea rows={3} value={ingresoForm.impresionClinicaIngreso} onChange={(e) => setIngresoForm((f) => ({ ...f, impresionClinicaIngreso: e.target.value }))} /></FormField>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Servicios solicitados"><TextInput value={ingresoForm.serviciosSolicitados} onChange={(e) => setIngresoForm((f) => ({ ...f, serviciosSolicitados: e.target.value }))} /></FormField>
                <FormField label="Referido por"><TextInput value={ingresoForm.referidoPor} onChange={(e) => setIngresoForm((f) => ({ ...f, referidoPor: e.target.value }))} /></FormField>
              </div>

              <div>
                <div className="font-semibold text-sm mb-2" style={{ color: COLORS.navy }}>Expediente escaneado de este ingreso (opcional)</div>
                <p className="text-xs mb-3" style={{ color: "#888" }}>
                  Igual que en Registro y Admisión: fotografíe el expediente en papel de esta admisión y el sistema genera el PDF.
                  El escaneo queda ligado a <strong>este ingreso</strong>, no al paciente en general.
                </p>
                {!documentoIngreso ? (
                  <Button type="button" variant="secondary" onClick={() => setEscanerIngresoAbierto(true)}>
                    <span className="flex items-center gap-1.5"><Camera size={14} /> Escanear desde este dispositivo</span>
                  </Button>
                ) : (
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-2 text-sm min-w-0">
                      <FileText size={15} style={{ color: COLORS.navy }} className="shrink-0" />
                      <span className="font-semibold">{documentoIngreso.nombre}</span>
                      <span className="text-xs" style={{ color: "#999" }}>{documentoIngreso.paginas} pág. — se adjuntará al guardar el ingreso</span>
                    </span>
                    <button type="button" onClick={() => setDocumentoIngreso(null)} className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg" style={{ color: COLORS.red }}>
                      <Trash2 size={13} /> Quitar escaneo
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={guardandoIngreso}>{guardandoIngreso ? "Guardando…" : "Guardar ingreso"}</Button>
                <Button type="button" variant="secondary" onClick={() => { setMostrarNuevoIngreso(false); setMensajeIngreso(null); }}>Cancelar</Button>
              </div>
            </form>
          )}
        </Card>
      )}

      <div className="mb-4">
        <Button onClick={abrirModal} disabled={!selectedId}>
          {estado === "cargando" ? "Consultando…" : "Ver diagnóstico"}
        </Button>
      </div>

      {estado === "visible" && diagnostico && (
        <Card style={{ border: `2px solid ${COLORS.gold}`, marginBottom: 16 }}>
          <div className="font-semibold text-sm mb-1">🔓 Diagnóstico confidencial</div>
          <DiagnosticoDetalle d={diagnostico} />

          {diagnostico.historial?.length > 0 && (
            <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${COLORS.border}` }}>
              <button
                type="button"
                onClick={() => setMostrarHistorial((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: COLORS.navy }}
              >
                {mostrarHistorial ? <EyeOff size={13} /> : <History size={13} />}
                {mostrarHistorial ? "Ocultar historial" : `Ver historial (${diagnostico.historial.length} versión${diagnostico.historial.length > 1 ? "es" : ""} anterior${diagnostico.historial.length > 1 ? "es" : ""})`}
              </button>

              {mostrarHistorial && (
                <div className="flex flex-col gap-3 mt-4 animate-fade-in">
                  {diagnostico.historial.map((h) => (
                    <div key={h.id} className="rounded-xl p-3" style={{ border: `1px solid ${COLORS.border}` }}>
                      <DiagnosticoDetalle d={h} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {estado === "sin-registro" && <Banner tone="info">Este paciente todavía no tiene un diagnóstico registrado.</Banner>}

      <Modal open={modalAbierto} onClose={() => setModalAbierto(false)} title="Información médica confidencial" icon={ShieldAlert}>
        <p className="text-sm mb-4" style={{ color: COLORS.textMuted }}>
          Está por ver el diagnóstico confidencial de <strong style={{ color: COLORS.text }}>{patient?.nombreCompleto}</strong>.
          Esta acción queda registrada a su nombre (RNF-08) — el Administrador puede consultar quién vio qué y cuándo desde <strong style={{ color: COLORS.text }}>Reportes</strong>.
        </p>

        {mensajeError && <Banner tone="error">{mensajeError}</Banner>}

        {esAdmin ? (
          <Button onClick={confirmarYVer} disabled={estado === "cargando"}>
            {estado === "cargando" ? "Verificando…" : "Continuar y ver diagnóstico"}
          </Button>
        ) : (
          <div className="flex flex-col gap-3">
            <FormField label="Token de acceso temporal (RF-33)">
              <TextInput value={tempToken} onChange={(e) => setTempToken(e.target.value)} placeholder="Pegue aquí el token" />
            </FormField>
            {tokenInfo && <p className="text-xs -mt-1" style={{ color: COLORS.green }}>{tokenInfo}</p>}
            {usuario.puedeAutogenerarToken ? (
              <Button variant="secondary" onClick={autogenerarToken}>
                <span className="flex items-center gap-1.5"><KeyRound size={14} /> Autogenerar token (RF-34)</span>
              </Button>
            ) : (
              <p className="text-xs" style={{ color: "#888" }}>No tiene permiso para autogenerar tokens. Solicítelo al Administrador desde Seguridad y Roles.</p>
            )}
            <Button onClick={confirmarYVer} disabled={!tempToken || estado === "cargando"}>
              {estado === "cargando" ? "Verificando…" : "Confirmar y ver diagnóstico"}
            </Button>
          </div>
        )}
      </Modal>

      {selectedId && (esAdmin || tempToken) && (
        <div className="mb-4">
          <Button variant={mostrarFormulario ? "secondary" : "primary"} onClick={() => setMostrarFormulario((v) => !v)}>
            {mostrarFormulario ? "Ocultar formulario de diagnóstico" : "Registrar diagnóstico"}
          </Button>
        </div>
      )}

      {selectedId && (esAdmin || tempToken) && mostrarFormulario && (
        <Card>
          <div className="font-semibold text-sm mb-1">Registrar diagnóstico (RF-10)</div>
          <p className="text-xs mb-4" style={{ color: "#888" }}>
            Médico responsable: <strong>{usuario.nombre}</strong> — se toma de la sesión activa, no es editable.
          </p>
          {mensajeGuardado && <Banner tone={mensajeGuardado.tone}>{mensajeGuardado.texto}</Banner>}

          <form onSubmit={guardarDiagnostico} className="flex flex-col gap-6">
            <div>
              <SeccionTitulo n={1}>Información general</SeccionTitulo>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <FormField label="Fecha del diagnóstico"><TextInput type="date" value={datos.fecha} onChange={(e) => setCampoDatos("fecha", e.target.value)} /></FormField>
                <FormField label="Hora"><TextInput type="time" value={datos.hora} onChange={(e) => setCampoDatos("hora", e.target.value)} /></FormField>
                <FormField label="Especialidad"><TextInput value={datos.especialidad} onChange={(e) => setCampoDatos("especialidad", e.target.value)} /></FormField>
                <FormField label="Tipo de atención">
                  <Select value={tipoAtencion} onChange={(e) => handleTipoAtencionChange(e.target.value)}>
                    <option value="">Seleccionar…</option>
                    {TIPOS_ATENCION.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </Select>
                </FormField>
                <FormField label="Servicio"><TextInput value={servicio} onChange={(e) => setServicio(e.target.value)} /></FormField>
                {requiereSalaCama && (
                  <FormField label="Sala / Cama"><TextInput value={salaCama} onChange={(e) => setSalaCama(e.target.value)} /></FormField>
                )}
                <FormField label="Ingreso al que pertenece">
                  <Select value={ingresoId} onChange={(e) => setIngresoId(e.target.value)}>
                    <option value="">Sin ingreso (no especificado)</option>
                    {ingresos.map((i) => <option key={i.id} value={i.id}>{new Date(i.fechaIngreso).toLocaleString()}</option>)}
                  </Select>
                </FormField>
              </div>
            </div>

            <div>
              <SeccionTitulo n={2}>Motivo de consulta</SeccionTitulo>
              <TextInput value={datos.motivoConsulta} onChange={(e) => setCampoDatos("motivoConsulta", e.target.value)} placeholder='ej. "Dolor abdominal de 18 horas de evolución"' />
            </div>

            <div>
              <SeccionTitulo n={3}>Historia de la enfermedad actual</SeccionTitulo>
              <TextArea rows={3} value={datos.historiaEnfermedad} onChange={(e) => setCampoDatos("historiaEnfermedad", e.target.value)} placeholder="Inicio, evolución, localización, intensidad, síntomas asociados, factores que agravan o alivian, tratamientos previos…" />
            </div>

            <div>
              <SeccionTitulo n={4}>Signos y síntomas relevantes</SeccionTitulo>
              <div className="flex flex-wrap gap-x-5 gap-y-2 mb-3">
                {SIGNOS_SINTOMAS.map((s) => (
                  <label key={s} className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
                    <input type="checkbox" checked={datos.signosSintomas.includes(s)} onChange={() => toggleSintoma(s)} />
                    {s}
                  </label>
                ))}
              </div>
              <TextInput placeholder="Otros…" value={datos.signosSintomasOtros} onChange={(e) => setCampoDatos("signosSintomasOtros", e.target.value)} style={{ maxWidth: 320 }} />
            </div>

            <div>
              <SeccionTitulo n={5}>Signos vitales</SeccionTitulo>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
                <FormField label="Presión arterial"><TextInput placeholder="120/80" value={datos.signosVitales.pa} onChange={(e) => setCampoVital("pa", e.target.value)} /></FormField>
                <FormField label="FC (lpm)"><TextInput type="number" value={datos.signosVitales.fc} onChange={(e) => setCampoVital("fc", e.target.value)} /></FormField>
                <FormField label="FR (rpm)"><TextInput type="number" value={datos.signosVitales.fr} onChange={(e) => setCampoVital("fr", e.target.value)} /></FormField>
                <FormField label="Temp (°C)"><TextInput type="number" step="0.1" value={datos.signosVitales.temp} onChange={(e) => setCampoVital("temp", e.target.value)} /></FormField>
                <FormField label="SpO₂ (%)"><TextInput type="number" value={datos.signosVitales.spo2} onChange={(e) => setCampoVital("spo2", e.target.value)} /></FormField>
                <FormField label="Peso (kg)"><TextInput type="number" step="0.1" value={datos.signosVitales.peso} onChange={(e) => setCampoVital("peso", e.target.value)} /></FormField>
                <FormField label="Talla (m)"><TextInput type="number" step="0.01" value={datos.signosVitales.talla} onChange={(e) => setCampoVital("talla", e.target.value)} /></FormField>
                <FormField label="IMC"><TextInput disabled value={imc || ""} placeholder="—" /></FormField>
              </div>
            </div>

            <div>
              <SeccionTitulo n={6}>Exploración física</SeccionTitulo>
              <div className="flex gap-4">
                <div className="flex flex-col gap-1 shrink-0" style={{ width: 160 }}>
                  {SISTEMAS_EXPLORACION.map((s) => (
                    <button
                      type="button"
                      key={s.key}
                      onClick={() => setSistemaActivo(s.key)}
                      className="text-left text-sm px-3 py-2 rounded-lg transition-colors"
                      style={sistemaActivo === s.key ? { backgroundColor: COLORS.navy, color: "white", fontWeight: 600 } : { color: COLORS.text }}
                    >
                      {s.label}
                      {datos.exploracionFisica[s.key] && sistemaActivo !== s.key && <span style={{ color: COLORS.gold }}> ●</span>}
                    </button>
                  ))}
                </div>
                <TextArea
                  rows={6}
                  className="flex-1"
                  value={datos.exploracionFisica[sistemaActivo]}
                  onChange={(e) => setCampoExploracion(e.target.value)}
                  placeholder={`Hallazgos de ${SISTEMAS_EXPLORACION.find((s) => s.key === sistemaActivo)?.label.toLowerCase()}…`}
                />
              </div>
            </div>

            <div>
              <SeccionTitulo n={7}>Estudios y resultados</SeccionTitulo>
              {datos.estudios.length > 0 && (
                <div className="flex flex-col gap-4 mb-3">
                  {datos.estudios.map((e, i) => (
                    <div key={i} className="rounded-xl p-3" style={{ border: `1px solid ${COLORS.border}` }}>
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_150px_2fr_auto] gap-3 items-end mb-2">
                        <FormField label="Tipo de estudio"><TextInput value={e.tipo} onChange={(ev) => actualizarEstudio(i, "tipo", ev.target.value)} placeholder="ej. Biometría hemática" /></FormField>
                        <FormField label="Fecha"><TextInput type="date" value={e.fecha} onChange={(ev) => actualizarEstudio(i, "fecha", ev.target.value)} /></FormField>
                        <FormField label="Resultado / hallazgos"><TextInput value={e.resultado} onChange={(ev) => actualizarEstudio(i, "resultado", ev.target.value)} /></FormField>
                        <button type="button" onClick={() => quitarEstudio(i)} className="text-gray-400 hover:text-red-500 mb-2.5" aria-label="Quitar estudio"><Trash2 size={16} /></button>
                      </div>
                      <FormField label="Adjuntar archivo (PDF/imagen, máx. 5MB — opcional)">
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          onChange={(ev) => setArchivoEstudio(i, ev.target.files[0] || null)}
                          className="text-sm mt-1.5"
                        />
                      </FormField>
                      {e.archivoNombre && !archivosEstudios[i] && (
                        <p className="text-xs mt-1" style={{ color: "#888" }}>Ya tiene adjunto: {e.archivoNombre} (seleccione otro archivo para reemplazarlo)</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <Button type="button" variant="secondary" onClick={agregarEstudio}>
                <span className="flex items-center gap-1.5"><Plus size={14} /> Agregar estudio</span>
              </Button>

              <div className="mt-4">
                <FormField label="Adjuntar archivos (PDF/imagen, máx. 5MB — opcional)">
                  <input
                    type="file"
                    multiple
                    accept=".pdf,image/*"
                    onChange={(ev) => {
                      const elegidos = Array.from(ev.target.files || []);
                      setArchivosAdicionales((a) => [...a, ...elegidos]);
                      ev.target.value = "";
                    }}
                    className="text-sm mt-1.5"
                  />
                </FormField>
                {archivosAdicionales.length > 0 && (
                  <ul className="flex flex-col gap-1 mt-2">
                    {archivosAdicionales.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs" style={{ color: "#555" }}>
                        <FileText size={13} /> {f.name}
                        <button
                          type="button"
                          onClick={() => setArchivosAdicionales((a) => a.filter((_, idx) => idx !== i))}
                          className="text-gray-400 hover:text-red-500"
                          aria-label="Quitar archivo"
                        >
                          <X size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div>
              <SeccionTitulo n={8}>Diagnóstico principal</SeccionTitulo>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
                <div className="col-span-1 sm:col-span-2 lg:col-span-3">
                  <FormField label="Diagnóstico"><TextInput required value={datos.diagnosticoPrincipal.diagnostico} onChange={(e) => setCampoPrincipal("diagnostico", e.target.value)} /></FormField>
                </div>
                <FormField label="Código CIE-10"><Cie10Input value={datos.diagnosticoPrincipal.codigoCie} onChange={(v) => setCampoPrincipal("codigoCie", v)} /></FormField>
                <FormField label="Tipo">
                  <Select value={datos.diagnosticoPrincipal.tipo} onChange={(e) => setCampoPrincipal("tipo", e.target.value)}>
                    {TIPOS_DIAGNOSTICO.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </FormField>
                <FormField label="Prioridad">
                  <Select value={datos.diagnosticoPrincipal.prioridad} onChange={(e) => setCampoPrincipal("prioridad", e.target.value)}>
                    {PRIORIDADES_DIAGNOSTICO.map((p) => <option key={p} value={p}>{p}</option>)}
                  </Select>
                </FormField>
                <FormField label="Estado">
                  <Select value={datos.diagnosticoPrincipal.estado} onChange={(e) => setCampoPrincipal("estado", e.target.value)}>
                    {ESTADOS_DIAGNOSTICO.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </FormField>
                <FormField label="Fecha"><TextInput type="date" value={datos.diagnosticoPrincipal.fecha} onChange={(e) => setCampoPrincipal("fecha", e.target.value)} /></FormField>
              </div>

              <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#888" }}>Diagnósticos secundarios (opcionales)</div>
              {datos.diagnosticosSecundarios.length > 0 && (
                <div className="flex flex-col gap-3 mb-3">
                  {datos.diagnosticosSecundarios.map((s, i) => (
                    <div key={i} className="grid grid-cols-1 sm:grid-cols-[2fr_150px_150px_auto] gap-3 items-end">
                      <FormField label="Diagnóstico"><TextInput value={s.diagnostico} onChange={(ev) => actualizarSecundario(i, "diagnostico", ev.target.value)} /></FormField>
                      <FormField label="Código CIE-10"><Cie10Input value={s.codigoCie} onChange={(v) => actualizarSecundario(i, "codigoCie", v)} /></FormField>
                      <FormField label="Estado">
                        <Select value={s.estado} onChange={(ev) => actualizarSecundario(i, "estado", ev.target.value)}>
                          {ESTADOS_DIAGNOSTICO.map((e) => <option key={e} value={e}>{e}</option>)}
                        </Select>
                      </FormField>
                      <button type="button" onClick={() => quitarSecundario(i)} className="text-gray-400 hover:text-red-500 mb-2.5" aria-label="Quitar diagnóstico"><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
              )}
              <Button type="button" variant="secondary" onClick={agregarSecundario}>
                <span className="flex items-center gap-1.5"><Plus size={14} /> Agregar diagnóstico</span>
              </Button>

              <div className="mt-4">
                <FormField label="Adjuntar archivo del diagnóstico (PDF/imagen, máx. 5MB — opcional)">
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(ev) => setArchivoDiagnostico(ev.target.files?.[0] || null)}
                    className="text-sm mt-1.5"
                  />
                </FormField>
                {archivoDiagnostico && (
                  <p className="flex items-center gap-2 text-xs mt-1.5" style={{ color: "#555" }}>
                    <FileText size={13} /> {archivoDiagnostico.name}
                    <button
                      type="button"
                      onClick={() => setArchivoDiagnostico(null)}
                      className="text-gray-400 hover:text-red-500"
                      aria-label="Quitar archivo"
                    >
                      <X size={13} />
                    </button>
                  </p>
                )}
              </div>
            </div>

            <div>
              <SeccionTitulo n={9}>Impresión clínica</SeccionTitulo>
              <TextArea rows={3} value={datos.impresionClinica} onChange={(e) => setCampoDatos("impresionClinica", e.target.value)} placeholder="Cómo se llegó al diagnóstico…" />
            </div>

            <div>
              <SeccionTitulo n={10}>Plan y conducta</SeccionTitulo>
              <TextArea rows={4} value={datos.planConducta} onChange={(e) => setCampoDatos("planConducta", e.target.value)} placeholder="Tratamiento indicado, medicamentos, procedimientos, referencia a especialista, hospitalización, cirugía, estudios adicionales, seguimiento…" />
            </div>

            <div>
              <Button type="submit" disabled={guardando}>{guardando ? "Guardando…" : "Guardar diagnóstico"}</Button>
            </div>
          </form>
        </Card>
      )}

      <CameraScannerModal
        open={escanerIngresoAbierto}
        onClose={() => setEscanerIngresoAbierto(false)}
        onConfirmar={(blob, { paginas, nombre, datosBasicos }) => {
          setDocumentoIngreso({ blob, paginas, nombre, fechaDocumentoOriginal: datosBasicos?.fechaDocumentoOriginal || "" });
        }}
        titulo="Escanear expediente de este ingreso"
        mensajeExito="El documento quedó listo — se adjuntará a este ingreso al guardarlo."
      />
    </div>
  );
}
