// Design tokens del sistema (paleta hospital: verde institucional/dorado, con neutrales de apoyo)
// "navy" se mantiene como nombre de la clave (usada en todo el frontend) pero
// es el verde institucional #008643 definido por el hospital.
// Contraste (WCAG 2.1 AA): blanco sobre #008643 = 4.7:1 (texto normal OK);
// blanco sobre #006B36 (navyDark) = 6.6:1. navyLight (#00A257) es solo para
// acentos/hover grandes, no para texto normal sobre blanco.
export const COLORS = {
  navy: "#008643",
  navyDark: "#006B36",
  navyLight: "#00A257",
  gold: "#B08B2E",
  goldLight: "#D4AF54",
  lightBg: "#F2F4F8",
  surface: "#FFFFFF",
  border: "#E4E7EE",
  red: "#B94A3D",
  green: "#008643",
  teal: "#1C7373",
  text: "#1A2233",
  textMuted: "#6B7280",
};
