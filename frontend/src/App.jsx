import React from "react";
import { Routes, Route, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "./components/Layout";
import { useAuth } from "./context/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { RecuperarPasswordPage } from "./pages/RecuperarPasswordPage";
import { CambiarPasswordPage } from "./pages/CambiarPasswordPage";
import { RegistroPage } from "./pages/RegistroPage";
import { ExpedientePage } from "./pages/ExpedientePage";
import { TratamientoPage } from "./pages/TratamientoPage";
import { ReferidosPage } from "./pages/ReferidosPage";
import { FinancieraPage } from "./pages/FinancieraPage";
import { FarmaciaPage } from "./pages/FarmaciaPage";
import { BitacoraPage } from "./pages/BitacoraPage";
import { SeguridadPage } from "./pages/SeguridadPage";
import { ReportesPage } from "./pages/ReportesPage";

// Estas tres paginas reciben un paciente preseleccionado (ej. desde "Ver
// expediente" en Registro) via ?pacienteId= en la URL, en vez de estado en
// memoria — asi el enlace es compartible/recargable.
function ConPacienteDeUrl({ Page }) {
  const [params] = useSearchParams();
  const pacienteId = params.get("pacienteId");
  return <Page pacienteIdInicial={pacienteId ? Number(pacienteId) : null} />;
}

export default function App() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  if (!usuario) {
    // Sprint 2: flujo publico de recuperacion de contrasena, accesible sin
    // sesion iniciada.
    return (
      <Routes>
        <Route path="/recuperar" element={<RecuperarPasswordPage />} />
        <Route path="/recuperar/cambiar" element={<CambiarPasswordPage />} />
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
        <Route path="/tratamiento" element={<ConPacienteDeUrl Page={TratamientoPage} />} />
        <Route path="/referidos" element={<ReferidosPage />} />
        <Route path="/financiera" element={<FinancieraPage />} />
        <Route path="/farmacia" element={<FarmaciaPage />} />
        <Route path="/bitacora" element={<ConPacienteDeUrl Page={BitacoraPage} />} />
        <Route path="/seguridad" element={<SeguridadPage />} />
        <Route path="/reportes" element={<ReportesPage />} />
        <Route path="*" element={<Navigate to="/registro" replace />} />
      </Routes>
    </Layout>
  );
}
