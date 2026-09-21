import React, { useEffect, useMemo, useState } from "react";
import { Printer, Camera, FileText, Download, Trash2, Smartphone, Eye, ChevronDown, ChevronUp } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Table } from "../components/Table";
import { Button } from "../components/Button";
import { Banner } from "../components/Banner";
import { Modal } from "../components/Modal";
import { FichaPacienteImprimible } from "../components/FichaPacienteImprimible";
import { CameraScannerModal } from "../components/CameraScannerModal";
import { EscaneoQRModal } from "../components/EscaneoQRModal";
import { PacienteBuscador } from "../components/PacienteBuscador";
import { FormField, TextInput, Select, TextArea } from "../components/FormField";
import { Combobox } from "../components/Combobox";
import { useFetch } from "../hooks/useFetch";
import { usePaginatedFetch } from "../hooks/usePaginatedFetch";
import { Pagination } from "../components/Pagination";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { ROLES, tieneRol } from "../utils/roles";
import { DEPARTAMENTOS_GUATEMALA, ESTADOS_CIVILES, NACIONALIDADES } from "../utils/guatemala";
import { CONDICIONES_EGRESO } from "../utils/condicionesEgreso";
import { Cie10Input } from "../components/Cie10Input";
import { formatearDPI, limpiarDPI, validarDPI } from "../utils/dpi";
import { formatearTelefono, limpiarTelefono, telefonoIncompleto } from "../utils/telefono";
import { COLORS } from "../styles/tokens";
import { fechaDia, fechaLocal } from "../utils/fechas";

const OTRO = "__otro__";

const PARENTESCOS = ["Esposo/a", "Padre", "Madre", "Hijo/a", "Hermano/a", "Abuelo/a", "Tío/a", "Amigo/a", "Vecino/a"];

const RELIGIONES = ["Católica", "Evangélica / Cristiana", "Testigo de Jehová", "Mormona (SUD)", "Espiritualidad Maya", "Ninguna / Atea"];

const CAMPOS_INGRESO_VACIOS = {
  // Dev-Mari: datos de identificacion editables despues del registro (antes
  // un error de digitacion —o del escaner— no se podia corregir).
  idNombre: "", idDpi: "", idHistoria: "", idDireccion: "", idTelefono: "", idFechaNacimiento: "",
  tipoSangre: "",
  fechaIngreso: "", serviciosSolicitados: "", referidoDe: "", medicoReferenteId: "", impresionClinicaIngreso: "",
  fechaEgreso: "", diagnosticoEgresoCodigo: "", complicacionesCodigo: "", operacionesCodigo: "",
  condicionEgreso: "", autopsia: "", causaMuerte: "",
  matNumeroHijo: "", matFecha: "", matHora: "", matSexo: "", matCondicion: "",
  matBebeNombre: "", matPadreNombre: "", matPadreDpi: "", matPadreTelefono: "",
};

