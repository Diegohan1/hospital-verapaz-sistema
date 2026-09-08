import React from "react";
import { Printer } from "lucide-react";
import { Button } from "./Button";
import { COLORS } from "../styles/tokens";
import { etiquetaCondicionEgreso } from "../utils/condicionesEgreso";
import logoVerapaz from "../assets/logo-verapaz.png";

function Barra({ children }) {
  return (
    <div className="text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-t-lg" style={{ backgroundColor: COLORS.navy, color: "white" }}>
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

function fecha(v) { return v ? new Date(v).toLocaleDateString() : null; }
function fechaHora(v) { return v ? new Date(v).toLocaleString() : null; }

// Ficha general del paciente (RF-09): junta los datos generales de admision
// con lo que se haya capturado en la pestaña Ingreso/Egreso, en el mismo
// formato de la hoja fisica que usa el hospital.
export function FichaPacienteImprimible({ paciente }) {
  const p = paciente;
  // Sprint 3: el egreso clinico llega cifrado como objeto egresoClinico; los
  // campos planos legacy son fallback de datos registrados antes del cifrado.
  const eg = p.egresoClinico || {};
  const diagnosticoEgreso = eg.diagnosticoEgreso ?? p.diagnosticoEgresoCodigo;
  const complicaciones = eg.complicaciones ?? p.complicacionesCodigo;
  const operaciones = eg.operaciones ?? p.operacionesCodigo;
  const autopsia = eg.autopsia ?? p.autopsia;
  const causaMuerte = eg.causaMuerte ?? p.causaMuerte;
  const tieneEgreso = p.fechaEgreso || p.condicionEgreso || diagnosticoEgreso || complicaciones || operaciones || causaMuerte;
  const tieneMaternidad = p.maternidad && (p.maternidad.numeroHijo || p.maternidad.fecha || p.maternidad.sexo || p.maternidad.condicionEgresoBebe);

  return (
    <div>
      <div className="no-print flex justify-end mb-3">
        <Button onClick={() => window.print()}>
          <span className="flex items-center gap-1.5"><Printer size={15} /> Imprimir</span>
        </Button>
      </div>

      <div id="printable-area" className="text-black" style={{ fontSize: 13 }}>
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

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1" style={{ borderTop: `1px solid ${COLORS.navy}` }} />
          <h2 className="text-base font-extrabold uppercase tracking-wide text-center" style={{ color: COLORS.navy }}>
            Ficha general del paciente
            <div className="text-xs font-semibold normal-case" style={{ color: "#888" }}>Hoja de ingreso y egreso</div>
          </h2>
          <div className="flex-1" style={{ borderTop: `1px solid ${COLORS.navy}` }} />
        </div>

        <div className="flex justify-between text-xs mb-4" style={{ color: "#444" }}>
          <span><strong>Historia clínica:</strong> {p.historiaClinica}</span>
          <span><strong>Fecha de ingreso:</strong> {fechaHora(p.fechaIngreso) || "—"}</span>
        </div>

        <div className="rounded-lg overflow-hidden mb-4" style={{ border: "1px solid #ccc" }}>
          <Barra>Datos generales</Barra>
          <div className="grid grid-cols-3 gap-3 p-3">
            <div className="col-span-2"><Campo label="Nombre completo" valor={p.nombreCompleto} /></div>
            <Campo label="DPI" valor={p.dpi} />
            <Campo label="Edad" valor={p.edad != null ? `${p.edad} años` : null} />
            <Campo label="Sexo" valor={p.sexo} />
            <Campo label="Tipo de sangre" valor={p.tipoSangre} />
            <Campo label="Fecha de nacimiento" valor={fecha(p.fechaNacimiento)} />
            <Campo label="Estado civil" valor={p.estadoCivil} />
            <Campo label="Ocupación" valor={p.ocupacion} />
            <Campo label="Religión" valor={p.religion} />
            <Campo label="Teléfono" valor={p.telefono} />
            <Campo label="Nacionalidad" valor={p.nacionalidad} />
            <div className="col-span-2"><Campo label="Lugar de nacimiento" valor={p.lugarNacimiento} /></div>
            <div className="col-span-3"><Campo label="Dirección" valor={p.direccion} /></div>
            <Campo label="Nombre del cónyuge" valor={p.nombreConyuge} />
            <Campo label="Nombre del padre" valor={p.nombrePadre} />
            <Campo label="Nombre de la madre" valor={p.nombreMadre} />
          </div>
        </div>

        <div className="rounded-lg overflow-hidden mb-4" style={{ border: "1px solid #ccc" }}>
          <Barra>En caso de emergencia notificar</Barra>
          <div className="grid grid-cols-3 gap-3 p-3">
            <Campo label="Nombre" valor={p.contactoEmergencia} />
            <Campo label="Teléfono" valor={p.telefonoEmergencia} />
            <Campo label="Parentesco" valor={p.parentesco} />
          </div>
        </div>

        {(p.encargadoNombre || p.encargadoTelefono) && (
          <div className="rounded-lg overflow-hidden mb-4" style={{ border: "1px solid #ccc" }}>
            <Barra>Encargado / responsable legal</Barra>
            <div className="grid grid-cols-2 gap-3 p-3">
              <Campo label="Nombre" valor={p.encargadoNombre} />
              <Campo label="Teléfono" valor={p.encargadoTelefono} />
            </div>
          </div>
        )}

        <div className="rounded-lg overflow-hidden mb-4" style={{ border: "1px solid #ccc" }}>
          <Barra>Ingreso</Barra>
          <div className="grid grid-cols-2 gap-3 p-3">
            <Campo label="Servicios solicitados" valor={p.serviciosSolicitados} />
            <Campo label="Referido de" valor={p.referidoDe} />
            <div className="col-span-2"><Campo label="Impresión clínica de ingreso" valor={p.impresionClinicaIngreso} /></div>
          </div>
        </div>

        {tieneEgreso && (
          <div className="rounded-lg overflow-hidden mb-4" style={{ border: "1px solid #ccc" }}>
            <Barra>Egreso</Barra>
            <div className="grid grid-cols-2 gap-3 p-3">
              <Campo label="Fecha de egreso" valor={fechaHora(p.fechaEgreso)} />
              <Campo label="Condición de egreso" valor={p.condicionEgreso ? etiquetaCondicionEgreso(p.condicionEgreso) : null} />
              <Campo label="Diagnóstico de egreso (CIE-10)" valor={diagnosticoEgreso} />
              <Campo label="Complicaciones (CIE-10)" valor={complicaciones} />
              <Campo label="Operaciones" valor={operaciones} />
              <Campo label="Autopsia" valor={autopsia == null ? null : autopsia ? "Sí" : "No"} />
              {causaMuerte && <div className="col-span-2"><Campo label="Causa de la muerte" valor={causaMuerte} /></div>}
            </div>
          </div>
        )}

        {tieneMaternidad && (
          <div className="rounded-lg overflow-hidden mb-4" style={{ border: "1px solid #ccc" }}>
            <Barra>Maternidad</Barra>
            <div className="grid grid-cols-4 gap-3 p-3">
              <Campo label="No. de hijo" valor={p.maternidad.numeroHijo} />
              <Campo label="Fecha de nacimiento" valor={fecha(p.maternidad.fecha)} />
              <Campo label="Hora" valor={p.maternidad.hora} />
              <Campo label="Sexo" valor={p.maternidad.sexo} />
              <div className="col-span-4"><Campo label="Condición de egreso del bebé" valor={p.maternidad.condicionEgresoBebe} /></div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-6 mt-8 mb-5">
          <div className="text-center">
            <div style={{ borderTop: "1px solid #999", paddingTop: 6 }}>
              <div className="text-[10px] uppercase tracking-wide" style={{ color: "#888" }}>Firma del médico</div>
            </div>
          </div>
          <div className="text-center">
            <div style={{ borderTop: "1px solid #999", paddingTop: 6 }}>
              <div className="text-[10px] uppercase tracking-wide" style={{ color: "#888" }}>Sello del hospital</div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs italic" style={{ color: COLORS.navy }}>
          Comprometidos con tu salud, siempre.
        </p>
      </div>
    </div>
  );
}
