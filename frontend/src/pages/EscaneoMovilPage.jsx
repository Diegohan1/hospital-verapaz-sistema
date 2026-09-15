import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Camera, ImagePlus, AlertTriangle, RefreshCw, CheckCircle2, X, Trash2 } from "lucide-react";
import { COLORS } from "../styles/tokens";
import { procesarEscaneoAutomatico } from "../utils/scanProcessing";
import { generarPdfDePaginas, validarPdf, nombreDescarga } from "../utils/pdfDocumentos";
import { api } from "../services/api";

const CAMERA_MAX_WIDTH = 1600;
const MAX_PAGINAS = 30;

function dataUrlDesdeVideo(video, maxWidth) {
  const escala = Math.min(1, maxWidth / video.videoWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * escala);
  canvas.height = Math.round(video.videoHeight * escala);
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.95);
}

function dataUrlDesdeArchivo(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(1, CAMERA_MAX_WIDTH / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(16, Math.round(img.width * escala));
        canvas.height = Math.max(16, Math.round(img.height * escala));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.95));
      };
      img.onerror = () => reject(new Error("No se pudo leer la imagen."));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

function Pantalla({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center" style={{ backgroundColor: "#111" }}>
      <div className="max-w-sm w-full text-white">{children}</div>
    </div>
  );
}

