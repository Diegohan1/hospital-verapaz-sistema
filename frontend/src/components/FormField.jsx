import React from "react";
import { X } from "lucide-react";
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

// Campo de busqueda con una "X" que aparece cuando hay texto y lo limpia.
// Se usa en los buscadores de las paginas para que la X siempre funcione.
export function SearchInput({ value, onClear, containerStyle, style, ...props }) {
  return (
    <div className="relative" style={containerStyle}>
      <TextInput
        {...props}
        value={value}
        style={{ paddingRight: value ? 34 : undefined, ...style }}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onClear("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 hover:bg-gray-100"
          style={{ color: "#999" }}
          aria-label="Limpiar búsqueda"
        >
          <X size={15} />
        </button>
      ) : null}
    </div>
  );
}
