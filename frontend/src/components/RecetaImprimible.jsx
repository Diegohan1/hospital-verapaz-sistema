import React from "react";
import { Printer } from "lucide-react";
import { Button } from "./Button";
import { COLORS } from "../styles/tokens";
import { fechaDia } from "../utils/fechas";
import logoVerapaz from "../assets/logo-verapaz.png";

function Campo({ label, valor }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#888" }}>{label}</div>
      <div className="text-sm" style={{ color: "#222" }}>{valor || "—"}</div>
    </div>
  );
}

function Barra({ children }) {
  return (
    <div
      className="text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-t-lg"
      style={{ backgroundColor: COLORS.navy, color: "white" }}
    >
      {children}
    </div>
  );
}

// Plantilla de receta medica: reproduce el formato de membrete que definio
// el hospital (encabezado + datos del paciente + Rp/ + indicaciones +
// tabla de medicamento + firma y sello), poblada con los datos reales de
// la receta en vez de dejarla en blanco para llenar a mano.
export function RecetaImprimible({ receta, patient }) {
  const fecha = new Date(receta.creadoEn);

  return (
    <div>
      <div className="no-print flex justify-end mb-3">
        <Button onClick={() => window.print()}>
          <span className="flex items-center gap-1.5"><Printer size={15} /> Imprimir</span>
        </Button>
      </div>

      <div id="printable-area" className="text-black" style={{ fontSize: 13 }}>
        {/* Membrete */}
        <div className="flex items-center gap-3 pb-3 mb-3" style={{ borderBottom: `3px solid ${COLORS.navy}` }}>
          <img src={logoVerapaz} alt="" className="w-12 h-12 rounded-full shrink-0" />
          <div>
            <div className="text-lg font-extrabold leading-tight">
              <span style={{ color: "#3A3A3A" }}>HOSPITAL </span>
              <span style={{ color: COLORS.navy }}>VERAPAZ</span>
            </div>
            <div className="text-[11px]" style={{ color: "#666" }}>Cobán, Alta Verapaz — Sistema de gestión de expediente clínico y administrativo</div>
          </div>
        </div>

        {/* Titulo */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1" style={{ borderTop: `1px solid ${COLORS.navy}` }} />
          <h2 className="text-base font-extrabold uppercase tracking-wide" style={{ color: COLORS.navy }}>Receta médica</h2>
          <div className="flex-1" style={{ borderTop: `1px solid ${COLORS.navy}` }} />
        </div>

        {/* Fecha / hora */}
        <div className="flex justify-between text-xs mb-4" style={{ color: "#444" }}>
          <span><strong>Fecha:</strong> {fecha.toLocaleDateString()}</span>
          <span><strong>Hora:</strong> {fecha.toLocaleTimeString()}</span>
        </div>

        {/* Datos del paciente */}
        <div className="rounded-lg overflow-hidden mb-4" style={{ border: "1px solid #ccc" }}>
          <Barra>Datos del paciente</Barra>
          <div className="grid grid-cols-2 gap-3 p-3">
            <Campo label="Nombre completo" valor={patient?.nombreCompleto} />
            <Campo label="No. de expediente" valor={patient?.historiaClinica} />
            <Campo label="Edad" valor={patient?.edad != null ? `${patient.edad} años` : null} />
            <Campo label="Sexo" valor={patient?.sexo} />
            <Campo label="Teléfono" valor={patient?.telefono} />
            <Campo label="Fecha de nacimiento" valor={fechaDia(patient?.fechaNacimiento)} />
            <Campo label="DPI" valor={patient?.dpi} />
            <div className="col-span-2"><Campo label="Dirección" valor={patient?.direccion} /></div>
          </div>
        </div>

        {/* Rp/ + indicaciones + frecuencia */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div
            className="col-span-2 rounded-lg p-4"
            style={{ border: "1px solid #ccc", minHeight: 130 }}
          >
            <div className="text-xl font-extrabold mb-2" style={{ color: COLORS.navy }}>Rp/</div>
            <div className="font-bold text-sm mb-1">{receta.medicamento}</div>
            {receta.dosis && <div className="text-sm">{receta.dosis}</div>}
          </div>
          <div className="flex flex-col gap-3">
            <div className="rounded-lg overflow-hidden flex-1" style={{ border: "1px solid #ccc" }}>
              <Barra>Indicaciones</Barra>
              <div className="p-3 text-sm">{receta.indicaciones || "—"}</div>
            </div>
            <div className="rounded-lg overflow-hidden" style={{ border: "1px solid #ccc" }}>
              <Barra>Duración</Barra>
              <div className="p-3 text-sm">{receta.duracion || "—"}</div>
            </div>
          </div>
        </div>

        {/* Tabla de medicamento */}
        <div className="rounded-lg overflow-hidden mb-6" style={{ border: "1px solid #ccc" }}>
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: COLORS.navy, color: "white" }}>
                <th className="text-left px-3 py-1.5 text-xs uppercase font-semibold">Medicamento</th>
                <th className="text-left px-3 py-1.5 text-xs uppercase font-semibold">Dosis</th>
                <th className="text-left px-3 py-1.5 text-xs uppercase font-semibold">Duración</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-3 py-2" style={{ borderTop: "1px solid #ddd" }}>{receta.medicamento}</td>
                <td className="px-3 py-2" style={{ borderTop: "1px solid #ddd" }}>{receta.dosis || "—"}</td>
                <td className="px-3 py-2" style={{ borderTop: "1px solid #ddd" }}>{receta.duracion || "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Firma y sello */}
        <div className="grid grid-cols-2 gap-6 mb-5">
          <div className="text-center">
            <div style={{ borderTop: "1px solid #999", paddingTop: 6 }}>
              <div className="text-sm font-semibold">{receta.medico?.nombre}</div>
              {(receta.medico?.colegiado || receta.medico?.especialidad) && (
                <div className="text-[10px]" style={{ color: "#666" }}>
                  {[
                    receta.medico?.colegiado && `Colegiado No. ${receta.medico.colegiado}`,
                    receta.medico?.especialidad,
                  ].filter(Boolean).join(" · ")}
                </div>
              )}
              <div className="text-[10px] uppercase tracking-wide" style={{ color: "#888" }}>Firma y sello del médico</div>
            </div>
          </div>
          <div
            className="rounded-lg flex items-center justify-center text-[10px] uppercase tracking-wide"
            style={{ border: "1px dashed #bbb", color: "#aaa", minHeight: 50 }}
          >
            Sello del hospital
          </div>
        </div>

        <p className="text-center text-xs italic" style={{ color: COLORS.navy }}>
          Comprometidos con tu salud, siempre.
        </p>
      </div>
    </div>
  );
}
