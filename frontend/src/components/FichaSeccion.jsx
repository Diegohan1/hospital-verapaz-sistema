import React from "react";
import { COLORS } from "../styles/tokens";

// Sección reutilizable de la ficha: barra de título institucional + caja
// bordeada con el contenido. El orden visual es siempre barra -> contenido.
export function FichaSeccion({ titulo, children, accion }) {
  return (
    <div className="rounded-lg overflow-hidden mb-4" style={{ border: "1px solid #ccc" }}>
      <div className="flex items-center justify-between gap-2">
        <div
          className="text-xs font-bold uppercase tracking-wide px-3 py-1.5"
          style={{ backgroundColor: COLORS.navy, color: "white" }}
        >
          {titulo}
        </div>
        {accion && <div className="pr-3">{accion}</div>}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}
