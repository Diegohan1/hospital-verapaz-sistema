import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    const raw = localStorage.getItem("usuario");
    return raw ? JSON.parse(raw) : null;
  });
  const [sesionExpirada, setSesionExpirada] = useState(false);

  // RF-29: inicio de sesion contra el backend (bcrypt + JWT)
  async function login(correo, password) {
    const data = await api.post("/auth/login", { correo, password });
    localStorage.setItem("token", data.token);
    localStorage.setItem("usuario", JSON.stringify(data.usuario));
    setSesionExpirada(false);
    setUsuario(data.usuario);
  }

  async function logout() {
    try {
      await api.post("/auth/logout", {});
    } catch {
      // si el token ya expiro o la peticion falla, igual cerramos sesion localmente
    }
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    setUsuario(null);
  }

  // Al arrancar, refresca el usuario desde el backend para que los roles y
  // permisos coincidan siempre con la base (y no con lo que quedo guardado en
  // localStorage de una sesion anterior).
  useEffect(() => {
    if (!localStorage.getItem("token")) return;
    api.get("/auth/me")
      .then((data) => {
        if (!data?.usuario) return;
        localStorage.setItem("usuario", JSON.stringify(data.usuario));
        setUsuario(data.usuario);
      })
      .catch(() => {
        // Si el token ya no sirve, api.js dispara "auth:sesion-expirada".
      });
  }, []);

  // Si el JWT expira o deja de ser valido, api.js dispara este evento:
  // cerramos sesion automaticamente en vez de dejar la app rota mostrando
  // "Token invalido" en cada pantalla (RF-29).
  useEffect(() => {
    function alExpirar() {
      setSesionExpirada(true);
      logout();
    }
    window.addEventListener("auth:sesion-expirada", alExpirar);
    return () => window.removeEventListener("auth:sesion-expirada", alExpirar);
  }, []);

  return (
    <AuthContext.Provider value={{ usuario, login, logout, sesionExpirada }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
