import React, { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { TextInput } from "./FormField";
import { Pagination } from "./Pagination";
import { Table } from "./Table";
import { usePaginatedFetch } from "../hooks/usePaginatedFetch";
import { api } from "../services/api";
import { COLORS } from "../styles/tokens";

const ANCHO_BUSCADOR = 420;

// Busqueda de paciente por nombre, DPI o historia clinica, con resultados
// del servidor (no una lista completa cargada de una vez): pensado para
// cuando el volumen de pacientes crece y ya no cabe en un <select> simple.
//
// mostrarListado=true agrega, mientras no haya paciente elegido y el campo
// este vacio, un directorio paginado con TODOS los pacientes visible en la
// pagina (no un dropdown flotante) — asi se puede elegir hojeando en vez de
// escribir, y solo hace falta buscar cuando ya hay demasiados para hojear.
// permitirVacio=true agrega una "x" para quitar la seleccion sin elegir a
// nadie mas (ej. una venta de farmacia sin paciente asociado).
export function PacienteBuscador({ pacienteSeleccionado, onSelect, permitirVacio = false, mostrarListado = false, placeholder = "Buscar por nombre, DPI o historia clínica…" }) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    setQuery(pacienteSeleccionado ? `${pacienteSeleccionado.nombreCompleto} — ${pacienteSeleccionado.historiaClinica}` : "");
  }, [pacienteSeleccionado?.id]);

  useEffect(() => {
    function onClickFuera(e) {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false);
    }
    document.addEventListener("mousedown", onClickFuera);
    return () => document.removeEventListener("mousedown", onClickFuera);
  }, []);

  useEffect(() => {
    if (!abierto || query.trim().length < 2) { setResultados([]); return; }
    setBuscando(true);
    const timeout = setTimeout(() => {
      api.get(`/pacientes?buscar=${encodeURIComponent(query)}`)
        .then(setResultados)
        .catch(() => setResultados([]))
        .finally(() => setBuscando(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, abierto]);

  // Directorio paginado: solo mientras no hay seleccion y el campo esta
  // vacio (en cuanto se escribe algo, manda al dropdown de busqueda de arriba).
  const modoDirectorio = mostrarListado && !pacienteSeleccionado && query.trim().length === 0;
  const directorio = usePaginatedFetch(modoDirectorio ? "/pacientes" : null, { pageSize: 8 });

  function elegir(p) {
    onSelect(p);
    setQuery(`${p.nombreCompleto} — ${p.historiaClinica}`);
    setAbierto(false);
  }

  function limpiar() {
    onSelect(null);
    setQuery("");
    setAbierto(false);
  }

  return (
    <div ref={ref}>
      <div style={{ position: "relative", maxWidth: ANCHO_BUSCADOR }}>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#999" }} />
          <TextInput
            value={query}
            placeholder={permitirVacio ? "Sin paciente — buscar por nombre, DPI o historia clínica…" : placeholder}
            style={{ paddingLeft: 32, paddingRight: query ? 32 : undefined }}
            onFocus={() => setAbierto(true)}
            onChange={(e) => { setQuery(e.target.value); setAbierto(true); }}
          />
          {query && (
            <button
              type="button"
              onClick={limpiar}
              className="absolute right-2.5 top-1/2 -translate-y-1/2"
              style={{ color: "#999" }}
              aria-label={pacienteSeleccionado ? "Quitar paciente" : "Limpiar búsqueda"}
            >
              <X size={15} />
            </button>
          )}
        </div>

        {abierto && (query.trim().length >= 2) && (
          <div
            className="mt-1.5 rounded-xl shadow-lifted overflow-y-auto animate-fade-in"
            style={{ position: "absolute", zIndex: 20, width: "100%", minWidth: 300, maxHeight: 280, backgroundColor: "white", border: `1px solid ${COLORS.border}` }}
          >
            {buscando ? (
              <div className="px-3 py-2 text-xs" style={{ color: "#999" }}>Buscando…</div>
            ) : resultados.length === 0 ? (
              <div className="px-3 py-2 text-xs" style={{ color: "#999" }}>Sin pacientes que coincidan.</div>
            ) : (
              resultados.map((p) => (
                <div key={p.id} onClick={() => elegir(p)} className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100">
                  <div className="font-semibold">{p.nombreCompleto}</div>
                  <div className="text-xs" style={{ color: "#888" }}>{p.historiaClinica} · DPI {p.dpi}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {modoDirectorio && (
        <div className="mt-3 animate-fade-in">
          <div className="text-xs mb-2" style={{ color: "#999" }}>
            Todos los pacientes — haga clic en una fila para seleccionar, o escriba arriba para buscar
          </div>
          <Table
            headers={["Historia clínica", "Nombre", "DPI", "Edad", "Sexo", "Sangre"]}
            rows={directorio.loading ? [] : directorio.items}
            emptyMessage={directorio.loading ? "Cargando…" : "No hay pacientes registrados."}
            onRowClick={elegir}
            renderRow={(p) => (
              <>
                <td className="px-4 py-3">{p.historiaClinica}</td>
                <td className="px-4 py-3 font-semibold">{p.nombreCompleto}</td>
                <td className="px-4 py-3">{p.dpi}</td>
                <td className="px-4 py-3">{p.edad ?? "—"}</td>
                <td className="px-4 py-3">{p.sexo ?? "—"}</td>
                <td className="px-4 py-3">{p.tipoSangre ?? "—"}</td>
              </>
            )}
          />
          <Pagination page={directorio.page} totalPages={directorio.totalPages} total={directorio.total} onChange={directorio.setPage} />
        </div>
      )}
    </div>
  );
}
