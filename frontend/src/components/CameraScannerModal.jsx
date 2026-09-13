import React, { useCallback, useEffect, useRef, useState } from "react";
import { Camera, X, ImagePlus, AlertTriangle } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { Banner } from "./Banner";
import { COLORS } from "../styles/tokens";

// Limite de resolucion de captura para controlar memoria y tiempo de
// procesamiento en dispositivos de gama media (Sprint 3/4 Cambios2).
export const SCAN_CONFIG = {
  CAMERA_MAX_WIDTH: 1600,
  MAX_PAGINAS: 30,
  TIPOS_ENTRADA: ["image/jpeg", "image/png"],
  MB_MIN: 0.01, // rechazar archivos vacios o corruptos
  MB_MAX: 15,   // por pagina de entrada
};

function dataUrlDesdeVideo(video, maxWidth) {
  const escala = Math.min(1, maxWidth / video.videoWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * escala);
  canvas.height = Math.round(video.videoHeight * escala);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.92), ancho: canvas.width, alto: canvas.height };
}

function archivoValido(file) {
  if (!file || file.size < SCAN_CONFIG.MB_MIN * 1024 * 1024) return "El archivo está vacío o corrupto.";
  if (file.size > SCAN_CONFIG.MB_MAX * 1024 * 1024) return `La imagen excede el máximo de ${SCAN_CONFIG.MB_MAX} MB.`;
  if (!SCAN_CONFIG.TIPOS_ENTRADA.includes(file.type) && !/\.(jpe?g|png|heic)$/i.test(file.name)) {
    return "Formato no permitido: use JPG, PNG o HEIC.";
  }
  return null;
}

// Sprint 3 (Cambios2): escaner documental con camara. Estados: idle,
// solicitando_permiso, capturando, procesando, previsualizando, error y
// confirmado. El permiso se pide solo al presionar el boton, nunca al abrir
// la ficha. Al cerrar (o desmontar) se detienen todos los tracks de video y
// se liberan los ObjectURL.
export function CameraScannerModal({ open, onClose, titulo = "Escanear documento del paciente" }) {
  const [estado, setEstado] = useState("idle"); // idle | solicitando_permiso | capturando | error
  const [error, setError] = useState(null);
  const [paginas, setPaginas] = useState([]); // [{ id, dataUrl }]
  const [soportaCamara, setSoportaCamara] = useState(true);

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
  }, []);

  const limpiarTodo = useCallback(() => {
    detenerCamara();
    setPaginas([]);
    setError(null);
    setEstado("idle");
  }, [detenerCamara]);

  // Liberar camara al cerrar el modal o desmontar el componente
  useEffect(() => {
    if (!open) {
      detenerCamara();
      setEstado("idle");
      setError(null);
    }
  }, [open, detenerCamara]);

  useEffect(() => () => detenerCamara(), [detenerCamara]);

  async function activarCamara() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setSoportaCamara(false);
      setError("Este navegador no permite usar la cámara. Use 'Seleccionar imagen' para escanear desde un archivo.");
      setEstado("error");
      return;
    }
    setEstado("solicitando_permiso");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1440 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
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

  function capturarPagina() {
    if (!videoRef.current || !videoRef.current.videoWidth) return;
    const { dataUrl } = dataUrlDesdeVideo(videoRef.current, SCAN_CONFIG.CAMERA_MAX_WIDTH);
    setPaginas((p) => [...p, { id: crypto.randomUUID(), dataUrl }]);
  }

  function manejarArchivo(evento) {
    const file = evento.target.files?.[0];
    evento.target.value = "";
    if (!file) return;
    const invalido = archivoValido(file);
    if (invalido) {
      setError(invalido);
      setEstado("error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(1, SCAN_CONFIG.CAMERA_MAX_WIDTH / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        setPaginas((p) => [...p, { id: crypto.randomUUID(), dataUrl: canvas.toDataURL("image/jpeg", 0.92) }]);
      };
      img.onerror = () => {
        setError("No se pudo leer la imagen (¿archivo corrupto o formato no soportado?).");
        setEstado("error");
      };
      img.src = reader.result;
    };
    reader.onerror = () => {
      setError("No se pudo leer el archivo seleccionado.");
      setEstado("error");
    };
    reader.readAsDataURL(file);
  }

  function quitarPagina(id) {
    setPaginas((p) => p.filter((pg) => pg.id !== id));
  }

  function cerrar() {
    limpiarTodo();
    onClose();
  }

  return (
    <Modal open={open} onClose={cerrar} title={titulo} maxWidth={720}>
      {estado === "error" && (
        <Banner tone="error">
          <span className="flex items-center gap-1.5"><AlertTriangle size={14} /> {error}</span>
        </Banner>
      )}

      {/* Vista previa de video con guias del documento */}
      {estado === "capturando" && (
        <div className="relative rounded-xl overflow-hidden mb-3" style={{ backgroundColor: "#111" }}>
          <video ref={videoRef} playsInline muted className="w-full" style={{ maxHeight: 380 }} />
          {/* Guias de encuadre del documento */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-6 rounded-lg" style={{ border: "2px dashed rgba(255,255,255,0.65)" }} />
            <div className="absolute left-2 top-2 w-6 h-6" style={{ borderTop: "3px solid #fff", borderLeft: "3px solid #fff", borderRadius: 4 }} />
            <div className="absolute right-2 top-2 w-6 h-6" style={{ borderTop: "3px solid #fff", borderRight: "3px solid #fff", borderRadius: 4 }} />
            <div className="absolute left-2 bottom-2 w-6 h-6" style={{ borderBottom: "3px solid #fff", borderLeft: "3px solid #fff", borderRadius: 4 }} />
            <div className="absolute right-2 bottom-2 w-6 h-6" style={{ borderBottom: "3px solid #fff", borderRight: "3px solid #fff", borderRadius: 4 }} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        {estado !== "capturando" ? (
          <Button onClick={activarCamara}>
            <span className="flex items-center gap-1.5"><Camera size={15} /> Activar cámara</span>
          </Button>
        ) : (
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

      {/* Paginas capturadas */}
      {paginas.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold mb-2" style={{ color: "#888" }}>
            Páginas capturadas ({paginas.length}/{SCAN_CONFIG.MAX_PAGINAS})
          </div>
          <div className="grid grid-cols-4 gap-2">
            {paginas.map((pg, i) => (
              <div key={pg.id} className="relative rounded-lg overflow-hidden group" style={{ border: `1px solid ${COLORS.border}` }}>
                <img src={pg.dataUrl} alt={`Página ${i + 1}`} className="w-full h-24 object-cover" />
                <span className="absolute left-1 top-1 text-[10px] font-bold px-1.5 rounded" style={{ backgroundColor: COLORS.navy, color: "white" }}>{i + 1}</span>
                <button
                  onClick={() => quitarPagina(pg.id)}
                  className="absolute right-1 top-1 rounded-full p-0.5"
                  style={{ backgroundColor: "rgba(0,0,0,0.55)", color: "white" }}
                  aria-label={`Eliminar página ${i + 1}`}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
