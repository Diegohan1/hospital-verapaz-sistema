import React, { useCallback, useEffect, useRef, useState } from "react";
import { Camera, X, ImagePlus, AlertTriangle, RefreshCw, Download, FileText } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { Banner } from "./Banner";
import { COLORS } from "../styles/tokens";
import { procesarEscaneoAutomatico } from "../utils/scanProcessing";
import { generarPdfDePaginas, validarPdf, descargarPdf, nombreDescarga, tamanoLegibleMB, renderizarPrimeraPaginaPdf } from "../utils/pdfDocumentos";
import { extraerDatosBasicos } from "../utils/ocrDatosBasicos";

// Escaner documental automatico (Cambios2): como un escaner de impresion —
// se toma la foto o se sube el archivo y el sistema detecta los bordes,
// corrige la perspectiva y aplica el filtro documento SIN preguntar nada.
// Flujo: idle -> solicitando_permiso -> capturando -> procesando ->
// capturando (pagina agregada) -> finalizando -> confirmado.
// El permiso se pide solo al presionar el boton; al cerrar se detienen todos
// los tracks de video.
export const SCAN_CONFIG = {
  CAMERA_MAX_WIDTH: 1600,
  MAX_PAGINAS: 30,
  MB_MAX_ENTRADA: 15,
  TIPOS_ENTRADA: ["image/jpeg", "image/png"],
  TIMEOUT_PROCESAMIENTO_MS: 20000,
};

function dataUrlDesdeVideo(video, maxWidth) {
  const escala = Math.min(1, maxWidth / video.videoWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * escala);
  canvas.height = Math.round(video.videoHeight * escala);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.95);
}

function esPdf(file) {
  return file?.type === "application/pdf" || /\.pdf$/i.test(file?.name || "");
}

function archivoValido(file) {
  if (!file || file.size <= 0) return "El archivo está vacío o corrupto.";
  if (file.size > SCAN_CONFIG.MB_MAX_ENTRADA * 1024 * 1024) return `La imagen excede el máximo de ${SCAN_CONFIG.MB_MAX_ENTRADA} MB.`;
  if (!SCAN_CONFIG.TIPOS_ENTRADA.includes(file.type) && !/\.(jpe?g|png|heic)$/i.test(file.name)) {
    return "Formato no permitido: use JPG, PNG, HEIC o PDF.";
  }
  return null;
}

function dataUrlDesdeArchivo(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(1, SCAN_CONFIG.CAMERA_MAX_WIDTH / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(16, Math.round(img.width * escala));
        canvas.height = Math.max(16, Math.round(img.height * escala));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.95));
      };
      img.onerror = () => reject(new Error("No se pudo decodificar la imagen (¿archivo corrupto o formato no soportado?)."));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo seleccionado."));
    reader.readAsDataURL(file);
  });
}

