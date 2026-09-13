import React from "react";
import { CheckCircle2, Info, AlertTriangle } from "lucide-react";
import { COLORS } from "../styles/tokens";

const TONES = {
  success: { bg: "#E5F6EE", color: COLORS.green, Icon: CheckCircle2 },
  error: { bg: "#FCECEA", color: COLORS.red, Icon: AlertTriangle },
  warning: { bg: "#FCECEA", color: COLORS.red, Icon: AlertTriangle },
  info: { bg: "#E8F5F5", color: COLORS.teal, Icon: Info },
};

export function Banner({ tone = "info", children }) {
  const { bg, color, Icon } = TONES[tone] || TONES.info;
  return (
    <div
      className="rounded-xl px-4 py-3 mb-4 text-sm font-medium flex items-start gap-2.5 animate-fade-in"
      style={{ backgroundColor: bg, color }}
    >
      <Icon size={17} className="shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}
