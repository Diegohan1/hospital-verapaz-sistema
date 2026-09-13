import React, { useCallback, useEffect, useRef, useState } from "react";
import { Camera, X, ImagePlus, AlertTriangle, RotateCw, RefreshCw, Check, ArrowLeft, ArrowRight, Download, Crop, Eye, EyeOff } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { Banner } from "./Banner";
import { COLORS } from "../styles/tokens";
import { detectarEsquinas, procesarPagina } from "../utils/scanProcessing";
import { generarPdfDePaginas, validarPdf, descargarPdf, nombreDescarga, tamanoLegibleMB, DOCUMENTO_CONFIG } from "../utils/pdfDocumentos";

// Sprint 3/4 (Cambios2): escaner documental con camara. Flujo:
//   idle -> solicitando_permiso -> capturando -> procesando -> editando
//   (esquinas manuales/automaticas, rotacion, filtros) -> previsualizando
//   (orden de paginas) -> confirmado (PDF validado y entregado).
// El permiso se pide solo al presionar el boton; al cerrar se detienen todos
// los tracks de video y se liberan los recursos.
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
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.95), ancho: canvas.width, alto: canvas.height };
}

function archivoValido(file) {
  if (!file || file.size <= 0) return "El archivo está vacío o corrupto.";
  if (file.size > SCAN_CONFIG.MB_MAX_ENTRADA * 1024 * 1024) return `La imagen excede el máximo de ${SCAN_CONFIG.MB_MAX_ENTRADA} MB.`;
  if (!SCAN_CONFIG.TIPOS_ENTRADA.includes(file.type) && !/\.(jpe?g|png|heic)$/i.test(file.name)) {
    return "Formato no permitido: use JPG, PNG o HEIC.";
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
        resolve({ dataUrl: canvas.toDataURL("image/jpeg", 0.95), ancho: canvas.width, alto: canvas.height });
      };
      img.onerror = () => reject(new Error("No se pudo decodificar la imagen (¿archivo corrupto o formato no soportado?)."));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo seleccionado."));
    reader.readAsDataURL(file);
  });
}

const FILTROS = [
  { value: "color", label: "Color" },
  { value: "grises", label: "Escala de grises" },
  { value: "documento", label: "Documento" },
];

