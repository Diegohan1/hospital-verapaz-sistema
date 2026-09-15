import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { Banner } from "./Banner";
import { COLORS } from "../styles/tokens";
import { api } from "../services/api";
import { extraerDatosBasicos } from "../utils/ocrDatosBasicos";
import { renderizarPrimeraPaginaPdf } from "../utils/pdfDocumentos";

const POLL_MS = 2500;

// Dev-Mari: para computadoras sin camara — muestra un QR que abre la pagina
// de escaneo en el navegador del telefono (misma red WiFi). El telefono
// genera el PDF con su propia camara y lo sube a una sesion efimera; esta
// pantalla consulta cada POLL_MS si ya llego, y cuando llega corre el mismo
// OCR de datos basicos y entrega el resultado con la misma forma que
// CameraScannerModal (blob + {paginas, nombre, datosBasicos}), para que el
// llamador use un unico manejador sin importar de donde vino el escaneo.
export function EscaneoQRModal({ open, onClose, onConfirmar }) {
  const [sesionId, setSesionId] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [estado, setEstado] = useState("creando"); // creando | esperando | recibiendo | error
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const urlSesion = sesionId ? `${window.location.origin}/escaneo-movil/${sesionId}` : null;

  useEffect(() => {
    if (open) iniciar();
    else limpiar();
    return limpiar;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function limpiar() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    setSesionId(null);
    setQrDataUrl(null);
    setEstado("creando");
    setError(null);
  }

  async function iniciar() {
    setEstado("creando");
    setError(null);
    try {
      const nueva = await api.post("/escaneo-movil/sesiones", {});
      setSesionId(nueva.id);
      const url = `${window.location.origin}/escaneo-movil/${nueva.id}`;
      setQrDataUrl(await QRCode.toDataURL(url, { margin: 1, width: 240 }));
      setEstado("esperando");
      pollRef.current = setInterval(() => verificar(nueva.id), POLL_MS);
    } catch (err) {
      setError(err.message);
      setEstado("error");
    }
  }

  async function verificar(id) {
    try {
      const r = await api.get(`/escaneo-movil/sesiones/${id}/estado`);
      setError(null); // una consulta exitosa borra el error de un intento fallido anterior
      if (r.estado !== "listo") return;
      clearInterval(pollRef.current);
      pollRef.current = null;
      setEstado("recibiendo");

      const blob = await api.getBlob(`/escaneo-movil/sesiones/${id}/pdf`);
      const bytes = await blob.arrayBuffer();
      const { dataUrl } = await renderizarPrimeraPaginaPdf(bytes);
      const datosBasicos = await extraerDatosBasicos([dataUrl]);

      if (onConfirmar) await onConfirmar(blob, { paginas: r.paginas, nombre: r.nombreOriginal, datosBasicos });
      onClose();
    } catch (err) {
      // Un fallo de red pasajero no debe cortar el sondeo; solo se avisa si
      // persiste (el usuario puede cancelar manualmente si tarda demasiado).
      setError(err.message);
    }
  }

  async function cancelar() {
    if (sesionId) {
      try { await api.del(`/escaneo-movil/sesiones/${sesionId}`); } catch { /* la sesion expira sola de todos modos */ }
    }
    onClose();
  }

  return (
    <Modal open={open} onClose={cancelar} title="Escanear con el teléfono" maxWidth={420}>
      {error && <Banner tone="error">{error}</Banner>}

      {estado === "creando" && <p className="text-sm text-center py-8" style={{ color: "#666" }}>Generando código…</p>}

      {(estado === "esperando" || estado === "recibiendo") && qrDataUrl && (
        <div className="flex flex-col items-center gap-3 py-2">
          <img src={qrDataUrl} alt="Código QR para escanear con el teléfono" width={220} height={220} />
          <p className="text-sm text-center" style={{ color: "#666" }}>
            Abra la cámara del teléfono y apunte a este código — debe estar conectado a la misma red WiFi.
          </p>
          <a href={urlSesion} className="text-xs break-all" style={{ color: COLORS.navy }}>{urlSesion}</a>
          {estado === "recibiendo" ? (
            <p className="text-sm font-semibold mt-2" style={{ color: COLORS.navy }}>Recibiendo el documento…</p>
          ) : (
            <p className="text-xs mt-2" style={{ color: "#999" }}>Esperando a que se complete el escaneo desde el teléfono… (vence en 10 min)</p>
          )}
        </div>
      )}

      <div className="mt-4">
        <Button variant="secondary" onClick={cancelar}>Cancelar</Button>
      </div>
    </Modal>
  );
}
