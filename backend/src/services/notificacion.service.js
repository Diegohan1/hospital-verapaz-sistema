// Sprint 2: adaptador de notificacion para el enlace de recuperacion de
// contrasena. El proveedor real de correo/SMS se definira al contratarlo;
// este adaptador desacopla los controladores de ese proveedor para que la
// integracion futura sea solo implementar un nuevo caso aqui.
//
// Variables:
//   NOTIFICACION_PROVEEDOR = "consola" (laboratorio) | futuro: "smtp", "sendgrid", ...
//   APP_URL = URL del frontend, para armar el enlace (ej. http://localhost:5173)
export function construirEnlaceReset(token) {
  const base = process.env.APP_URL || "http://localhost:5173";
  return `${base.replace(/\/$/, "")}/recuperar/cambiar?token=${token}`;
}

export async function enviarEnlaceRecuperacion({ correo, nombre, enlace }) {
  const proveedor = process.env.NOTIFICACION_PROVEEDOR || "consola";

  switch (proveedor) {
    case "consola":
      // Modo laboratorio: no hay proveedor contratado; se registra el enlace
      // en consola y, si PASSWORD_RESET_EXPOSE_TOKEN=true, el controlador lo
      // devuelve en la respuesta para poder probar el flujo completo.
      console.log(`[notificacion:consola] Enlace de recuperación para ${correo}: ${enlace}`);
      return { entregado: false, modo: "consola" };
    default:
      // Punto de integracion futuro: agregar el caso del proveedor contratado
      // (SMTP, SendGrid, Mailgun, SMS...) aqui, sin tocar los controladores.
      throw new Error(`Proveedor de notificación "${proveedor}" no está implementado aún. Configure NOTIFICACION_PROVEEDOR=consola o implemente el adaptador.`);
  }
}