export function CameraScannerModal({
  open,
  onClose,
  pacienteId,
  onConfirmar,
  titulo = "Escanear documento del paciente",
  // Dev-Mari: al escanear antes de registrar (sin pacienteId), el documento
  // todavia no se guardo en el servidor, solo quedo listo en el formulario.
  mensajeExito = "El documento se guardó en el expediente del paciente.",
}) {
  const [estado, setEstado] = useState("idle");
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null); // "Página 2 escaneada y agregada"
  const [soportaCamara, setSoportaCamara] = useState(true);
  const [camaraActiva, setCamaraActiva] = useState(false);

  const [paginas, setPaginas] = useState([]); // [{ id, dataUrl procesada }]
  const [pdfResultado, setPdfResultado] = useState(null);
  const [finalizando, setFinalizando] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setSoportaCamara(!!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia));
  }, []);

  const detenerCamara = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamaraActiva(false);
  }, []);

  const limpiarTodo = useCallback(() => {
    detenerCamara();
    setPaginas([]);
    setPdfResultado(null);
    setError(null);
    setAviso(null);
    setEstado("idle");
  }, [detenerCamara]);

  useEffect(() => {
    if (!open) {
      detenerCamara();
      setEstado("idle");
      setError(null);
      setAviso(null);
    }
  }, [open, detenerCamara]);

  useEffect(() => () => detenerCamara(), [detenerCamara]);

  // ---- Camara ----

  async function activarCamara() {
    setError(null);
    setAviso(null);
    setPdfResultado(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setSoportaCamara(false);
      setError("Este navegador no permite usar la cámara. Use 'Seleccionar imagen' para escanear desde un archivo.");
      return;
    }
    setEstado("solicitando_permiso");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamaraActiva(true);
      setEstado("capturando");
    } catch (err) {
      setEstado("error");
      if (err.name === "NotAllowedError") {
        setError("Permiso de cámara denegado. Habilítelo en el navegador o use 'Seleccionar imagen' para escanear desde un archivo.");
      } else if (err.name === "NotFoundError") {
        setError("No se detectó ninguna cámara conectada. Use 'Seleccionar imagen'.");
      } else {
        setError("No se pudo iniciar la cámara: " + err.message);
      }
    }
  }

  // ---- Escaneo automatico: captura -> bordes -> perspectiva -> filtro ----

  async function escanearAutomaticamente(dataUrl) {
    if (paginas.length >= SCAN_CONFIG.MAX_PAGINAS) {
      setError(`Ya alcanzó el máximo de ${SCAN_CONFIG.MAX_PAGINAS} páginas por documento.`);
      setEstado("error");
      return;
    }
    setEstado("procesando");
    setError(null);
    try {
      const { canvas } = await Promise.race([
        procesarEscaneoAutomatico(dataUrl, { maxAncho: SCAN_CONFIG.CAMERA_MAX_WIDTH }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("El procesamiento tardó demasiado; intente de nuevo.")), SCAN_CONFIG.TIMEOUT_PROCESAMIENTO_MS)),
      ]);
      setPaginas((p) => [...p, { id: crypto.randomUUID(), dataUrl: canvas.toDataURL("image/jpeg", 0.9) }]);
      setAviso(`Página ${paginas.length + 1} escaneada: bordes y perspectiva corregidos automáticamente.`);
      setEstado(camaraActiva ? "capturando" : "idle");
    } catch (err) {
      setError(err.message || "Error al procesar la captura.");
      setEstado(camaraActiva ? "capturando" : "error");
    }
  }

  function capturarPagina() {
    if (!videoRef.current || !videoRef.current.videoWidth) return;
    escanearAutomaticamente(dataUrlDesdeVideo(videoRef.current, SCAN_CONFIG.CAMERA_MAX_WIDTH));
  }

  // Dev-Mari: un PDF ya viene de un escaner fisico (impresora) — no es una
  // foto que haya que enderezar. Se usa tal cual, sin pasar por deteccion de
  // bordes ni correccion de perspectiva, y se va directo a leer los datos
  // basicos y confirmar.
  async function manejarArchivoPdf(file) {
    setError(null);
    setAviso(null);
    setEstado("extrayendo_datos");
    try {
      const bytes = await file.arrayBuffer();
      const { dataUrl, totalPaginas } = await renderizarPrimeraPaginaPdf(bytes);
      const datosBasicos = await extraerDatosBasicos([dataUrl]);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const nombre = nombreDescarga(pacienteId);
      setPdfResultado({ blob, paginas: totalPaginas, nombre });
      setEstado("confirmado");
      if (onConfirmar) {
        try {
          await onConfirmar(blob, { paginas: totalPaginas, nombre, datosBasicos });
        } catch (err) {
          setError("El documento se generó, pero no se pudo guardar: " + err.message + " Use 'Descargar copia' para no perderlo.");
        }
      }
    } catch (err) {
      setError("No se pudo leer el PDF (¿está dañado o protegido con contraseña?): " + err.message);
      setEstado("error");
    }
  }

  async function manejarArchivo(evento) {
    const file = evento.target.files?.[0];
    evento.target.value = "";
    if (!file) return;
    if (esPdf(file)) {
      await manejarArchivoPdf(file);
      return;
    }
    const invalido = archivoValido(file);
    if (invalido) {
      setError(invalido);
      setEstado("error");
      return;
    }
    try {
      const dataUrl = await dataUrlDesdeArchivo(file);
      await escanearAutomaticamente(dataUrl);
    } catch (err) {
      setError(err.message);
      setEstado("error");
    }
  }

  function quitarPagina(id) {
    setPaginas((p) => p.filter((pg) => pg.id !== id));
  }

  // ---- PDF final ----

  async function terminarYGuardar() {
    setFinalizando(true);
    setError(null);
    try {
      const { blob, paginas: total } = await generarPdfDePaginas(paginas.map((p) => p.dataUrl));
      const invalido = validarPdf(blob, total);
      if (invalido) {
        setError(invalido);
        setEstado("error");
        return;
      }
      const nombre = nombreDescarga(pacienteId);

      // Lectura automatica de nombre/DPI/telefono/fecha (solo la primera
      // pagina). Nunca bloquea el guardado: si falla o no reconoce nada,
      // el formulario se sigue llenando a mano.
      setEstado("extrayendo_datos");
      const datosBasicos = await extraerDatosBasicos(paginas.map((p) => p.dataUrl));

      setPdfResultado({ blob, paginas: total, nombre });
      setEstado("confirmado");
      detenerCamara();
      if (onConfirmar) {
        try {
          await onConfirmar(blob, { paginas: total, nombre, datosBasicos });
        } catch (err) {
          setError("El documento se generó, pero no se pudo guardar en el expediente: " + err.message + " Use 'Descargar copia' para no perderlo.");
        }
      }
    } catch (err) {
      setError(err.message || "Error al generar el PDF.");
      setEstado("error");
    } finally {
      setFinalizando(false);
    }
  }

  function cerrar() {
    limpiarTodo();
    onClose();
  }

  return (
    <Modal open={open} onClose={cerrar} title={titulo} maxWidth={720}>
      {estado === "error" && error && (
        <Banner tone="error">
          <span className="flex items-center gap-1.5"><AlertTriangle size={14} /> {error}</span>
        </Banner>
      )}
      {aviso && estado !== "error" && (
        <Banner tone="success">
          <span className="flex items-center gap-1.5"><FileText size={14} /> {aviso}</span>
        </Banner>
      )}

      {/* Vista previa de video con guias del documento */}
      {estado === "capturando" && (
        <div className="relative rounded-xl overflow-hidden mb-3" style={{ backgroundColor: "#111" }}>
          <video ref={videoRef} playsInline muted className="w-full" style={{ maxHeight: 380 }} />
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-6 rounded-lg" style={{ border: "2px dashed rgba(255,255,255,0.65)" }} />
            <div className="absolute left-2 top-2 w-6 h-6" style={{ borderTop: "3px solid #fff", borderLeft: "3px solid #fff", borderRadius: 4 }} />
            <div className="absolute right-2 top-2 w-6 h-6" style={{ borderTop: "3px solid #fff", borderRight: "3px solid #fff", borderRadius: 4 }} />
            <div className="absolute left-2 bottom-2 w-6 h-6" style={{ borderBottom: "3px solid #fff", borderLeft: "3px solid #fff", borderRadius: 4 }} />
            <div className="absolute right-2 bottom-2 w-6 h-6" style={{ borderBottom: "3px solid #fff", borderRight: "3px solid #fff", borderRadius: 4 }} />
          </div>
        </div>
      )}

      {estado === "procesando" && (
        <div className="py-10 text-center">
          <RefreshCw size={28} className="animate-spin mx-auto" style={{ color: COLORS.navy }} />
          <p className="text-sm mt-3" style={{ color: "#666" }}>Escaneando: detectando bordes y corrigiendo perspectiva…</p>
        </div>
      )}

      {estado === "extrayendo_datos" && (
        <div className="py-10 text-center">
          <RefreshCw size={28} className="animate-spin mx-auto" style={{ color: COLORS.navy }} />
          <p className="text-sm mt-3" style={{ color: "#666" }}>Generando el PDF y leyendo los datos básicos del documento…</p>
        </div>
      )}

      {/* Acciones de captura */}
      {(estado === "idle" || estado === "capturando" || estado === "solicitando_permiso" || estado === "error") && (
        <div className="flex flex-wrap gap-2 items-center">
          {estado === "capturando" ? (
            <Button onClick={capturarPagina}>
              <span className="flex items-center gap-1.5"><Camera size={15} /> Capturar página</span>
            </Button>
          ) : (
            !camaraActiva && (
              <Button onClick={activarCamara} disabled={estado === "solicitando_permiso"}>
                <span className="flex items-center gap-1.5"><Camera size={15} /> {estado === "solicitando_permiso" ? "Solicitando permiso…" : "Activar cámara"}</span>
              </Button>
            )
          )}
          <Button variant="secondary" onClick={() => inputRef.current?.click()}>
            <span className="flex items-center gap-1.5"><ImagePlus size={15} /> Subir imagen o PDF del escáner</span>
          </Button>
          <input ref={inputRef} type="file" accept="image/*,.pdf,application/pdf" capture="environment" className="hidden" onChange={manejarArchivo} aria-label="Subir imagen o PDF del documento" />
          {estado === "capturando" && (
            <Button variant="secondary" onClick={detenerCamara}>
              <span className="flex items-center gap-1.5"><X size={15} /> Detener cámara</span>
            </Button>
          )}
          {!soportaCamara && estado === "idle" && (
            <span className="text-xs" style={{ color: COLORS.gold }}>Este navegador no soporta cámara; use la subida de archivo.</span>
          )}
        </div>
      )}

      {/* Paginas escaneadas (procesamiento automatico) */}
      {paginas.length > 0 && estado !== "confirmado" && (
        <div className="mt-4">
          <div className="text-xs font-semibold mb-2" style={{ color: "#888" }}>
            Páginas escaneadas ({paginas.length}/{SCAN_CONFIG.MAX_PAGINAS}) — cada página se recorta y corrige automáticamente
          </div>
          <div className="grid grid-cols-5 gap-2">
            {paginas.map((pg, i) => (
              <div key={pg.id} className="relative rounded-lg overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
                <img src={pg.dataUrl} alt={`Página ${i + 1}`} className="w-full h-20 object-cover" />
                <span className="absolute left-1 top-1 text-[10px] font-bold px-1.5 rounded" style={{ backgroundColor: COLORS.navy, color: "white" }}>{i + 1}</span>
                <button
                  onClick={() => quitarPagina(pg.id)}
                  className="absolute right-1 top-1 rounded-full p-0.5"
                  style={{ backgroundColor: "rgba(0,0,0,0.55)", color: "white" }}
                  aria-label={`Eliminar página ${i + 1}`}
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <Button onClick={terminarYGuardar} disabled={finalizando}>
              {finalizando ? "Generando PDF…" : `Terminar y guardar en el expediente (${paginas.length} página${paginas.length === 1 ? "" : "s"})`}
            </Button>
          </div>
        </div>
      )}

      {/* Confirmacion */}
      {estado === "confirmado" && pdfResultado && (
        <div className="mt-2">
          <Banner tone="success">
            PDF generado automáticamente: {pdfResultado.paginas} página{pdfResultado.paginas === 1 ? "" : "s"}, {tamanoLegibleMB(pdfResultado.blob.size)}.
            {onConfirmar ? ` ${mensajeExito}` : " Descargue la copia local; aún no hay persistencia configurada."}
          </Banner>
          <div className="flex gap-2 mt-3">
            <Button variant="secondary" onClick={() => descargarPdf(pdfResultado.blob, pdfResultado.nombre)}>
              <span className="flex items-center gap-1.5"><Download size={14} /> Descargar copia</span>
            </Button>
            <Button variant="secondary" onClick={cerrar}>Cerrar</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
