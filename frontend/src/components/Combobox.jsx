import React, { useEffect, useRef, useState } from "react";
import { COLORS } from "../styles/tokens";
import { normalizarTexto as normalizar } from "../utils/texto";

// Campo de texto con lista filtrable debajo, agrupada opcionalmente.
// options: [{ value, label, group? }]
export function Combobox({ options, value, onChange, placeholder }) {
  const seleccionada = options.find((o) => o.value === value);
  const [query, setQuery] = useState(seleccionada?.label || "");
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const actual = options.find((o) => o.value === value);
    setQuery(actual?.label || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    function onClickFuera(e) {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false);
    }
    document.addEventListener("mousedown", onClickFuera);
    return () => document.removeEventListener("mousedown", onClickFuera);
  }, []);

  const filtradas = query.trim() === ""
    ? options
    : options.filter((o) => normalizar(`${o.label} ${o.group || ""}`).includes(normalizar(query)));

  const grupos = [];
  for (const opt of filtradas.slice(0, 200)) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.group === (opt.group || "")) ultimo.items.push(opt);
    else grupos.push({ group: opt.group || "", items: [opt] });
  }

  function elegir(opt) {
    onChange(opt.value);
    setQuery(opt.label);
    setAbierto(false);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onFocus={() => setAbierto(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setAbierto(true);
          if (e.target.value === "") onChange("");
        }}
        className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl text-sm border outline-none transition-all duration-150 focus:border-navy focus:ring-2"
        style={{ borderColor: COLORS.border, "--tw-ring-color": "rgba(0, 134, 67, 0.18)" }}
      />
      {abierto && (
        <div
          className="mt-1.5 rounded-xl shadow-lifted overflow-y-auto animate-fade-in"
          style={{ position: "absolute", zIndex: 20, width: "100%", maxHeight: 260, backgroundColor: "white", border: `1px solid ${COLORS.border}` }}
        >
          {filtradas.length === 0 ? (
            <div className="px-3 py-2 text-xs" style={{ color: "#999" }}>Sin resultados.</div>
          ) : (
            grupos.map((g, gi) => (
              <div key={gi}>
                {g.group && (
                  <div className="px-3 pt-2 pb-1 text-xs font-semibold" style={{ color: "#999" }}>{g.group}</div>
                )}
                {g.items.map((opt) => (
                  <div
                    key={opt.value}
                    onClick={() => elegir(opt)}
                    className="px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-100"
                    style={opt.value === value ? { backgroundColor: "#F4F4F7", fontWeight: 600 } : {}}
                  >
                    {opt.label}
                  </div>
                ))}
              </div>
            ))
          )}
          {filtradas.length > 200 && (
            <div className="px-3 py-2 text-xs" style={{ color: "#999" }}>Siga escribiendo para acotar la búsqueda…</div>
          )}
        </div>
      )}
    </div>
  );
}
