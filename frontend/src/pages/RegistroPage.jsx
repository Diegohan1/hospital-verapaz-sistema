import React, { useEffect, useMemo, useState } from "react";
import { Printer, Camera, FileText, Download, Trash2, Eye, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Table } from "../components/Table";
import { Button } from "../components/Button";
import { Banner } from "../components/Banner";
import { Modal } from "../components/Modal";
import { FichaPacienteImprimible } from "../components/FichaPacienteImprimible";
import { CameraScannerModal } from "../components/CameraScannerModal";
import { PacienteBuscador } from "../components/PacienteBuscador";
import { FormField, TextInput, Select, TextArea, SearchInput } from "../components/FormField";
import { useFetch } from "../hooks/useFetch";
import { usePaginatedFetch } from "../hooks/usePaginatedFetch";
import { Pagination } from "../components/Pagination";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { ROLES, tieneRol } from "../utils/roles";
import { ESTADOS_CIVILES } from "../utils/guatemala";
import { CONDICIONES_EGRESO, CONDICIONES_EGRESO_BEBE } from "../utils/condicionesEgreso";
import { Cie10Input } from "../components/Cie10Input";
import { limpiarDPI, validarDPI } from "../utils/dpi";
import { limpiarTelefono, telefonoIncompleto } from "../utils/telefono";
import { COLORS } from "../styles/tokens";
import { fechaDia, fechaLocal } from "../utils/fechas";