// Los inputs datetime-local/date esperan "YYYY-MM-DDTHH:mm" / "YYYY-MM-DD" en
// hora local; convertir con toISOString() a secas desplaza la hora por el
// timezone offset, por eso se resta ese offset antes de recortar el string.
function toDatetimeLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
// Fechas "de solo dia" (nacimiento del bebe, fecha de nacimiento) se guardan
// como medianoche UTC: se leen en UTC. Convertirlas a hora local las corria un
// dia atras en cada carga (en Guatemala, UTC-6) y, al volver a guardar,
// retrocedian un dia mas cada vez.
function toDateInput(iso) {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

const OPCIONES_LUGAR = DEPARTAMENTOS_GUATEMALA.flatMap((d) =>
  d.municipios.map((m) => ({ value: `${m}, ${d.departamento}`, label: m, group: d.departamento }))
);

const CAMPOS_VACIOS = {
  nombreCompleto: "", dpi: "", historiaClinica: "", fechaIngreso: "", horaIngreso: "", direccion: "", lugarNacimiento: "", fechaNacimiento: "",
  telefono: "", edad: "", sexo: "", tipoSangre: "", estadoCivil: "", ocupacion: "", religion: "",
  nacionalidad: "", nombreConyuge: "", nombrePadre: "", nombreMadre: "",
  contactoEmergencia: "", telefonoEmergencia: "", parentesco: "",
  encargadoNombre: "", encargadoTelefono: "",
  referidoDe: "", medicoReferenteId: "",
};

const TIPOS_SANGRE = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export function RegistroPage({ onVerExpediente }) {
  const { usuario } = useAuth();
  const puedeRegistrar = tieneRol(usuario, ROLES.RECEPCION, ROLES.ADMIN);

  const [tab, setTab] = useState("nuevo");
  const [buscarInput, setBuscarInput] = useState("");
  const [buscar, setBuscar] = useState(""); // valor con debounce, para no disparar una petición por cada tecla (RNF-07)

  useEffect(() => {
    const timeout = setTimeout(() => setBuscar(buscarInput), 300);
    return () => clearTimeout(timeout);
  }, [buscarInput]);

  const pacientesLista = usePaginatedFetch(
    tab === "lista" ? `/pacientes${buscar ? `?buscar=${encodeURIComponent(buscar)}` : ""}` : null,
    { pageSize: 20 }
  );
  const { data: medicosReferentes } = useFetch("/referidos");
  // Dev-Mari: si el servidor tiene activada la lectura avanzada (modelo de
  // vision), se le avisa al personal que la imagen viaja a un servicio externo.
  const { data: lecturaAvanzada } = useFetch(puedeRegistrar ? "/pacientes/lectura-avanzada/estado" : null, { enabled: puedeRegistrar });

  const [ingresoPacienteId, setIngresoPacienteId] = useState(null);
  const [mostrarFicha, setMostrarFicha] = useState(false);
  const [escanerAbierto, setEscanerAbierto] = useState(false);
  const [escaneoQRAbierto, setEscaneoQRAbierto] = useState(false);
  const [mensajeDocumento, setMensajeDocumento] = useState(null);
  const [mensajeFichaDocumento, setMensajeFichaDocumento] = useState(null);
  // Dev-Mari: el expediente fisico se escanea ANTES de que el paciente
  // exista — ya no depende de tener uno seleccionado. El PDF queda aqui,
  // pendiente, hasta que se registra el paciente (un solo POST con ambos).
  const [documentoPendiente, setDocumentoPendiente] = useState(null);
  const { data: pacienteDetalle, reload: reloadPacienteDetalle } = useFetch(
    ingresoPacienteId ? `/pacientes/${ingresoPacienteId}` : null,
    { enabled: !!ingresoPacienteId }
  );
  // Cambios2: documentos escaneados del paciente (visible para admision y
  // personal clinico; el backend repite la autorizacion por rol).
  const puedeVerDocumentos = tieneRol(usuario, ROLES.ADMIN, ROLES.RECEPCION, ROLES.CONSULTA, ROLES.ENFERMERIA);
  const { data: documentosPaciente, reload: reloadDocumentos } = useFetch(
    puedeVerDocumentos && ingresoPacienteId ? `/pacientes/${ingresoPacienteId}/documentos` : null,
    { enabled: !!(puedeVerDocumentos && ingresoPacienteId) }
  );
  const [ingresoForm, setIngresoForm] = useState(CAMPOS_INGRESO_VACIOS);
  const [guardandoIngreso, setGuardandoIngreso] = useState(false);
  const [mensajeIngreso, setMensajeIngreso] = useState(null);

  useEffect(() => {
    if (!pacienteDetalle) return;
    // Sprint 3: el egreso clinico llega cifrado desde el backend como objeto
    // egresoClinico; los campos planos legacy son solo fallback de datos viejos.
    const eg = pacienteDetalle.egresoClinico || {};
    setIngresoForm({
      idNombre: pacienteDetalle.nombreCompleto || "",
      idDpi: pacienteDetalle.dpi || "",
      idHistoria: pacienteDetalle.historiaClinica || "",
      idDireccion: pacienteDetalle.direccion || "",
      idTelefono: pacienteDetalle.telefono || "",
      idFechaNacimiento: toDateInput(pacienteDetalle.fechaNacimiento),
      tipoSangre: pacienteDetalle.tipoSangre || "",
      fechaIngreso: toDatetimeLocal(pacienteDetalle.fechaIngreso),
      serviciosSolicitados: pacienteDetalle.serviciosSolicitados || "",
      referidoDe: pacienteDetalle.referidoDe || "",
      medicoReferenteId: pacienteDetalle.medicoReferenteId || "",
      impresionClinicaIngreso: pacienteDetalle.impresionClinicaIngreso || "",
      fechaEgreso: toDatetimeLocal(pacienteDetalle.fechaEgreso),
      diagnosticoEgresoCodigo: eg.diagnosticoEgreso ?? pacienteDetalle.diagnosticoEgresoCodigo ?? "",
      complicacionesCodigo: eg.complicaciones ?? pacienteDetalle.complicacionesCodigo ?? "",
      operacionesCodigo: eg.operaciones ?? pacienteDetalle.operacionesCodigo ?? "",
      condicionEgreso: pacienteDetalle.condicionEgreso || "",
      autopsia: eg.autopsia == null ? (pacienteDetalle.autopsia == null ? "" : pacienteDetalle.autopsia ? "si" : "no") : eg.autopsia ? "si" : "no",
      causaMuerte: eg.causaMuerte ?? pacienteDetalle.causaMuerte ?? "",
      matNumeroHijo: pacienteDetalle.maternidad?.numeroHijo ?? "",
      matFecha: toDateInput(pacienteDetalle.maternidad?.fecha),
      matHora: pacienteDetalle.maternidad?.hora || "",
      matSexo: pacienteDetalle.maternidad?.sexo || "",
      matCondicion: pacienteDetalle.maternidad?.condicionEgresoBebe || "",
      matBebeNombre: pacienteDetalle.maternidad?.bebeNombre || "",
      matPadreNombre: pacienteDetalle.maternidad?.padreNombre || "",
      matPadreDpi: pacienteDetalle.maternidad?.padreDpi || "",
      matPadreTelefono: pacienteDetalle.maternidad?.padreTelefono || "",
    });
  }, [pacienteDetalle]);

  function setCampoIngreso(campo, valor) {
    setIngresoForm((f) => ({ ...f, [campo]: valor }));
  }

  const esFallecido = ingresoForm.condicionEgreso.startsWith("fallecido");

  // Autopsia y causa de la muerte solo aplican si el paciente fallecio: si
  // el usuario cambia la condicion de egreso a una con vida, se limpian
  // para no dejar guardado un dato que ya no corresponde.
  function handleCondicionEgresoChange(valor) {
    setIngresoForm((f) => ({
      ...f,
      condicionEgreso: valor,
      ...(valor.startsWith("fallecido") ? {} : { autopsia: "", causaMuerte: "" }),
    }));
  }

  async function handleSubmitIngreso(e) {
    e.preventDefault();
    const f = ingresoForm;
    // Identificacion editable: se valida aqui para dar el mensaje al lado del
    // formulario en vez de un 400 generico del servidor.
    const errorId =
      (!f.idNombre.trim() && "El nombre no puede quedar vacío.") ||
      (validarDPI(f.idDpi).estado !== "valido" && (validarDPI(f.idDpi).mensaje || "Ingrese un DPI completo y válido.")) ||
      (telefonoIncompleto(f.idTelefono) && "El teléfono debe tener 8 dígitos.") ||
      (telefonoIncompleto(f.matPadreTelefono) && "El teléfono del padre debe tener 8 dígitos.") ||
      (f.matPadreDpi && validarDPI(f.matPadreDpi).estado !== "valido" && "El DPI del padre debe tener 13 dígitos.");
    if (errorId) {
      setMensajeIngreso({ tone: "error", texto: errorId });
      return;
    }
    setGuardandoIngreso(true);
    setMensajeIngreso(null);
    const payload = {
      nombreCompleto: f.idNombre.trim(),
      dpi: limpiarDPI(f.idDpi),
      historiaClinica: f.idHistoria.trim() || undefined,
      direccion: f.idDireccion.trim() || null,
      telefono: limpiarTelefono(f.idTelefono) || null,
      fechaNacimiento: f.idFechaNacimiento || null,
      tipoSangre: f.tipoSangre || null,
      fechaIngreso: f.fechaIngreso ? new Date(f.fechaIngreso).toISOString() : null,
      serviciosSolicitados: f.serviciosSolicitados || null,
      referidoDe: f.referidoDe || null,
      medicoReferenteId: f.medicoReferenteId ? Number(f.medicoReferenteId) : null,
      impresionClinicaIngreso: f.impresionClinicaIngreso || null,
      fechaEgreso: f.fechaEgreso ? new Date(f.fechaEgreso).toISOString() : null,
      condicionEgreso: f.condicionEgreso || null,
      // Sprint 3: datos clinicos de egreso viajan como objeto; el backend los
      // cifra (AES-256-GCM) antes de guardarlos en EgresoClinico.
      egresoClinico: {
        diagnosticoEgreso: f.diagnosticoEgresoCodigo || null,
        complicaciones: f.complicacionesCodigo || null,
        operaciones: f.operacionesCodigo || null,
        autopsia: f.autopsia === "" ? null : f.autopsia === "si",
        causaMuerte: f.causaMuerte || null,
      },
    };
    if (f.matNumeroHijo || f.matFecha || f.matHora || f.matSexo || f.matCondicion || f.matBebeNombre || f.matPadreNombre || f.matPadreDpi || f.matPadreTelefono) {
      payload.maternidad = {
        numeroHijo: f.matNumeroHijo ? Number(f.matNumeroHijo) : null,
        fecha: f.matFecha ? new Date(f.matFecha).toISOString() : null,
        hora: f.matHora || null,
        sexo: f.matSexo || null,
        condicionEgresoBebe: f.matCondicion || null,
        bebeNombre: f.matBebeNombre.trim() || null,
        padreNombre: f.matPadreNombre.trim() || null,
        padreDpi: limpiarDPI(f.matPadreDpi) || null,
        padreTelefono: limpiarTelefono(f.matPadreTelefono) || null,
      };
    }
    try {
      await api.put(`/pacientes/${ingresoPacienteId}`, payload);
      setMensajeIngreso({ tone: "success", texto: "Datos de ingreso/egreso guardados correctamente." });
      reloadPacienteDetalle();
    } catch (err) {
      setMensajeIngreso({ tone: "error", texto: err.message });
    } finally {
      setGuardandoIngreso(false);
    }
  }

  // Dev-Mari: el escaner entrega el PDF generado + lo que el OCR pudo leer
  // del documento (nombre, DPI, telefono, fecha). El documento se queda en
  // memoria (documentoPendiente) — se adjunta al paciente hasta que se
  // guarda el formulario, en una sola operacion (nunca queda un documento
  // huerfano sin paciente ni un paciente sin su respaldo escaneado).
  function manejarEscaneoConfirmado(blob, { paginas, nombre, datosBasicos }) {
    const d = datosBasicos || {};
    const leidos = {
      nombreCompleto: d.nombreCompleto,
      dpi: d.dpi ? limpiarDPI(d.dpi) : "",
      historiaClinica: d.historiaClinica,
      direccion: d.direccion,
      telefono: d.telefono ? limpiarTelefono(d.telefono) : "",
      fechaNacimiento: d.fechaNacimiento,
      fechaIngreso: d.fechaIngreso,
    };
    // Solo se llenan los campos que estan vacios: nunca se pisa lo que el
    // personal ya haya escrito a mano.
    const llenados = Object.entries(leidos).filter(([campo, valor]) => valor && !form[campo]).map(([campo]) => campo);
    setForm((f) => {
      const nuevo = { ...f };
      for (const campo of llenados) nuevo[campo] = leidos[campo];
      return nuevo;
    });
    setCamposOCR(new Set(llenados));
    setOcrDetalle({ texto: d.textoCrudo || "", error: d.error || null, fuente: d.fuente || "local", avisoIA: d.avisoIA || null });
    // Con un expediente escaneado, los datos opcionales ya quedan en el PDF
    // original: se ocultan por defecto (el interruptor los vuelve a mostrar).
    setMostrarOpcionales(false);
    setDocumentoPendiente({ blob, nombre, paginas, fechaDocumentoOriginal: d.fechaIngreso || "" });

    const lector = d.fuente === "ia" ? "la lectura avanzada" : "el lector local";
    // Si la lectura avanzada estaba activa pero fallo, se avisa por que (y se
    // uso el lector local): asi no parece que "no paso nada".
    const notaIA = d.avisoIA ? ` La lectura avanzada no estuvo disponible (${d.avisoIA}); se usó el lector local, que lee mal la letra a mano.` : "";
    let mensaje;
    if (d.error) {
      mensaje = { tone: "info", texto: `El lector automático de texto no pudo ejecutarse (${d.error}). Complete los datos a mano; el escaneo igual se adjuntará al guardar.${notaIA}` };
    } else if (llenados.length) {
      mensaje = { tone: "success", texto: `Se autorellenaron ${llenados.length} campo${llenados.length === 1 ? "" : "s"} con ${lector} — verifíquelos contra el papel antes de guardar (la letra manuscrita se lee con errores).${notaIA}` };
    } else {
      mensaje = { tone: "info", texto: `No se lograron leer datos del documento con ${lector}; complete el formulario a mano. El escaneo igual se adjuntará al guardar.${notaIA}` };
    }
    setMensajeDocumento(mensaje);
  }

  // Vista previa incrustada del PDF escaneado (se libera al cambiar o quitar).
  const urlVistaPrevia = useMemo(() => (documentoPendiente?.blob ? URL.createObjectURL(documentoPendiente.blob) : null), [documentoPendiente?.blob]);
  useEffect(() => () => { if (urlVistaPrevia) URL.revokeObjectURL(urlVistaPrevia); }, [urlVistaPrevia]);

  function quitarDocumentoPendiente() {
    setDocumentoPendiente(null);
    setMensajeDocumento(null);
    setCamposOCR(new Set());
    setOcrDetalle(null);
    setMostrarOpcionales(true);
  }

  // Abre el PDF escaneado (todavia sin guardar) en una pestaña nueva para
  // revisarlo antes de confirmar el registro del paciente.
  function verDocumentoPendiente() {
    if (!documentoPendiente) return;
    const url = URL.createObjectURL(documentoPendiente.blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function descargarDocumento(pacienteId, doc, alError) {
    try {
      const blob = await api.getBlob(`/pacientes/${pacienteId}/documentos/${doc.id}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.nombreOriginal;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      (alError || setMensajeDocumento)({ tone: "error", texto: err.message });
    }
  }

  async function eliminarDocumento(pacienteId, doc, reload, alError) {
    if (!window.confirm(`¿Eliminar el documento "${doc.nombreOriginal}" del expediente?`)) return;
    try {
      await api.del(`/pacientes/${pacienteId}/documentos/${doc.id}`);
      reload();
      (alError || setMensajeDocumento)({ tone: "success", texto: "Documento eliminado del expediente." });
    } catch (err) {
      (alError || setMensajeDocumento)({ tone: "error", texto: err.message });
    }
  }

  const [form, setForm] = useState(CAMPOS_VACIOS);
  const [lugarOtro, setLugarOtro] = useState(false);
  const [parentescoOtro, setParentescoOtro] = useState(false);
  const [religionOtro, setReligionOtro] = useState(false);
  const [tieneReferido, setTieneReferido] = useState(false);
  const [nacionalidadOtro, setNacionalidadOtro] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  // Dev-Mari: datos opcionales colapsables (se ocultan solos al escanear), y
  // que campos llenó el OCR — para marcarlos "verifique" hasta que se editen.
  const [mostrarOpcionales, setMostrarOpcionales] = useState(true);
  const [camposOCR, setCamposOCR] = useState(new Set());
  const [ocrDetalle, setOcrDetalle] = useState(null); // { texto, error } del ultimo escaneo

  const dpiEstado = validarDPI(form.dpi);
  const DPI_COLOR = { valido: COLORS.green, invalido: COLORS.red, incompleto: "#B08B2E", vacio: "#888" };

  function setCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
    // Editar a mano un campo autorrellenado ya es "verificarlo": se quita el aviso.
    setCamposOCR((s) => {
      if (!s.has(campo)) return s;
      const nuevo = new Set(s);
      nuevo.delete(campo);
      return nuevo;
    });
  }

  function avisoOCR(campo) {
    if (!camposOCR.has(campo)) return null;
    return (
      <p className="text-[11px] mt-1" style={{ color: COLORS.gold }}>
        Leído del escaneo — verifique que coincida con el papel.
      </p>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (dpiEstado.estado !== "valido") {
      setMensaje({ tone: "error", texto: dpiEstado.mensaje || "Ingrese un DPI completo y válido." });
      return;
    }
    setGuardando(true);
    setMensaje(null);
    try {
      const datosPaciente = {
        ...form,
        edad: form.edad ? Number(form.edad) : undefined,
        fechaNacimiento: form.fechaNacimiento || undefined,
        // Fecha + hora locales del ingreso. Sin hora se usa mediodia: un
        // "YYYY-MM-DD" a secas seria medianoche UTC y en Guatemala (UTC-6) se
        // veria como el dia anterior.
        fechaIngreso: form.fechaIngreso ? new Date(`${form.fechaIngreso}T${form.horaIngreso || "12:00"}:00`).toISOString() : undefined,
        historiaClinica: form.historiaClinica.trim() || undefined,
        medicoReferenteId: form.medicoReferenteId ? Number(form.medicoReferenteId) : undefined,
      };
      delete datosPaciente.horaIngreso; // solo sirve para armar fechaIngreso

      let paciente;
      if (documentoPendiente) {
        // Un solo POST con los datos del paciente + el PDF escaneado: el
        // backend crea ambos en la misma transaccion.
        const fd = new FormData();
        for (const [campo, valor] of Object.entries(datosPaciente)) {
          if (valor !== undefined && valor !== null && valor !== "") fd.append(campo, valor);
        }
        fd.append("documento", new File([documentoPendiente.blob], documentoPendiente.nombre, { type: "application/pdf" }));
        fd.append("paginas", String(documentoPendiente.paginas));
        // La fecha del papel es la que el doctor anoto como fecha de ingreso:
        // si no se capturo aparte, se usa esa.
        const fechaPapel = documentoPendiente.fechaDocumentoOriginal || form.fechaIngreso;
        if (fechaPapel) fd.append("fechaDocumentoOriginal", fechaPapel);
        paciente = await api.post("/pacientes", fd);
      } else {
        paciente = await api.post("/pacientes", datosPaciente);
      }

      setMensaje({
        tone: "success",
        texto: `Paciente registrado con historia clínica ${paciente.historiaClinica}${documentoPendiente ? " (expediente escaneado adjunto)." : "."}`,
      });
      setForm(CAMPOS_VACIOS);
      setDocumentoPendiente(null);
      setMensajeDocumento(null);
      setCamposOCR(new Set());
      setOcrDetalle(null);
      setMostrarOpcionales(true);
      setLugarOtro(false);
      setParentescoOtro(false);
      setReligionOtro(false);
      setNacionalidadOtro(false);
      setTieneReferido(false);
      pacientesLista.reload();
    } catch (err) {
      setMensaje({ tone: "error", texto: err.message });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <PageHeader title="Registro y Admisión de Pacientes" />
      <div className="flex gap-2 mb-4 flex-wrap">
        {puedeRegistrar && (
          <button
            onClick={() => setTab("nuevo")}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150"
            style={tab === "nuevo" ? { backgroundColor: COLORS.navy, color: "white" } : { border: `1px solid ${COLORS.border}`, backgroundColor: "white", color: COLORS.text }}
          >
            + Paciente nuevo
          </button>
        )}
        {puedeRegistrar && (
          <button
            onClick={() => setTab("ingreso")}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150"
            style={tab === "ingreso" ? { backgroundColor: COLORS.navy, color: "white" } : { border: `1px solid ${COLORS.border}`, backgroundColor: "white", color: COLORS.text }}
          >
            Ingreso / Egreso
          </button>
        )}
        <button
          onClick={() => setTab("lista")}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150"
          style={tab === "lista" ? { backgroundColor: COLORS.navy, color: "white" } : { border: `1px solid ${COLORS.border}`, backgroundColor: "white", color: COLORS.text }}
        >
          Pacientes registrados
        </button>
      </div>

      {/* Dev-Mari: escaneo del expediente fisico ANTES de registrar al
          paciente — ya no depende de tener uno seleccionado. Util cuando el
          doctor ya lo lleno a mano en papel: se escanea, el sistema intenta
          leer los datos basicos y autorellenar el formulario de abajo, y el
          PDF se adjunta al guardar. El escaneo es opcional: tambien se puede
          seguir llenando el formulario a mano sin escanear nada. */}
      {tab === "nuevo" && puedeRegistrar && puedeVerDocumentos && (
        <Card style={{ marginBottom: 16 }}>
          <div className="font-semibold text-sm mb-1">Escanear expediente físico (opcional)</div>
          <p className="text-xs mb-4" style={{ color: "#888" }}>
            Si el doctor ya llenó el expediente en papel, escanéelo aquí antes de registrar: el sistema genera el PDF
            automáticamente y trata de leer nombre, DPI, historia clínica, dirección, teléfono y fechas para autorellenar el formulario de abajo
            (siempre revisable). El PDF original queda guardado tal cual, sin alterar la letra ni la firma del doctor,
            y se adjunta al paciente al hacer clic en "Guardar paciente".
          </p>

          {lecturaAvanzada?.disponible && (
            <p className="text-xs mb-3 font-semibold" style={{ color: COLORS.gold }}>
              Lectura avanzada activa: para leer la letra a mano, la imagen de la primera página del expediente se envía a un
              servicio externo (Anthropic) únicamente para extraer estos datos.
            </p>
          )}

          {mensajeDocumento && <Banner tone={mensajeDocumento.tone}>{mensajeDocumento.texto}</Banner>}

          {!documentoPendiente ? (
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => setEscanerAbierto(true)}>
                <span className="flex items-center gap-1.5"><Camera size={15} /> Escanear en esta computadora</span>
              </Button>
              <Button variant="secondary" onClick={() => setEscaneoQRAbierto(true)}>
                <span className="flex items-center gap-1.5"><Smartphone size={15} /> Escanear con el teléfono</span>
              </Button>
            </div>
          ) : (
            <div className="flex items-end gap-3 justify-between flex-wrap">
              <span className="flex items-center gap-2 min-w-0 text-sm">
                <FileText size={15} style={{ color: COLORS.navy }} className="shrink-0" />
                <span className="font-semibold">{documentoPendiente.nombre}</span>
                <span className="text-xs" style={{ color: "#999" }}>
                  {documentoPendiente.paginas} pág. — se adjuntará al guardar el paciente
                </span>
              </span>
              <FormField label="Fecha en el documento (papel)">
                <TextInput
                  type="date"
                  value={documentoPendiente.fechaDocumentoOriginal}
                  onChange={(e) => setDocumentoPendiente((d) => ({ ...d, fechaDocumentoOriginal: e.target.value }))}
                />
                <p className="text-[11px] mt-1" style={{ color: "#999" }}>Distinta de la fecha de registro en el sistema, que se guarda sola.</p>
              </FormField>
              <span className="flex gap-1">
                <button onClick={verDocumentoPendiente} className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg" style={{ color: COLORS.navy }}>
                  <Eye size={13} /> Ver documento
                </button>
                <button onClick={quitarDocumentoPendiente} className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg" style={{ color: COLORS.red }}>
                  <Trash2 size={13} /> Quitar escaneo
                </button>
              </span>
            </div>
          )}

          {urlVistaPrevia && (
            <iframe title="Vista previa del expediente escaneado" src={urlVistaPrevia} className="w-full mt-3 rounded-lg" style={{ height: 420, border: `1px solid ${COLORS.border}` }} />
          )}

          {documentoPendiente && ocrDetalle && (
            <details className="mt-3 text-xs" style={{ color: "#888" }}>
              <summary className="cursor-pointer font-semibold">Ver cómo se leyó el documento (diagnóstico)</summary>
              <p className="mt-2">Lector usado: <strong>{ocrDetalle.fuente === "ia" ? "lectura avanzada (modelo de visión)" : "lector local (Tesseract)"}</strong></p>
              {ocrDetalle.avisoIA && <p className="mt-1" style={{ color: COLORS.gold }}>Lectura avanzada no disponible: {ocrDetalle.avisoIA}</p>}
              {ocrDetalle.error && <p className="mt-1" style={{ color: COLORS.red }}>Error del lector: {ocrDetalle.error}</p>}
              {ocrDetalle.fuente !== "ia" && (
                <pre className="whitespace-pre-wrap mt-2 p-2 rounded-lg overflow-auto" style={{ backgroundColor: "#f6f6f6", maxHeight: 220 }}>
                  {ocrDetalle.texto || "(no se leyó ningún texto)"}
                </pre>
              )}
            </details>
          )}
        </Card>
      )}

      {tab === "nuevo" && puedeRegistrar ? (
        <Card>
          <p className="text-xs font-semibold mb-4" style={{ color: "#888" }}>
            Historia clínica: si la hoja en papel ya trae una, escríbala tal cual; si se deja vacía, se genera automáticamente al guardar (RF-03). El DPI no puede repetirse (RF-04).
          </p>
          {mensaje && <Banner tone={mensaje.tone}>{mensaje.texto}</Banner>}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="col-span-1 sm:col-span-2 lg:col-span-3 font-semibold text-sm" style={{ color: COLORS.navy }}>Datos básicos</div>
            <FormField label="Nombre completo">
              <TextInput required value={form.nombreCompleto} onChange={(e) => setCampo("nombreCompleto", e.target.value)} />
              {avisoOCR("nombreCompleto")}
            </FormField>
            <FormField label="DPI / CUI">
              <TextInput
                required
                value={formatearDPI(form.dpi)}
                onChange={(e) => setCampo("dpi", limpiarDPI(e.target.value))}
                placeholder="0000 00000 0000"
                inputMode="numeric"
              />
              {dpiEstado.mensaje && (
                <p className="text-xs mt-1" style={{ color: DPI_COLOR[dpiEstado.estado] }}>{dpiEstado.mensaje}</p>
              )}
              {!dpiEstado.mensaje && (
                <p className="text-xs mt-1" style={{ color: "#999" }}>Si es menor de edad, use el CUI del certificado de nacimiento — es el mismo número de 13 dígitos.</p>
              )}
              {avisoOCR("dpi")}
            </FormField>
            <FormField label="Historia clínica (la de la hoja, si ya tiene)">
              <TextInput value={form.historiaClinica} maxLength={40} onChange={(e) => setCampo("historiaClinica", e.target.value)} placeholder="Vacía = se genera automáticamente" />
              {avisoOCR("historiaClinica")}
            </FormField>
            <FormField label="Dirección">
              <TextInput value={form.direccion} onChange={(e) => setCampo("direccion", e.target.value)} />
              {avisoOCR("direccion")}
            </FormField>
            <FormField label="Teléfono">
              <TextInput
                value={formatearTelefono(form.telefono)}
                onChange={(e) => setCampo("telefono", limpiarTelefono(e.target.value))}
                placeholder="0000 0000"
                inputMode="numeric"
              />
              {telefonoIncompleto(form.telefono) && (
                <p className="text-xs mt-1" style={{ color: "#B08B2E" }}>El teléfono debe tener 8 dígitos.</p>
              )}
              {avisoOCR("telefono")}
            </FormField>
            <FormField label="Fecha de nacimiento">
              <TextInput type="date" value={form.fechaNacimiento} onChange={(e) => setCampo("fechaNacimiento", e.target.value)} />
              {avisoOCR("fechaNacimiento")}
            </FormField>
            <FormField label="Fecha de ingreso">
              <TextInput type="date" value={form.fechaIngreso} onChange={(e) => setCampo("fechaIngreso", e.target.value)} />
              {avisoOCR("fechaIngreso")}
            </FormField>
            <FormField label="Hora de ingreso (opcional)">
              <TextInput type="time" value={form.horaIngreso} onChange={(e) => setCampo("horaIngreso", e.target.value)} />
              {form.fechaIngreso && !form.horaIngreso && (
                <p className="text-[11px] mt-1" style={{ color: "#999" }}>Sin hora, se guarda solo la fecha (12:00 como referencia).</p>
              )}
            </FormField>

            {/* Datos opcionales: al escanear un expediente ya llenado por el doctor
                se ocultan solos (todo eso ya queda en el PDF original); al
                registrar a mano se muestran. El interruptor siempre permite
                cambiar de opinion. */}
            <div className="col-span-1 sm:col-span-2 lg:col-span-3 flex items-center gap-3 flex-wrap pt-2" style={{ borderTop: `1px dashed ${COLORS.border}` }}>
              <button
                type="button"
                onClick={() => setMostrarOpcionales((v) => !v)}
                aria-expanded={mostrarOpcionales}
                className="flex items-center gap-1.5 text-sm font-semibold"
                style={{ color: COLORS.navy }}
              >
                {mostrarOpcionales ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                {mostrarOpcionales ? "Ocultar datos opcionales" : "Mostrar datos opcionales"}
              </button>
              {!mostrarOpcionales && documentoPendiente && (
                <span className="text-xs" style={{ color: "#999" }}>
                  Ocultos porque se escaneó el expediente: todo lo demás queda en el PDF original.
                </span>
              )}
            </div>

            <div className={mostrarOpcionales ? "contents" : "hidden"}>
            <FormField label="Lugar de nacimiento">
              {lugarOtro ? (
                <TextInput
                  placeholder="Especifique el lugar de nacimiento"
                  value={form.lugarNacimiento}
                  onChange={(e) => setCampo("lugarNacimiento", e.target.value)}
                />
              ) : (
                <Combobox
                  options={OPCIONES_LUGAR}
                  value={form.lugarNacimiento}
                  onChange={(v) => setCampo("lugarNacimiento", v)}
                  placeholder="Escriba para buscar un municipio…"
                />
              )}
              <button
                type="button"
                onClick={() => { setLugarOtro((v) => !v); setCampo("lugarNacimiento", ""); }}
                className="text-xs mt-1"
                style={{ color: COLORS.navy }}
              >
                {lugarOtro ? "← Buscar en la lista de Guatemala" : "¿Nació fuera de Guatemala? Escríbalo aquí"}
              </button>
            </FormField>
            <FormField label="Edad"><TextInput type="number" min="0" value={form.edad} onChange={(e) => setCampo("edad", e.target.value)} /></FormField>
            <FormField label="Sexo">
              <Select value={form.sexo} onChange={(e) => setCampo("sexo", e.target.value)}>
                <option value="">Seleccionar…</option>
                <option value="Femenino">Femenino</option>
                <option value="Masculino">Masculino</option>
              </Select>
            </FormField>
            <FormField label="Tipo de sangre">
              <Select value={form.tipoSangre} onChange={(e) => setCampo("tipoSangre", e.target.value)}>
                <option value="">Seleccionar…</option>
                {TIPOS_SANGRE.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </FormField>
            <FormField label="Estado civil">
              <Select value={form.estadoCivil} onChange={(e) => setCampo("estadoCivil", e.target.value)}>
                <option value="">Seleccionar…</option>
                {ESTADOS_CIVILES.map((ec) => <option key={ec} value={ec}>{ec}</option>)}
              </Select>
            </FormField>
            <FormField label="Ocupación"><TextInput value={form.ocupacion} onChange={(e) => setCampo("ocupacion", e.target.value)} /></FormField>
            <FormField label="Religión">
              {religionOtro ? (
                <>
                  <TextInput placeholder="Especifique la religión" value={form.religion} onChange={(e) => setCampo("religion", e.target.value)} />
                  <button type="button" onClick={() => { setReligionOtro(false); setCampo("religion", ""); }} className="text-xs mt-1" style={{ color: COLORS.navy }}>
                    ← Volver a la lista
                  </button>
                </>
              ) : (
                <Select
                  value={form.religion}
                  onChange={(e) => {
                    if (e.target.value === OTRO) {
                      setReligionOtro(true);
                      setCampo("religion", "");
                    } else {
                      setCampo("religion", e.target.value);
                    }
                  }}
                >
                  <option value="">Seleccionar…</option>
                  {RELIGIONES.map((r) => <option key={r} value={r}>{r}</option>)}
                  <option value={OTRO}>Otro…</option>
                </Select>
              )}
            </FormField>
            <FormField label="Nacionalidad">
              {nacionalidadOtro ? (
                <>
                  <TextInput placeholder="Especifique la nacionalidad" value={form.nacionalidad} onChange={(e) => setCampo("nacionalidad", e.target.value)} />
                  <button type="button" onClick={() => { setNacionalidadOtro(false); setCampo("nacionalidad", ""); }} className="text-xs mt-1" style={{ color: COLORS.navy }}>
                    ← Volver a la lista
                  </button>
                </>
              ) : (
                <Select
                  value={form.nacionalidad}
                  onChange={(e) => {
                    if (e.target.value === OTRO) {
                      setNacionalidadOtro(true);
                      setCampo("nacionalidad", "");
                    } else {
                      setCampo("nacionalidad", e.target.value);
                    }
                  }}
                >
                  <option value="">Seleccionar…</option>
                  {NACIONALIDADES.map((n) => <option key={n} value={n}>{n}</option>)}
                  <option value={OTRO}>Otra…</option>
                </Select>
              )}
            </FormField>
            <FormField label="Nombre del cónyuge"><TextInput value={form.nombreConyuge} onChange={(e) => setCampo("nombreConyuge", e.target.value)} /></FormField>
            <FormField label="Nombre del padre"><TextInput value={form.nombrePadre} onChange={(e) => setCampo("nombrePadre", e.target.value)} /></FormField>
            <FormField label="Nombre de la madre"><TextInput value={form.nombreMadre} onChange={(e) => setCampo("nombreMadre", e.target.value)} /></FormField>
            <FormField label="Nombre del contacto de emergencia"><TextInput placeholder="Nombre de la persona a contactar" value={form.contactoEmergencia} onChange={(e) => setCampo("contactoEmergencia", e.target.value)} /></FormField>
            <FormField label="Teléfono del contacto de emergencia">
              <TextInput
                value={formatearTelefono(form.telefonoEmergencia)}
                onChange={(e) => setCampo("telefonoEmergencia", limpiarTelefono(e.target.value))}
                placeholder="0000 0000"
                inputMode="numeric"
              />
              {telefonoIncompleto(form.telefonoEmergencia) && (
                <p className="text-xs mt-1" style={{ color: "#B08B2E" }}>El teléfono debe tener 8 dígitos.</p>
              )}
            </FormField>
            <FormField label="Parentesco (relación con el contacto de emergencia)">
              {parentescoOtro ? (
                <>
                  <TextInput placeholder="Especifique el parentesco" value={form.parentesco} onChange={(e) => setCampo("parentesco", e.target.value)} />
                  <button type="button" onClick={() => { setParentescoOtro(false); setCampo("parentesco", ""); }} className="text-xs mt-1" style={{ color: COLORS.navy }}>
                    ← Volver a la lista
                  </button>
                </>
              ) : (
                <Select
                  value={form.parentesco}
                  onChange={(e) => {
                    if (e.target.value === OTRO) {
                      setParentescoOtro(true);
                      setCampo("parentesco", "");
                    } else {
                      setCampo("parentesco", e.target.value);
                    }
                  }}
                >
                  <option value="">Seleccionar…</option>
                  {PARENTESCOS.map((p) => <option key={p} value={p}>{p}</option>)}
                  <option value={OTRO}>Otro…</option>
                </Select>
              )}
            </FormField>
            <FormField label="Encargado / responsable legal (nombre)">
              <TextInput placeholder="Puede ser distinto del contacto de emergencia" value={form.encargadoNombre} onChange={(e) => setCampo("encargadoNombre", e.target.value)} />
            </FormField>
            <FormField label="Teléfono del encargado">
              <TextInput
                value={formatearTelefono(form.encargadoTelefono)}
                onChange={(e) => setCampo("encargadoTelefono", limpiarTelefono(e.target.value))}
                placeholder="0000 0000"
                inputMode="numeric"
              />
              {telefonoIncompleto(form.encargadoTelefono) && (
                <p className="text-xs mt-1" style={{ color: "#B08B2E" }}>El teléfono debe tener 8 dígitos.</p>
              )}
            </FormField>
            <div className="col-span-1 sm:col-span-2 lg:col-span-3">
              <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={tieneReferido}
                  onChange={(e) => {
                    setTieneReferido(e.target.checked);
                    if (!e.target.checked) { setCampo("medicoReferenteId", ""); setCampo("referidoDe", ""); }
                  }}
                />
                El paciente llega referido por un médico o institución externa (RF-16)
              </label>
            </div>
            {tieneReferido && (
              <>
                <FormField label="Médico referente (si está registrado en Clientes Referidos)">
                  <Select value={form.medicoReferenteId} onChange={(e) => setCampo("medicoReferenteId", e.target.value)}>
                    <option value="">— No está en la lista —</option>
                    {(medicosReferentes || []).map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </Select>
                </FormField>
                <FormField label="Institución / médico (si no está registrado)">
                  <TextInput placeholder="Nombre del médico o institución" value={form.referidoDe} onChange={(e) => setCampo("referidoDe", e.target.value)} />
                </FormField>
              </>
            )}
            </div>
            <div className="col-span-1 sm:col-span-2 lg:col-span-3 mt-2">
              <Button type="submit" disabled={guardando}>{guardando ? "Guardando…" : "Guardar paciente"}</Button>
            </div>
          </form>
        </Card>
      ) : null}
      {tab === "ingreso" && puedeRegistrar ? (
        <Card>
          <p className="text-xs font-semibold mb-4" style={{ color: "#888" }}>
            Ficha de ingreso y egreso (RF-05 a RF-09) — se guarda sobre un paciente ya registrado.
          </p>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <FormField label="Paciente">
              <PacienteBuscador pacienteSeleccionado={pacienteDetalle} onSelect={(p) => setIngresoPacienteId(p?.id || null)} mostrarListado />
            </FormField>
            {ingresoPacienteId && pacienteDetalle && (
              <Button variant="secondary" onClick={() => setMostrarFicha(true)}>
                <span className="flex items-center gap-1.5"><Printer size={14} /> Imprimir ficha (RF-09)</span>
              </Button>
            )}
          </div>

          {ingresoPacienteId && (
            <form onSubmit={handleSubmitIngreso} className="flex flex-col gap-6 mt-5">
              {mensajeIngreso && <Banner tone={mensajeIngreso.tone}>{mensajeIngreso.texto}</Banner>}

              <div>
                <div className="font-semibold text-sm mb-1" style={{ color: COLORS.navy }}>Datos de identificación</div>
                <p className="text-[11px] mb-3" style={{ color: "#999" }}>
                  Aquí se corrigen los datos básicos si se digitaron mal (o si el lector del escáner se equivocó). Cambiar la
                  historia clínica solo es necesario si no coincide con la del papel; debe ser única.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  <FormField label="Nombre completo">
                    <TextInput value={ingresoForm.idNombre} onChange={(e) => setCampoIngreso("idNombre", e.target.value)} />
                  </FormField>
                  <FormField label="DPI / CUI">
                    <TextInput value={formatearDPI(ingresoForm.idDpi)} onChange={(e) => setCampoIngreso("idDpi", limpiarDPI(e.target.value))} placeholder="0000 00000 0000" inputMode="numeric" />
                  </FormField>
                  <FormField label="Historia clínica">
                    <TextInput value={ingresoForm.idHistoria} maxLength={40} onChange={(e) => setCampoIngreso("idHistoria", e.target.value)} />
                  </FormField>
                  <FormField label="Dirección">
                    <TextInput value={ingresoForm.idDireccion} onChange={(e) => setCampoIngreso("idDireccion", e.target.value)} />
                  </FormField>
                  <FormField label="Teléfono">
                    <TextInput value={formatearTelefono(ingresoForm.idTelefono)} onChange={(e) => setCampoIngreso("idTelefono", limpiarTelefono(e.target.value))} placeholder="0000 0000" inputMode="numeric" />
                  </FormField>
                  <FormField label="Fecha de nacimiento">
                    <TextInput type="date" value={ingresoForm.idFechaNacimiento} onChange={(e) => setCampoIngreso("idFechaNacimiento", e.target.value)} />
                  </FormField>
                </div>

                <div className="font-semibold text-sm mb-3" style={{ color: COLORS.navy }}>Datos generales</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-2">
                  <FormField label="Tipo de sangre">
                    <Select value={ingresoForm.tipoSangre} onChange={(e) => setCampoIngreso("tipoSangre", e.target.value)}>
                      <option value="">Seleccionar…</option>
                      {TIPOS_SANGRE.map((t) => <option key={t} value={t}>{t}</option>)}
                    </Select>
                    <p className="text-[11px] mt-1" style={{ color: "#999" }}>Se captura al registrar al paciente; aquí se puede completar o corregir.</p>
                  </FormField>
                </div>
              </div>

              <div>
                <div className="font-semibold text-sm mb-3" style={{ color: COLORS.navy }}>Ingreso</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FormField label="Fecha y hora de ingreso">
                    <TextInput type="datetime-local" value={ingresoForm.fechaIngreso} onChange={(e) => setCampoIngreso("fechaIngreso", e.target.value)} />
                  </FormField>
                  <FormField label="Servicios solicitados">
                    <TextInput value={ingresoForm.serviciosSolicitados} onChange={(e) => setCampoIngreso("serviciosSolicitados", e.target.value)} />
                  </FormField>
                  <FormField label="Referido de (institución / médico)">
                    <TextInput value={ingresoForm.referidoDe} onChange={(e) => setCampoIngreso("referidoDe", e.target.value)} />
                  </FormField>
                  <FormField label="Referido por (médico registrado)">
                    <Select value={ingresoForm.medicoReferenteId} onChange={(e) => setCampoIngreso("medicoReferenteId", e.target.value)}>
                      <option value="">— Ninguno —</option>
                      {(medicosReferentes || []).map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                    </Select>
                  </FormField>
                  <div className="col-span-1 sm:col-span-2 lg:col-span-3">
                    <FormField label="Impresión clínica de ingreso">
                      <TextArea rows={2} value={ingresoForm.impresionClinicaIngreso} onChange={(e) => setCampoIngreso("impresionClinicaIngreso", e.target.value)} />
                    </FormField>
                  </div>
                </div>
              </div>

              <div>
                <div className="font-semibold text-sm mb-3" style={{ color: COLORS.navy }}>Egreso</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FormField label="Fecha y hora de egreso">
                    <TextInput type="datetime-local" value={ingresoForm.fechaEgreso} onChange={(e) => setCampoIngreso("fechaEgreso", e.target.value)} />
                  </FormField>
                  <FormField label="Condición de egreso">
                    <Select value={ingresoForm.condicionEgreso} onChange={(e) => handleCondicionEgresoChange(e.target.value)}>
                      <option value="">Seleccionar…</option>
                      {CONDICIONES_EGRESO.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </Select>
                  </FormField>
                  <FormField label="Diagnóstico de egreso (código CIE-10)">
                    <Cie10Input value={ingresoForm.diagnosticoEgresoCodigo} onChange={(v) => setCampoIngreso("diagnosticoEgresoCodigo", v)} />
                  </FormField>
                  <FormField label="Complicaciones (código CIE-10)">
                    <Cie10Input value={ingresoForm.complicacionesCodigo} onChange={(v) => setCampoIngreso("complicacionesCodigo", v)} />
                  </FormField>
                  <FormField label="Operaciones (código)">
                    <TextInput value={ingresoForm.operacionesCodigo} onChange={(e) => setCampoIngreso("operacionesCodigo", e.target.value)} />
                    <p className="text-[11px] mt-1" style={{ color: "#999" }}>Catálogo de procedimientos (CIE-9-MC), no incluido en el buscador CIE-10.</p>
                  </FormField>
                </div>

                {esFallecido && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 pt-4 animate-fade-in" style={{ borderTop: `1px dashed ${COLORS.border}` }}>
                    <FormField label="Autopsia">
                      <Select value={ingresoForm.autopsia} onChange={(e) => setCampoIngreso("autopsia", e.target.value)}>
                        <option value="">Seleccionar…</option>
                        <option value="si">Sí</option>
                        <option value="no">No</option>
                      </Select>
                    </FormField>
                    <div className="col-span-1 sm:col-span-2">
                      <FormField label="Causa de la muerte">
                        <TextInput value={ingresoForm.causaMuerte} onChange={(e) => setCampoIngreso("causaMuerte", e.target.value)} />
                      </FormField>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="font-semibold text-sm mb-3" style={{ color: COLORS.navy }}>Maternidad (si aplica)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FormField label="No. de hijo">
                    <TextInput type="number" min="1" value={ingresoForm.matNumeroHijo} onChange={(e) => setCampoIngreso("matNumeroHijo", e.target.value)} />
                  </FormField>
                  <FormField label="Fecha de nacimiento">
                    <TextInput type="date" value={ingresoForm.matFecha} onChange={(e) => setCampoIngreso("matFecha", e.target.value)} />
                  </FormField>
                  <FormField label="Hora">
                    <TextInput placeholder="ej. 14:30" value={ingresoForm.matHora} onChange={(e) => setCampoIngreso("matHora", e.target.value)} />
                  </FormField>
                  <FormField label="Sexo">
                    <Select value={ingresoForm.matSexo} onChange={(e) => setCampoIngreso("matSexo", e.target.value)}>
                      <option value="">Seleccionar…</option>
                      <option value="Femenino">Femenino</option>
                      <option value="Masculino">Masculino</option>
                    </Select>
                  </FormField>
                  <FormField label="Condición de egreso del bebé">
                    <TextInput value={ingresoForm.matCondicion} onChange={(e) => setCampoIngreso("matCondicion", e.target.value)} />
                  </FormField>
                  <FormField label="Nombre del bebé (si ya tiene)">
                    <TextInput value={ingresoForm.matBebeNombre} onChange={(e) => setCampoIngreso("matBebeNombre", e.target.value)} />
                  </FormField>
                </div>

                <div className="font-semibold text-xs mt-4 mb-2" style={{ color: "#666" }}>Padres del bebé</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FormField label="Madre (la paciente)">
                    <TextInput disabled value={pacienteDetalle ? `${pacienteDetalle.nombreCompleto} · DPI ${pacienteDetalle.dpi}` : ""} readOnly />
                    <p className="text-[11px] mt-1" style={{ color: "#999" }}>Ya está registrada: sus datos se toman de su ficha.</p>
                  </FormField>
                  <FormField label="Nombre del padre">
                    <TextInput value={ingresoForm.matPadreNombre} onChange={(e) => setCampoIngreso("matPadreNombre", e.target.value)} />
                  </FormField>
                  <FormField label="DPI del padre (opcional)">
                    <TextInput value={formatearDPI(ingresoForm.matPadreDpi)} onChange={(e) => setCampoIngreso("matPadreDpi", limpiarDPI(e.target.value))} placeholder="0000 00000 0000" inputMode="numeric" />
                  </FormField>
                  <FormField label="Teléfono del padre (opcional)">
                    <TextInput value={formatearTelefono(ingresoForm.matPadreTelefono)} onChange={(e) => setCampoIngreso("matPadreTelefono", limpiarTelefono(e.target.value))} placeholder="0000 0000" inputMode="numeric" />
                  </FormField>
                </div>
              </div>

              <div>
                <Button type="submit" disabled={guardandoIngreso}>{guardandoIngreso ? "Guardando…" : "Guardar cambios"}</Button>
              </div>
            </form>
          )}
        </Card>
      ) : tab === "lista" ? (
        <>
          <div className="mb-4 flex gap-2">
            <TextInput
              placeholder="Buscar por nombre, DPI o historia clínica (RF-02)"
              value={buscarInput}
              onChange={(e) => setBuscarInput(e.target.value)}
              style={{ maxWidth: 360 }}
            />
          </div>
          {pacientesLista.error && <Banner tone="error">{pacientesLista.error}</Banner>}
          <Table
            headers={["Historia clínica", "Nombre", "DPI", "Edad", "Sexo", "Sangre", "Fechas de registro", ""]}
            rows={pacientesLista.loading ? [] : pacientesLista.items}
            emptyMessage={pacientesLista.loading ? "Cargando…" : "No hay pacientes registrados."}
            renderRow={(p) => (
              <>
                <td className="px-4 py-3">{p.historiaClinica}</td>
                <td className="px-4 py-3">{p.nombreCompleto}</td>
                <td className="px-4 py-3">{p.dpi}</td>
                <td className="px-4 py-3">{p.edad ?? "—"}</td>
                <td className="px-4 py-3">{p.sexo ?? "—"}</td>
                <td className="px-4 py-3">{p.tipoSangre ?? "—"}</td>
                <td className="px-4 py-3 text-xs leading-5" style={{ color: "#555" }}>
                  <div><span style={{ color: "#999" }}>En el sistema:</span> {fechaLocal(p.creadoEn) || "—"}</div>
                  {p.documentos?.[0]?.fechaDocumentoOriginal && (
                    <div><span style={{ color: "#999" }}>En el papel:</span> {fechaDia(p.documentos[0].fechaDocumentoOriginal)}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button className="text-xs font-semibold" style={{ color: COLORS.navy }} onClick={() => onVerExpediente(p.id)}>
                    Ver expediente →
                  </button>
                </td>
              </>
            )}
          />
          <Pagination page={pacientesLista.page} totalPages={pacientesLista.totalPages} total={pacientesLista.total} onChange={pacientesLista.setPage} />
        </>
      ) : null}

      <Modal open={mostrarFicha} onClose={() => setMostrarFicha(false)} title="Ficha del paciente" maxWidth={640}>
        {pacienteDetalle && (
          <>
            {mensajeFichaDocumento && <Banner tone={mensajeFichaDocumento.tone}>{mensajeFichaDocumento.texto}</Banner>}
            <FichaPacienteImprimible
              paciente={pacienteDetalle}
              documentos={documentosPaciente}
              onDescargarDocumento={(doc) => descargarDocumento(ingresoPacienteId, doc, setMensajeFichaDocumento)}
              onEliminarDocumento={puedeRegistrar ? (doc) => eliminarDocumento(ingresoPacienteId, doc, reloadDocumentos, setMensajeFichaDocumento) : undefined}
            />
          </>
        )}
      </Modal>

      <CameraScannerModal
        open={escanerAbierto}
        onClose={() => setEscanerAbierto(false)}
        onConfirmar={manejarEscaneoConfirmado}
        mensajeExito="El documento quedó listo — se adjuntará al paciente al hacer clic en 'Guardar paciente'."
      />
      <EscaneoQRModal
        open={escaneoQRAbierto}
        onClose={() => setEscaneoQRAbierto(false)}
        onConfirmar={manejarEscaneoConfirmado}
      />
    </div>
  );
}
