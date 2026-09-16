import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev-Mari: la camara del navegador (getUserMedia) y crypto.randomUUID()
// solo funcionan en "contexto seguro" (HTTPS o localhost). Para poder
// probar el escaneo desde el telefono por la red local hace falta HTTPS
// tambien ahi. Certificado autofirmado solo para desarrollo (ver
// frontend/.cert/README.md) — el navegador va a advertir "conexion no
// segura" una vez por dispositivo; hay que aceptar la excepcion para
// continuar. No se usa en produccion (ese HTTPS lo da el hosting real).
const certKey = path.resolve(process.cwd(), ".cert/dev-key.pem");
const certFile = path.resolve(process.cwd(), ".cert/dev-cert.pem");
const httpsDisponible = fs.existsSync(certKey) && fs.existsSync(certFile);

export default defineConfig({
  plugins: [react()],
  server: {
    // host:true expone el servidor en la red local (no solo localhost)
    // para poder abrir la app desde el navegador del telefono conectado
    // al mismo WiFi.
    host: true,
    https: httpsDisponible ? { key: fs.readFileSync(certKey), cert: fs.readFileSync(certFile) } : undefined,
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
});
