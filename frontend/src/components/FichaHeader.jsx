import React from "react";
import { Printer, Camera } from "lucide-react";
import { Button } from "./Button";
import { COLORS } from "../styles/tokens";
import logoVerapaz from "../assets/logo-verapaz.png";

// Encabezado institucional de la ficha: zona de acciones superior (imprimir
// y escanear documento con la cámara, con etiqueta accesible, marcadas como
// no-print) seguida del membrete y los metadatos principales. Se monta
// dentro del area imprimible de FichaPacienteImprimible.
export function FichaHeader({ paciente, onImprimir, onEscanear, puedeEscanear }) {
  const p = paciente || {};
  return (
    <>
      <div className="flex justify-end gap-2 mb-3 no-print">
        {puedeEscanear && (
          <Button variant="secondary" onClick={onEscanear}>
            <span className="flex items-center gap-1.5">
              <Camera size={15} aria-hidden />
              <span aria-label="Escanear documento del paciente con la cámara">Escanear documento</span>
            </span>
          </Button>
        )}
        <Button onClick={onImprimir}>
          <span className="flex items-center gap-1.5">
            <Printer size={15} aria-hidden />
            <span aria-label="Imprimir ficha del paciente">Imprimir</span>
          </span>
        </Button>
      </div>

      <div className="flex items-center gap-3 pb-3 mb-3" style={{ borderBottom: `3px solid ${COLORS.navy}` }}>
        <img src={logoVerapaz} alt="Hospital Verapaz" className="w-12 h-12 rounded-full shrink-0" />
        <div>
          <div className="text-lg font-extrabold leading-tight">
            <span style={{ color: "#3A3A3A" }}>HOSPITAL </span>
            <span style={{ color: COLORS.navy }}>VERAPAZ</span>
          </div>
          <div className="text-[11px]" style={{ color: "#666" }}>Cobán, Alta Verapaz — Sistema de gestión de expediente clínico y administrativo</div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1" style={{ borderTop: `1px solid ${COLORS.navy}` }} />
        <h2 className="text-base font-extrabold uppercase tracking-wide text-center" style={{ color: COLORS.navy }}>
          Ficha general del paciente
          <div className="text-xs font-semibold normal-case" style={{ color: "#888" }}>Hoja de ingreso y egreso</div>
        </h2>
        <div className="flex-1" style={{ borderTop: `1px solid ${COLORS.navy}` }} />
      </div>

      <div className="flex justify-between text-xs mb-4" style={{ color: "#444" }}>
        <span><strong>Historia clínica:</strong> {p.historiaClinica || "—"}</span>
        <span><strong>Fecha de ingreso:</strong> {p.fechaIngreso ? new Date(p.fechaIngreso).toLocaleString() : "—"}</span>
      </div>
    </>
  );
}