export function CameraScannerModal({ open, onClose, pacienteId, onConfirmar, titulo = "Escanear documento del paciente" }) {
  const [estado, setEstado] = useState("idle");
  const [error, setError] = useState(null);
  const [soportaCamara, setSoportaCamara] = useState(true);
  const [camaraActiva, setCamaraActiva] = useState(false);

  // Pagina en edicion
  const [paginaActual, setPaginaActual] = useState(null); // { dataUrl, ancho, alto, esquinas, deteccionAuto }
  const [esquinas, setEsquinas] = useState(null);
  const [rotaciones, setRotaciones] = useState(0);
  const [filtro, setFiltro] = useState("color");
  const [procesadaUrl, setProcesadaUrl] = useState(null);
  const [verOriginal, setVerOriginal] = useState(false);
  const [arrastre, setArrastre] = useState(null); // indice de esquina arrastrandose

  // Paginas aceptadas y PDF final
  const [paginas, setPaginas] = useState([]);
  const [pdfResultado, setPdfResultado] = useState(null); // { blob, paginas, nombre }
  const [generando, setGenerando] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const inputRef = useRef(null);
  const contenedorRef = useRef(null);

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
    setPaginaActual(null);
    setEsquinas(null);
    setProcesadaUrl(null);
    setPdfResultado(null);
    setRotaciones(0);
    setFiltro("color");
    setError(null);
    setEstado("idle");
  }, [detenerCamara]);

  useEffect(() => {
    if (!open) {
      detenerCamara();
      setEstado("idle");
      setError(null);
      setPaginaActual(null);
      setProcesadaUrl(null);
    }
  }, [open, detenerCamara]);

  useEffect(() => () => detenerCamara(), [detenerCamara]);

  // ---- Captura ----

  async function activarCamara() {
    setError(null);
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

  async function iniciarProcesamiento({ dataUrl, ancho, alto }) {
    if (paginas.length >= SCAN_CONFIG.MAX_PAGINAS) {
      setError(`Ya alcanzó el máximo de ${SCAN_CONFIG.MAX_PAGINAS} páginas por documento.`);
      setEstado("error");
      return;
    }
    setEstado("procesando");
    setError(null);
    try {
      const deteccion = await Promise.race([
        detectarEsquinas(await (async () => {
          const img = new Image();
          img.src = dataUrl;
          await img.decode();
          const canvas = document.createElement("canvas");
          canvas.width = ancho;
          canvas.height = alto;
          canvas.getContext("2d").drawImage(img, 0, 0, ancho, alto);
          return canvas;
        })()),
        new Promise((resolve) => setTimeout(() => resolve(null), SCAN_CONFIG.TIMEOUT_PROCESAMIENTO_MS)),
      ]);
      const esquinasIniciales = deteccion || [
        { x: ancho * 0.06, y: alto * 0.06 }, { x: ancho * 0.94, y: alto * 0.06 },
        { x: ancho * 0.94, y: alto * 0.94 }, { x: ancho * 0.06, y: alto * 0.94 },
      ];
      setPaginaActual({ dataUrl, ancho, alto });
      setEsquinas(esquinasIniciales);
      setRotaciones(0);
      setFiltro("color");
      setVerOriginal(false);
      setEstado("editando");
    } catch (err) {
      setError(err.message || "Error al procesar la captura.");
      setEstado("error");
    }
  }

  function capturarPagina() {
    if (!videoRef.current || !videoRef.current.videoWidth) return;
    const { dataUrl, ancho, alto } = dataUrlDesdeVideo(videoRef.current, SCAN_CONFIG.CAMERA_MAX_WIDTH);
    iniciarProcesamiento({ dataUrl, ancho, alto });
  }

  async function manejarArchivo(evento) {
    const file = evento.target.files?.[0];
    evento.target.value = "";
    if (!file) return;
    const invalido = archivoValido(file);
    if (invalido) {
      setError(invalido);
      setEstado("error");
      return;
    }
    try {
      const { dataUrl, ancho, alto } = await dataUrlDesdeArchivo(file);
      await iniciarProcesamiento({ dataUrl, ancho, alto });
    } catch (err) {
      setError(err.message);
      setEstado("error");
    }
  }

  // ---- Edicion de la pagina ----

  // Recalcula la vista previa procesada cuando cambian esquinas/rotacion/filtro
  useEffect(() => {
    let vigente = true;
    if (estado !== "editando" || !paginaActual) return undefined;
    setProcesadaUrl(null);
    procesarPagina(paginaActual.dataUrl, {
      esquinas,
      rotaciones,
      filtro,
      maxAncho: SCAN_CONFIG.CAMERA_MAX_WIDTH,
    })
      .then((canvas) => {
        if (vigente) setProcesadaUrl(canvas.toDataURL("image/jpeg", 0.9));
      })
      .catch(() => {
        if (vigente) setProcesadaUrl(null);
      });
    return () => { vigente = false; };
  }, [estado, paginaActual, esquinas, rotaciones, filtro]);

  // Arrastre de esquinas sobre la imagen original
  function iniciarArrastre(indice, evento) {
    evento.preventDefault();
    evento.stopPropagation();
    setArrastre(indice);
  }

  function moverArrastre(evento) {
    if (arrastre == null || !contenedorRef.current || !paginaActual) return;
    const rect = contenedorRef.current.getBoundingClientRect();
    const x = Math.min(Math.max((evento.clientX - rect.left) / rect.width, 0.02), 0.98);
    const y = Math.min(Math.max((evento.clientY - rect.top) / rect.height, 0.02), 0.98);
    setEsquinas((e) => e.map((esq, i) => (i === arrastre ? { x: x * paginaActual.ancho, y: y * paginaActual.alto } : esq)));
  }

  function terminarArrastre() {
    setArrastre(null);
  }

  async function redetectar() {
    if (!paginaActual) return;
    setEstado("procesando");
    try {
      const img = new Image();
      img.src = paginaActual.dataUrl;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = paginaActual.ancho;
      canvas.height = paginaActual.alto;
      canvas.getContext("2d").drawImage(img, 0, 0);
      const deteccion = detectarEsquinas(canvas);
      if (deteccion) {
        setEsquinas(deteccion);
        setEstado("editando");
      } else {
        setError("No se detectaron los bordes con confianza. Ajuste las esquinas manualmente.");
        setEstado("editando");
      }
    } catch {
      setError("Error al reintentar la detección de bordes.");
      setEstado("editando");
    }
  }

  function aceptarPagina() {
    if (!procesadaUrl) return;
    setPaginas((p) => [...p, {
      id: crypto.randomUUID(),
      procesadaUrl,
      originalUrl: paginaActual.dataUrl,
    }]);
    setPaginaActual(null);
    setProcesadaUrl(null);
    setError(null);
    setEstado(camaraActiva ? "capturando" : "previsualizando");
  }

  function repetirCaptura() {
    setPaginaActual(null);
    setProcesadaUrl(null);
    setError(null);
    setEstado(camaraActiva ? "capturando" : "idle");
  }

  // ---- Gestion de paginas y PDF ----

  function moverPagina(i, direccion) {
    setPaginas((p) => {
      const j = i + direccion;
      if (j < 0 || j >= p.length) return p;
      const copia = [...p];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia;
    });
  }

  function quitarPagina(id) {
    setPaginas((p) => p.filter((pg) => pg.id !== id));
  }

  async function generarPdf() {
    setGenerando(true);
    setError(null);
    try {
      const { blob, paginas: total } = await generarPdfDePaginas(paginas.map((p) => p.procesadaUrl));
      const invalido = validarPdf(blob, total);
      if (invalido) {
        setError(invalido);
        setEstado("error");
        return;
      }
      const nombre = nombreDescarga(pacienteId);
      setPdfResultado({ blob, paginas: total, nombre });
      setEstado("confirmado");
      // Si el integrador define onConfirmar (subida al expediente), se llama;
      // la descarga local queda siempre disponible como copia.
      if (onConfirmar) {
        try {
          await onConfirmar(blob, { paginas: total, nombre });
        } catch (err) {
          setError("El documento se generó, pero no se pudo guardar en el expediente: " + err.message + " Use 'Descargar copia' para no perderlo.");
        }
      }
    } catch (err) {
      setError(err.message || "Error al generar el PDF.");
      setEstado("error");
    } finally {
      setGenerando(false);
    }
  }

  function cerrar() {
    limpiarTodo();
    onClose();
  }

  const enEdicion = estado === "editando" && paginaActual;

  return (
    <Modal open={open} onClose={cerrar} title={titulo} maxWidth={760}>
      {estado === "error" && error && (
        <Banner tone="error">
          <span className="flex items-center gap-1.5"><AlertTriangle size={14} /> {error}</span>
        </Banner>
      )}

      {/* ---------- Captura con camara ---------- */}
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
          <p className="text-sm mt-3" style={{ color: "#666" }}>Procesando captura (detección de bordes y corrección de perspectiva)…</p>
        </div>
      )}

      {/* ---------- Editor de pagina ---------- */}
      {enEdicion && (
        <div>
          <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
            <div className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "#888" }}>
              <Crop size={13} /> Ajuste las esquinas del documento y el filtro. Arrastre los puntos verdes sobre la imagen original.
            </div>
            <Button variant="secondary" onClick={() => setVerOriginal((v) => !v)}>
              <span className="flex items-center gap-1.5">
                {verOriginal ? <Eye size={14} /> : <EyeOff size={14} />}
                {verOriginal ? "Ver procesada" : "Ver original"}
              </span>
            </Button>
          </div>

          <div
            ref={contenedorRef}
            className="relative rounded-xl overflow-hidden mb-3 select-none touch-none"
            style={{ border: `1px solid ${COLORS.border}`, maxHeight: 340 }}
            onPointerMove={moverArrastre}
            onPointerUp={terminarArrastre}
            onPointerLeave={terminarArrastre}
          >
            <img
              src={verOriginal ? paginaActual.dataUrl : (procesadaUrl || paginaActual.dataUrl)}
              alt="Página en edición"
              className="w-full h-auto"
              style={{ maxHeight: 340, objectFit: "contain" }}
            />
            {!verOriginal && !procesadaUrl && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.6)" }}>
                <RefreshCw size={22} className="animate-spin" style={{ color: COLORS.navy }} />
              </div>
            )}
            {!verOriginal && esquinas && (
              <>
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <polygon
                    points={esquinas.map((e) => `${(e.x / paginaActual.ancho) * 100}%,${(e.y / paginaActual.alto) * 100}%`).join(" ")}
                    fill="none"
                    stroke={COLORS.gold}
                    strokeWidth={2}
                    strokeDasharray="6 4"
                  />
                </svg>
                {esquinas.map((e, i) => (
                  <button
                    key={i}
                    onPointerDown={(evento) => iniciarArrastre(i, evento)}
                    className="absolute w-5 h-5 rounded-full"
                    style={{
                      left: `${(e.x / paginaActual.ancho) * 100}%`,
                      top: `${(e.y / paginaActual.alto) * 100}%`,
                      transform: "translate(-50%, -50%)",
                      backgroundColor: COLORS.navy,
                      border: "2px solid white",
                      cursor: "grab",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
                    }}
                    aria-label={`Esquina ${i + 1} del documento`}
                  />
                ))}
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2 items-center mb-3">
            <Button variant="secondary" onClick={redetectar}>
              <span className="flex items-center gap-1.5"><Crop size={14} /> Detectar bordes automáticamente</span>
            </Button>
            <Button variant="secondary" onClick={() => setRotaciones((r) => r + 1)}>
              <span className="flex items-center gap-1.5"><RotateCw size={14} /> Rotar 90°</span>
            </Button>
            <div className="flex gap-1 rounded-xl p-1" style={{ border: `1px solid ${COLORS.border}` }}>
              {FILTROS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFiltro(f.value)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
                  style={filtro === f.value ? { backgroundColor: COLORS.navy, color: "white" } : { color: COLORS.text }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={aceptarPagina} disabled={!procesadaUrl}>
              <span className="flex items-center gap-1.5"><Check size={15} /> Aceptar página</span>
            </Button>
            <Button variant="secondary" onClick={repetirCaptura}>
              <span className="flex items-center gap-1.5"><RefreshCw size={14} /> Repetir captura</span>
            </Button>
          </div>
        </div>
      )}

      {/* ---------- Acciones generales ---------- */}
      {(estado === "idle" || estado === "capturando" || estado === "error") && (
        <div className="flex flex-wrap gap-2 items-center">
          {!camaraActiva && (
            <Button onClick={activarCamara}>
              <span className="flex items-center gap-1.5"><Camera size={15} /> Activar cámara</span>
            </Button>
          )}
          {estado === "capturando" && (
            <Button onClick={capturarPagina}>
              <span className="flex items-center gap-1.5"><Camera size={15} /> Capturar página</span>
            </Button>
          )}
          <Button variant="secondary" onClick={() => inputRef.current?.click()}>
            <span className="flex items-center gap-1.5"><ImagePlus size={15} /> Seleccionar imagen</span>
          </Button>
          <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={manejarArchivo} aria-label="Seleccionar imagen del documento" />
          {estado === "capturando" && (
            <Button variant="secondary" onClick={detenerCamara}>
              <span className="flex items-center gap-1.5"><X size={15} /> Detener cámara</span>
            </Button>
          )}
          {!soportaCamara && estado === "idle" && (
            <span className="text-xs" style={{ color: COLORS.gold }}>Este navegador no soporta cámara; use la selección de archivo.</span>
          )}
        </div>
      )}

      {/* ---------- Paginas aceptadas ---------- */}
      {paginas.length > 0 && (estado === "idle" || estado === "capturando" || estado === "previsualizando" || estado === "error") && (
        <div className="mt-4">
          <div className="text-xs font-semibold mb-2" style={{ color: "#888" }}>
            Páginas del documento ({paginas.length}/{SCAN_CONFIG.MAX_PAGINAS})
          </div>
          <div className="grid grid-cols-4 gap-2">
            {paginas.map((pg, i) => (
              <div key={pg.id} className="relative rounded-lg overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
                <img src={pg.procesadaUrl} alt={`Página ${i + 1}`} className="w-full h-24 object-cover" />
                <span className="absolute left-1 top-1 text-[10px] font-bold px-1.5 rounded" style={{ backgroundColor: COLORS.navy, color: "white" }}>{i + 1}</span>
                <div className="absolute right-1 top-1 flex gap-1">
                  <button onClick={() => moverPagina(i, -1)} disabled={i === 0} className="rounded p-0.5 disabled:opacity-30" style={{ backgroundColor: "rgba(0,0,0,0.55)", color: "white" }} aria-label={`Mover página ${i + 1} atrás`}><ArrowLeft size={11} /></button>
                  <button onClick={() => moverPagina(i, 1)} disabled={i === paginas.length - 1} className="rounded p-0.5 disabled:opacity-30" style={{ backgroundColor: "rgba(0,0,0,0.55)", color: "white" }} aria-label={`Mover página ${i + 1} adelante`}><ArrowRight size={11} /></button>
                  <button onClick={() => quitarPagina(pg.id)} className="rounded p-0.5" style={{ backgroundColor: "rgba(0,0,0,0.55)", color: "white" }} aria-label={`Eliminar página ${i + 1}`}><X size={11} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------- Confirmacion del PDF ---------- */}
      {paginas.length > 0 && !enEdicion && estado !== "confirmado" && (
        <div className="mt-4 flex flex-wrap gap-2 items-center">
          <Button onClick={generarPdf} disabled={generando}>
            {generando ? "Generando PDF…" : `Generar PDF y confirmar (${paginas.length} página${paginas.length === 1 ? "" : "s"})`}
          </Button>
          {estado === "previsualizando" && !camaraActiva && (
            <Button variant="secondary" onClick={activarCamara}>
              <span className="flex items-center gap-1.5"><Camera size={14} /> Agregar otra página</span>
            </Button>
          )}
        </div>
      )}

      {estado === "confirmado" && pdfResultado && (
        <div className="mt-2">
          <Banner tone="success">
            PDF generado correctamente: {pdfResultado.paginas} página{pdfResultado.paginas === 1 ? "" : "s"}, {tamanoLegibleMB(pdfResultado.blob.size)}.
            {onConfirmar ? " El documento se guardó en el expediente del paciente." : " Descargue la copia local; aún no hay persistencia configurada."}
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
