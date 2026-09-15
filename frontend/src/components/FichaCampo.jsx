import React from "react";

// Clases literales para que Tailwind las detecte en el escaneo de código
const COL_SPAN = { 2: "col-span-2", 3: "col-span-3", 4: "col-span-4" };

// Etiqueta + valor de un campo de la ficha. Estado vacío visible ("—"),
// sin huecos ambiguos. `formato` aplica parseo de fecha local consistente.
export function FichaCampo({ label, valor, formato = "texto", colSpan }) {
  let texto = valor;
  if (formato === "fecha" && valor) texto = new Date(valor).toLocaleDateString();
  if (formato === "fechaHora" && valor) texto = new Date(valor).toLocaleString();
  if (valor === 0) texto = 0; // no tratar cero como vacío

  return (
    <div className={COL_SPAN[colSpan]}>
      <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#888" }}>{label}</div>
      <div className="text-sm" style={{ color: "#222" }}>{texto == null || texto === "" ? "—" : texto}</div>
    </div>
  );
}
