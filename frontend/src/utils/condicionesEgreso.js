// Compartido entre el formulario de Ingreso/Egreso (RegistroPage) y el
// dashboard de Reportes, para que el codigo guardado en condicionEgreso y su
// etiqueta en español esten en un solo lugar.
export const CONDICIONES_EGRESO = [
  { value: "curado", label: "Curado" },
  { value: "contraindicado", label: "Contra indicado" },
  { value: "referido", label: "Referido a otra institución" },
  { value: "mejorado", label: "Mejorado" },
  { value: "fallecido_antes_48", label: "Fallecido antes de 48 horas" },
  { value: "fallecido_despues_48", label: "Fallecido después de 48 horas" },
];

export const CONDICIONES_EGRESO_BEBE = [
  { value: "curado", label: "Egreso curado" },
  { value: "contraindicado", label: "Contraindicado" },
  { value: "referido", label: "Referido a otra institución" },
  { value: "mejorado", label: "Mejorado" },
  { value: "diagnosticado", label: "Diagnosticado" },
  { value: "fallecido_antes_48", label: "Muerto antes de 48 horas" },
  { value: "fallecido_despues_48", label: "Muerto después de 48 horas" },
];

export function etiquetaCondicionEgreso(value) {
  return CONDICIONES_EGRESO.find((c) => c.value === value)?.label || value;
}
