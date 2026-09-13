import React from "react";
import { Download, Trash2, FileText } from "lucide-react";
import { FichaHeader } from "./FichaHeader";
import { FichaSeccion } from "./FichaSeccion";
import { FichaCampo } from "./FichaCampo";
import { COLORS } from "../styles/tokens";
import { etiquetaCondicionEgreso } from "../utils/condicionesEgreso";

function tamanoLegible(bytes) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Ficha general del paciente (RF-09), reorganizada en secciones logicas
// con orden clinico-administrativo de lectura:
//   1) identificacion  2) demograficos  3) contacto  4) familiar
//   5) emergencia      6) encargado legal  7) ingreso  8) egreso
//   9) maternidad     10) firmas
// Sprint 2 (Cambios2): el orden de impresion coincide con el de pantalla;
// emergencia y encargado legal son secciones separadas y diferenciadas.
// La seccion de documentos escaneados es solo pantalla (no-print).
export function FichaPacienteImprimible({
  paciente,
  puedeEscanear,
  onEscanear,
  documentos,
  onDescargarDocumento,
  onEliminarDocumento,
}) {
  const p = paciente;
  // El egreso clinico llega cifrado como objeto egresoClinico; los campos
  // planos legacy son fallback de datos registrados antes del cifrado.
  const eg = p.egresoClinico || {};
  const diagnosticoEgreso = eg.diagnosticoEgreso ?? p.diagnosticoEgresoCodigo;
  const complicaciones = eg.complicaciones ?? p.complicacionesCodigo;
  const operaciones = eg.operaciones ?? p.operacionesCodigo;
  const autopsia = eg.autopsia ?? p.autopsia;
  const causaMuerte = eg.causaMuerte ?? p.causaMuerte;

  const tieneEgreso = p.fechaEgreso || p.condicionEgreso || diagnosticoEgreso || complicaciones || operaciones || causaMuerte;
  const tieneMaternidad = p.maternidad && (p.maternidad.numeroHijo || p.maternidad.fecha || p.maternidad.sexo || p.maternidad.condicionEgresoBebe);
  const tieneEmergencia = p.contactoEmergencia || p.telefonoEmergencia || p.parentesco;
  const tieneEncargado = p.encargadoNombre || p.encargadoTelefono;

  return (
    <div id="printable-area" className="text-black" style={{ fontSize: 13 }}>
      <FichaHeader paciente={p} onImprimir={() => window.print()} puedeEscanear={puedeEscanear} onEscanear={onEscanear} />

      {/* 1. Identificacion del paciente */}
      <FichaSeccion titulo="Identificación del paciente">
        <div className="grid grid-cols-3 gap-3">
          <FichaCampo label="Nombre completo" valor={p.nombreCompleto} colSpan={2} />
          <FichaCampo label="DPI / CUI" valor={p.dpi} />
        </div>
      </FichaSeccion>

      {/* 2. Datos demograficos */}
      <FichaSeccion titulo="Datos demográficos">
        <div className="grid grid-cols-5 gap-3">
          <FichaCampo label="Fecha de nacimiento" valor={p.fechaNacimiento} formato="fecha" />
          <FichaCampo label="Edad" valor={p.edad != null ? `${p.edad} años` : null} />
          <FichaCampo label="Sexo" valor={p.sexo} />
          <FichaCampo label="Tipo de sangre" valor={p.tipoSangre} />
          <FichaCampo label="Nacionalidad" valor={p.nacionalidad} />
        </div>
      </FichaSeccion>

      {/* 3. Datos de contacto */}
      <FichaSeccion titulo="Datos de contacto">
        <div className="grid grid-cols-3 gap-3">
          <FichaCampo label="Teléfono" valor={p.telefono} />
          <FichaCampo label="Estado civil" valor={p.estadoCivil} />
          <FichaCampo label="Ocupación" valor={p.ocupacion} />
          <FichaCampo label="Lugar de nacimiento" valor={p.lugarNacimiento} />
          <FichaCampo label="Religión" valor={p.religion} />
          <FichaCampo label="Dirección" valor={p.direccion} />
        </div>
      </FichaSeccion>

      {/* 4. Informacion familiar */}
      <FichaSeccion titulo="Información familiar">
        <div className="grid grid-cols-3 gap-3">
          <FichaCampo label="Nombre del cónyuge" valor={p.nombreConyuge} />
          <FichaCampo label="Nombre del padre" valor={p.nombrePadre} />
          <FichaCampo label="Nombre de la madre" valor={p.nombreMadre} />
        </div>
      </FichaSeccion>

      {/* 5. Contacto de emergencia (separado del encargado legal) */}
      {tieneEmergencia && (
        <FichaSeccion titulo="En caso de emergencia notificar">
          <div className="grid grid-cols-3 gap-3">
            <FichaCampo label="Nombre del contacto" valor={p.contactoEmergencia} />
            <FichaCampo label="Teléfono" valor={p.telefonoEmergencia} />
            <FichaCampo label="Parentesco" valor={p.parentesco} />
          </div>
        </FichaSeccion>
      )}

      {/* 6. Encargado / responsable legal (no mezclar con emergencia) */}
      {tieneEncargado && (
        <FichaSeccion titulo="Encargado / responsable legal">
          <div className="grid grid-cols-2 gap-3">
            <FichaCampo label="Nombre del encargado" valor={p.encargadoNombre} />
            <FichaCampo label="Teléfono del encargado" valor={p.encargadoTelefono} />
          </div>
        </FichaSeccion>
      )}

      {/* 7. Ingreso */}
      <FichaSeccion titulo="Ingreso">
        <div className="grid grid-cols-3 gap-3">
          <FichaCampo label="Fecha y hora de ingreso" valor={p.fechaIngreso} formato="fechaHora" />
          <FichaCampo label="Servicios solicitados" valor={p.serviciosSolicitados} />
          <FichaCampo label="Referido de" valor={p.referidoDe} />
          <FichaCampo label="Impresión clínica de ingreso" valor={p.impresionClinicaIngreso} colSpan={3} />
        </div>
      </FichaSeccion>

      {/* 8. Egreso */}
      {tieneEgreso && (
        <FichaSeccion titulo="Egreso">
          <div className="grid grid-cols-2 gap-3">
            <FichaCampo label="Fecha y hora de egreso" valor={p.fechaEgreso} formato="fechaHora" />
            <FichaCampo label="Condición de egreso" valor={p.condicionEgreso ? etiquetaCondicionEgreso(p.condicionEgreso) : null} />
            <FichaCampo label="Diagnóstico de egreso (CIE-10)" valor={diagnosticoEgreso} />
            <FichaCampo label="Complicaciones (CIE-10)" valor={complicaciones} />
            <FichaCampo label="Operaciones" valor={operaciones} />
            <FichaCampo label="Autopsia" valor={autopsia == null ? null : autopsia ? "Sí" : "No"} />
            {causaMuerte && <FichaCampo label="Causa de la muerte" valor={causaMuerte} colSpan={2} />}
          </div>
        </FichaSeccion>
      )}

      {/* 9. Maternidad */}
      {tieneMaternidad && (
        <FichaSeccion titulo="Maternidad">
          <div className="grid grid-cols-4 gap-3">
            <FichaCampo label="No. de hijo" valor={p.maternidad.numeroHijo} />
            <FichaCampo label="Fecha de nacimiento" valor={p.maternidad.fecha} formato="fecha" />
            <FichaCampo label="Hora" valor={p.maternidad.hora} />
            <FichaCampo label="Sexo" valor={p.maternidad.sexo} />
            <FichaCampo label="Condición de egreso del bebé" valor={p.maternidad.condicionEgresoBebe} colSpan={4} />
          </div>
        </FichaSeccion>
      )}

      {/* 10. Firmas y sello */}
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

      {/* Documentos escaneados del paciente (solo pantalla, no se imprime) */}
      {(puedeEscanear || (documentos || []).length > 0) && (
        <div className="no-print mt-4 rounded-xl overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
          <div
            className="text-xs font-bold uppercase tracking-wide px-3 py-2"
            style={{ backgroundColor: COLORS.lightBg, color: COLORS.text }}
          >
            Documentos escaneados del paciente
          </div>
          <div className="p-3 flex flex-col gap-2">
            {(documentos || []).length === 0 && (
              <p className="text-sm" style={{ color: "#888" }}>Este paciente aún no tiene documentos escaneados.</p>
            )}
            {(documentos || []).map((d) => (
              <div key={d.id} className="flex items-center gap-3 justify-between flex-wrap text-sm">
                <span className="flex items-center gap-2 min-w-0">
                  <FileText size={15} style={{ color: COLORS.navy }} className="shrink-0" />
                  <span className="font-semibold truncate">{d.nombreOriginal}</span>
                  <span className="text-xs" style={{ color: "#999" }}>
                    {d.paginas} pág. · {tamanoLegible(d.tamano)} · {new Date(d.creadoEn).toLocaleDateString()}
                  </span>
                </span>
                <span className="flex gap-1">
                  {onDescargarDocumento && (
                    <button onClick={() => onDescargarDocumento(d)} className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg" style={{ color: COLORS.navy }} aria-label={`Descargar ${d.nombreOriginal}`}>
                      <Download size={13} /> Abrir
                    </button>
                  )}
                  {onEliminarDocumento && (
                    <button onClick={() => onEliminarDocumento(d)} className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg" style={{ color: COLORS.red }} aria-label={`Eliminar ${d.nombreOriginal}`}>
                      <Trash2 size={13} /> Eliminar
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
