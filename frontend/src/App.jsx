import React from "react";
import { Routes, Route, Navigate, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import { useAuth } from "./context/AuthContext";
import { puedeVerModulo } from "./utils/roles";
import { LoginPage } from "./pages/LoginPage";
import { RecuperarPasswordPage } from "./pages/RecuperarPasswordPage";
import { CambiarPasswordPage } from "./pages/CambiarPasswordPage";
import { RegistroPage } from "./pages/RegistroPage";
import { ExpedientePage } from "./pages/ExpedientePage";
import { DocumentosPage } from "./pages/DocumentosPage";
import { TratamientoPage } from "./pages/TratamientoPage";
import { ReferidosPage } from "./pages/ReferidosPage";
import { FinancieraPage } from "./pages/FinancieraPage";
import { GastosPage } from "./pages/GastosPage";
import { FarmaciaPage } from "./pages/FarmaciaPage";
import { SeguridadPage } from "./pages/SeguridadPage";
import { ReportesPage } from "./pages/ReportesPage";
import { EscaneoMovilPage } from "./pages/EscaneoMovilPage";

// Estas tres paginas reciben un paciente preseleccionado (ej. desde "Ver
// expediente" en Registro) via ?pacienteId= en la URL, en vez de estado en
// memoria — asi el enlace es compartible/recargable.
function ConPacienteDeUrl({ Page }) {
  const [params] = useSearchParams();
  const pacienteId = params.get("pacienteId");
  return <Page pacienteIdInicial={pacienteId ? Number(pacienteId) : null} />;
}

// Redirige un enlace viejo a su reemplazo conservando el ?pacienteId= si lo trae.
function Redirigir({ a }) {
  const location = useLocation();
  return <Navigate to={`${a}${location.search}`} replace />;
}

// Bloquea el acceso directo por URL a modulos que el rol no puede ver
// (por ejemplo, una secretaria escribiendo /financiera a mano). El menu ya
// los oculta; esto cierra la puerta tambien en la ruta.
function ModuloProtegido({ modulo, children }) {
  const { usuario } = useAuth();
  if (!puedeVerModulo(usuario, modulo)) return <Navigate to="/registro" replace />;
  return children;
}

export default function App() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  if (!usuario) {
    // Sprint 2: flujo publico de recuperacion de contrasena, accesible sin
    // sesion iniciada. Dev-Mari: /escaneo-movil/:sesionId tambien es
    // publica — la abre el navegador del telefono al leer el QR, sin login.
    return (
      <Routes>
        <Route path="/recuperar" element={<RecuperarPasswordPage />} />
        <Route path="/recuperar/cambiar" element={<CambiarPasswordPage />} />
        <Route path="/escaneo-movil/:sesionId" element={<EscaneoMovilPage />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  function irAExpediente(pacienteId) {
    navigate(`/expediente?pacienteId=${pacienteId}`);
  }

  return (
    <Layout usuario={usuario} onLogout={logout}>
      <Routes>
        <Route path="/" element={<Navigate to="/registro" replace />} />
        <Route path="/registro" element={<ModuloProtegido modulo="registro"><RegistroPage onVerExpediente={irAExpediente} /></ModuloProtegido>} />
        <Route path="/expediente" element={<ModuloProtegido modulo="expediente"><ConPacienteDeUrl Page={ExpedientePage} /></ModuloProtegido>} />
        <Route path="/documentos" element={<ModuloProtegido modulo="documentos"><ConPacienteDeUrl Page={DocumentosPage} /></ModuloProtegido>} />
        {/* "Anexos" se fusiono con "Documentos escaneados" el 23/09/2026; se conserva el enlace viejo por si quedo guardado en algun lado */}
        <Route path="/anexos" element={<Redirigir a="/documentos" />} />
        <Route path="/tratamiento" element={<ModuloProtegido modulo="tratamiento"><ConPacienteDeUrl Page={TratamientoPage} /></ModuloProtegido>} />
        <Route path="/referidos" element={<ModuloProtegido modulo="referidos"><ReferidosPage /></ModuloProtegido>} />
        <Route path="/financiera" element={<ModuloProtegido modulo="financiera"><FinancieraPage /></ModuloProtegido>} />
        <Route path="/gastos" element={<ModuloProtegido modulo="gastos"><GastosPage /></ModuloProtegido>} />
        <Route path="/farmacia" element={<ModuloProtegido modulo="farmacia"><FarmaciaPage /></ModuloProtegido>} />
        <Route path="/seguridad" element={<ModuloProtegido modulo="seguridad"><SeguridadPage /></ModuloProtegido>} />
        <Route path="/reportes" element={<ModuloProtegido modulo="reportes"><ReportesPage /></ModuloProtegido>} />
        <Route path="*" element={<Navigate to="/registro" replace />} />
      </Routes>
    </Layout>
  );
}
