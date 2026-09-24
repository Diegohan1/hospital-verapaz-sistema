import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ClipboardList, FileText, FolderOpen, Syringe, Users, Wallet, Receipt, Pill,
  ClipboardCheck, ShieldCheck, BarChart3, LogOut, Menu, X,
} from "lucide-react";
import { COLORS } from "../styles/tokens";
import { etiquetasRoles } from "../utils/roles";
import logoVerapaz from "../assets/logo-verapaz.png";

const NAV_ITEMS = [
  { key: "registro", label: "Registro y Admisión", Icon: ClipboardList, allowedInRestricted: true },
  { key: "expediente", label: "Expediente Clínico", Icon: FileText, allowedInRestricted: true },
  { key: "documentos", label: "Documentos del Paciente", Icon: FolderOpen, allowedInRestricted: false },
  { key: "tratamiento", label: "Tratamiento", Icon: Syringe, allowedInRestricted: false },
  { key: "referidos", label: "Clientes Referidos", Icon: Users, allowedInRestricted: false },
  { key: "financiera", label: "Área Financiera", Icon: Wallet, allowedInRestricted: false },
  { key: "gastos", label: "Gastos del Hospital", Icon: Receipt, allowedInRestricted: false },
  { key: "farmacia", label: "Farmacia", Icon: Pill, allowedInRestricted: false },
  { key: "bitacora", label: "Bitácora de Visitas", Icon: ClipboardCheck, allowedInRestricted: true },
  { key: "seguridad", label: "Seguridad y Roles", Icon: ShieldCheck, allowedInRestricted: false },
  { key: "reportes", label: "Reportes", Icon: BarChart3, allowedInRestricted: false },
];

function iniciales(nombre) {
  return (nombre || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

function SidebarContent({ usuario, onLogout, onNavigate, restrictedMode, onToggleRestrictedMode }) {
  const location = useLocation();
  
  // Filtrar items según el modo restringido
  const visibleItems = NAV_ITEMS.filter(item => 
    restrictedMode ? item.allowedInRestricted : true
  );

  return (
    <>
      <div className="px-5 pt-6 pb-5">
        <button
          onClick={onToggleRestrictedMode}
          className="flex items-center gap-2.5 w-full"
          aria-label={restrictedMode ? "Mostrar todos los módulos" : "Ocultar módulos (solo Registro, Expediente, Bitácora)"}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <img src={logoVerapaz} alt="Hospital Verapaz" className="w-7 h-7 rounded-full shrink-0 transition-transform duration-200" style={{ transform: restrictedMode ? "rotate(180deg)" : "none" }} />
          <div className="text-white font-bold text-sm tracking-wide flex-1 text-left">
            HOSPITAL VERAPAZ
            {restrictedMode && (
              <span className="block text-[10px] font-normal opacity-75">Modo restringido</span>
            )}
          </div>
        </button>
        <div className="flex items-center gap-2.5 mt-4">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ backgroundColor: COLORS.gold, color: COLORS.navy }}
          >
            {iniciales(usuario.nombre) || "U"}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{usuario.nombre}</div>
            <div className="text-xs truncate" style={{ color: "#A5D8BD" }}>{etiquetasRoles(usuario.roles)}</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 overflow-y-auto">
        {visibleItems.map((item) => {
          const activo = location.pathname === `/${item.key}`;
          return (
            <Link
              key={item.key}
              to={`/${item.key}`}
              onClick={() => onNavigate?.()}
              className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl text-sm mb-1 transition-all duration-150"
              style={
                activo
                  ? { backgroundColor: COLORS.gold, color: COLORS.navy, fontWeight: 600 }
                  : { color: "#D8F0E2", backgroundColor: "transparent" }
              }
              onMouseEnter={(e) => { if (!activo) e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)"; }}
              onMouseLeave={(e) => { if (!activo) e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              <item.Icon size={17} strokeWidth={2} className="shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-3 pb-5 pt-2">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl text-sm transition-colors duration-150 hover:bg-white/5"
          style={{ color: "#A5D8BD" }}
        >
          <LogOut size={17} className="shrink-0" />
          Cerrar sesión
        </button>
      </div>
    </>
  );
}

export function Layout({ usuario, onLogout, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [restrictedMode, setRestrictedMode] = useState(false);

  const toggleRestrictedMode = () => {
    setRestrictedMode(prev => !prev);
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: COLORS.lightBg }}>
      {/* Sidebar de escritorio */}
      <div
        className="hidden md:flex flex-col shrink-0"
        style={{ width: 248, backgroundColor: COLORS.navy }}
      >
        <SidebarContent 
          usuario={usuario} 
          onLogout={onLogout} 
          restrictedMode={restrictedMode}
          onToggleRestrictedMode={toggleRestrictedMode}
        />
      </div>

      {/* Sidebar movil (drawer) */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={() => setMobileOpen(false)} />
          <div className="relative flex flex-col w-72 max-w-[80%] shadow-lifted" style={{ backgroundColor: COLORS.navy }}>
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-5 right-4 text-white/70 hover:text-white"
              aria-label="Cerrar menú"
            >
              <X size={20} />
            </button>
            <SidebarContent 
              usuario={usuario} 
              onLogout={onLogout} 
              onNavigate={() => setMobileOpen(false)}
              restrictedMode={restrictedMode}
              onToggleRestrictedMode={toggleRestrictedMode}
            />
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar movil */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b sticky top-0 z-30" style={{ borderColor: COLORS.border }}>
          <button onClick={() => setMobileOpen(true)} aria-label="Abrir menú" style={{ color: COLORS.navy }}>
            <Menu size={22} />
          </button>
          <button
            onClick={toggleRestrictedMode}
            aria-label={restrictedMode ? "Mostrar todos los módulos" : "Ocultar módulos (solo Registro, Expediente, Bitácora)"}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <img src={logoVerapaz} alt="Hospital Verapaz" className="w-6 h-6 rounded-full transition-transform duration-200" style={{ transform: restrictedMode ? "rotate(180deg)" : "none" }} />
          </button>
          <div className="text-sm font-bold" style={{ color: COLORS.navy }}>
            HOSPITAL VERAPAZ
            {restrictedMode && <span className="block text-[10px] font-normal opacity-75">Modo restringido</span>}
          </div>
        </div>

        <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
