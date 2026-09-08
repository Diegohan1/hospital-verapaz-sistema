import React, { useState } from "react";
import { Lock, ArrowLeft } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Banner } from "../components/Banner";
import { COLORS } from "../styles/tokens";
import { api } from "../services/api";
import logoVerapaz from "../assets/logo-verapaz.png";

// Sprint 2: cambio de contrasena con el token de recuperacion (?token=...).
// Cubre los estados definidos: token expirado, token ya utilizado y token
// invalido o no entregado (mensajes especificos del backend).
export function CambiarPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState(null);
  const [listo, setListo] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (password !== confirmacion) {
      return setError("Las contraseñas no coinciden");
    }
    setCargando(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setListo(true);
      setTimeout(() => navigate("/"), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-6"
      style={{ background: `linear-gradient(135deg, ${COLORS.lightBg} 0%, #E3F0E7 100%)` }}
    >
      <div className="animate-fade-in-up w-full max-w-md rounded-2xl overflow-hidden shadow-lifted bg-white">
        <div
          className="px-6 py-6 flex items-center gap-3"
          style={{ background: `linear-gradient(160deg, ${COLORS.navy} 0%, ${COLORS.navyDark} 100%)` }}
        >
          <img src={logoVerapaz} alt="Hospital Verapaz" className="w-10 h-10 rounded-full" />
          <div>
            <div className="text-xs font-bold tracking-[0.2em]" style={{ color: COLORS.goldLight }}>HOSPITAL VERAPAZ</div>
            <h1 className="text-base font-bold text-white">Nueva contraseña</h1>
          </div>
        </div>

        <div className="px-6 py-8">
          {!token && <Banner tone="error">Falta el token de recuperación. Solicite un enlace nuevo desde "Recuperar contraseña".</Banner>}
          {listo && <Banner tone="success">Contraseña actualizada. Redirigiendo a inicio de sesión…</Banner>}
          {error && <Banner tone="error">{error}</Banner>}

          <form className="flex flex-col gap-4 mt-4" onSubmit={handleSubmit}>
            <div>
              <label className="text-xs font-semibold" style={{ color: "#475066" }}>Nueva contraseña (mínimo 8 caracteres)</label>
              <div className="relative mt-1.5">
                <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "#9AA3B8" }} />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm border outline-none transition-all duration-150 focus:border-navy focus:ring-2 focus:shadow-soft"
                  style={{ borderColor: COLORS.border, "--tw-ring-color": "rgba(15, 122, 61, 0.18)" }}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold" style={{ color: "#475066" }}>Confirmar contraseña</label>
              <div className="relative mt-1.5">
                <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "#9AA3B8" }} />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmacion}
                  onChange={(e) => setConfirmacion(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm border outline-none transition-all duration-150 focus:border-navy focus:ring-2 focus:shadow-soft"
                  style={{ borderColor: COLORS.border, "--tw-ring-color": "rgba(15, 122, 61, 0.18)" }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={cargando || !token || listo}
              className="w-full py-2.5 rounded-xl text-sm font-semibold shadow-soft hover:shadow-lifted hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150"
              style={{ backgroundColor: COLORS.navy, color: "white", opacity: cargando || listo ? 0.6 : 1 }}
            >
              {cargando ? "Guardando…" : "Restablecer contraseña"}
            </button>
          </form>

          <Link to="/recuperar" className="flex items-center justify-center gap-1.5 text-xs mt-6 font-semibold" style={{ color: COLORS.gold }}>
            <ArrowLeft size={14} /> Solicitar un enlace nuevo
          </Link>
        </div>
      </div>
    </div>
  );
}
