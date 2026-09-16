import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Camera, ImagePlus, AlertTriangle, RefreshCw, CheckCircle2, Trash2 } from "lucide-react";
import { COLORS } from "../styles/tokens";
import { procesarEscaneoAutomatico, idAleatorio } from "../utils/scanProcessing";
import { generarPdfDePaginas, validarPdf, nombreDescarga, esPdf, leerInfoPdf } from "../utils/pdfDocumentos";
import { api } from "../services/api";

const CAMERA_MAX_WIDTH = 1600;
const MAX_PAGINAS = 30;

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
// que autoriza la subida, como un enlace de un solo uso.
//
// Un solo boton "Elegir imagen o PDF" (input de archivo nativo, sin el
// atributo capture): el propio selector del telefono ya ofrece "Camara"
// como una de las fuentes, junto con la galeria y el almacenamiento — no
// hace falta un boton aparte con video en vivo (getUserMedia), que ademas
// requiere HTTPS. Reusa el mismo motor de correccion de bordes/perspectiva
// que el escaner integrado de la computadora.
export function EscaneoMovilPage() {
  const { sesionId } = useParams();
  const [valido, setValido] = useState(null); // null=verificando, true/false
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState(null);
  const [paginas, setPaginas] = useState([]);

  const inputRef = useRef(null);

  useEffect(() => {
    api.get(`/escaneo-movil/sesiones/${sesionId}/info`)
      .then((d) => setValido(!!d.valido))
      .catch(() => setValido(false));
  }, [sesionId]);

  async function escanearAutomaticamente(dataUrl) {
    if (paginas.length >= MAX_PAGINAS) {
      setError(`Ya alcanzó el máximo de ${MAX_PAGINAS} páginas.`);
      return;
    }
    setProcesando(true);
    setError(null);
    try {
      const { canvas } = await Promise.race([
        procesarEscaneoAutomatico(dataUrl, { maxAncho: CAMERA_MAX_WIDTH }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("El procesamiento tardó demasiado; intente de nuevo con mejor luz o más cerca del documento.")), 20000)),
      ]);
      setPaginas((p) => [...p, { id: idAleatorio(), dataUrl: canvas.toDataURL("image/jpeg", 0.85) }]);
    } catch (err) {
      setError(err.message || "Error al procesar la captura.");
    } finally {
      setProcesando(false);
    }
  }

  // Envio final a la sesion: comun para el PDF armado con las paginas
  // capturadas y para un PDF que ya vino listo del almacenamiento.
  async function enviarPdf(blob, totalPaginas) {
    setEnviando(true);
    setError(null);
    try {
      const invalido = validarPdf(blob, totalPaginas);
      if (invalido) {
        setError(invalido);
        return;
      }
      const fd = new FormData();
      const nombre = nombreDescarga();
      fd.append("documento", new File([blob], nombre, { type: "application/pdf" }));
      fd.append("paginas", String(totalPaginas));
      fd.append("nombre", nombre);
      await api.post(`/escaneo-movil/sesiones/${sesionId}/subir`, fd);
      setEnviado(true);
    } catch (err) {
      // No se limpian las paginas ya capturadas: si el envio falla, el
      // usuario puede reintentar sin tener que volver a escanear todo.
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  // Dev-Mari: un PDF elegido del almacenamiento ya es el documento final
  // (por ejemplo, uno que dejo el escaner de una impresora) — no pasa por
  // deteccion de bordes/perspectiva, que es solo para fotos.
  async function manejarArchivoPdf(file) {
    setError(null);
    try {
      const bytes = await file.arrayBuffer();
      const { totalPaginas } = await leerInfoPdf(bytes);
      await enviarPdf(new Blob([bytes], { type: "application/pdf" }), totalPaginas);
    } catch (err) {
      setError("No se pudo leer el PDF (¿está dañado o protegido con contraseña?): " + err.message);
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
    try {
      const dataUrl = await dataUrlDesdeArchivo(file);
      await escanearAutomaticamente(dataUrl);
    } catch (err) {
      setError(err.message);
    }
  }

  function quitarPagina(id) {
    setPaginas((p) => p.filter((pg) => pg.id !== id));
  }

  async function enviar() {
    try {
      const { blob, paginas: total } = await generarPdfDePaginas(paginas.map((p) => p.dataUrl));
      await enviarPdf(blob, total);
    } catch (err) {
      setError(err.message);
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
          Toque el botón: puede elegir "Cámara" para tomar una foto por página, o "Archivos"/"Galería" para un PDF o
          imagen ya guardada. El sistema corrige bordes y perspectiva automáticamente.
        </p>

        {error && (
          <div className="rounded-lg px-3 py-2 mb-3 text-sm" style={{ backgroundColor: "#4a1f1f", color: "#ffb3b3" }}>
            {error}
          </div>
        )}

        {procesando && (
          <div className="py-10 text-center">
            <RefreshCw size={28} className="animate-spin mx-auto" />
            <p className="text-sm mt-3" style={{ color: "#aaa" }}>Escaneando…</p>
          </div>
        )}

        <button
          onClick={() => inputRef.current?.click()}
          disabled={procesando}
          className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-1.5"
          style={{ backgroundColor: COLORS.navy, color: "white", opacity: procesando ? 0.7 : 1 }}
        >
          <ImagePlus size={16} /> Elegir imagen o PDF
        </button>
        <input ref={inputRef} type="file" accept="image/*,.pdf,application/pdf" className="hidden" onChange={manejarArchivo} aria-label="Elegir imagen o PDF del almacenamiento" />

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
