import React from "react";
import { Printer } from "lucide-react";
import { Button } from "./Button";
import { COLORS } from "../styles/tokens";
import logoVerapaz from "../assets/logo-verapaz.png";

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

function Campo({ label, valor }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#888" }}>{label}</div>
      <div className="text-sm" style={{ color: "#222" }}>{valor || "—"}</div>
    </div>
  );
}

// Plantilla compartida para facturas de hospital y de farmacia: mismo
// membrete/paleta que la receta, tabla de conceptos con o sin precio
// unitario segun el detalle disponible, y total resaltado.
export function FacturaImprimible({ titulo, numero, fecha, paciente, lineas, total, formaPago, atendidoPor }) {
  const f = new Date(fecha);
  const conDetalle = lineas.some((l) => l.cantidad != null);

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
          <h2 className="text-base font-extrabold uppercase tracking-wide" style={{ color: COLORS.navy }}>{titulo}</h2>
          <div className="flex-1" style={{ borderTop: `1px solid ${COLORS.navy}` }} />
        </div>

        {/* No. / fecha */}
        <div className="flex justify-between text-xs mb-4" style={{ color: "#444" }}>
          <span><strong>No.:</strong> {numero}</span>
          <span><strong>Fecha:</strong> {f.toLocaleDateString()} <strong className="ml-2">Hora:</strong> {f.toLocaleTimeString()}</span>
        </div>

        {/* Cliente */}
        <div className="rounded-lg overflow-hidden mb-4" style={{ border: "1px solid #ccc" }}>
          <Barra>{paciente ? "Datos del cliente" : "Venta de mostrador"}</Barra>
          {paciente ? (
            <div className="grid grid-cols-2 gap-3 p-3">
              <Campo label="Nombre completo" valor={paciente.nombreCompleto} />
              <Campo label="No. de expediente" valor={paciente.historiaClinica} />
              {paciente.dpi && <Campo label="DPI" valor={paciente.dpi} />}
              {formaPago && <Campo label="Forma de pago" valor={formaPago === "efectivo" ? "Efectivo" : "Transferencia"} />}
            </div>
          ) : (
            <div className="p-3 text-sm" style={{ color: "#666" }}>
              Venta sin paciente asociado.
              {formaPago && <> <strong>Forma de pago:</strong> {formaPago === "efectivo" ? "Efectivo" : "Transferencia"}</>}
            </div>
          )}
        </div>

        {/* Conceptos */}
        <div className="rounded-lg overflow-hidden mb-4" style={{ border: "1px solid #ccc" }}>
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: COLORS.navy, color: "white" }}>
                <th className="text-left px-3 py-1.5 text-xs uppercase font-semibold">Concepto</th>
                {conDetalle && <th className="text-right px-3 py-1.5 text-xs uppercase font-semibold">Cant.</th>}
                {conDetalle && <th className="text-right px-3 py-1.5 text-xs uppercase font-semibold">Precio</th>}
                <th className="text-right px-3 py-1.5 text-xs uppercase font-semibold">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l, i) => (
                <tr key={i}>
                  <td className="px-3 py-2" style={{ borderTop: "1px solid #ddd" }}>{l.concepto}</td>
                  {conDetalle && <td className="text-right px-3 py-2" style={{ borderTop: "1px solid #ddd" }}>{l.cantidad ?? ""}</td>}
                  {conDetalle && <td className="text-right px-3 py-2" style={{ borderTop: "1px solid #ddd" }}>{l.precioUnitario != null ? `Q${Number(l.precioUnitario).toFixed(2)}` : ""}</td>}
                  <td className="text-right px-3 py-2" style={{ borderTop: "1px solid #ddd" }}>Q{Number(l.subtotal).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Total */}
        <div
          className="flex justify-between items-center rounded-lg px-4 py-3 mb-6"
          style={{ backgroundColor: "#E5F6EE", border: `1px solid ${COLORS.navy}` }}
        >
          <span className="text-sm font-bold uppercase tracking-wide" style={{ color: COLORS.navy }}>Total</span>
          <span className="text-xl font-extrabold" style={{ color: COLORS.navy }}>Q{Number(total).toFixed(2)}</span>
        </div>

        {atendidoPor && (
          <div className="text-xs mb-4" style={{ color: "#888" }}>Atendido por: {atendidoPor}</div>
        )}

        <p className="text-center text-xs italic" style={{ color: COLORS.navy }}>
          Comprometidos con tu salud, siempre.
        </p>
      </div>
    </div>
  );
}