// Dev-Mari: pagina que abre el TELEFONO al escanear el QR desde la
// computadora (EscaneoQRModal). Sin login — el id de sesion en la URL es lo
// que autoriza la subida, como un enlace de un solo uso. Reusa el mismo
// motor de captura (deteccion de bordes/perspectiva) que el escaner
// integrado, pero en una pagina completa pensada para pantalla de celular.
export function EscaneoMovilPage() {
  const { sesionId } = useParams();
  const [valido, setValido] = useState(null); // null=verificando, true/false
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [estado, setEstado] = useState("idle"); // idle | capturando | procesando | error
  const [error, setError] = useState(null);
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [paginas, setPaginas] = useState([]);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    api.get(`/escaneo-movil/sesiones/${sesionId}/info`)
      .then((d) => setValido(!!d.valido))
      .catch(() => setValido(false));
  }, [sesionId]);

  const detenerCamara = useCallback(() => {
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop();
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamaraActiva(false);
  }, []);

  useEffect(() => () => detenerCamara(), [detenerCamara]);

  async function activarCamara() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Este navegador no permite usar la cámara. Use 'Subir imagen'.");
      return;
    }
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
      if (err.name === "NotAllowedError") setError("Permiso de cámara denegado. Habilítelo o use 'Subir imagen'.");
      else if (err.name === "NotFoundError") setError("No se detectó ninguna cámara. Use 'Subir imagen'.");
      else setError("No se pudo iniciar la cámara: " + err.message);
    }
  }

  async function escanearAutomaticamente(dataUrl) {
    if (paginas.length >= MAX_PAGINAS) {
      setError(`Ya alcanzó el máximo de ${MAX_PAGINAS} páginas.`);
      return;
    }
    setEstado("procesando");
    setError(null);
    try {
      const { canvas } = await procesarEscaneoAutomatico(dataUrl, { maxAncho: CAMERA_MAX_WIDTH });
      setPaginas((p) => [...p, { id: crypto.randomUUID(), dataUrl: canvas.toDataURL("image/jpeg", 0.9) }]);
      setEstado(camaraActiva ? "capturando" : "idle");
    } catch (err) {
      setError(err.message || "Error al procesar la captura.");
      setEstado(camaraActiva ? "capturando" : "error");
    }
  }

  function capturarPagina() {
    if (!videoRef.current?.videoWidth) return;
    escanearAutomaticamente(dataUrlDesdeVideo(videoRef.current, CAMERA_MAX_WIDTH));
  }

  async function manejarArchivo(evento) {
    const file = evento.target.files?.[0];
    evento.target.value = "";
    if (!file) return;
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

  async function enviar() {
    setEnviando(true);
    setError(null);
    try {
      const { blob, paginas: total } = await generarPdfDePaginas(paginas.map((p) => p.dataUrl));
      const invalido = validarPdf(blob, total);
      if (invalido) {
        setError(invalido);
        return;
      }
      const fd = new FormData();
      const nombre = nombreDescarga();
      fd.append("documento", new File([blob], nombre, { type: "application/pdf" }));
      fd.append("paginas", String(total));
      fd.append("nombre", nombre);
      await api.post(`/escaneo-movil/sesiones/${sesionId}/subir`, fd);
      detenerCamara();
      setEnviado(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (valido === null) {
    return <Pantalla><RefreshCw size={32} className="animate-spin mx-auto mb-3" /><p>Verificando código…</p></Pantalla>;
  }
  if (!valido) {
    return (
      <Pantalla>
        <AlertTriangle size={32} className="mx-auto mb-3" style={{ color: COLORS.gold }} />
        <p className="font-semibold mb-1">Este código ya no es válido</p>
        <p className="text-sm" style={{ color: "#aaa" }}>Puede haber expirado o ya fue usado. Genere uno nuevo desde la computadora.</p>
      </Pantalla>
    );
  }
  if (enviado) {
    return (
      <Pantalla>
        <CheckCircle2 size={36} className="mx-auto mb-3" style={{ color: COLORS.green }} />
        <p className="font-semibold mb-1">Documento enviado</p>
        <p className="text-sm" style={{ color: "#aaa" }}>Ya puede continuar el registro en la computadora. Puede cerrar esta página.</p>
      </Pantalla>
    );
  }

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: "#111" }}>
      <div className="max-w-md mx-auto text-white">
        <div className="font-semibold text-lg mb-1 flex items-center gap-2"><Camera size={20} /> Escanear expediente</div>
        <p className="text-xs mb-4" style={{ color: "#aaa" }}>
          Tome una foto por cada página. El sistema corrige bordes y perspectiva automáticamente.
        </p>

        {error && (
          <div className="rounded-lg px-3 py-2 mb-3 text-sm" style={{ backgroundColor: "#4a1f1f", color: "#ffb3b3" }}>
            {error}
          </div>
        )}

        {estado === "capturando" && (
          <div className="relative rounded-xl overflow-hidden mb-3">
            <video ref={videoRef} playsInline muted className="w-full" />
            <div className="absolute inset-4 rounded-lg pointer-events-none" style={{ border: "2px dashed rgba(255,255,255,0.65)" }} />
          </div>
        )}

        {estado === "procesando" && (
          <div className="py-10 text-center">
            <RefreshCw size={28} className="animate-spin mx-auto" />
            <p className="text-sm mt-3" style={{ color: "#aaa" }}>Escaneando…</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {estado === "capturando" ? (
            <button onClick={capturarPagina} className="flex-1 min-w-[140px] py-3 rounded-xl font-semibold flex items-center justify-center gap-1.5" style={{ backgroundColor: COLORS.navy, color: "white" }}>
              <Camera size={16} /> Capturar página
            </button>
          ) : (
            !camaraActiva && (
              <button onClick={activarCamara} className="flex-1 min-w-[140px] py-3 rounded-xl font-semibold flex items-center justify-center gap-1.5" style={{ backgroundColor: COLORS.navy, color: "white" }}>
                <Camera size={16} /> Activar cámara
              </button>
            )
          )}
          <button onClick={() => inputRef.current?.click()} className="flex-1 min-w-[140px] py-3 rounded-xl font-semibold flex items-center justify-center gap-1.5" style={{ border: "1px solid #444", color: "white" }}>
            <ImagePlus size={16} /> Subir imagen
          </button>
          <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={manejarArchivo} aria-label="Subir imagen del documento" />
          {camaraActiva && (
            <button onClick={detenerCamara} className="flex-1 min-w-[140px] py-3 rounded-xl font-semibold flex items-center justify-center gap-1.5" style={{ border: "1px solid #444", color: "white" }}>
              <X size={16} /> Detener cámara
            </button>
          )}
        </div>

        {paginas.length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-semibold mb-2" style={{ color: "#aaa" }}>
              Páginas ({paginas.length}/{MAX_PAGINAS})
            </div>
            <div className="grid grid-cols-4 gap-2">
              {paginas.map((pg, i) => (
                <div key={pg.id} className="relative rounded-lg overflow-hidden">
                  <img src={pg.dataUrl} alt={`Página ${i + 1}`} className="w-full h-20 object-cover" />
                  <span className="absolute left-1 top-1 text-[10px] font-bold px-1.5 rounded" style={{ backgroundColor: COLORS.navy, color: "white" }}>{i + 1}</span>
                  <button onClick={() => quitarPagina(pg.id)} className="absolute right-1 top-1 rounded-full p-0.5" style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "white" }} aria-label={`Eliminar página ${i + 1}`}>
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={enviar}
              disabled={enviando}
              className="w-full mt-3 py-3 rounded-xl font-semibold"
              style={{ backgroundColor: COLORS.green, color: "white", opacity: enviando ? 0.7 : 1 }}
            >
              {enviando ? "Enviando…" : `Terminar y enviar (${paginas.length} página${paginas.length === 1 ? "" : "s"})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
