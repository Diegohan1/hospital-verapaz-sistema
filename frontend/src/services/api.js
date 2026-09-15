// Punto único de conexión al backend (Express). Vite hace proxy de /api -> http://localhost:4000
const BASE_URL = "/api";

async function request(path, options = {}) {
  const token = localStorage.getItem("token");
  // Si el body ya es FormData (subida de archivos), no se fuerza JSON: el
  // navegador pone el Content-Type con el boundary correcto solo si lo dejamos
  // sin especificar aqui.
  const esFormData = options.body instanceof FormData;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(esFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    // La sesion (JWT) expiro o dejo de ser valida: avisa a AuthContext para
    // que cierre sesion y regrese al login, en vez de dejar la app mostrando
    // errores de "Token invalido" en cada peticion.
    if (res.status === 401 && token) {
      window.dispatchEvent(new Event("auth:sesion-expirada"));
    }
    throw new Error(body?.error || `Error ${res.status} al llamar ${path}`);
  }
  return body;
}

// Descarga binaria (anexos cifrados): igual que request() pero devuelve un
// Blob en lugar de JSON, con los mismos headers de autenticacion.
async function requestBlob(path, options = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    if (res.status === 401 && token) {
      window.dispatchEvent(new Event("auth:sesion-expirada"));
    }
    throw new Error(body?.error || `Error ${res.status} al llamar ${path}`);
  }
  return res.blob();
}

export const api = {
  get: (path, options) => request(path, options),
  post: (path, body, options) => request(path, { ...options, method: "POST", body: body instanceof FormData ? body : JSON.stringify(body) }),
  put: (path, body, options) => request(path, { ...options, method: "PUT", body: JSON.stringify(body) }),
  del: (path, options) => request(path, { ...options, method: "DELETE" }),
  getBlob: (path, options) => requestBlob(path, options),
};
