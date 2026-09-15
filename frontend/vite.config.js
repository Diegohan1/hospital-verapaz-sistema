import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Dev-Mari: host:true expone el servidor en la red local (no solo
    // localhost) para poder abrir la app desde el navegador del telefono
    // conectado al mismo WiFi y usar su camara para escanear.
    host: true,
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
});