const CAMPOS_INGRESO_VACIOS = {
  idNombre: "", idDpi: "", idHistoria: "", idDireccion: "", idLugarNacimiento: "",
  idTelefono: "", idFechaNacimiento: "", idEdad: "", idSexo: "", idEstadoCivil: "",
  idOcupacion: "", idReligion: "", idNacionalidad: "", fechaIngreso: "", horaIngreso: "",
  nombreConyuge: "", direccionConyuge: "", telefonoConyuge: "", nombrePadre: "", nombreMadre: "",
  contactoEmergencia: "", parentesco: "", direccionEmergencia: "", telefonoEmergencia: "",
  otrasHospitalizaciones: "", referidoDe: "", serviciosSolicitados: "", referidoPor: "",
  impresionClinicaIngreso: "", fechaEgreso: "", horaEgreso: "", diagnosticosEgreso: [],
  complicacionesEgreso: [], operacionesLista: [], condicionEgreso: "", autopsia: "", causaMuerte: "",
  matNumeroHijo: "", matFecha: "", matHora: "", matSexo: "", matCondicion: "",
  matAutopsia: "", matCausaMuerte: "", matFechaMuerte: "",
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

function separarFechaHora(iso) {
  const valor = toDatetimeLocal(iso);
  return valor ? { fecha: valor.slice(0, 10), hora: valor.slice(11, 16).replace(":", "") } : { fecha: "", hora: "" };
}

function horaNumericaValida(valor) {
  if (!/^\d{4}$/.test(valor || "")) return false;
  return Number(valor.slice(0, 2)) < 24 && Number(valor.slice(2)) < 60;
}

function horaParaAlmacenar(valor) {
  if (!valor) return "00:00";
  return `${valor.slice(0, 2)}:${valor.slice(2)}`;
}

function fechaHoraIso(fecha, hora) {
  if (!fecha) return null;
  const valor = new Date(`${fecha}T${horaParaAlmacenar(hora)}:00`);
  return Number.isFinite(valor.getTime()) ? valor.toISOString() : null;
}

function listaDiagnostica(egreso, campo, legado) {
  if (Array.isArray(egreso?.[campo])) return egreso[campo];
  return egreso?.[legado] ? [{ descripcion: "", codigo: egreso[legado] }] : [];
}

function listasTexto(egreso, campo, legado) {
  if (Array.isArray(egreso?.[campo])) return egreso[campo];
  return egreso?.[legado] ? [egreso[legado]] : [];
}

function codigoEstadoCivil(valor) {
  return ESTADOS_CIVILES.find((estado) => estado.value === valor || estado.label === valor)?.value || "";
}

function filasCodificadasValidas(items) {
  return items.every((item) => (!item.descripcion.trim() && !item.codigo.trim()) || (item.descripcion.trim() && item.codigo.trim()));
}

function listaCodificadaLimpia(items) {
  return items
    .filter((item) => item.descripcion.trim() || item.codigo.trim())
    .map((item) => ({ descripcion: item.descripcion.trim(), codigo: item.codigo.trim() }));
}

function OpcionesExclusivas({ name, value, onChange, options, required = false }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2">
      {options.map((option, index) => (
        <label key={option.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            required={required && index === 0}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

function ListaCodificada({ titulo, singular, items, onChange }) {
  function actualizar(index, campo, valor) {
    onChange(items.map((item, i) => i === index ? { ...item, [campo]: valor } : item));
  }

  return (
    <div className="col-span-1 sm:col-span-2 lg:col-span-3">
      <div className="text-xs font-semibold mb-2" style={{ color: "#475066" }}>{titulo}</div>
      <div className="flex flex-col gap-3">
        {items.map((item, index) => (
          <div key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <FormField label={`${singular} ${index + 1}`}>
              <TextInput value={item.descripcion} onChange={(e) => actualizar(index, "descripcion", e.target.value)} />
            </FormField>
            <FormField label="Código">
              <Cie10Input value={item.codigo} onChange={(codigo) => actualizar(index, "codigo", codigo)} />
            </FormField>
            <button type="button" onClick={() => onChange(items.filter((_, i) => i !== index))} className="text-gray-400 hover:text-red-500 mb-2.5" aria-label={`Quitar ${singular.toLowerCase()} ${index + 1}`}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <div>
          <Button type="button" variant="secondary" onClick={() => onChange([...items, { descripcion: "", codigo: "" }])}>
            Agregar {singular.toLowerCase()}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ListaOperaciones({ items, onChange }) {
  return (
    <div className="col-span-1 sm:col-span-2 lg:col-span-3">
      <div className="text-xs font-semibold mb-2" style={{ color: "#475066" }}>Operaciones (en orden de importancia)</div>
      <div className="flex flex-col gap-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-end gap-3">
            <FormField label={`Operación ${index + 1}`}>
              <TextInput value={item} onChange={(e) => onChange(items.map((actual, i) => i === index ? e.target.value : actual))} />
            </FormField>
            <button type="button" onClick={() => onChange(items.filter((_, i) => i !== index))} className="text-gray-400 hover:text-red-500 mb-2.5" aria-label={`Quitar operación ${index + 1}`}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <div>
          <Button type="button" variant="secondary" onClick={() => onChange([...items, ""])}>Agregar operación</Button>
        </div>
      </div>
    </div>
  );
}

const CAMPOS_VACIOS = {
  nombreCompleto: "", dpi: "", historiaClinica: "", fechaIngreso: "", horaIngreso: "",
  direccion: "", telefono: "", lugarNacimiento: "", fechaNacimiento: "", edad: "", sexo: "",
  estadoCivil: "", ocupacion: "", religion: "", nacionalidad: "",
  nombreConyuge: "", direccionConyuge: "", telefonoConyuge: "", nombrePadre: "", nombreMadre: "",
  contactoEmergencia: "", parentesco: "", direccionEmergencia: "", telefonoEmergencia: "",
  otrasHospitalizaciones: "", referidoDe: "", serviciosSolicitados: "", referidoPor: "",
  impresionClinicaIngreso: "", fechaEgreso: "", horaEgreso: "", diagnosticosEgreso: [],
  complicacionesEgreso: [], operacionesLista: [], matNumeroHijo: "", matFecha: "", matHora: "",
  matSexo: "", matCondicion: "", matAutopsia: "", matCausaMuerte: "", matFechaMuerte: "",
};

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
  // Dev-Mari: si el servidor tiene activada la lectura avanzada (modelo de
  // vision), se le avisa al personal que la imagen viaja a un servicio externo.
  const { data: lecturaAvanzada } = useFetch(puedeRegistrar ? "/pacientes/lectura-avanzada/estado" : null, { enabled: puedeRegistrar });

  const [ingresoPacienteId, setIngresoPacienteId] = useState(null);
  const [mostrarFicha, setMostrarFicha] = useState(false);
  const [modalEdicionAbierto, setModalEdicionAbierto] = useState(false);
  const [escanerAbierto, setEscanerAbierto] = useState(false);
  const [mensajeDocumento, setMensajeDocumento] = useState(null);
  const [mensajeFichaDocumento, setMensajeFichaDocumento] = useState(null);
  // Dev-Mari: el expediente fisico se escanea ANTES de que el paciente
  // exista — ya no depende de tener uno seleccionado. El PDF queda aqui,
  // pendiente, hasta que se registra el paciente (un solo POST con ambos).
  const [documentoPendiente, setDocumentoPendiente] = useState(null);
  const [adjuntos, setAdjuntos] = useState([]);
  const [adjuntosIngreso, setAdjuntosIngreso] = useState([]);
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
    const ingreso = separarFechaHora(pacienteDetalle.fechaIngreso);
    const egreso = separarFechaHora(pacienteDetalle.fechaEgreso);
    const maternidad = pacienteDetalle.maternidad || {};
    setIngresoForm({
      ...CAMPOS_INGRESO_VACIOS,
      idNombre: pacienteDetalle.nombreCompleto || "",
      idDpi: pacienteDetalle.dpi || "",
      idHistoria: pacienteDetalle.historiaClinica || "",
      idDireccion: pacienteDetalle.direccion || "",
      idLugarNacimiento: pacienteDetalle.lugarNacimiento || "",
      idTelefono: pacienteDetalle.telefono || "",
      idFechaNacimiento: toDateInput(pacienteDetalle.fechaNacimiento),
      idEdad: pacienteDetalle.edad ?? "",
      idSexo: pacienteDetalle.sexo || "",
      idEstadoCivil: codigoEstadoCivil(pacienteDetalle.estadoCivil),
      idOcupacion: pacienteDetalle.ocupacion || "",
      idReligion: pacienteDetalle.religion || "",
      idNacionalidad: pacienteDetalle.nacionalidad || "",
      fechaIngreso: ingreso.fecha,
      horaIngreso: ingreso.hora,
      nombreConyuge: pacienteDetalle.nombreConyuge || "",
      direccionConyuge: pacienteDetalle.direccionConyuge || "",
      telefonoConyuge: pacienteDetalle.telefonoConyuge || "",
      nombrePadre: pacienteDetalle.nombrePadre || "",
      nombreMadre: pacienteDetalle.nombreMadre || "",
      contactoEmergencia: pacienteDetalle.contactoEmergencia || "",
      parentesco: pacienteDetalle.parentesco || "",
      direccionEmergencia: pacienteDetalle.direccionEmergencia || "",
      telefonoEmergencia: pacienteDetalle.telefonoEmergencia || "",
      otrasHospitalizaciones: pacienteDetalle.otrasHospitalizaciones || "",
      serviciosSolicitados: pacienteDetalle.serviciosSolicitados || "",
      referidoDe: pacienteDetalle.referidoDe || "",
      referidoPor: pacienteDetalle.referidoPor || pacienteDetalle.medicoReferente?.nombre || "",
      impresionClinicaIngreso: pacienteDetalle.impresionClinicaIngreso || "",
      fechaEgreso: egreso.fecha,
      horaEgreso: egreso.hora,
      diagnosticosEgreso: listaDiagnostica(eg, "diagnosticosEgreso", "diagnosticoEgreso"),
      complicacionesEgreso: listaDiagnostica(eg, "complicacionesEgreso", "complicaciones"),
      operacionesLista: listasTexto(eg, "operacionesLista", "operaciones"),
      condicionEgreso: pacienteDetalle.condicionEgreso || "",
      autopsia: eg.autopsia == null ? (pacienteDetalle.autopsia == null ? "" : pacienteDetalle.autopsia ? "si" : "no") : eg.autopsia ? "si" : "no",
      causaMuerte: eg.causaMuerte ?? pacienteDetalle.causaMuerte ?? "",
      matNumeroHijo: maternidad.numeroHijo ?? "",
      matFecha: toDateInput(maternidad.fecha),
      matHora: maternidad.hora ? maternidad.hora.replace(/\D/g, "").slice(0, 4) : "",
      matSexo: maternidad.sexo === "Femenino" ? "F" : maternidad.sexo === "Masculino" ? "M" : maternidad.sexo || "",
      matCondicion: maternidad.condicionEgresoBebe || "",
      matAutopsia: maternidad.autopsiaBebe == null ? "" : maternidad.autopsiaBebe ? "si" : "no",
      matCausaMuerte: maternidad.causaMuerteBebe || "",
      matFechaMuerte: toDateInput(maternidad.fechaMuerteBebe),
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
    const horaInvalida = [f.horaIngreso, f.horaEgreso, f.matHora].some((hora) => hora && !horaNumericaValida(hora));
    const errorId =
      (!f.idNombre.trim() && "El nombre no puede quedar vacío.") ||
      (validarDPI(f.idDpi).estado !== "valido" && (validarDPI(f.idDpi).mensaje || "Ingrese un DPI completo y válido.")) ||
      (f.idTelefono && limpiarTelefono(f.idTelefono).length !== 8 && "El teléfono debe tener 8 dígitos.") ||
      ([f.telefonoConyuge, f.telefonoEmergencia].some((v) => v && limpiarTelefono(v).length !== 8) && "Los teléfonos opcionales deben tener 8 dígitos.") ||
      (horaInvalida && "Ingrese las horas como cuatro dígitos válidos (HHMM).") ||
      ((f.horaIngreso && !f.fechaIngreso || f.horaEgreso && !f.fechaEgreso || f.matHora && !f.matFecha) && "Seleccione la fecha correspondiente para guardar la hora.") ||
      (!filasCodificadasValidas(f.diagnosticosEgreso) && "Complete la descripción y el código de cada diagnóstico de egreso.") ||
      (!filasCodificadasValidas(f.complicacionesEgreso) && "Complete la descripción y el código de cada complicación.") ||
      (f.matAutopsia === "si" && (!f.matCausaMuerte.trim() || !f.matFechaMuerte) && "Si hubo autopsia, indique la causa y fecha de muerte del bebé.");
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
      lugarNacimiento: f.idLugarNacimiento.trim() || null,
      fechaNacimiento: f.idFechaNacimiento || null,
      edad: f.idEdad === "" ? null : Number(f.idEdad),
      sexo: f.idSexo.trim() || null,
      estadoCivil: f.idEstadoCivil || null,
      ocupacion: f.idOcupacion.trim() || null,
      religion: f.idReligion.trim() || null,
      nacionalidad: f.idNacionalidad.trim() || null,
      fechaIngreso: fechaHoraIso(f.fechaIngreso, f.horaIngreso),
      nombreConyuge: f.nombreConyuge.trim() || null,
      direccionConyuge: f.direccionConyuge.trim() || null,
      telefonoConyuge: limpiarTelefono(f.telefonoConyuge) || null,
      nombrePadre: f.nombrePadre.trim() || null,
      nombreMadre: f.nombreMadre.trim() || null,
      contactoEmergencia: f.contactoEmergencia.trim() || null,
      parentesco: f.parentesco.trim() || null,
      direccionEmergencia: f.direccionEmergencia.trim() || null,
      telefonoEmergencia: limpiarTelefono(f.telefonoEmergencia) || null,
      otrasHospitalizaciones: f.otrasHospitalizaciones.trim() || null,
      serviciosSolicitados: f.serviciosSolicitados || null,
      referidoDe: f.referidoDe || null,
      referidoPor: f.referidoPor.trim() || null,
      impresionClinicaIngreso: f.impresionClinicaIngreso || null,
      fechaEgreso: fechaHoraIso(f.fechaEgreso, f.horaEgreso),
      condicionEgreso: f.condicionEgreso || null,
      // Sprint 3: datos clinicos de egreso viajan como objeto; el backend los
      // cifra (AES-256-GCM) antes de guardarlos en EgresoClinico.
      egresoClinico: {
        diagnosticosEgreso: listaCodificadaLimpia(f.diagnosticosEgreso),
        complicacionesEgreso: listaCodificadaLimpia(f.complicacionesEgreso),
        operacionesLista: f.operacionesLista.map((item) => item.trim()).filter(Boolean),
        diagnosticoEgreso: listaCodificadaLimpia(f.diagnosticosEgreso)[0]?.codigo || null,
        complicaciones: listaCodificadaLimpia(f.complicacionesEgreso)[0]?.codigo || null,
        operaciones: f.operacionesLista.map((item) => item.trim()).filter(Boolean).join("\n") || null,
        autopsia: f.autopsia === "" ? null : f.autopsia === "si",
        causaMuerte: f.causaMuerte || null,
      },
    };
    if (f.matNumeroHijo || f.matFecha || f.matHora || f.matSexo || f.matCondicion || f.matAutopsia || f.matCausaMuerte || f.matFechaMuerte) {
      payload.maternidad = {
        numeroHijo: f.matNumeroHijo ? Number(f.matNumeroHijo) : null,
        fecha: f.matFecha ? new Date(f.matFecha).toISOString() : null,
        hora: f.matHora ? horaParaAlmacenar(f.matHora) : null,
        sexo: f.matSexo || null,
        condicionEgresoBebe: f.matCondicion || null,
        autopsiaBebe: f.matAutopsia === "" ? null : f.matAutopsia === "si",
        causaMuerteBebe: f.matCausaMuerte.trim() || null,
        fechaMuerteBebe: f.matFechaMuerte ? new Date(f.matFechaMuerte).toISOString() : null,
      };
    }
    try {
      await api.put(`/pacientes/${ingresoPacienteId}`, payload);
      if (adjuntosIngreso.length) {
        for (const archivo of adjuntosIngreso) {
          const fd = new FormData();
          fd.append("documento", archivo);
          fd.append("tipoDocumental", "resultado_clinico");
          await api.post(`/pacientes/${ingresoPacienteId}/documentos`, fd);
        }
      }
      setMensajeIngreso({ tone: "success", texto: "Datos del paciente guardados correctamente." });
      setAdjuntosIngreso([]);
      reloadPacienteDetalle();
      reloadDocumentos();
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
      historiaClinica: d.historiaClinica ? d.historiaClinica.replace(/\D/g, "").slice(0, 40) : "",
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
    setMostrarOpcionales(false);
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

  // Abre el modal de edicion con los datos del paciente cargados (identidad,
  // ingreso, egreso y maternidad) sobre el mismo formulario que actualiza
  // por PUT.
  function editarPaciente(p) {
    setIngresoPacienteId(p.id);
    setModalEdicionAbierto(true);
  }

  async function eliminarPaciente(p) {
    const confirmacion = window.confirm(
      `¿Eliminar definitivamente a ${p.nombreCompleto} (HC ${p.historiaClinica})?\n\n` +
      "Se borrarán su expediente, diagnósticos, documentos, tratamientos y facturas. Esta acción no se puede deshacer."
    );
    if (!confirmacion) return;
    try {
      await api.del(`/pacientes/${p.id}`);
      if (ingresoPacienteId === p.id) setIngresoPacienteId(null);
      pacientesLista.reload();
    } catch (err) {
      window.alert(`No se pudo eliminar el paciente: ${err.message}`);
    }
  }

  const [form, setForm] = useState(CAMPOS_VACIOS);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  // Dev-Mari: datos opcionales colapsables. Ocultos por defecto siempre (se
  // despliegan solo con el clic del usuario en el interruptor) — nunca se
  // auto-muestran, ni al entrar al módulo ni al quitar un escaneo.
  const [mostrarOpcionales, setMostrarOpcionales] = useState(false);
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

function ListaAdjuntos({ archivos, onChange, titulo = "Adjuntar archivos (resultados clínicos, PDF o imagen)" }) {
  function agregar(e) {
    const nuevos = Array.from(e.target.files || []);
    if (nuevos.length) onChange([...archivos, ...nuevos].slice(0, 10));
    e.target.value = "";
  }
  return (
    <div className="col-span-1 sm:col-span-2 lg:col-span-3">
      <div className="text-xs font-semibold mb-2" style={{ color: "#475066" }}>{titulo}</div>
      <input type="file" multiple accept=".pdf,image/png,image/jpeg" onChange={agregar} className="text-sm" aria-label="Adjuntar archivos" />
      {archivos.length > 0 && (
        <ul className="flex flex-col gap-1 mt-2">
          {archivos.map((archivo, index) => (
            <li key={index} className="flex items-center gap-2 text-sm">
              <span>{archivo.name}</span>
              <span className="text-xs" style={{ color: "#888" }}>({(archivo.size / 1024).toFixed(0)} KB)</span>
              <button type="button" onClick={() => onChange(archivos.filter((_, i) => i !== index))} className="text-gray-400 hover:text-red-500" aria-label={`Quitar archivo ${index + 1}`}>
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs mt-1" style={{ color: "#888" }}>Máximo 10 archivos (PDF, PNG o JPG). Se guardan como resultados clínicos del paciente.</p>
    </div>
  );
}

  async function handleSubmit(e) {
    e.preventDefault();
    const diagnosticos = listaCodificadaLimpia(form.diagnosticosEgreso);
    const complicaciones = listaCodificadaLimpia(form.complicacionesEgreso);
    const operaciones = form.operacionesLista.map((item) => item.trim()).filter(Boolean);
    const errorFormulario =
      (dpiEstado.estado !== "valido" && (dpiEstado.mensaje || "Ingrese un DPI completo y válido.")) ||
      (!/^\d+$/.test(form.historiaClinica) && "La historia clínica debe contener solo números.") ||
      (!horaNumericaValida(form.horaIngreso) && "La hora de ingreso debe escribirse con cuatro dígitos (HHMM).") ||
      (limpiarTelefono(form.telefono).length !== 8 && "El teléfono debe tener 8 dígitos.") ||
      ([form.telefonoConyuge, form.telefonoEmergencia].some((telefono) => telefono && limpiarTelefono(telefono).length !== 8) && "Los teléfonos opcionales deben tener 8 dígitos.") ||
      (Number(form.edad) < 0 || Number(form.edad) > 130) && "La edad debe estar entre 0 y 130 años." ||
      (form.horaEgreso && !horaNumericaValida(form.horaEgreso) && "La hora de egreso debe escribirse con cuatro dígitos (HHMM).") ||
      (form.matHora && !horaNumericaValida(form.matHora) && "La hora del nacimiento debe escribirse con cuatro dígitos (HHMM).") ||
      ((form.horaEgreso && !form.fechaEgreso || form.matHora && !form.matFecha) && "Seleccione la fecha correspondiente para guardar la hora.") ||
      (form.matAutopsia === "si" && (!form.matCausaMuerte.trim() || !form.matFechaMuerte) && "Si hubo autopsia, indique la causa y fecha de muerte del bebé.") ||
      (!filasCodificadasValidas(form.diagnosticosEgreso) && "Complete la descripción y el código de cada diagnóstico de egreso.") ||
      (!filasCodificadasValidas(form.complicacionesEgreso) && "Complete la descripción y el código de cada complicación.");
    if (errorFormulario) {
      setMensaje({ tone: "error", texto: errorFormulario });
      return;
    }
    setGuardando(true);
    setMensaje(null);
    try {
      const maternidad = {
        numeroHijo: form.matNumeroHijo ? Number(form.matNumeroHijo) : null,
        fecha: form.matFecha ? new Date(form.matFecha).toISOString() : null,
        hora: form.matHora ? horaParaAlmacenar(form.matHora) : null,
        sexo: form.matSexo || null,
        condicionEgresoBebe: form.matCondicion || null,
        autopsiaBebe: form.matAutopsia === "" ? null : form.matAutopsia === "si",
        causaMuerteBebe: form.matCausaMuerte.trim() || null,
        fechaMuerteBebe: form.matFechaMuerte ? new Date(form.matFechaMuerte).toISOString() : null,
      };
      const hayDatosMaternidad = Object.entries(maternidad).some(([campo, valor]) => campo === "autopsiaBebe" ? valor != null : valor != null && valor !== "");
      const egresoClinico = {
        diagnosticosEgreso: diagnosticos,
        complicacionesEgreso: complicaciones,
        operacionesLista: operaciones,
        diagnosticoEgreso: diagnosticos[0]?.codigo || null,
        complicaciones: complicaciones[0]?.codigo || null,
        operaciones: operaciones.join("\n") || null,
      };
      const hayDatosEgreso = diagnosticos.length || complicaciones.length || operaciones.length;
      const datosPaciente = {
        nombreCompleto: form.nombreCompleto.trim(),
        dpi: limpiarDPI(form.dpi),
        historiaClinica: form.historiaClinica.trim(),
        direccion: form.direccion.trim(),
        telefono: limpiarTelefono(form.telefono),
        lugarNacimiento: form.lugarNacimiento.trim(),
        fechaNacimiento: form.fechaNacimiento,
        edad: Number(form.edad),
        sexo: form.sexo.trim(),
        estadoCivil: form.estadoCivil,
        ocupacion: form.ocupacion.trim(),
        religion: form.religion.trim(),
        nacionalidad: form.nacionalidad.trim(),
        fechaIngreso: fechaHoraIso(form.fechaIngreso, form.horaIngreso),
        nombreConyuge: form.nombreConyuge.trim() || null,
        direccionConyuge: form.direccionConyuge.trim() || null,
        telefonoConyuge: limpiarTelefono(form.telefonoConyuge) || null,
        nombrePadre: form.nombrePadre.trim() || null,
        nombreMadre: form.nombreMadre.trim() || null,
        contactoEmergencia: form.contactoEmergencia.trim() || null,
        parentesco: form.parentesco.trim() || null,
        direccionEmergencia: form.direccionEmergencia.trim() || null,
        telefonoEmergencia: limpiarTelefono(form.telefonoEmergencia) || null,
        otrasHospitalizaciones: form.otrasHospitalizaciones.trim() || null,
        referidoDe: form.referidoDe.trim() || null,
        serviciosSolicitados: form.serviciosSolicitados.trim() || null,
        referidoPor: form.referidoPor.trim() || null,
        impresionClinicaIngreso: form.impresionClinicaIngreso.trim() || null,
        fechaEgreso: fechaHoraIso(form.fechaEgreso, form.horaEgreso),
        ...(hayDatosEgreso ? { egresoClinico } : {}),
        ...(hayDatosMaternidad ? { maternidad } : {}),
      };

      let paciente;
      if (documentoPendiente || adjuntos.length) {
        // Un solo POST con los datos del paciente + expediente escaneado + adjuntos.
        const fd = new FormData();
        for (const [campo, valor] of Object.entries(datosPaciente)) {
          if (valor !== undefined && valor !== null && valor !== "") {
            fd.append(campo, typeof valor === "object" ? JSON.stringify(valor) : valor);
          }
        }
        if (documentoPendiente) {
          fd.append("documento", new File([documentoPendiente.blob], documentoPendiente.nombre, { type: "application/pdf" }));
          fd.append("paginas", String(documentoPendiente.paginas));
          const fechaPapel = documentoPendiente.fechaDocumentoOriginal || form.fechaIngreso;
          if (fechaPapel) fd.append("fechaDocumentoOriginal", fechaPapel);
        }
        adjuntos.forEach((archivo) => fd.append("adjuntos", archivo));
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
      setAdjuntos([]);
      setMensajeDocumento(null);
      setCamposOCR(new Set());
      setOcrDetalle(null);
      setMostrarOpcionales(false);
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
        <button
          onClick={() => setTab("lista")}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150"
          style={tab === "lista" ? { backgroundColor: COLORS.navy, color: "white" } : { border: `1px solid ${COLORS.border}`, backgroundColor: "white", color: COLORS.text }}
        >
          Pacientes registrados
        </button>
      </div>

      {tab === "nuevo" && puedeRegistrar && puedeVerDocumentos && (
        <Card style={{ marginBottom: 16 }}>
          <div className="font-semibold text-sm mb-1">Escanear expediente físico (opcional)</div>

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
                <span className="flex items-center gap-1.5"><Camera size={15} /> Escanear desde este dispositivo</span>
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
            Historia clínica: si la hoja en papel ya trae una, escríbala tal cual; si se deja vacía, se genera automáticamente al guardar. El DPI no puede repetirse.
          </p>
          {mensaje && <Banner tone={mensaje.tone}>{mensaje.texto}</Banner>}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="col-span-1 sm:col-span-2 lg:col-span-3 rounded-xl p-4" style={{ backgroundColor: COLORS.lightBg }}>
              <div className="font-semibold text-sm mb-3" style={{ color: COLORS.navy }}>Datos básicos · todos son obligatorios</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField label="Fecha de ingreso">
                  <TextInput name="fechaIngreso" type="date" required value={form.fechaIngreso} onChange={(e) => setCampo("fechaIngreso", e.target.value)} />
                  {avisoOCR("fechaIngreso")}
                </FormField>
                <FormField label="Hora de ingreso (HHMM)">
                  <TextInput name="horaIngreso" required inputMode="numeric" pattern="[0-9]{4}" placeholder="1430" value={form.horaIngreso} onChange={(e) => setCampo("horaIngreso", e.target.value.replace(/\D/g, "").slice(0, 4))} />
                </FormField>
                <FormField label="Historia clínica">
                  <TextInput name="historiaClinica" required inputMode="numeric" pattern="[0-9]+" value={form.historiaClinica} onChange={(e) => setCampo("historiaClinica", e.target.value.replace(/\D/g, "").slice(0, 40))} />
                  {avisoOCR("historiaClinica")}
                </FormField>
                <FormField label="Nombre completo">
                  <TextInput name="nombreCompleto" required value={form.nombreCompleto} onChange={(e) => setCampo("nombreCompleto", e.target.value)} />
                  {avisoOCR("nombreCompleto")}
                </FormField>
                <FormField label="Dirección">
                  <TextInput name="direccion" required value={form.direccion} onChange={(e) => setCampo("direccion", e.target.value)} />
                  {avisoOCR("direccion")}
                </FormField>
                <FormField label="Teléfono">
                  <TextInput name="telefono" required inputMode="numeric" pattern="[0-9]{8}" placeholder="8 dígitos" value={form.telefono} onChange={(e) => setCampo("telefono", limpiarTelefono(e.target.value))} />
                  {telefonoIncompleto(form.telefono) && <p className="text-xs mt-1" style={{ color: "#B08B2E" }}>Ingrese los 8 dígitos.</p>}
                  {avisoOCR("telefono")}
                </FormField>
                <FormField label="Lugar de nacimiento">
                  <TextInput name="lugarNacimiento" required value={form.lugarNacimiento} onChange={(e) => setCampo("lugarNacimiento", e.target.value)} />
                </FormField>
                <FormField label="Fecha de nacimiento">
                  <TextInput name="fechaNacimiento" type="date" required value={form.fechaNacimiento} onChange={(e) => setCampo("fechaNacimiento", e.target.value)} />
                  {avisoOCR("fechaNacimiento")}
                </FormField>
                <FormField label="Edad">
                  <TextInput name="edad" required inputMode="numeric" pattern="[0-9]{1,3}" value={form.edad} onChange={(e) => setCampo("edad", e.target.value.replace(/\D/g, "").slice(0, 3))} />
                </FormField>
                <FormField label="Sexo">
                  <TextInput name="sexo" required value={form.sexo} onChange={(e) => setCampo("sexo", e.target.value)} />
                </FormField>
                <FormField label="Estado civil · seleccione uno">
                  <OpcionesExclusivas name="estadoCivil" value={form.estadoCivil} onChange={(valor) => setCampo("estadoCivil", valor)} options={ESTADOS_CIVILES.map((estado) => ({ ...estado, label: `${estado.value} · ${estado.label}` }))} required />
                </FormField>
                <FormField label="Ocupación"><TextInput name="ocupacion" required value={form.ocupacion} onChange={(e) => setCampo("ocupacion", e.target.value)} /></FormField>
                <FormField label="Religión"><TextInput name="religion" required value={form.religion} onChange={(e) => setCampo("religion", e.target.value)} /></FormField>
                <FormField label="Nacionalidad"><TextInput name="nacionalidad" required value={form.nacionalidad} onChange={(e) => setCampo("nacionalidad", e.target.value)} /></FormField>
                <FormField label="DPI / CUI">
                  <TextInput name="dpi" required inputMode="numeric" pattern="[0-9]{13}" placeholder="13 dígitos" value={form.dpi} onChange={(e) => setCampo("dpi", limpiarDPI(e.target.value))} />
                  {dpiEstado.mensaje && <p className="text-xs mt-1" style={{ color: DPI_COLOR[dpiEstado.estado] }}>{dpiEstado.mensaje}</p>}
                  {avisoOCR("dpi")}
                </FormField>
              </div>
            </div>

            <div className="col-span-1 sm:col-span-2 lg:col-span-3 flex items-center gap-3 flex-wrap pt-2" style={{ borderTop: `1px dashed ${COLORS.border}` }}>
              <button type="button" onClick={() => setMostrarOpcionales((v) => !v)} aria-expanded={mostrarOpcionales} className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: COLORS.navy }}>
                {mostrarOpcionales ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                {mostrarOpcionales ? "Ocultar datos opcionales" : "Mostrar datos opcionales"}
              </button>
              {!mostrarOpcionales && documentoPendiente && <span className="text-xs" style={{ color: "#999" }}>El expediente escaneado también quedará adjunto al registro.</span>}
            </div>

            <div className={mostrarOpcionales ? "col-span-1 sm:col-span-2 lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" : "hidden"}>
              <div className="col-span-1 sm:col-span-2 lg:col-span-3 font-semibold text-sm" style={{ color: COLORS.navy }}>Datos opcionales</div>
              <FormField label="Nombre del cónyuge"><TextInput name="nombreConyuge" value={form.nombreConyuge} onChange={(e) => setCampo("nombreConyuge", e.target.value)} /></FormField>
              <FormField label="Dirección del cónyuge"><TextInput name="direccionConyuge" value={form.direccionConyuge} onChange={(e) => setCampo("direccionConyuge", e.target.value)} /></FormField>
              <FormField label="Teléfono del cónyuge">
                <TextInput name="telefonoConyuge" inputMode="numeric" pattern="[0-9]{8}" placeholder="8 dígitos" value={form.telefonoConyuge} onChange={(e) => setCampo("telefonoConyuge", limpiarTelefono(e.target.value))} />
              </FormField>
              <FormField label="Nombre del padre"><TextInput name="nombrePadre" value={form.nombrePadre} onChange={(e) => setCampo("nombrePadre", e.target.value)} /></FormField>
              <FormField label="Nombre de la madre"><TextInput name="nombreMadre" value={form.nombreMadre} onChange={(e) => setCampo("nombreMadre", e.target.value)} /></FormField>
              <FormField label="En caso de emergencia notificar"><TextInput name="contactoEmergencia" value={form.contactoEmergencia} onChange={(e) => setCampo("contactoEmergencia", e.target.value)} /></FormField>
              <FormField label="Parentesco"><TextInput name="parentesco" value={form.parentesco} onChange={(e) => setCampo("parentesco", e.target.value)} /></FormField>
              <FormField label="Dirección de emergencia"><TextInput name="direccionEmergencia" value={form.direccionEmergencia} onChange={(e) => setCampo("direccionEmergencia", e.target.value)} /></FormField>
              <FormField label="Teléfono de emergencia">
                <TextInput name="telefonoEmergencia" inputMode="numeric" pattern="[0-9]{8}" placeholder="8 dígitos" value={form.telefonoEmergencia} onChange={(e) => setCampo("telefonoEmergencia", limpiarTelefono(e.target.value))} />
              </FormField>
              <div className="col-span-1 sm:col-span-2 lg:col-span-3">
                <FormField label="Otras hospitalizaciones"><TextArea name="otrasHospitalizaciones" rows={2} value={form.otrasHospitalizaciones} onChange={(e) => setCampo("otrasHospitalizaciones", e.target.value)} /></FormField>
              </div>
              <FormField label="Referido de"><TextInput name="referidoDe" value={form.referidoDe} onChange={(e) => setCampo("referidoDe", e.target.value)} /></FormField>
              <FormField label="Servicios"><TextInput name="serviciosSolicitados" value={form.serviciosSolicitados} onChange={(e) => setCampo("serviciosSolicitados", e.target.value)} /></FormField>
              <FormField label="Referido por"><TextInput name="referidoPor" value={form.referidoPor} onChange={(e) => setCampo("referidoPor", e.target.value)} /></FormField>
              <div className="col-span-1 sm:col-span-2 lg:col-span-3">
                <FormField label="Impresión clínica de ingreso"><TextArea name="impresionClinicaIngreso" rows={2} value={form.impresionClinicaIngreso} onChange={(e) => setCampo("impresionClinicaIngreso", e.target.value)} /></FormField>
              </div>
              <FormField label="Fecha de egreso"><TextInput name="fechaEgreso" type="date" value={form.fechaEgreso} onChange={(e) => setCampo("fechaEgreso", e.target.value)} /></FormField>
              <FormField label="Hora de egreso (HHMM)"><TextInput name="horaEgreso" inputMode="numeric" pattern="[0-9]{4}" placeholder="1430" value={form.horaEgreso} onChange={(e) => setCampo("horaEgreso", e.target.value.replace(/\D/g, "").slice(0, 4))} /></FormField>
              <ListaCodificada titulo="Diagnóstico de egreso (en orden de importancia)" singular="Diagnóstico" items={form.diagnosticosEgreso} onChange={(items) => setCampo("diagnosticosEgreso", items)} />
              <ListaCodificada titulo="Complicaciones" singular="Complicación" items={form.complicacionesEgreso} onChange={(items) => setCampo("complicacionesEgreso", items)} />
              <ListaOperaciones items={form.operacionesLista} onChange={(items) => setCampo("operacionesLista", items)} />
              <ListaAdjuntos archivos={adjuntos} onChange={setAdjuntos} />

              <div className="col-span-1 sm:col-span-2 lg:col-span-3 mt-2 pt-4" style={{ borderTop: `1px solid ${COLORS.border}` }}>
                <div className="font-semibold text-sm mb-2" style={{ color: COLORS.navy }}>Maternidad</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FormField label="No. de hijo"><TextInput name="matNumeroHijo" inputMode="numeric" pattern="[0-9]+" value={form.matNumeroHijo} onChange={(e) => setCampo("matNumeroHijo", e.target.value.replace(/\D/g, ""))} /></FormField>
                  <FormField label="Fecha de nacimiento"><TextInput name="matFecha" type="date" value={form.matFecha} onChange={(e) => setCampo("matFecha", e.target.value)} /></FormField>
                  <FormField label="Hora de nacimiento (HHMM)"><TextInput name="matHora" inputMode="numeric" pattern="[0-9]{4}" placeholder="1430" value={form.matHora} onChange={(e) => setCampo("matHora", e.target.value.replace(/\D/g, "").slice(0, 4))} /></FormField>
                  <FormField label="Sexo del bebé">
                    <OpcionesExclusivas name="sexoBebeNuevo" value={form.matSexo} onChange={(valor) => setCampo("matSexo", valor)} options={[{ value: "F", label: "F" }, { value: "M", label: "M" }]} />
                  </FormField>
                  <div className="sm:col-span-2">
                    <FormField label="Condición de egreso del bebé">
                      <OpcionesExclusivas name="condicionBebeNuevo" value={form.matCondicion} onChange={(valor) => setCampo("matCondicion", valor)} options={CONDICIONES_EGRESO_BEBE} />
                    </FormField>
                  </div>
                  <FormField label="Autopsia">
                    <OpcionesExclusivas
                      name="autopsiaBebeNuevo"
                      value={form.matAutopsia}
                      onChange={(valor) => {
                        setCampo("matAutopsia", valor);
                        if (valor !== "si") { setCampo("matCausaMuerte", ""); setCampo("matFechaMuerte", ""); }
                      }}
                      options={[{ value: "si", label: "Sí" }, { value: "no", label: "No" }]}
                    />
                  </FormField>
                  {form.matAutopsia === "si" && (
                    <>
                      <FormField label="Causa de muerte"><TextInput name="matCausaMuerte" required value={form.matCausaMuerte} onChange={(e) => setCampo("matCausaMuerte", e.target.value)} /></FormField>
                      <FormField label="Fecha de muerte"><TextInput name="matFechaMuerte" required type="date" value={form.matFechaMuerte} onChange={(e) => setCampo("matFechaMuerte", e.target.value)} /></FormField>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="col-span-1 sm:col-span-2 lg:col-span-3 mt-2">
              <Button type="submit" disabled={guardando}>{guardando ? "Guardando…" : "Guardar paciente"}</Button>
            </div>
          </form>
        </Card>
      ) : null}
      {/* Edicion de un paciente ya registrado. Antes vivia en la pestaña
          "Ingreso / Egreso"; ahora se abre como modal desde "Editar" en la
          lista de pacientes registrados. Se conservan todos los campos
          administrativos del paciente (identidad, ingreso, egreso y
          maternidad): son datos del paciente, no del modulo. */}
      <Modal
        open={modalEdicionAbierto && !!ingresoPacienteId && !!pacienteDetalle}
        onClose={() => setModalEdicionAbierto(false)}
        title="Editar datos del paciente"
        maxWidth={900}
      >
        <div>
          <p className="text-xs font-semibold mb-4" style={{ color: "#888" }}>
            Ficha del paciente — se guarda sobre un paciente ya registrado.
          </p>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <FormField label="Paciente">
              <PacienteBuscador pacienteSeleccionado={pacienteDetalle} onSelect={(p) => setIngresoPacienteId(p?.id || null)} mostrarListado />
            </FormField>
            {ingresoPacienteId && pacienteDetalle && (
              <Button variant="secondary" onClick={() => setMostrarFicha(true)}>
                <span className="flex items-center gap-1.5"><Printer size={14} /> Imprimir ficha</span>
              </Button>
            )}
          </div>

          {ingresoPacienteId && (
            <form onSubmit={handleSubmitIngreso} className="flex flex-col gap-6 mt-5">
              {mensajeIngreso && <Banner tone={mensajeIngreso.tone}>{mensajeIngreso.texto}</Banner>}

              <div>
                <div className="font-semibold text-sm mb-3" style={{ color: COLORS.navy }}>Datos básicos</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FormField label="Nombre completo"><TextInput value={ingresoForm.idNombre} onChange={(e) => setCampoIngreso("idNombre", e.target.value)} /></FormField>
                  <FormField label="DPI / CUI"><TextInput inputMode="numeric" pattern="[0-9]{13}" value={ingresoForm.idDpi} onChange={(e) => setCampoIngreso("idDpi", limpiarDPI(e.target.value))} /></FormField>
                  <FormField label="Historia clínica"><TextInput inputMode="numeric" value={ingresoForm.idHistoria} onChange={(e) => setCampoIngreso("idHistoria", e.target.value.replace(/\D/g, "").slice(0, 40))} /></FormField>
                  <FormField label="Dirección"><TextInput value={ingresoForm.idDireccion} onChange={(e) => setCampoIngreso("idDireccion", e.target.value)} /></FormField>
                  <FormField label="Teléfono"><TextInput inputMode="numeric" value={ingresoForm.idTelefono} onChange={(e) => setCampoIngreso("idTelefono", limpiarTelefono(e.target.value))} /></FormField>
                  <FormField label="Lugar de nacimiento"><TextInput value={ingresoForm.idLugarNacimiento} onChange={(e) => setCampoIngreso("idLugarNacimiento", e.target.value)} /></FormField>
                  <FormField label="Fecha de nacimiento"><TextInput type="date" value={ingresoForm.idFechaNacimiento} onChange={(e) => setCampoIngreso("idFechaNacimiento", e.target.value)} /></FormField>
                  <FormField label="Edad"><TextInput inputMode="numeric" value={ingresoForm.idEdad} onChange={(e) => setCampoIngreso("idEdad", e.target.value.replace(/\D/g, "").slice(0, 3))} /></FormField>
                  <FormField label="Sexo"><TextInput value={ingresoForm.idSexo} onChange={(e) => setCampoIngreso("idSexo", e.target.value)} /></FormField>
                  <FormField label="Estado civil"><OpcionesExclusivas name="estadoCivilEditar" value={ingresoForm.idEstadoCivil} onChange={(v) => setCampoIngreso("idEstadoCivil", v)} options={ESTADOS_CIVILES.map((estado) => ({ ...estado, label: `${estado.value} · ${estado.label}` }))} /></FormField>
                  <FormField label="Ocupación"><TextInput value={ingresoForm.idOcupacion} onChange={(e) => setCampoIngreso("idOcupacion", e.target.value)} /></FormField>
                  <FormField label="Religión"><TextInput value={ingresoForm.idReligion} onChange={(e) => setCampoIngreso("idReligion", e.target.value)} /></FormField>
                  <FormField label="Nacionalidad"><TextInput value={ingresoForm.idNacionalidad} onChange={(e) => setCampoIngreso("idNacionalidad", e.target.value)} /></FormField>
                </div>
              </div>

              <div>
                <div className="font-semibold text-sm mb-3" style={{ color: COLORS.navy }}>Ingreso y datos opcionales</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FormField label="Fecha de ingreso"><TextInput type="date" value={ingresoForm.fechaIngreso} onChange={(e) => setCampoIngreso("fechaIngreso", e.target.value)} /></FormField>
                  <FormField label="Hora de ingreso (HHMM)"><TextInput inputMode="numeric" pattern="[0-9]{4}" value={ingresoForm.horaIngreso} onChange={(e) => setCampoIngreso("horaIngreso", e.target.value.replace(/\D/g, "").slice(0, 4))} /></FormField>
                  <FormField label="Nombre del cónyuge"><TextInput value={ingresoForm.nombreConyuge} onChange={(e) => setCampoIngreso("nombreConyuge", e.target.value)} /></FormField>
                  <FormField label="Dirección del cónyuge"><TextInput value={ingresoForm.direccionConyuge} onChange={(e) => setCampoIngreso("direccionConyuge", e.target.value)} /></FormField>
                  <FormField label="Teléfono del cónyuge"><TextInput inputMode="numeric" value={ingresoForm.telefonoConyuge} onChange={(e) => setCampoIngreso("telefonoConyuge", limpiarTelefono(e.target.value))} /></FormField>
                  <FormField label="Nombre del padre"><TextInput value={ingresoForm.nombrePadre} onChange={(e) => setCampoIngreso("nombrePadre", e.target.value)} /></FormField>
                  <FormField label="Nombre de la madre"><TextInput value={ingresoForm.nombreMadre} onChange={(e) => setCampoIngreso("nombreMadre", e.target.value)} /></FormField>
                  <FormField label="En caso de emergencia notificar"><TextInput value={ingresoForm.contactoEmergencia} onChange={(e) => setCampoIngreso("contactoEmergencia", e.target.value)} /></FormField>
                  <FormField label="Parentesco"><TextInput value={ingresoForm.parentesco} onChange={(e) => setCampoIngreso("parentesco", e.target.value)} /></FormField>
                  <FormField label="Dirección de emergencia"><TextInput value={ingresoForm.direccionEmergencia} onChange={(e) => setCampoIngreso("direccionEmergencia", e.target.value)} /></FormField>
                  <FormField label="Teléfono de emergencia"><TextInput inputMode="numeric" value={ingresoForm.telefonoEmergencia} onChange={(e) => setCampoIngreso("telefonoEmergencia", limpiarTelefono(e.target.value))} /></FormField>
                  <FormField label="Otras hospitalizaciones"><TextArea rows={2} value={ingresoForm.otrasHospitalizaciones} onChange={(e) => setCampoIngreso("otrasHospitalizaciones", e.target.value)} /></FormField>
                  <FormField label="Referido de"><TextInput value={ingresoForm.referidoDe} onChange={(e) => setCampoIngreso("referidoDe", e.target.value)} /></FormField>
                  <FormField label="Servicios"><TextInput value={ingresoForm.serviciosSolicitados} onChange={(e) => setCampoIngreso("serviciosSolicitados", e.target.value)} /></FormField>
                  <FormField label="Referido por"><TextInput value={ingresoForm.referidoPor} onChange={(e) => setCampoIngreso("referidoPor", e.target.value)} /></FormField>
                  <div className="col-span-1 sm:col-span-2 lg:col-span-3"><FormField label="Impresión clínica de ingreso"><TextArea rows={2} value={ingresoForm.impresionClinicaIngreso} onChange={(e) => setCampoIngreso("impresionClinicaIngreso", e.target.value)} /></FormField></div>
                </div>
              </div>

              <div>
                <div className="font-semibold text-sm mb-3" style={{ color: COLORS.navy }}>Egreso</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                  <FormField label="Fecha de egreso"><TextInput type="date" value={ingresoForm.fechaEgreso} onChange={(e) => setCampoIngreso("fechaEgreso", e.target.value)} /></FormField>
                  <FormField label="Hora de egreso (HHMM)"><TextInput inputMode="numeric" pattern="[0-9]{4}" value={ingresoForm.horaEgreso} onChange={(e) => setCampoIngreso("horaEgreso", e.target.value.replace(/\D/g, "").slice(0, 4))} /></FormField>
                  <FormField label="Condición de egreso del paciente">
                    <Select value={ingresoForm.condicionEgreso} onChange={(e) => handleCondicionEgresoChange(e.target.value)}>
                      <option value="">Seleccionar…</option>
                      {CONDICIONES_EGRESO.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </Select>
                  </FormField>
                </div>
                <ListaCodificada titulo="Diagnóstico de egreso (en orden de importancia)" singular="Diagnóstico" items={ingresoForm.diagnosticosEgreso} onChange={(items) => setCampoIngreso("diagnosticosEgreso", items)} />
                <div className="mt-4"><ListaCodificada titulo="Complicaciones" singular="Complicación" items={ingresoForm.complicacionesEgreso} onChange={(items) => setCampoIngreso("complicacionesEgreso", items)} /></div>
                <div className="mt-4"><ListaOperaciones items={ingresoForm.operacionesLista} onChange={(items) => setCampoIngreso("operacionesLista", items)} /></div>
                <div className="mt-4"><ListaAdjuntos archivos={adjuntosIngreso} onChange={setAdjuntosIngreso} titulo="Adjuntar archivos (resultados clínicos, PDF o imagen)" /></div>
                {esFallecido && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 animate-fade-in" style={{ borderTop: `1px dashed ${COLORS.border}` }}>
                    <FormField label="Autopsia"><OpcionesExclusivas name="autopsiaPaciente" value={ingresoForm.autopsia} onChange={(v) => setCampoIngreso("autopsia", v)} options={[{ value: "si", label: "Sí" }, { value: "no", label: "No" }]} /></FormField>
                    <FormField label="Causa de muerte"><TextInput value={ingresoForm.causaMuerte} onChange={(e) => setCampoIngreso("causaMuerte", e.target.value)} /></FormField>
                  </div>
                )}
              </div>

              <div>
                <div className="font-semibold text-sm mb-3" style={{ color: COLORS.navy }}>Maternidad</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FormField label="No. de hijo"><TextInput inputMode="numeric" value={ingresoForm.matNumeroHijo} onChange={(e) => setCampoIngreso("matNumeroHijo", e.target.value.replace(/\D/g, ""))} /></FormField>
                  <FormField label="Fecha de nacimiento"><TextInput type="date" value={ingresoForm.matFecha} onChange={(e) => setCampoIngreso("matFecha", e.target.value)} /></FormField>
                  <FormField label="Hora de nacimiento (HHMM)"><TextInput inputMode="numeric" pattern="[0-9]{4}" value={ingresoForm.matHora} onChange={(e) => setCampoIngreso("matHora", e.target.value.replace(/\D/g, "").slice(0, 4))} /></FormField>
                  <FormField label="Sexo del bebé"><OpcionesExclusivas name="sexoBebeEditar" value={ingresoForm.matSexo} onChange={(v) => setCampoIngreso("matSexo", v)} options={[{ value: "F", label: "F" }, { value: "M", label: "M" }]} /></FormField>
                  <div className="sm:col-span-2"><FormField label="Condición de egreso del bebé"><OpcionesExclusivas name="condicionBebeEditar" value={ingresoForm.matCondicion} onChange={(v) => setCampoIngreso("matCondicion", v)} options={CONDICIONES_EGRESO_BEBE} /></FormField></div>
                  <FormField label="Autopsia del bebé">
                    <OpcionesExclusivas name="autopsiaBebeEditar" value={ingresoForm.matAutopsia} onChange={(v) => { setCampoIngreso("matAutopsia", v); if (v !== "si") { setCampoIngreso("matCausaMuerte", ""); setCampoIngreso("matFechaMuerte", ""); } }} options={[{ value: "si", label: "Sí" }, { value: "no", label: "No" }]} />
                  </FormField>
                  {ingresoForm.matAutopsia === "si" && (
                    <>
                      <FormField label="Causa de muerte"><TextInput required value={ingresoForm.matCausaMuerte} onChange={(e) => setCampoIngreso("matCausaMuerte", e.target.value)} /></FormField>
                      <FormField label="Fecha de muerte"><TextInput required type="date" value={ingresoForm.matFechaMuerte} onChange={(e) => setCampoIngreso("matFechaMuerte", e.target.value)} /></FormField>
                    </>
                  )}
                </div>
              </div>

              <div>
                <Button type="submit" disabled={guardandoIngreso}>{guardandoIngreso ? "Guardando…" : "Guardar cambios"}</Button>
              </div>
            </form>
          )}
        </div>
      </Modal>
      {tab === "lista" ? (
        <>
          <div className="mb-4 flex gap-2 items-center">
            <SearchInput
              placeholder="Buscar por nombre, DPI o historia clínica"
              value={buscarInput}
              onChange={(e) => setBuscarInput(e.target.value)}
              onClear={setBuscarInput}
              containerStyle={{ maxWidth: 360, flex: 1 }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => pacientesLista.reload()}
              disabled={pacientesLista.loading}
              title="Recargar la lista de pacientes"
            >
              <span className="flex items-center gap-1.5">
                <RefreshCw size={14} className={pacientesLista.loading ? "animate-spin" : ""} />
                {pacientesLista.loading ? "Actualizando…" : "Actualizar"}
              </span>
            </Button>
          </div>
          {pacientesLista.error && <Banner tone="error">{pacientesLista.error}</Banner>}
          {pacientesLista.loading && (
            <div className="flex items-center gap-2 mb-2 text-xs" style={{ color: "#888" }}>
              <RefreshCw size={13} className="animate-spin" /> Actualizando pacientes…
            </div>
          )}
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
                  <div className="flex items-center gap-3">
                    <button className="text-xs font-semibold" style={{ color: COLORS.navy }} onClick={() => onVerExpediente(p.id)}>
                      Ver expediente →
                    </button>
                    {puedeRegistrar && (
                      <>
                        <button className="text-xs font-semibold" style={{ color: COLORS.navy }} onClick={() => editarPaciente(p)}>
                          Editar
                        </button>
                        <button className="text-xs font-semibold" style={{ color: COLORS.red }} onClick={() => eliminarPaciente(p)}>
                          Eliminar
                        </button>
                      </>
                    )}
                  </div>
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
    </div>
  );
}
