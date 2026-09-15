import React, { useState } from "react";
import { Mail, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Banner } from "../components/Banner";
import { COLORS } from "../styles/tokens";
import { api } from "../services/api";
import logoVerapaz from "../assets/logo-verapaz.png";

// Sprint 2: solicitud del enlace de recuperacion de contrasena.
// La respuesta del backend es anti-enumeracion (mismo mensaje exista o no el
// correo). En laboratorio el backend puede devolver el token en la respuesta
// mientras no haya proveedor de correo contratado.
export function RecuperarPasswordPage() {
  const [correo, setCorreo] = useState("");
  const [mensaje, setMensaje] = useState(null);
  const [tokenLab, setTokenLab] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setMensaje(null);
    setTokenLab(null);
    setCargando(true);
    try {
      const res = await api.post("/auth/forgot-password", { correo });
      setMensaje(res.mensaje);
      if (res.token) setTokenLab(res.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-6"
      style={{ background: `linear-gradient(135deg, ${COLORS.lightBg} 0%, #E5F6EE 100%)` }}
    >
      <div className="animate-fade-in-up w-full max-w-md rounded-2xl overflow-hidden shadow-lifted bg-white">
        <div
          className="px-6 py-6 flex items-center gap-3"
          style={{ background: `linear-gradient(160deg, ${COLORS.navy} 0%, ${COLORS.navyDark} 100%)` }}
        >
          <img src={logoVerapaz} alt="Hospital Verapaz" className="w-10 h-10 rounded-full" />
          <div>
            <div className="text-xs font-bold tracking-[0.2em]" style={{ color: COLORS.goldLight }}>HOSPITAL VERAPAZ</div>
            <h1 className="text-base font-bold text-white">Recuperar contraseña</h1>
          </div>
        </div>

        <div className="px-6 py-8">
          <p className="text-sm mb-5" style={{ color: COLORS.textMuted }}>
           Ingrese su correo y le enviaremos un enlace para restablecer la contraseña. El enlace expira en 30 minutos y puede usarse una sola vez.
          </p>

          {mensaje && <Banner tone="success">{mensaje}</Banner>}
          {error && <Banner tone="error">{error}</Banner>}
          {tokenLab && (
            <Banner tone="info">
              Modo laboratorio (sin proveedor de correo): use este enlace directo:{" "}
              <Link className="underline font-semibold" to={`/recuperar/cambiar?token=${tokenLab}`}>Restablecer contraseña</Link>
            </Banner>
          )}

          <form className="flex flex-col gap-4 mt-4" onSubmit={handleSubmit}>
            <div>
              <label className="text-xs font-semibold" style={{ color: "#475066" }}>Correo</label>
              <div className="relative mt-1.5 group">
                <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "#9AA3B8" }} />
                <input
                  type="email"
                  required
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  placeholder="correo@hospitalverapaz.gt"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm border outline-none transition-all duration-150 focus:border-navy focus:ring-2 focus:shadow-soft"
                  style={{ borderColor: COLORS.border, "--tw-ring-color": "rgba(0, 134, 67, 0.18)" }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="w-full py-2.5 rounded-xl text-sm font-semibold shadow-soft hover:shadow-lifted hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150"
              style={{ backgroundColor: COLORS.navy, color: "white", opacity: cargando ? 0.6 : 1 }}
            >
              {cargando ? "Enviando…" : "Enviar enlace de recuperación"}
            </button>
          </form>

          <Link to="/" className="flex items-center justify-center gap-1.5 text-xs mt-6 font-semibold" style={{ color: COLORS.gold }}>
            <ArrowLeft size={14} /> Volver a iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  );
}
