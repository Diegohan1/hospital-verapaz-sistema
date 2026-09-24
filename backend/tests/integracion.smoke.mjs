// PRUEBA DE HUMO INTEGRAL (contra el servidor y la base de datos reales).
// Recorre todos los modulos con un usuario de cada rol. Requiere el backend
// corriendo (npm run dev) y el usuario admin del seed. Crea datos con prefijo
// SMOKE y los borra al final.   Uso:  npm run test:integracion
// Variable opcional: BASE=http://localhost:4000/api


const BASE = process.env.BASE || "http://localhost:4000/api";
const PRISMA_URL = new URL("../src/config/prisma.js", import.meta.url).href;
const SUF = Date.now().toString(36);
const PW = "Smoke12345";

let pass = 0, fail = 0;
const fallas = [];
function check(nombre, cond, detalle = "") {
  if (cond) { pass++; console.log(`  OK    ${nombre}`); }
  else { fail++; fallas.push(`${nombre} ${detalle}`); console.log(`  FALLA ${nombre} ${detalle}`); }
}

async function api(method, path, { body, token, form, headers = {} } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { h["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
  const res = await fetch(`${BASE}${path}`, { method, headers: h, body: payload });
  let data = null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("json")) data = await res.json().catch(() => null);
  else data = Buffer.from(await res.arrayBuffer());
  return { status: res.status, data };
}
const st = (r) => `(HTTP ${r.status}${r.data?.error ? ": " + r.data.error : ""})`;

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

const creados = { pacientes: [], usuarios: [] };

async function main() {
  console.log("\n== AUTENTICACION ==");
  let r = await api("POST", "/auth/login", { body: { correo: "admin@hospitalverapaz.gt", password: "CambiarEsta123" } });
  check("login admin", r.status === 200 && r.data?.token, st(r));
  const admin = r.data.token;
  r = await api("POST", "/auth/login", { body: { correo: "admin@hospitalverapaz.gt", password: "mal" } });
  check("login con clave incorrecta -> 401", r.status === 401, st(r));
  r = await api("POST", "/auth/forgot-password", { body: { correo: "noexiste@x.gt" } });
  check("forgot-password no revela si el correo existe (200)", r.status === 200 && r.data?.ok, st(r));
  r = await api("POST", "/auth/reset-password", { body: { token: "invalido", password: "12345678" } });
  check("reset-password con token invalido -> 400", r.status === 400, st(r));
  r = await api("GET", "/pacientes");
  check("sin sesion -> 401", r.status === 401, st(r));

  console.log("\n== USUARIOS Y ROLES ==");
  const roles = { recep: "Recepcion", medico: "Consulta", enf: "Enfermeria", fact: "Facturacion", farm: "Farmacia" };
  const tk = {}, uid = {};
  for (const [k, rol] of Object.entries(roles)) {
    const body = { nombre: `SMOKE ${k}`, correo: `smoke_${k}_${SUF}@x.gt`, password: PW, roles: [rol] };
    if (k === "medico") { body.colegiado = "C-9999"; body.especialidad = "Pediatría"; }
    r = await api("POST", "/usuarios", { token: admin, body });
    check(`crear usuario ${rol}`, r.status === 201, st(r));
    uid[k] = r.data?.id; creados.usuarios.push(r.data?.id);
    const l = await api("POST", "/auth/login", { body: { correo: body.correo, password: PW } });
    tk[k] = l.data?.token;
    check(`login usuario ${rol}`, !!tk[k], st(l));
  }
  r = await api("POST", "/usuarios", { token: tk.recep, body: { nombre: "x", correo: "x@x.gt", password: "12345678", roles: ["Consulta"] } });
  check("Recepcion NO puede crear usuarios (403)", r.status === 403, st(r));
  r = await api("GET", "/usuarios/medicos", { token: tk.medico });
  check("selector de medicos accesible para un medico y trae colegiado", r.status === 200 && r.data.some((m) => m.id === uid.medico && m.colegiado === "C-9999"), st(r));
  r = await api("PUT", `/usuarios/${uid.medico}`, { token: admin, body: { roles: ["Recepcion"] } });
  check("quitar rol Consulta limpia colegiado/especialidad", r.status === 200 && r.data.colegiado === null, st(r));
  await api("PUT", `/usuarios/${uid.medico}`, { token: admin, body: { roles: ["Consulta"], colegiado: "C-9999", especialidad: "Pediatría" } });

  console.log("\n== PACIENTES (Registro y Admision) ==");
  r = await api("POST", "/pacientes", { token: tk.enf, body: { nombreCompleto: "SMOKE No", dpi: "9000000000099" } });
  check("Enfermeria NO puede registrar pacientes (403)", r.status === 403, st(r));
  r = await api("POST", "/pacientes", { token: tk.recep, body: { nombreCompleto: "SMOKE Paciente", dpi: "9000000000001", historiaClinica: `HC-SMK-${SUF}`, telefono: "55512345", fechaNacimiento: "2000-03-01", sexo: "Femenino" } });
  check("Recepcion registra paciente (historia manual)", r.status === 201 && r.data.historiaClinica === `HC-SMK-${SUF}`, st(r));
  const P = r.data.id; creados.pacientes.push(P);
  r = await api("POST", "/pacientes", { token: tk.recep, body: { nombreCompleto: "SMOKE Dup", dpi: "9000000000001" } });
  check("DPI duplicado -> 409", r.status === 409, st(r));
  r = await api("POST", "/pacientes", { token: tk.recep, body: { nombreCompleto: "SMOKE Malo", dpi: "123" } });
  check("DPI de largo incorrecto -> 400", r.status === 400, st(r));
  r = await api("GET", `/pacientes/${P}`, { token: tk.medico });
  check("Consulta puede leer la ficha del paciente", r.status === 200 && r.data.nombreCompleto === "SMOKE Paciente", st(r));
  r = await api("GET", `/pacientes?buscar=HC-SMK-${SUF}&page=1`, { token: tk.enf });
  check("busqueda paginada por historia clinica", r.status === 200 && r.data.items?.length === 1, st(r));
  r = await api("PUT", `/pacientes/${P}`, { token: tk.recep, body: { tipoSangre: "O+", serviciosSolicitados: "Consulta", fechaIngreso: new Date().toISOString() } });
  check("guardar ingreso (actualizacion parcial)", r.status === 200, st(r));
  r = await api("PUT", `/pacientes/${P}`, { token: tk.recep, body: { condicionEgreso: "fallecido_antes_48", fechaEgreso: new Date().toISOString(), egresoClinico: { diagnosticoEgreso: "A00", causaMuerte: "Causa QA", autopsia: true } } });
  check("guardar egreso clinico cifrado", r.status === 200, st(r));
  r = await api("GET", `/pacientes/${P}`, { token: tk.recep });
  check("Recepcion ve el egreso clinico descifrado", r.status === 200 && r.data.egresoClinico?.causaMuerte === "Causa QA", st(r));
  r = await api("GET", `/pacientes/${P}`, { token: tk.medico });
  check("[decision pendiente] el medico NO ve el egreso clinico", r.status === 200 && r.data.egresoClinico === undefined, st(r));
  r = await api("PUT", `/pacientes/${P}`, { token: tk.recep, body: { condicionEgreso: "vivo_mejorado", egresoClinico: { autopsia: true } } });
  check("autopsia con paciente vivo -> rechazada (422)", r.status === 422, st(r));
  r = await api("PUT", `/pacientes/${P}`, { token: tk.recep, body: { maternidad: { numeroHijo: 1, fecha: "2026-03-01T00:00:00.000Z", sexo: "Femenino", padreNombre: "SMOKE Padre", padreDpi: "2456789011601" } } });
  check("maternidad con datos del padre", r.status === 200, st(r));

  console.log("\n== CLIENTES REFERIDOS ==");
  r = await api("POST", "/referidos", { token: tk.recep, body: { nombre: `SMOKE Dr Ref ${SUF}`, especialidad: "Cirugía", comisionQ: 150 } });
  check("crear medico referente", r.status === 201, st(r));
  const REF = r.data?.id;
  r = await api("PUT", `/referidos/${REF}`, { token: tk.recep, body: { comisionQ: 200 } });
  check("actualizar comision", r.status === 200, st(r));
  r = await api("PUT", `/pacientes/${P}`, { token: tk.recep, body: { medicoReferenteId: REF } });
  check("asignar medico referente al paciente", r.status === 200, st(r));

  console.log("\n== BITACORA DE VISITAS ==");
  r = await api("POST", "/bitacora", { token: tk.enf, body: { pacienteId: P, descripcion: "Visita QA" } });
  check("Enfermeria registra visita", r.status === 201, st(r));
  const V = r.data?.id;
  r = await api("PUT", `/bitacora/${V}`, { token: tk.enf, body: { descripcion: "Visita QA editada" } });
  check("editar visita", r.status === 200, st(r));
  r = await api("GET", `/bitacora?pacienteId=${P}`, { token: tk.medico });
  check("listar visitas del paciente", r.status === 200 && (r.data.items || r.data).length >= 1, st(r));

  console.log("\n== TRATAMIENTOS ==");
  r = await api("POST", "/tratamientos", { token: tk.medico, body: { pacienteId: P, descripcion: "Apendicectomia QA", costo: 1500, origen: "intrahospitalario", cirujano: "Dr QA" } });
  check("registrar procedimiento", r.status === 201, st(r));
  const T = r.data?.id;
  r = await api("POST", "/tratamientos", { token: tk.medico, body: { pacienteId: P, descripcion: "Mal", costo: 1, origen: "otro" } });
  check("origen invalido -> 400", r.status === 400, st(r));
  r = await api("POST", "/tratamientos", { token: tk.medico, body: { pacienteId: P, descripcion: "Mal", costo: -5, origen: "farmacia" } });
  check("costo negativo -> 422", r.status === 422, st(r));
  r = await api("PUT", `/tratamientos/${T}`, { token: tk.medico, body: { costo: 1600 } });
  check("actualizar costo", r.status === 200, st(r));
  r = await api("POST", "/tratamientos", { token: tk.recep, body: { pacienteId: P, descripcion: "x", costo: 1, origen: "farmacia" } });
  check("Recepcion NO puede registrar tratamientos (403)", r.status === 403, st(r));

  console.log("\n== RECETAS ==");
  r = await api("POST", "/recetas", { token: tk.medico, body: { pacienteId: P, medicamento: "Amoxicilina", dosis: "500mg c/8h", indicaciones: "Con alimentos", duracion: "7 dias" } });
  check("medico crea receta (medico por defecto = el mismo)", r.status === 201 && r.data.medicoId === uid.medico, st(r));
  r = await api("POST", "/recetas", { token: tk.medico, body: { pacienteId: P, medicamento: "X", dosis: "1", medicoId: uid.enf } });
  check("medico responsable sin rol clinico -> 422", r.status === 422, st(r));
  r = await api("GET", `/recetas?pacienteId=${P}`, { token: tk.medico });
  check("receta lista trae colegiado y especialidad del medico", r.status === 200 && r.data[0]?.medico?.colegiado === "C-9999", st(r));
  r = await api("GET", `/recetas/${r.data?.[0]?.id}`, { token: tk.enf });
  check("vista imprimible de la receta", r.status === 200 && r.data.medico?.especialidad === "Pediatría", st(r));

  console.log("\n== EXPEDIENTE CLINICO (diagnostico cifrado y tokens) ==");
  const datos = { motivoConsulta: "QA", signosVitales: { pa: "120/80", fc: "72", peso: "60", talla: "165" }, estudios: [{ tipo: "Laboratorio", resultado: "Normal" }] };
  let form = new FormData();
  form.append("datos", JSON.stringify(datos)); form.append("tipoAtencion", "consulta_externa");
  form.append("estudio_0", new Blob([PNG], { type: "image/png" }), "lab.png");
  r = await api("POST", `/expedientes/paciente/${P}`, { token: admin, form });
  check("Admin registra diagnostico con archivo adjunto cifrado", r.status === 201, st(r));
  r = await api("GET", `/expedientes/paciente/${P}`, { token: tk.medico });
  check("medico SIN token no ve el diagnostico (403)", r.status === 403, st(r));
  r = await api("POST", "/auth/token/auto", { token: tk.medico, body: { pacienteId: P } });
  check("autogenerar token sin permiso -> 403", r.status === 403, st(r));
  r = await api("POST", "/auth/token", { token: admin, body: { usuarioId: uid.medico, pacienteId: P } });
  check("Admin emite token temporal para el medico", r.status === 201 && r.data.token, st(r));
  const TOKEN1 = r.data.token;
  r = await api("GET", `/expedientes/paciente/${P}`, { token: tk.medico, headers: { "x-temp-token": TOKEN1 } });
  check("medico CON token ve el diagnostico descifrado", r.status === 200 && r.data.datos?.motivoConsulta === "QA", st(r));
  check("el archivo del estudio se entrega descifrado", r.status === 200 && !!(r.data.datos?.estudios?.[0]?.archivoNombre), st(r));
  r = await api("GET", `/expedientes/paciente/${P}`, { token: tk.medico, headers: { "x-temp-token": TOKEN1 } });
  check("el token es de un solo uso (403 al reusar)", r.status === 403, st(r));

  console.log("\n== DOCUMENTOS DEL PACIENTE (fusion Anexos + Documentos escaneados, 23/09/2026) ==");
  // Protegido por rol, sin token de acceso temporal (a diferencia del
  // diagnostico y de como era Anexos antes de la fusion): RegistroPage ya
  // muestra esta lista dentro de la ficha del paciente sin flujo de token.
  form = new FormData();
  form.append("documento", new Blob([PNG], { type: "image/png" }), "anexo.png");
  r = await api("POST", `/pacientes/${P}/documentos`, { token: admin, form });
  check("Admin sube un documento (imagen) cifrado", r.status === 201, st(r));
  const A = r.data?.id;
  r = await api("GET", `/pacientes/${P}/documentos`, { token: tk.medico });
  check("medico (rol Consulta) lista los documentos sin necesitar token", r.status === 200 && r.data.length === 1, st(r));
  r = await api("GET", `/pacientes/${P}/documentos`, { token: tk.fact });
  check("Facturacion NO puede ver los documentos (403, rol no autorizado)", r.status === 403, st(r));
  r = await api("GET", `/pacientes/${P}/documentos/${A}`, { token: tk.medico });
  check("medico descarga el documento y llega con su Content-Type real (imagen, no forzado a PDF)", r.status === 200 && Buffer.isBuffer(r.data) && r.data.equals(PNG), st(r));
  const otro = await api("POST", "/pacientes", { token: tk.recep, body: { nombreCompleto: "SMOKE Otro", dpi: "9000000000002" } });
  creados.pacientes.push(otro.data.id);
  r = await api("GET", `/pacientes/${otro.data.id}/documentos/${A}`, { token: tk.medico });
  check("el documento de OTRO paciente no se descarga por esa URL (404)", r.status === 404, st(r));
  const JPEG = Buffer.from("ffd8ffe000104a46494600010100000100010000ffd9", "hex");
  form = new FormData();
  form.append("documento", new Blob([JPEG], { type: "image/jpeg" }), "IMG_0001.jpeg");
  r = await api("POST", `/pacientes/${P}/documentos`, { token: admin, form });
  check("foto .jpeg de celular se acepta (antes solo .jpg)", r.status === 201, st(r));
  form = new FormData();
  form.append("documento", new Blob([Buffer.from("<html><script>alert(1)</script></html>")], { type: "image/png" }), "falso.png");
  r = await api("POST", `/pacientes/${P}/documentos`, { token: admin, form });
  check("un archivo disfrazado de imagen se rechaza (422)", r.status === 422, st(r));

  console.log("\n== DOCUMENTOS: expediente escaneado (PDF, fechas y borrado) ==");
  const pdf = Buffer.from("%PDF-1.4\n%QA\n1 0 obj<<>>endobj\n");
  form = new FormData();
  form.append("documento", new Blob([pdf], { type: "application/pdf" }), "exp.pdf"); form.append("paginas", "2"); form.append("fechaDocumentoOriginal", "2026-09-10");
  r = await api("POST", `/pacientes/${P}/documentos`, { token: tk.recep, form });
  check("Recepcion sube documento escaneado (PDF)", r.status === 201, st(r));
  const D = r.data?.id;
  r = await api("GET", `/pacientes/${P}/documentos/${D}`, { token: tk.enf });
  check("Enfermeria descarga el documento (PDF) descifrado", r.status === 200 && Buffer.isBuffer(r.data) && r.data.equals(pdf), st(r));
  r = await api("GET", `/pacientes/${P}/documentos`, { token: tk.enf });
  check("lista trae fechaDocumentoOriginal", r.status === 200 && r.data.some((d) => d.fechaDocumentoOriginal), st(r));
  r = await api("DELETE", `/pacientes/${P}/documentos/${D}`, { token: tk.recep });
  check("eliminacion logica del documento", r.status === 200, st(r));

  console.log("\n== FACTURACION ==");
  r = await api("GET", `/facturacion/costeo/${P}`, { token: tk.fact });
  check("costeo del paciente lista el tratamiento pendiente", r.status === 200, st(r));
  r = await api("POST", "/facturacion", { token: tk.fact, body: { pacienteId: P, costoHospital: 500.005, formaPago: "efectivo" } });
  check("generar factura (suma tratamientos y redondea a 2 decimales)", r.status === 201 && Math.abs(Number(r.data.total) - 2100.01) < 0.011, `${st(r)} total=${r.data?.total}`);
  r = await api("POST", "/facturacion", { token: tk.fact, body: { pacienteId: P, costoHospital: 100, formaPago: "efectivo" } });
  check("los tratamientos ya facturados no se cobran dos veces", r.status === 201 && Math.abs(Number(r.data.total) - 100) < 0.011, `total=${r.data?.total}`);
  r = await api("POST", "/facturacion", { token: tk.fact, body: { pacienteId: P, costoHospital: 10, formaPago: "cheque" } });
  check("forma de pago invalida -> 400", r.status === 400, st(r));
  r = await api("GET", "/facturacion?page=1", { token: tk.fact });
  check("listado paginado de facturas", r.status === 200, st(r));
  r = await api("GET", "/facturacion/reporte", { token: tk.recep });
  check("Recepcion NO ve el reporte financiero (403)", r.status === 403, st(r));

  console.log("\n== GASTOS DEL HOSPITAL (23/09/2026) ==");
  r = await api("POST", "/facturacion/categorias-fiscales", { token: tk.fact, body: { nombre: `SMOKE Categoria ${SUF}`, tasa: 12 } });
  check("Facturacion NO puede crear categorias fiscales (403, solo Admin)", r.status === 403, st(r));
  r = await api("POST", "/facturacion/categorias-fiscales", { token: admin, body: { nombre: `SMOKE Categoria ${SUF}`, tasa: 12 } });
  check("Admin crea una categoria fiscal", r.status === 201, st(r));
  const CAT = r.data?.id;
  r = await api("POST", "/facturacion/categorias-fiscales", { token: admin, body: { nombre: `SMOKE Categoria ${SUF}`, tasa: 5 } });
  check("nombre de categoria repetido -> 409", r.status === 409, st(r));
  r = await api("GET", "/facturacion/reporte", { token: tk.fact });
  const netoAntes = r.data.ingresoNeto;
  r = await api("POST", "/facturacion/gastos", { token: tk.fact, body: { fecha: "2026-09-20", proveedor: "SMOKE Proveedor", monto: 150.5, categoriaFiscalId: CAT, numeroFactura: "DTE-001" } });
  check("Facturacion registra un gasto clasificado", r.status === 201 && r.data.categoriaFiscal?.id === CAT, st(r));
  check("el impuesto estimado se calcula solo (12% de 150.50)", Math.abs(Number(r.data.montoImpuestoEstimado) - 18.06) < 0.01, `impuesto=${r.data?.montoImpuestoEstimado}`);
  const G = r.data?.id;
  r = await api("POST", "/facturacion/gastos", { token: tk.fact, body: { fecha: "2026-09-20", proveedor: "SMOKE Sin categoria", monto: -5 } });
  check("monto negativo -> 422", r.status === 422, st(r));
  r = await api("GET", "/facturacion/gastos?page=1", { token: tk.fact });
  check("listado paginado de gastos", r.status === 200 && r.data.items.some((g) => g.id === G), st(r));
  r = await api("GET", "/facturacion/reporte", { token: tk.fact });
  check("el reporte descuenta el gasto del ingreso neto", r.status === 200 && Math.abs(r.data.ingresoNeto - (netoAntes - 150.5)) < 0.01, `${st(r)} neto=${r.data?.ingresoNeto} antes=${netoAntes}`);
  check("el reporte desglosa gastos por categoria fiscal", r.data.gastosPorCategoria?.some((c) => c.categoria === `SMOKE Categoria ${SUF}`), JSON.stringify(r.data.gastosPorCategoria));
  check("el desglose incluye el impuesto estimado de la categoria", Math.abs((r.data.gastosPorCategoria?.find((c) => c.categoria === `SMOKE Categoria ${SUF}`)?.impuestoEstimado ?? 0) - 18.06) < 0.01, JSON.stringify(r.data.gastosPorCategoria));
  check("el reporte totaliza el impuesto estimado", r.data.totalImpuestosEstimados >= 18.06, `total=${r.data?.totalImpuestosEstimados}`);
  r = await api("DELETE", `/facturacion/gastos/${G}`, { token: tk.recep });
  check("Recepcion NO puede eliminar gastos (403)", r.status === 403, st(r));
  r = await api("DELETE", `/facturacion/gastos/${G}`, { token: tk.fact });
  check("Facturacion elimina el gasto (correccion de captura)", r.status === 200, st(r));
  r = await api("PUT", `/facturacion/categorias-fiscales/${CAT}`, { token: admin, body: { activo: false } });
  check("Admin desactiva la categoria fiscal", r.status === 200 && r.data.activo === false, st(r));
  r = await api("GET", "/facturacion/categorias-fiscales?activo=true", { token: tk.fact });
  check("la categoria desactivada ya no aparece en el desplegable", r.status === 200 && !r.data.some((c) => c.id === CAT), st(r));

  console.log("\n== FARMACIA ==");
  r = await api("POST", "/farmacia", { token: tk.farm, body: { nombre: `SMOKE Med ${SUF}`, tipo: "Analgesico", presentacion: "Tableta", stock: 10, stockMinimo: 2, precioVenta: 5 } });
  check("crear medicamento", r.status === 201, st(r));
  const M = r.data?.id;
  r = await api("POST", `/farmacia/${M}/entradas`, { token: tk.farm, body: { cantidad: 5, motivo: "Compra" } });
  check("registrar entrada de inventario", r.status === 201 || r.status === 200, st(r));
  r = await api("POST", `/farmacia/${M}/salidas`, { token: tk.farm, body: { cantidad: 2, pacienteId: P } });
  check("salida intrahospitalaria a un paciente", r.status === 201 || r.status === 200, st(r));
  r = await api("POST", `/farmacia/${M}/salidas`, { token: tk.farm, body: { cantidad: 9999, pacienteId: P } });
  check("stock insuficiente -> 409", r.status === 409, st(r));
  r = await api("POST", "/farmacia/ventas", { token: tk.farm, body: { items: [{ medicamentoId: M, cantidad: 3 }] } });
  check("venta directa con carrito", r.status === 201, st(r));
  r = await api("GET", "/farmacia/ventas?page=1", { token: tk.farm });
  check("listado de ventas", r.status === 200, st(r));
  r = await api("POST", "/farmacia", { token: tk.recep, body: { nombre: "x" } });
  check("Recepcion NO puede crear medicamentos (403)", r.status === 403, st(r));

  console.log("\n== REPORTES / CIE-10 / AUDITORIA ==");
  for (const [n, p] of [["financiero", "/reportes/financiero"], ["ingresos por mes", "/reportes/ingresos-por-mes"], ["admisiones", "/reportes/admisiones"], ["facturacion por forma de pago", "/reportes/facturacion-por-forma-pago"], ["kardex", "/reportes/inventario-kardex"], ["auditoria de diagnosticos", "/reportes/auditoria-diagnostico"], ["actividad", "/reportes/actividad"], ["catalogo CIE-10", "/cie10?q=diarrea"]]) {
    r = await api("GET", p, { token: admin });
    check(`reporte: ${n}`, r.status === 200, st(r));
  }
  r = await api("GET", "/reportes/actividad?page=1", { token: admin });
  check("la bitacora registro las acciones de esta prueba", r.status === 200 && JSON.stringify(r.data).includes("SMOKE"), st(r));

  console.log("\n== LECTURA AVANZADA / ESCANEO MOVIL ==");
  r = await api("GET", "/pacientes/lectura-avanzada/estado", { token: tk.recep });
  check("estado de la lectura avanzada (apagada por defecto)", r.status === 200 && r.data.disponible === false, st(r));
  r = await api("POST", "/escaneo-movil/sesiones", { token: tk.recep, body: {} });
  check("crear sesion de escaneo movil", r.status === 201, st(r));
  const ses = r.data?.id;
  r = await api("GET", `/escaneo-movil/sesiones/${ses}/info`);
  check("info publica de la sesion (sin login)", r.status === 200 && r.data.valido === true, st(r));
  form = new FormData(); form.append("documento", new Blob([pdf], { type: "application/pdf" }), "m.pdf"); form.append("paginas", "1");
  r = await api("POST", `/escaneo-movil/sesiones/${ses}/subir`, { form });
  check("el telefono sube el PDF sin login", r.status === 200, st(r));
  r = await api("GET", `/escaneo-movil/sesiones/${ses}/pdf`, { token: tk.enf });
  check("otro usuario no puede recoger la sesion (403)", r.status === 403, st(r));
  r = await api("GET", `/escaneo-movil/sesiones/${ses}/pdf`, { token: tk.recep });
  check("la PC recoge el PDF", r.status === 200 && Buffer.isBuffer(r.data), st(r));
}

async function limpiar() {
  const { prisma } = await import(PRISMA_URL);
  const pids = creados.pacientes.filter(Boolean);
  const uids = creados.usuarios.filter(Boolean);
  const intentar = async (f) => { try { await f(); } catch (e) { console.log("   (limpieza) ", String(e.message).split("\n").pop().slice(0, 100)); } };
  const meds = (await prisma.medicamentoInventario.findMany({ where: { nombre: { startsWith: "SMOKE" } }, select: { id: true } })).map((m) => m.id);
  await intentar(() => prisma.ventaFarmacia.deleteMany({ where: { medicamentoId: { in: meds } } }));
  await intentar(() => prisma.facturaFarmacia.deleteMany({ where: { registradoPor: { in: uids } } }));
  await intentar(() => prisma.movimientoInventario.deleteMany({ where: { medicamentoId: { in: meds } } }));
  for (const m of ["accesoDiagnostico", "diagnosticoArchivo", "diagnostico", "documentoPaciente", "registroMaternidad", "egresoClinico", "tratamientoItem", "receta", "bitacoraVisita", "facturaHospital", "movimientoInventario"]) {
    await intentar(() => prisma[m].deleteMany({ where: { pacienteId: { in: pids } } }));
  }
  await intentar(() => prisma.medicamentoInventario.deleteMany({ where: { id: { in: meds } } }));
  await intentar(() => prisma.paciente.deleteMany({ where: { id: { in: pids } } }));
  await intentar(() => prisma.medicoReferente.deleteMany({ where: { nombre: { startsWith: "SMOKE" } } }));
  await intentar(() => prisma.gastoHospital.deleteMany({ where: { proveedor: { startsWith: "SMOKE" } } }));
  await intentar(() => prisma.categoriaFiscal.deleteMany({ where: { nombre: { startsWith: "SMOKE" } } }));
  await intentar(() => prisma.tokenTemporal.deleteMany({ where: { OR: [{ usuarioId: { in: uids } }, { emitidoPor: { in: uids } }] } }));
  await intentar(() => prisma.logActividad.deleteMany({ where: { usuarioId: { in: uids } } }));
  await intentar(() => prisma.passwordResetToken.deleteMany({ where: { usuarioId: { in: uids } } }));
  await intentar(() => prisma.usuario.deleteMany({ where: { id: { in: uids } } }));
  const quedan = await prisma.paciente.count({ where: { nombreCompleto: { startsWith: "SMOKE" } } });
  console.log(`\nLimpieza: pacientes SMOKE restantes = ${quedan}`);
  await prisma.$disconnect();
}

try { await main(); } catch (e) { fail++; fallas.push("EXCEPCION: " + e.message); console.log("\nEXCEPCION:", e); }
await limpiar();
console.log(`\n=== RESULTADO: ${pass} ok, ${fail} fallas ===`);
if (fallas.length) { console.log("Fallas:"); fallas.forEach((f) => console.log(" - " + f)); }
process.exit(fail ? 1 : 0);
