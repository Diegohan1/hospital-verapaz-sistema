import React from "react";
import { COLORS } from "../styles/tokens";

export function FormField({ label, children }) {
  return (
    <div>
      <label className="text-xs font-semibold" style={{ color: "#475066" }}>{label}</label>
      {children}
    </div>
  );
}

const baseClass =
  "w-full mt-1.5 px-3.5 py-2.5 rounded-xl text-sm border transition-all duration-150 outline-none " +
  "focus:ring-2 focus:ring-offset-0";
const baseStyle = { borderColor: COLORS.border, color: COLORS.text };

// El focus ring usa el verde del hospital via CSS var, para no depender del theme de Tailwind
const focusVars = { "--tw-ring-color": "rgba(0, 134, 67, 0.18)" };

export function TextInput(props) {
  return (
    <input
      {...props}
      className={baseClass + " focus:border-navy " + (props.className || "")}
      style={{ ...baseStyle, ...focusVars, ...props.style }}
    />
  );
}

export function Select({ children, ...props }) {
  return (
    <select
      {...props}
      className={baseClass + " focus:border-navy bg-white " + (props.className || "")}
      style={{ ...baseStyle, ...focusVars, ...props.style }}
    >
      {children}
    </select>
  );
}

export function TextArea(props) {
  return (
    <textarea
      {...props}
      className={baseClass + " focus:border-navy " + (props.className || "")}
      style={{ ...baseStyle, ...focusVars, ...props.style }}
    />
  );
}
