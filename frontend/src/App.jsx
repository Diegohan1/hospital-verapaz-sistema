import React from "react";
import { Routes, Route, Navigate, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import { useAuth } from "./context/AuthContext";
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
import { BitacoraPage } from "./pages/BitacoraPage";
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
        <Route path="/registro" element={<RegistroPage onVerExpediente={irAExpediente} />} />
        <Route path="/expediente" element={<ConPacienteDeUrl Page={ExpedientePage} />} />
        <Route path="/documentos" element={<ConPacienteDeUrl Page={DocumentosPage} />} />
        {/* "Anexos" se fusiono con "Documentos escaneados" el 23/09/2026; se conserva el enlace viejo por si quedo guardado en algun lado */}
        <Route path="/anexos" element={<Redirigir a="/documentos" />} />
        <Route path="/tratamiento" element={<ConPacienteDeUrl Page={TratamientoPage} />} />
        <Route path="/referidos" element={<ReferidosPage />} />
        <Route path="/financiera" element={<FinancieraPage />} />
        <Route path="/gastos" element={<GastosPage />} />
        <Route path="/farmacia" element={<FarmaciaPage />} />
        <Route path="/bitacora" element={<ConPacienteDeUrl Page={BitacoraPage} />} />
        <Route path="/seguridad" element={<SeguridadPage />} />
        <Route path="/reportes" element={<ReportesPage />} />
        <Route path="*" element={<Navigate to="/registro" replace />} />
      </Routes>
    </Layout>
  );
}
