# Manual técnico — Sistema de Expediente Clínico y Administrativo

**Hospital de Especialidades Verapaz — Cobán, Alta Verapaz**

| Campo | Valor |
|---|---|
| Documento | Manual técnico (arquitectura, instalación, operación, seguridad y API) |
| Fecha | 14/10/2026 |
| Rama de referencia | `Dev_Diego` |
| Estado del código | Commit `1a5a4d9` (incluye los cambios de ingresos múltiples, adjuntos y ocultación de Bitácora) |
| Público | Administradores de sistemas, desarrolladores y personal de soporte técnico |

Este documento describe el sistema tal como está implementado en el código. Cuando algo es una decisión pendiente o una limitación conocida, se indica explícitamente en la sección 15. Las rutas, roles y valores por defecto citados se verificaron contra el código fuente.

---

## 1. Alcance

El sistema es una aplicación web para la gestión del expediente clínico y administrativo de un hospital. Cubre:

- Registro y admisión de pacientes, con historial de ingresos múltiples.
- Expediente clínico con diagnósticos cifrados y control de acceso por token temporal.
- Documentos escaneados y archivos adjuntos del paciente.
- Tratamientos intrahospitalarios, recetas médicas y clientes referidos.
- Facturación del hospital y de farmacia, gastos y reportes financieros.
- Inventario y ventas de farmacia.
- Gestión de usuarios, roles y auditoría.

Fuera de alcance de este documento: el contenido funcional de cada pantalla (ver el manual de usuario) y la especificación de requerimientos (ver `docs/Req_y_Estructura.docx`).

---

## 2. Arquitectura

### 2.1 Vista general

```
                 Navegador (SPA React)
                         │  HTTP :8080
                         ▼
        ┌────────────────────────────────────┐
        │ frontend (Nginx)                   │
        │  - sirve /  (SPA, fallback a index)│
        │  - proxy /api/ → backend:4000      │
        └──────────────┬─────────────────────┘
                       │ red privada de compose
                       ▼
        ┌────────────────────────────────────┐
        │ backend (Node 22 + Express 4)      │
        │  - JWT, roles, tokens temporales   │
        │  - cifrado AES-256-GCM             │
        │  - Prisma ORM                      │
        └───────┬───────────────┬────────────┘
                │ TCP 5432      │ volúmenes
                ▼               ▼
        ┌──────────────┐  uploads/ (archivos cifrados)
        │ db (Postgres │  backups/ (respaldos .sql)
        │ 16-alpine)   │
        └──────────────┘
```

En el despliegue con Docker Compose, **solo el frontend publica un puerto** (`${FRONTEND_PORT:-8080}`). El backend y PostgreSQL viven en la red interna de compose; PostgreSQL además se expone solo en `127.0.0.1:5433` para ejecutar el backend fuera de Docker.

### 2.2 Componentes

| Componente | Tecnología | Responsabilidad | Ubicación |
|---|---|---|---|
| SPA | React 18.3, Vite 5.4, react-router-dom 6.26, Tailwind 3 | Interfaz, validación de formularios, OCR y escaneo en el navegador | `frontend/` |
| Servidor web | Nginx (imagen `nginx:alpine`) | Sirve la SPA compilada, proxy `/api/`, corrige el MIME de `.mjs` | `frontend/nginx.conf` |
| API | Node 22, Express 4.19, express-async-errors | Lógica de negocio, autenticación, autorización, cifrado | `backend/src/` |
| ORM | Prisma 5.x (`@prisma/client`) | Acceso a datos y migraciones | `backend/prisma/` |
| Base de datos | PostgreSQL 16 | Persistencia | servicio `db` |
| Almacenamiento de archivos | Sistema de archivos (volumen `uploads`) | Binarios cifrados (sobres AES-GCM) | `backend/uploads/` |
| Escaneo móvil | Sesiones en memoria (Map) con TTL de 10 min | Recibir el PDF desde el teléfono | `escaneoMovil.controller.js` |
| Lectura avanzada (opcional) | `@anthropic-ai/sdk` | Lectura de letra manuscrita en la ficha escaneada | `lecturaVision.service.js` |

### 2.3 Flujo de una petición autenticada

1. El navegador envía `Authorization: Bearer <JWT>` a `/api/...`.
2. Nginx reenvía la petición a `backend:4000`.
3. `requireAuth` verifica la firma del JWT (`JWT_SECRET`) y deja `req.user = { id, nombre, roles }`. También actualiza `Usuario.ultimaActividad` sin bloquear la respuesta.
4. `requireRole(...)` compara `req.user.roles` con los roles permitidos por la ruta.
5. Para el expediente, `requireTempToken` valida `x-temp-token` (sección 7.4).
6. El controlador ejecuta la operación; las operaciones de varios pasos usan `prisma.$transaction`.
7. La acción se registra en `LogActividad` (`registrarActividad`); si ese registro falla, la operación principal no se interrumpe.

### 2.4 Estructura del repositorio

```
hospital-verapaz-sistema/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma            modelo de datos (fuente de verdad)
│   │   ├── migrations/              22 migraciones SQL versionadas
│   │   ├── seed.js                  usuarios de prueba, inventario y catálogos
│   │   └── data/cie10.js            catálogo CIE-10 (subconjunto curado)
│   ├── scripts/
│   │   ├── backup.js                respaldo con pg_dump
│   │   ├── migrar-egreso-cifrado.js        migración histórica (una vez)
│   │   ├── migrar-anexos-a-documentos.js   migración histórica (una vez)
│   │   └── recifrar-archivos.js            recifrado de archivos en claro (una vez)
│   ├── src/
│   │   ├── app.js                   Express: montaje de rutas, health, error handler
│   │   ├── server.js                listen en PORT (4000 por defecto)
│   │   ├── config/                  env.js (validación), prisma.js (cliente)
│   │   ├── routes/                  un router por módulo
│   │   ├── controllers/             un controlador por módulo
│   │   ├── middlewares/             auth.middleware.js, rate-limit.middleware.js
│   │   ├── services/                facturación, notificación, actividad, lectura visión
│   │   └── utils/                   crypto, archivos, roles, paginación, periodos
│   ├── tests/
│   │   ├── unit/                    pruebas unitarias (node:test)
│   │   └── integracion.smoke.mjs    prueba de integración contra un stack levantado
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx                  rutas (react-router)
│   │   ├── pages/                   una página por módulo
│   │   ├── components/              Layout, formularios, impresión de fichas
│   │   ├── context/AuthContext.jsx  sesión (localStorage)
│   │   ├── services/api.js          cliente HTTP
│   │   ├── hooks/                   useFetch, usePaginatedFetch
│   │   └── utils/                   validadores (DPI, teléfono), OCR, PDF, roles
│   ├── tests/                       pruebas unitarias (.test.mjs) y E2E (.spec.ts)
│   ├── nginx.conf
│   ├── vite.config.js
│   ├── playwright.config.ts
│   └── Dockerfile
├── docs/                            documentación del proyecto (incluye este manual)
├── .github/workflows/ci.yml        pipeline de CI/CD
├── docker-compose.yml
└── .env.example                     variables para docker compose
```

---

## 3. Stack y versiones

Versiones declaradas en `package.json` (rangos semver):

| Paquete | Versión declarada | Uso |
|---|---|---|
| express | ^4.19.0 | Servidor HTTP |
| express-async-errors | ^3.1.1 | Propaga errores async al manejador central |
| @prisma/client, prisma | ^5.19.0 | ORM y CLI de migraciones |
| jsonwebtoken | ^9.0.0 | Firma y verificación de JWT (HS256) |
| bcrypt | ^5.1.0 | Hash de contraseñas (cost 10) |
| multer | ^2.2.0 | Recepción de multipart/form-data en memoria |
| zod | ^4.6.5 | Esquema de la lectura avanzada |
| @anthropic-ai/sdk | ^0.127.0 | Cliente de la lectura avanzada (opcional) |
| dotenv | ^16.4.0 | Carga de `.env` |
| cors | ^2.8.5 | CORS (sin opciones restrictivas, ver R12) |
| react / react-dom | ^18.3.0 | Interfaz |
| react-router-dom | ^6.26.0 | Enrutamiento de la SPA |
| vite | ^5.4.0 | Compilación y servidor de desarrollo |
| tailwindcss | ^3.4.0 | Estilos utilitarios |
| tesseract.js | ^7.0.0 | OCR en el navegador |
| pdfjs-dist | ^6.3.289 | Lectura de PDF en el navegador |
| jspdf | — | Generación de PDF (fichas, facturas, recetas) |
| recharts | ^2.15.4 | Gráficas de reportes |
| qrcode | ^1.5.4 | Código QR del escaneo móvil |
| @playwright/test | ^1.64.0 | Pruebas E2E |

Imágenes de contenedor: `node:22-alpine` (backend y compilación del frontend), `nginx:alpine` (frontend), `postgres:16-alpine` (base de datos). Node 22 es la versión usada en CI y en los contenedores; el desarrollo local se ha probado también con Node 24.

---

## 4. Configuración

### 4.1 Variables de entorno del backend

Se leen desde `backend/.env` (desarrollo) o desde el entorno del contenedor (Docker, inyectadas por `docker-compose.yml`). La validación crítica ocurre en `src/config/env.js` al arrancar: si falta una variable obligatoria o es inválida, el proceso termina con código 1 y muestra el detalle.

| Variable | Obligatoria | Por defecto | Descripción |
|---|---|---|---|
| `DATABASE_URL` | Sí | — | Cadena de conexión PostgreSQL (`postgresql://usuario:clave@host:5432/hospital_verapaz`). |
| `JWT_SECRET` | Sí | — | Secreto de firma JWT. Mínimo 16 caracteres. |
| `ENCRYPTION_KEY` | Sí | — | Llave AES-256 en hexadecimal: **exactamente 64 caracteres hex** (32 bytes). Ver 4.4. |
| `JWT_EXPIRES_IN` | No | `8h` | Duración de la sesión (formato de `jsonwebtoken`). |
| `TEMP_TOKEN_EXPIRES_MIN` | No | `15` | Vigencia de los tokens de acceso temporal, en minutos. |
| `PASSWORD_RESET_EXPIRES_MIN` | No | `30` | Vigencia del enlace de recuperación de contraseña. |
| `PASSWORD_RESET_EXPOSE_TOKEN` | No | `false` | Si es `true`, `forgot-password` devuelve el token en la respuesta. **Solo laboratorio.** |
| `NOTIFICACION_PROVEEDOR` | No | `consola` | Adaptador de notificación. Hoy solo existe `consola`; cualquier otro valor lanza error. |
| `APP_URL` | No | `http://localhost:5173` | URL pública del frontend; se usa para armar el enlace de recuperación. |
| `PORT` | No | `4000` | Puerto del backend. |
| `UPLOAD_MAX_MB_ESTUDIOS` | No | `5` | Tamaño máximo por archivo de estudios del diagnóstico. |
| `DOCUMENT_MAX_MB` | No | `20` | Tamaño máximo por archivo en documentos del paciente, escaneo y adjuntos. |
| `DOCUMENT_MAX_PAGES` | No | `30` | Páginas máximas para documentos del paciente (ver D4). |
| `UPLOAD_TIPOS_PERMITIDOS` | No | `application/pdf,image/png,image/jpeg` | Lista de MIME permitidos. Si se cambia, la validación de firma solo cubre PDF, PNG y JPEG. |
| `SEED_ADMIN_EMAIL` | No | `admin@hospitalverapaz.gt` | Correo del administrador creado por el seed. |
| `SEED_ADMIN_PASSWORD` | No | `CambiarEsta123` | Contraseña del administrador creado por el seed. **Cambiar.** |
| `ANTHROPIC_API_KEY` | No | — | Activa la lectura avanzada. Sin ella, la función está apagada. |
| `ANTHROPIC_MODEL` | No | `claude-opus-5` | Modelo para la lectura avanzada (`.env.example` sugiere `claude-sonnet-5` como alternativa más económica). |

Variables que aparecen en `.env.example` pero **no se usan** en el código: `UPLOAD_MAX_MB_ANEXOS` (raíz). Se eliminó la función de anexos en la fusión del 23/09/2026.

### 4.2 Variables de Docker Compose (archivo `.env` en la raíz)

| Variable | Por defecto en compose | Uso |
|---|---|---|
| `POSTGRES_PASSWORD` | obligatoria | Clave del usuario `verapaz`. |
| `JWT_SECRET` | obligatoria | Pasada al backend. |
| `ENCRYPTION_KEY` | obligatoria | Pasada al backend. |
| `FRONTEND_PORT` | `8080` | Puerto publicado del frontend. |
| `APP_URL` | `http://localhost:8080` | Enlaces de recuperación. |
| `RUN_MIGRATIONS` | `true` | Aplica `prisma migrate deploy` al arrancar el backend. |
| `RUN_SEED` | `true` | Ejecuta `prisma/seed.js` al arrancar el backend. Ver D1 (duplicación de inventario). |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | valores de `.env.example` | Administrador inicial. |

El resto de variables del backend se pueden añadir en `docker-compose.yml` (sección `environment` del servicio `backend`).

### 4.3 Validación de la llave de cifrado

`env.js` exige `/^[0-9a-fA-F]{64}$/` para `ENCRYPTION_KEY`. Para generar una llave:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4.4 Custodia de `ENCRYPTION_KEY`

La llave protege:
- `Diagnostico.textoCifrado` (contenido de cada diagnóstico),
- `EgresoClinico.textoCifrado` (datos clínicos de egreso),
- todos los binarios en `uploads/` (documentos, adjuntos y archivos de estudios).

**Si la llave se pierde o cambia, esos datos no se pueden recuperar.** No hay mecanismo de recuperación ni de rotación documentado en el proyecto. La llave debe guardarse en custodia separada del respaldo de base de datos (sección 13.2).

---

## 5. Instalación y despliegue

### 5.1 Despliegue con Docker Compose (recomendado)

Requisitos: Docker Engine con el plugin Compose v2.

```bash
# 1. Crear la configuración
cp .env.example .env
# Completar: POSTGRES_PASSWORD, JWT_SECRET, ENCRYPTION_KEY, SEED_ADMIN_PASSWORD

# 2. Construir y levantar
docker compose up -d --build

# 3. Verificar
docker compose ps
curl -fsS http://localhost:8080/api/health     # {"status":"ok","db":"ok"}
```

Servicios:

| Servicio | Imagen | Puerto publicado | Volúmenes | Notas |
|---|---|---|---|---|
| `db` | postgres:16-alpine | `127.0.0.1:5433 → 5432` | `pgdata` | Healthcheck con `pg_isready`. |
| `backend` | build de `backend/` | ninguno | `uploads → /app/uploads`, `backups → /app/backups` | Usuario no root `verapaz`. Healthcheck en el Dockerfile contra `/api/health`. |
| `frontend` | build de `frontend/` | `${FRONTEND_PORT:-8080} → 80` | ninguno | Depende de `backend`. |

En el arranque, el contenedor de `backend` ejecuta, en orden: `prisma migrate deploy` (si `RUN_MIGRATIONS=true`), `node prisma/seed.js` (si `RUN_SEED=true`) y `node src/server.js`.

Operaciones frecuentes:

```bash
docker compose logs -f backend          # seguir logs del backend
docker compose exec backend sh          # shell dentro del contenedor
docker compose restart backend          # reinicio
docker compose down                     # detener (conserva volúmenes)
docker compose down -v                  # ¡borra volúmenes: base de datos y archivos!
```

Después de la instalación inicial, poner `RUN_SEED=false` (y `RUN_MIGRATIONS=true` puede mantenerse, es idempotente).

### 5.2 Desarrollo local (sin Docker)

Requisitos: Node 22, PostgreSQL 16 accesible, `pg_dump` si se usará el respaldo.

```bash
# Backend
cd backend
cp .env.example .env            # completar DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY
npm ci                          # el postinstall ejecuta prisma generate
npx prisma migrate deploy       # aplica migraciones existentes
npm run prisma:seed             # usuarios de prueba, inventario y catálogos
npm run dev                     # watch sobre src/ y prisma/schema.prisma, puerto 4000

# Frontend (otra terminal)
cd frontend
npm ci
npm run dev                     # Vite en http://localhost:5173, proxy /api → localhost:4000
```

Notas:
- `npm run prisma:migrate` ejecuta `prisma migrate dev`, que puede **crear migraciones y resetear datos**. No usarlo en entornos con datos reales; para aplicar migraciones use `npx prisma migrate deploy`.
- `npm run start` ejecuta `node src/server.js` sin watch.
- Para crear una migración nueva en desarrollo: `npx prisma migrate dev --name <nombre_descriptivo>` y revisar el SQL generado antes de versionarlo.

### 5.3 HTTPS en desarrollo y escaneo desde el teléfono

La cámara del navegador (`getUserMedia`) y `crypto.randomUUID()` exigen contexto seguro: HTTPS o `localhost`. Para probar desde un teléfono en la misma red:

- **Certificado autofirmado de desarrollo:** coloque `dev-key.pem` y `dev-cert.pem` en `frontend/.cert/` (ignorados por git). `vite.config.js` los detecta y activa HTTPS. Ver `frontend/.cert/README.md`.
- **Túnel HTTPS con ngrok:** `ngrok http 8080` (Docker) o `ngrok http 5173` (Vite). Abra el sistema desde la URL de ngrok; el QR generado usa `window.location.origin`, por lo que apunta a esa URL pública. Vite tiene `allowedHosts: true` para aceptar el dominio del túnel.

El authtoken de ngrok es una credencial: no lo versione ni lo comparta.

### 5.4 Procedimiento de actualización

1. Respaldar base de datos y `uploads/` (sección 13.2).
2. Obtener el código de la versión objetivo (`git pull` o nuevo artefacto).
3. `docker compose up -d --build`. Con `RUN_MIGRATIONS=true`, las migraciones pendientes se aplican al arrancar el backend.
4. Verificar `/api/health` y ejecutar la prueba de integración (sección 11.2) si el entorno lo permite.
5. **Si una migración falla, el backend arranca igualmente** con el esquema anterior: el `CMD` del `Dockerfile` encadena los pasos con `;` y no con `&&`, así que un error de `migrate deploy` solo queda en los logs (ver D14). Tras cada actualización, revise `docker compose logs backend` buscando errores de Prisma y verifique la tabla `_prisma_migrations`. Si una migración falla, restaure el respaldo antes de reintentar.

---

## 6. Base de datos

### 6.1 Motor y convenciones

- PostgreSQL 16. Esquema gestionado exclusivamente con Prisma Migrate (`backend/prisma/migrations/`).
- Identificadores `Int` autoincrementales. Fechas `TIMESTAMP(3)`. Montos `DECIMAL(10,2)`.
- Arreglos nativos para roles (`Usuario.roles TEXT[]`).
- Campos cifrados guardan `textoCifrado`, `iv` y `authTag` en hexadecimal.

### 6.2 Entidades

| Modelo | Módulo | Propósito | Notas |
|---|---|---|---|
| `Usuario` | Seguridad | Cuenta, `roles[]`, `puedeAutogenerarToken`, colegiado, especialidad, `ultimaActividad` | `correo` único. `passwordHash` bcrypt. |
| `PasswordResetToken` | Seguridad | Recuperación de contraseña | Guarda SHA-256 del token; uso único; expira. |
| `TokenTemporal` | Seguridad | Token de acceso al diagnóstico | `token` único; `usado`; `expiraEn`; `pacienteId` opcional. |
| `LogActividad` | Auditoría general | Quién hizo qué y cuándo | Índices por usuario, fecha y acción. |
| `Paciente` | Admisión | Identidad y datos administrativos | `historiaClinica` y `dpi` únicos. Conserva columnas legacy de egreso en texto plano que la API actual ya no escribe (ver D13). |
| `Ingreso` | Admisión / Expediente | Una admisión del paciente | Uno a muchos con `Paciente`. Incluye `impresionClinicaIngreso` en texto plano (ver 7.10). |
| `EgresoClinico` | Admisión | Payload clínico de egreso cifrado | Uno a uno con `Paciente`. |
| `RegistroMaternidad` | Admisión | Datos del nacimiento y del padre | Uno a uno con `Paciente`. |
| `DocumentoPaciente` | Documentos | Metadatos de documentos y adjuntos | Borrado lógico (`eliminadoEn`). Binario cifrado en disco. |
| `Diagnostico` | Expediente | Versión cifrada del diagnóstico | Cada guardado crea una fila; no hay UPDATE. Opcional `ingresoId`. |
| `DiagnosticoArchivo` | Expediente | Archivos de "Estudios y resultados" | Binario cifrado en `uploads/diagnosticos/`. |
| `AccesoDiagnostico` | Auditoría clínica (RNF-08) | Cada vista de un diagnóstico | Registra usuario, si fue por token y su id. |
| `TratamientoItem` | Tratamiento | Costos intrahospitalarios y de farmacia usados | `facturado` evita doble cobro. |
| `Receta` | Tratamiento | Receta médica | `medicoId` apunta a un `Usuario`. |
| `MedicoReferente` | Referidos | Médico o institución referente y comisión | |
| `FacturaHospital` | Financiera | Factura del hospital | `costoTratamiento` y `total` redondeados a 2 decimales. |
| `CategoriaFiscal` | Financiera | Catálogo editable de categorías | `nombre` único. Tasa informativa. |
| `GastoHospital` | Financiera | Gastos del hospital | `montoImpuestoEstimado` congelado al registrar. |
| `FacturaFarmacia` | Farmacia | Cabecera de venta directa | `pacienteId` opcional. |
| `VentaFarmacia` | Farmacia | Líneas de la venta | Una por medicamento. |
| `MedicamentoInventario` | Farmacia | Existencias | `stockMinimo`, `fechaVencimiento`. **Sin restricción única en `nombre`.** |
| `MovimientoInventario` | Farmacia | Kardex | `tipo` entrada/salida; `motivo`. |
| `CatalogoCie10` | Catálogo | Códigos CIE-10 de uso frecuente | `codigo` único. |
| `BitacoraVisita` | Bitácora de Visitas | Visitas registradas | Módulo retirado de la interfaz; el modelo y la API siguen activos. |

### 6.3 Relaciones principales

- `Paciente` 1—N `Ingreso`; `Ingreso` 1—N `Diagnostico` (opcional, `ON DELETE SET NULL`).
- `Paciente` 1—1 `EgresoClinico`, 1—1 `RegistroMaternidad`; 1—N `DocumentoPaciente`, `TratamientoItem`, `Receta`, `FacturaHospital`, `BitacoraVisita`, `TokenTemporal`, `AccesoDiagnostico`, `FacturaFarmacia`.
- `Usuario` 1—N `Diagnostico` (`registradoPor`), `Receta` (`medicoId`), `TokenTemporal` (como titular y como emisor), `DocumentoPaciente`, `GastoHospital`, `LogActividad`.
- `CategoriaFiscal` 1—N `GastoHospital`.
- `MedicamentoInventario` 1—N `MovimientoInventario` y `VentaFarmacia`.
- `FacturaFarmacia` 1—N `VentaFarmacia`.

Las claves foráneas a `Paciente` usan `ON DELETE RESTRICT` (por defecto de Prisma para relaciones requeridas): **no existe endpoint de borrado de pacientes**, y la base impide borrarlos mientras tengan registros asociados.

### 6.4 Restricciones de integridad relevantes

- `Paciente.historiaClinica` y `Paciente.dpi`: únicos. Los controladores responden 409 antes de llegar a la restricción.
- `Usuario.correo`: único.
- `CatalogoCie10.codigo`, `CategoriaFiscal.nombre`, `EgresoClinico.pacienteId`, `RegistroMaternidad.pacienteId`: únicos.
- `MedicamentoInventario`: solo tiene índice (no único) sobre `nombre`. Ver D1.

### 6.5 Borrado lógico y retención

- `DocumentoPaciente.eliminadoEn`: el documento deja de listarse y descargarse; el binario se conserva según la política de retención. La depuración física no está automatizada.
- Los diagnósticos nunca se modifican ni se borran por la API: cada guardado es una versión nueva.

### 6.6 Historial de migraciones

| # | Migración | Contenido resumido |
|---|---|---|
| 1 | `20260819022631_init` | Esquema inicial. |
| 2 | `20260820195841_agrega_auditoria_diagnostico` | Auditoría de acceso al diagnóstico. |
| 3 | `20260820201918_agrega_accion_a_auditoria` | Campo `accion`. |
| 4 | `20260820210313_factura_farmacia_multilinea` | Facturas de farmacia con líneas. |
| 5 | `20260820215115_agrega_telefono_emergencia` | Teléfono de emergencia. |
| 6 | `20260820215809_bitacora_general_y_estado_en_linea` | `LogActividad` y `ultimaActividad`. |
| 7 | `20260820221553_paso1_agrega_roles_array` | `roles TEXT[]`. |
| 8 | `20260820222525_paso2_elimina_columna_rol` | Retira la columna `rol` única. |
| 9 | `20260821052433_paso3_agrega_contexto_atencion_diagnostico` | Tipo de atención, servicio, sala/cama. |
| 10 | `20260825193155_paso4_agrega_catalogo_cie10` | Catálogo CIE-10. |
| 11 | `20260825193915_paso5_agrega_personal_medico_procedimiento` | Equipo quirúrgico, colegiado, especialidad. |
| 12 | `20260825195942_paso6_agrega_archivo_diagnostico` | `DiagnosticoArchivo`. |
| 13 | `20260825215914_paso7_agrega_tipo_sangre` | Tipo de sangre. |
| 14 | `20260908120000_paso8_egreso_cifrado_anexos_reset_colegiado` | `EgresoClinico` cifrado; reset de colegiado. |
| 15 | `20260913150000_paso9_documentos_paciente` | `DocumentoPaciente`. |
| 16 | `20260915120000_paso10_fecha_documento_original` | `fechaDocumentoOriginal`. |
| 17 | `20260921120000_paso11_maternidad_padres` | Datos del bebé y del padre. |
| 18 | `20260923120000_paso12_fusion_anexos_documentos` | Fusión de Anexos en Documentos. |
| 19 | `20260923150000_paso13_gastos_hospital` | `GastoHospital` y `CategoriaFiscal`. |
| 20 | `20260924120000_paso14_impuesto_estimado_gasto` | `montoImpuestoEstimado`. |
| 21 | `20261008120000_datos_formulario_admision` | Cónyuge, emergencia, referido por, otras hospitalizaciones; autopsia del bebé. |
| 22 | `20261013120000_paso15_ingresos_paciente` | Tabla `Ingreso`, `Diagnostico.ingresoId`, backfill (ver 6.7). |

### 6.7 Migración de ingresos múltiples (`20261013120000`)

1. Crea `Ingreso` con FK a `Paciente` (`ON DELETE RESTRICT`) e índices por `pacienteId` y `fechaIngreso`.
2. Agrega `Diagnostico.ingresoId` (nullable) con FK `ON DELETE SET NULL` e índice.
3. **Backfill:** inserta un `Ingreso` por cada `Paciente` con `fechaIngreso` no nulo, copiando los campos de admisión.
4. **Backfill:** asigna a cada `Diagnostico` existente el ingreso de su paciente (un paciente tiene exactamente uno tras el paso 3).

Verificación realizada en el entorno de desarrollo: el backfill creó 1 ingreso para el único paciente existente; no había diagnósticos que enlazar.

---

## 7. Seguridad

### 7.1 Autenticación

- `POST /api/auth/login` valida `correo` y `password` con `bcrypt.compare` y emite un JWT firmado con HS256 (`jsonwebtoken`, secreto `JWT_SECRET`).
- Payload del JWT: `{ id, nombre, roles, iat, exp }`. Expira según `JWT_EXPIRES_IN` (8 h por defecto).
- **No hay lista de revocación.** `POST /api/auth/logout` solo registra el evento en `LogActividad`. Un token robado es válido hasta su expiración.
- Los roles viajan en el JWT: un cambio de roles surte efecto cuando el usuario inicia sesión de nuevo.
- El frontend guarda `token` y `usuario` en `localStorage` (`AuthContext.jsx`) y los envía como Bearer en cada petición (`services/api.js`).

### 7.2 Contraseñas

- Hash: bcrypt con cost 10.
- Recuperación: `forgot-password` genera 32 bytes aleatorios, guarda solo su SHA-256 y lo envía por el adaptador de notificación. Expira en `PASSWORD_RESET_EXPIRES_MIN`. La respuesta es idéntica exista o no el correo (anti-enumeración).
- `reset-password`: exige token vigente y no usado, y `password` de al menos 8 caracteres. El cambio de contraseña y el marcado del token como usado se hacen en una misma transacción.
- En la creación de usuario (`POST /api/usuarios`) el código solo exige que `password` no esté vacío; **no valida longitud mínima** (ver R10).

### 7.3 Autorización por rol

`requireRole(...)` compara `req.user.roles` con los roles de la ruta. Un usuario con varios roles obtiene la unión de sus permisos. El detalle de qué ruta exige qué rol está en la sección 9.

Regla de diseño: **la autorización se aplica en el backend**. La interfaz oculta o deshabilita acciones por comodidad, pero no es una barrera de seguridad. Ejemplo verificado: el menú lateral muestra todos los módulos a cualquier rol; los permisos se imponen por endpoint.

### 7.4 Tokens de acceso temporal (diagnóstico)

Implementados en `auth.middleware.js` (`requireTempToken`) y `auth.controller.js`:

1. **Emisión.**
   - Administrador: `POST /api/auth/token` con `usuarioId` y `pacienteId` opcional. Genera 24 bytes aleatorios (48 hex).
   - Usuario con permiso: `POST /api/auth/token/auto` (requiere `puedeAutogenerarToken` o rol Administrador). Emite el token a sí mismo.
   - Vigencia: `TEMP_TOKEN_EXPIRES_MIN` (15 min).
2. **Verificación** en cada petición a `/api/expedientes/paciente/:id` (GET y POST):
   - Si el usuario tiene rol Administrador, se omite el token (acceso permanente, RF-11).
   - Si no, se exige el header `x-temp-token`, y se comprueba: que exista, que no esté `usado`, que no esté expirado, que pertenezca al usuario autenticado, y que, si el token tiene `pacienteId`, coincida con el `:id` de la ruta.
3. **Consumo.** Si todo es válido, el token se marca `usado = true` **antes** de ejecutar el controlador (uso único, RNF-12).
4. **Auditoría.** Cada respuesta exitosa de `GET` crea un registro en `AccesoDiagnostico` (`viaToken`, `tokenId`).

Observaciones: ver 7.10 (R6 y R8).

### 7.5 Cifrado

- Algoritmo: **AES-256-GCM** (`crypto.util.js`), IV aleatorio de 12 bytes por operación, tag de autenticación de 16 bytes.
- **Campos cifrados:** `Diagnostico.textoCifrado` (JSON de la plantilla clínica) y `EgresoClinico.textoCifrado` (payload de egreso). Cada fila guarda `iv` y `authTag`.
- **Archivos:** formato de "sobre" en disco: `[IV 12 bytes][authTag 16 bytes][ciphertext]`. El nombre interno es `enc_<48 hex>.bin`. Los archivos sin prefijo `enc_` se leen en claro (compatibilidad con históricos) y se pueden recifrar con `scripts/recifrar-archivos.js`.
- Un tag que no coincide provoca error de descifrado: se detecta manipulación o llave incorrecta.

### 7.6 Manejo de archivos

Reglas de `utils/archivos.util.js`:

- Tipos permitidos por defecto: `application/pdf`, `image/png`, `image/jpeg`.
- La validación exige **tres condiciones simultáneas**: el MIME declarado está permitido, la extensión corresponde a ese MIME (`.pdf`; `.png`; `.jpg`/`.jpeg`) y los primeros bytes son la firma del formato (`%PDF-`, `\x89PNG\r\n\x1a\n`, `FF D8 FF`).
- El nombre original no se usa para escribir en disco; se rechazan nombres con `/`, `\` o `..`.
- Los PDF del escaneo se verifican además con `validarPdf` (firma `%PDF-` y MIME).
- Los binarios se procesan en memoria (multer `memoryStorage`) y se cifran antes de tocar disco.

Límites vigentes:

| Flujo | Límite | Fuente |
|---|---|---|
| Archivos de estudios (diagnóstico) | 5 MB por archivo | `UPLOAD_MAX_MB_ESTUDIOS` |
| Documentos del paciente y adjuntos de admisión | 20 MB por archivo; 10 adjuntos por envío | `DOCUMENT_MAX_MB`; `multer.fields` |
| Escaneo móvil (PDF del teléfono) | 20 MB | constante en `escaneoMovil.routes.js` |
| Lectura avanzada (imagen) | 8 MB | constante en `lecturaExpediente.controller.js` |
| Cuerpo JSON | 100 KB | límite por defecto de `express.json()` |

Nota: `nginx.conf` limita el cuerpo a 20 MB (`client_max_body_size 20m`).

### 7.7 Auditoría

| Registro | Qué guarda | Consulta |
|---|---|---|
| `LogActividad` | login, logout, solicitud y cambio de contraseña, alta y edición de pacientes, ingresos, documentos, facturas, ventas, gastos y más | Reportes → Actividad (solo Administrador) |
| `AccesoDiagnostico` | cada visualización del diagnóstico: usuario, paciente, fecha, si fue con token | Reportes → Auditoría del diagnóstico |
| `LogActividad` (`ultimaActividad`) | última petición autenticada por usuario | Seguridad y Roles ("en línea") |

Las llamadas a `registrarActividad` no bloquean la operación: si fallan, se escribe en consola.

### 7.8 Límites de intentos (rate limiting)

`rate-limit.middleware.js`, implementación **en memoria** por IP (`req.ip`):

| Endpoint | Ventana | Máximo | Modo |
|---|---|---|---|
| `POST /api/auth/login` | 5 min | 10 **fallos** | solo cuenta respuestas ≥ 400 |
| `POST /api/auth/forgot-password` y `reset-password` | 5 min | 5 peticiones | cuenta todas |

Respuesta al exceder: `429` con cabecera `Retry-After`. Cada limitador tiene su propio mapa de contadores. Al ser en memoria, los contadores se pierden al reiniciar el backend y **no se comparten entre instancias**.

Detrás de Nginx, `req.ip` es la IP del proxy salvo que se configure `trust proxy` en Express (no está configurado). Esto significa que, en el despliegue actual, **todos los clientes comparten el mismo contador** de login (ver R14).

### 7.9 Red, CORS y TLS

- `app.use(cors())` sin opciones: acepta cualquier origen (ver 7.10, R6).
- El backend no implementa TLS; el HTTPS lo debe proporcionar el hosting o un proxy externo.
- Nginx no añade cabeceras de seguridad (`X-Content-Type-Options`, `Content-Security-Policy`, `Strict-Transport-Security`).
- Solo el frontend publica puerto en Docker Compose; PostgreSQL queda en `127.0.0.1`.

### 7.10 Riesgos y observaciones de seguridad

Evaluación basada en el código al commit `1a5a4d9`. Severidad: A alta, M media, B baja.

| ID | Sev. | Hallazgo | Evidencia | Recomendación |
|---|---|---|---|---|
| R1 | A | `Ingreso.impresionClinicaIngreso` (nuevo en la migración 22) y `Paciente.impresionClinicaIngreso` se guardan **en texto plano**, sin cifrar. `GET /api/pacientes/:id` incluye `ingresos` completos y el listado (`SELECT_LISTADO`) incluye `impresionClinicaIngreso`; ambos son accesibles para **cualquier rol autenticado**. | `pacientes.controller.js` → `obtenerUno` (`include: { ingresos }`), `schema.prisma` | Cifrar la impresión clínica al estilo de `Diagnostico`, o retirarla de la respuesta para roles sin acceso clínico. |
| R2 | A | Los documentos del paciente (incluidos resultados clínicos adjuntos y el expediente escaneado) pueden **listarse y descargarse sin token temporal** por los roles Consulta y Enfermería. | `pacientes.routes.js`; comentarios de `documentos.controller.js` | Decidir la clasificación de estos archivos. Si son clínicos, exigir token o mover a estudios del diagnóstico. |
| R3 | M | Los resultados clínicos adjuntos se guardan como `DocumentoPaciente` con `tipoDocumental = "resultado_clinico"`. El comentario del modelo indica que los resultados de exámenes **no** deben ir en esa tabla. | `pacientes.controller.js` (`crear` y adjuntos), `schema.prisma` (DocumentoPaciente) | Decisión pendiente (ver D2). |
| R4 | M | `GET /api/pacientes` y `GET /api/pacientes/:id` solo exigen autenticación. Cualquier rol (incluido Farmacia) ve datos administrativos completos del paciente. | `pacientes.routes.js` | Restringir por rol o devolver un DTO mínimo para roles no administrativos. |
| R5 | M | `GET /api/facturacion` y `GET /api/facturacion/:id` solo exigen autenticación. | `facturacion.routes.js` | Añadir `requireRole(ADMIN, FACTURACION)`. |
| R6 | M | Un token emitido desde la interfaz **no lleva `pacienteId`** (la pantalla de emisión solo elige usuario). Con ese token, cualquier paciente puede consultarse durante 15 minutos. | `SeguridadPage.jsx`, `auth.controller.js` | Hacer obligatorio `pacienteId` en la emisión desde la interfaz. |
| R7 | M | El seed imprime en consola la contraseña del administrador y crea cuentas con contraseñas fijas y conocidas (en `prisma/seed.js`). En `docker-compose.yml`, `RUN_SEED` vale `true` por defecto. | `seed.js`, `docker-compose.yml` | Poner `RUN_SEED=false` tras la instalación; cambiar contraseñas; no usar el seed en producción con cuentas de prueba. |
| R8 | B | `requireTempToken` marca el token como usado **antes** de ejecutar el controlador. Si la operación falla después (p. ej., validación 400), el token se pierde. | `auth.middleware.js` | Consumir el token al final, en la misma transacción que la operación. |
| R9 | B | En `POST /api/expedientes/paciente/:id`, `uploadEstudios` (multer) procesa el cuerpo **antes** de `requireTempToken`. Hay consumo de recursos antes de comprobar el permiso. | `expedientes.routes.js` | Invertir el orden: primero token, luego multer. |
| R10 | B | La creación de usuarios no valida longitud mínima de contraseña (el reset sí exige 8). | `usuarios.controller.js` (`crear`) | Aplicar la misma regla que en el reset. |
| R11 | B | El manejador de errores devuelve `err.message` al cliente en respuestas 500. Puede filtrar detalles internos. | `app.js` | Devolver mensaje genérico en 500 y registrar el detalle en el servidor. |
| R12 | B | CORS abierto (`cors()`), sin cabeceras de seguridad en Nginx. | `app.js`, `nginx.conf` | Restringir `origin` a `APP_URL`; añadir cabeceras básicas en Nginx. |
| R13 | B | JWT sin revocación; logout no invalida el token. | `auth.controller.js` | Lista de revocación o sesiones con id en base de datos. |
| R14 | B | Rate limiting en memoria y sin `trust proxy`: el límite de login se comparte entre todos los clientes detrás de Nginx. | `rate-limit.middleware.js` | Configurar `app.set("trust proxy", 1)` y considerar almacén compartido. |
| R15 | Info | La lectura avanzada envía la primera página del expediente a un servicio externo (Anthropic) cuando `ANTHROPIC_API_KEY` está definida. Es decisión del hospital. | `lecturaVision.service.js`, `.env.example` | Documentar la decisión formal antes de activarla. |

---

## 8. Backend: diseño interno

### 8.1 Capas

`routes/` (autorización por ruta) → `middlewares/` (auth, token, rate limit) → `controllers/` (validación y orquestación HTTP) → `services/` y `utils/` (lógica reutilizable, cifrado, archivos) → Prisma.

Convención: los controladores validan la entrada y devuelven el error con el código HTTP correspondiente. Los errores de Prisma se traducen en controladores (`P2025` → 404, `P2002` → 409) y, como respaldo, en el manejador central de `app.js` (`P2002` → 409; `LIMIT_FILE_SIZE` → 422).

### 8.2 Contrato de errores

Todas las respuestas de error tienen la forma `{ "error": "mensaje" }`, con código HTTP:

| Código | Uso |
|---|---|
| 400 | Validación de entrada o falta de campos obligatorios. |
| 401 | Sin token, token inválido o expirado. |
| 403 | Rol no permitido, token temporal requerido/inválido/usado/expirado. |
| 404 | Recurso inexistente o fuera del alcance del usuario. |
| 409 | Duplicado (DPI, historia clínica, correo), stock insuficiente en venta, sesión ya usada. |
| 422 | Contenido o tipo de archivo inválido, reglas de negocio (p. ej., autopsia fuera de fallecimiento). |
| 429 | Límite de intentos excedido (con `Retry-After`). |
| 500 | Error no controlado. |
| 503 | `/api/health` cuando la base de datos no responde. |

### 8.3 Transacciones (`prisma.$transaction`)

| Operación | Archivo | Qué garantiza |
|---|---|---|
| Alta de paciente (con documento, adjuntos, maternidad, egreso e ingreso inicial) | `pacientes.controller.js` → `crear` | Todo o nada: no queda un documento sin paciente ni un paciente sin su respaldo. |
| Actualización de paciente | `pacientes.controller.js` → `actualizar` | Datos administrativos, egreso cifrado y maternidad se actualizan juntos. |
| Factura del hospital | `services/facturacion.service.js` → `generarFacturaHospital` | Costeo, factura y marcado `facturado` son atómicos (RNF-13). |
| Venta de farmacia | `registrarVentaFarmacia` | Stock, factura, líneas y kardex se registran juntos; si una línea no tiene stock, se revierte todo. |
| Restablecer contraseña | `auth.controller.js` → `resetPassword` | Cambio de hash y consumo del token en la misma transacción. |

### 8.4 Endpoints de utilidad

- `GET /api/health`: ejecuta `SELECT 1`. Responde `200 {"status":"ok","db":"ok"}` o `503`. Sin autenticación.
- `GET /api/cie10?q=`: búsqueda en el catálogo `CatalogoCie10`. Requiere autenticación.

### 8.5 Migraciones y datos iniciales en el arranque

`Dockerfile` del backend: `prisma migrate deploy` (si `RUN_MIGRATIONS=true`) y `node prisma/seed.js` (si `RUN_SEED=true`), luego `node src/server.js`. El seed usa `upsert` para usuarios (no cambia contraseñas existentes) y `createMany` con `skipDuplicates` para inventario, catálogo y categorías. Ver D1 sobre el inventario.

---

## 9. Referencia de la API REST

Base: `/api`. Todas las rutas, salvo las marcadas como **público**, requieren `Authorization: Bearer <JWT>`. Los roles se indican como abreviaturas: **ADM** Administrador, **REC** Recepción, **CON** Consulta, **ENF** Enfermería, **FAC** Facturación, **FAR** Farmacia.

### 9.1 Autenticación y seguridad (`/api/auth`)

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| POST | `/auth/login` | público (rate limit) | Body `{correo, password}`. Responde `{token, usuario}`. |
| POST | `/auth/logout` | autenticado | Registra el cierre de sesión. |
| POST | `/auth/forgot-password` | público (rate limit) | Body `{correo}`. Respuesta genérica. |
| POST | `/auth/reset-password` | público (rate limit) | Body `{token, password}` (≥ 8 caracteres). |
| POST | `/auth/token` | ADM | Body `{usuarioId, pacienteId?}`. Responde `201 {token, expiraEn}`. |
| POST | `/auth/token/auto` | autenticado con `puedeAutogenerarToken` o ADM | Body `{pacienteId?}`. |

### 9.2 Usuarios (`/api/usuarios`)

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/usuarios/medicos` | autenticado | Usuarios con rol Consulta (para elegir médico de receta). |
| GET | `/usuarios` | ADM | Listado. |
| GET | `/usuarios/:id` | ADM | Detalle. |
| POST | `/usuarios` | ADM | Body `{nombre, correo, password, roles[], puedeAutogenerarToken?, colegiado?, especialidad?}`. |
| PUT | `/usuarios/:id` | ADM | Actualización parcial. Limpia colegiado y especialidad si el usuario deja de ser Consulta. |

### 9.3 Pacientes (`/api/pacientes`)

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/pacientes` | autenticado | `?buscar=`; con `?page=&pageSize=` responde `{items,total,page,pageSize}`; sin `page`, máximo 50. |
| GET | `/pacientes/:id` | autenticado | Datos del paciente, `ingresos[]` y `egresoClinico` descifrado solo para ADM y REC. Ver R1 y R4. |
| POST | `/pacientes` | REC, ADM | JSON o multipart: campos del paciente; `documento` (PDF del escaneo), `adjuntos` (hasta 10), `paginas`, `fechaDocumentoOriginal`. Responde 201. 409 si el DPI existe. |
| PUT | `/pacientes/:id` | REC, ADM | Actualización parcial: datos, `egresoClinico` (`null` lo elimina), `maternidad`. |
| GET | `/pacientes/lectura-avanzada/estado` | REC, ADM | Indica si la lectura avanzada está activa. |
| POST | `/pacientes/leer-expediente` | REC, ADM | Imagen (máx. 8 MB) → datos básicos leídos por visión. Solo si está configurada. |
| GET | `/pacientes/:id/ingresos` | ADM, REC, CON, ENF | Historial de ingresos, más reciente primero. |
| POST | `/pacientes/:id/ingresos` | REC, ADM | Body `{fechaIngreso, impresionClinicaIngreso?, serviciosSolicitados?, referidoDe?, referidoPor?}`. |
| GET | `/pacientes/:id/documentos` | ADM, REC, CON, ENF | Metadatos paginados (`?page=`) o lista de hasta 100. |
| GET | `/pacientes/:id/documentos/:documentoId` | ADM, REC, CON, ENF | Descarga del binario descifrado con su `Content-Type` real. |
| POST | `/pacientes/:id/documentos` | REC, ADM | Multipart: `documento` (PDF/PNG/JPG), `nombreOriginal?`, `tipoDocumental?`, `paginas?` (PDF), `fechaDocumentoOriginal?`. Valida páginas ≤ 30. |
| DELETE | `/pacientes/:id/documentos/:documentoId` | REC, ADM | Borrado lógico. |

### 9.4 Expediente clínico (`/api/expedientes`)

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/expedientes` | autenticado | Metadatos de los últimos 50 diagnósticos (sin contenido). |
| GET | `/expedientes/paciente/:id` | ADM (sin token) u otro rol con `x-temp-token` | Diagnóstico más reciente descifrado, `historial[]` (versiones previas), `ingresos[]` con sus diagnósticos. 404 si no hay diagnóstico. Registra `AccesoDiagnostico`. |
| POST | `/expedientes/paciente/:id` | ADM o `x-temp-token` | Multipart: `datos` (JSON de la plantilla), `ingresoId?` (por defecto, el más reciente), `tipoAtencion?`, `servicio?`, `salaCama?`, `codigoCie?`, archivos `estudio_<i>` (≤ 5 MB c/u). Crea una versión nueva. Responde 201. |

Formato de `datos` (resumen): `motivoConsulta`, `historiaEnfermedad`, `signosSintomas[]`, `signosSintomasOtros`, `signosVitales{pa,fc,fr,temp,spo2,peso,talla}`, `exploracionFisica{general,cabezaCuello,cardiovascular,respiratorio,abdomen,neurologico,extremidades,piel,otros}`, `estudios[{tipo,fecha,resultado,archivoId?}]`, `diagnosticoPrincipal{diagnostico,codigoCie,tipo,prioridad,estado,fecha}`, `diagnosticosSecundarios[]`, `impresionClinica`, `planConducta`.

### 9.5 Tratamiento, recetas y referidos

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/tratamientos`, `/tratamientos/:id` | autenticado | `?pacienteId=` en listado. |
| POST | `/tratamientos` | ENF, CON, ADM | Body `{pacienteId, descripcion, costo ≥ 0, origen: intrahospitalario\|farmacia, dosis?, cirujano?, ayudante?, instrumentista?, anestesiologo?}`. |
| PUT | `/tratamientos/:id` | ENF, CON, ADM | Actualización. |
| GET | `/recetas`, `/recetas/:id` | autenticado | |
| POST | `/recetas` | CON, ADM | Body `{pacienteId, medicoId, medicamento, dosis, indicaciones, duracion}`. El `medicoId` debe ser un usuario con rol Consulta (422 si no). |
| GET | `/referidos`, `/referidos/:id` | autenticado | |
| POST / PUT | `/referidos`, `/referidos/:id` | REC, ADM | Body `{nombre, comisionQ, especialidad?}`. |

### 9.6 Facturación y gastos (`/api/facturacion`)

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/facturacion/reporte` | ADM, FAC | Reporte por rango (`?desde=&hasta=`). |
| GET | `/facturacion/costeo/:pacienteId` | ADM, FAC | Costo pendiente de tratamientos y total estimado. |
| POST | `/facturacion` | FAC, ADM | Body `{pacienteId, costoHospital ≥ 0, formaPago: transferencia\|efectivo}`. Transacción. |
| GET | `/facturacion`, `/facturacion/:id` | autenticado | **Sin restricción de rol (R5).** |
| GET | `/facturacion/gastos` | ADM, FAC | Listado. Parámetros: `desde`, `hasta`, `categoriaFiscalId`, y `page` para paginar. |
| POST | `/facturacion/gastos` | ADM, FAC | Body `{fecha, proveedor, monto > 0, categoriaFiscalId?, numeroFactura?, descripcion?}`. Calcula `montoImpuestoEstimado`. |
| DELETE | `/facturacion/gastos/:id` | ADM, FAC | |
| GET | `/facturacion/categorias-fiscales` | ADM, FAC | |
| POST / PUT | `/facturacion/categorias-fiscales[/:id]` | ADM | |

### 9.7 Farmacia (`/api/farmacia`)

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/farmacia`, `/farmacia/:id` | autenticado | Inventario; el campo `estado` es una lista que puede contener `ok`, `stock_bajo` y/o `por_vencer`. |
| POST | `/farmacia` | FAR, ADM | Alta de medicamento. |
| PUT | `/farmacia/:id` | FAR, ADM | Actualización. |
| POST | `/farmacia/:id/entradas` | FAR, ADM | Body `{cantidad > 0}`. Crea movimiento de entrada. |
| POST | `/farmacia/:id/salidas` | FAR, ADM | Body `{cantidad > 0, pacienteId}` (paciente obligatorio). 409 si no hay stock. |
| POST | `/farmacia/ventas` | FAR, ADM | Body `{items:[{medicamentoId, cantidad}], pacienteId?}`. Transacción. |
| GET | `/farmacia/ventas` | FAR, ADM | Facturas de farmacia. |
| GET | `/farmacia/ventas/:id` | autenticado | Detalle para impresión. |

### 9.8 Bitácora de visitas (`/api/bitacora`)

Sin pantalla en la interfaz desde la migración de ocultación. La API sigue activa.

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/bitacora`, `/bitacora/:id` | autenticado | `?pacienteId=`. |
| POST / PUT | `/bitacora`, `/bitacora/:id` | ENF, REC, ADM | Body `{pacienteId, descripcion}`. |

### 9.9 Reportes (`/api/reportes`)

Todas requieren ADM. Parámetros: `desde` y `hasta` (fechas) en la mayoría; `granularidad` (`dia`, `semana` o `mes`, por defecto `mes`) en `ingresos-por-mes`; `medicamentoId` en el kardex; `usuarioId`, `accion`, `buscar` y `page` en actividad; `pacienteId` y `buscar` en auditoría.

| Ruta | Descripción |
|---|---|
| `/reportes/financiero` | Ingresos hospital + farmacia, gastos, impuesto estimado e ingreso neto (RF-21). |
| `/reportes/ingresos-por-mes` | Ingresos agrupados por periodo. |
| `/reportes/admisiones` | Admisiones por condición de egreso. |
| `/reportes/facturacion-por-forma-pago` | Totales por efectivo y transferencia. |
| `/reportes/inventario-kardex` | Kardex de inventario (RNF-10). |
| `/reportes/auditoria-diagnostico` | Accesos al diagnóstico (RNF-08). |
| `/reportes/actividad` | `LogActividad` filtrable por acción. |

### 9.10 Escaneo móvil (`/api/escaneo-movil`)

Sesiones en memoria, TTL 10 minutos, un documento por sesión.

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/escaneo-movil/sesiones` | REC, ADM | Crea sesión y devuelve `{id, expiraMinutos}`. |
| GET | `/escaneo-movil/sesiones/:id/estado` | propietario | `{estado, paginas, nombreOriginal}`. |
| GET | `/escaneo-movil/sesiones/:id/pdf` | propietario | Entrega el PDF **una sola vez** y elimina la sesión. |
| DELETE | `/escaneo-movil/sesiones/:id` | propietario | Cancela. |
| GET | `/escaneo-movil/sesiones/:id/info` | **público** | `{valido, estado}`. |
| POST | `/escaneo-movil/sesiones/:id/subir` | **público** | Multipart `documento` (PDF, 20 MB). Solo una vez por sesión. |

El identificador de sesión es un UUID v4 (`crypto.randomUUID`) y funciona como credencial de un solo uso para el teléfono.

### 9.11 Catálogo CIE-10 y sistema

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/cie10?q=` | autenticado | Búsqueda por código o descripción. |
| GET | `/health` | público | Estado del servicio y de la base de datos (ruta completa `/api/health`). |


---

## 10. Frontend

### 10.1 Enrutamiento

`src/App.jsx` usa `react-router-dom` v6 (`Routes`, `Route`, `Navigate`). Sin sesión, solo estas rutas están disponibles:

| Ruta | Página | Acceso |
|---|---|---|
| `/recuperar` | `RecuperarPasswordPage` | público |
| `/recuperar/cambiar?token=` | `CambiarPasswordPage` | público |
| `/escaneo-movil/:sesionId` | `EscaneoMovilPage` | público (teléfono) |
| cualquier otra | `LoginPage` | público |

Con sesión, las rutas son: `/registro`, `/expediente`, `/documentos`, `/tratamiento`, `/referidos`, `/financiera`, `/gastos`, `/farmacia`, `/seguridad`, `/reportes`. `/anexos` redirige a `/documentos`. Las páginas que reciben un paciente usan `?pacienteId=` (`ConPacienteDeUrl`), lo que permite enlaces compartibles.

La ruta `/bitacora` fue retirada en la migración de ocultación.

### 10.2 Estado de sesión

`context/AuthContext.jsx` lee `usuario` de `localStorage` al iniciar, expone `login`, `logout` y el indicador `sesionExpirada`. `services/api.js` añade `Authorization: Bearer` tomado de `localStorage.token` y envía `FormData` sin forzar `Content-Type` cuando el cuerpo es multipart.

### 10.3 Control de acceso en la interfaz

- `utils/roles.js` define `ROLES`, `ROLE_LABELS` y `tieneRol(usuario, ...roles)`.
- `components/Layout.jsx` define `NAV_ITEMS` con `allowedInRestricted`. **No filtra por rol:** todos los módulos aparecen para todos los usuarios. El filtro del modo restringido solo oculta módulos según ese indicador.
- Las páginas usan `tieneRol` para mostrar u ocultar botones de escritura. Es comodidad de uso; la autorización real es la del backend (7.3).

### 10.4 Componentes y utilidades relevantes

- Formularios: `components/FormField.jsx`, `Cie10Input.jsx` (búsqueda en `CatalogoCie10`), `Combobox.jsx`, `PacienteBuscador.jsx`.
- Escaneo: `CameraScannerModal.jsx` (cámara del navegador), `EscaneoQRModal.jsx` (QR y sesión móvil), `utils/scanProcessing.js`, `utils/pdfDocumentos.js` (generación de PDF desde imágenes con jsPDF).
- OCR: `utils/ocrDatosBasicos.js` (tesseract.js en el navegador; lectura de datos básicos con reglas de formato).
- Validadores: `utils/dpi.js` (13 dígitos, dígito verificador, departamento 1–22), `utils/telefono.js` (8 dígitos), `utils/fechas.js`, `utils/guatemala.js` (catálogos, entre ellos estado civil).
- Impresión: `FichaPacienteImprimible.jsx`, `FacturaImprimible.jsx`, `RecetaImprimible.jsx`.

### 10.5 Compilación y servido

- Desarrollo: `npm run dev` (Vite). `vite.config.js` define `server.proxy['/api'] = 'http://localhost:4000'` y `allowedHosts: true`. HTTPS opcional con `frontend/.cert/`.
- Producción: `npm run build` genera `dist/`. El Dockerfile de frontend compila en `node:22-alpine` y sirve `dist/` con `nginx:alpine`.
- `nginx.conf`: fallback de SPA a `index.html`; `location /api/` con proxy a `http://backend:4000`; `location ~* \.mjs$` con `default_type application/javascript` (necesario para el worker de pdf.js); `client_max_body_size 20m`.

---

## 11. Pruebas

### 11.1 Matriz de pruebas

| Suite | Ubicación | Comando | Requiere | Cubre |
|---|---|---|---|---|
| Unitarias backend | `backend/tests/unit/*.test.mjs` | `npm test` (en `backend/`) | nada (usa `_entorno.mjs`) | validación de pacientes, cifrado, archivos, rate limit, periodos, escaneo móvil, lectura de visión |
| Integración backend | `backend/tests/integracion.smoke.mjs` | `BASE=http://localhost:8080/api npm run test:integracion` | stack levantado y `SEED_ADMIN_PASSWORD` | flujo de punta a punta: login, pacientes, ingresos, expediente con tokens, documentos, tratamientos, recetas, facturación, farmacia, reportes, escaneo |
| Unitarias frontend | `frontend/tests/*.test.mjs` | `npm test` (en `frontend/`) | nada | fechas, validadores, OCR de datos básicos |
| E2E | `frontend/tests/*.spec.ts` | `npm run test:e2e` | stack levantado y `SEED_ADMIN_PASSWORD` | autenticación, pacientes, expediente, escáner, modo restringido |

### 11.2 Prueba de integración

- `BASE` por defecto: `http://localhost:4000/api`. Para el stack Docker use `http://localhost:8080/api`.
- `SEED_ADMIN_PASSWORD` debe coincidir con la del administrador en la base; si no se define, la prueba usa `CambiarEsta123`.
- Crea datos con prefijo `SMOKE` y los elimina al final (`limpiar()`). Las eliminaciones van en un orden que respeta las claves foráneas; `ingreso` se incluye desde la migración 22.
- Limitaciones observadas:
  - **Límites de intentos:** los endpoints de recuperación permiten 5 peticiones cada 5 minutos por IP. Repetir la suite en menos de ese tiempo produce fallos 429 en `forgot-password` y `reset-password`. Espere la ventana antes de reejecutar.
  - **Restos de ejecuciones fallidas:** si quedan pacientes `SMOKE` (por ejemplo, tras una interrupción), el alta siguiente falla por DPI duplicado y las pruebas posteriores fallan en cascada. Limpie primero los registros `SMOKE` (con el mismo orden de borrado que `limpiar()`).
  - La limpieza imprime `Unknown argument pacienteId` para `movimientoInventario`, que no tiene ese campo. Es un error inofensivo capturado por `intentar()`; está pendiente de corregir en el script.

### 11.3 E2E (Playwright)

- `playwright.config.ts`: `baseURL = PLAYWRIGHT_BASE_URL` o `http://localhost:8080`.
- Los tests de inicio de sesión necesitan `SEED_ADMIN_PASSWORD` con la contraseña real del administrador. Sin esa variable, `restricted-mode.spec.ts` falla en el login.
- Se observó un fallo intermitente en "Logo del hospital es un botón clicable" que no se reprodujo al ejecutarlo aislado. Tratarlo como prueba inestable pendiente de revisión.

---

## 12. Integración continua (`.github/workflows/ci.yml`)

Disparadores: `push` y `pull_request` sobre `Dev_Diego` y `main`.

| Job | Qué hace | Estado |
|---|---|---|
| `lint` | `npm run lint` y `tsc --noEmit` con respaldo `\|\| echo` | **Placeholder:** el frontend no define `lint`; el job nunca falla. |
| `backend-tests` | Postgres 16 como servicio; `prisma generate`, `migrate deploy`, seed y `npm test` | Activo. |
| `frontend-build` | `npm ci` y `npm run build`; sube `dist` como artefacto | Activo. |
| `e2e-tests` | Levanta backend con `npm run dev` y `serve` en 5173; ejecuta Playwright | Activo. Usa `PLAYWRIGHT_BASE_URL=http://localhost:5173`. |
| `docker-build` | `docker compose build`, `up -d`, health checks (`/api/health`, `/`, MIME de `pdf.worker`) y `down -v` | Activo. |
| `deploy-staging` | Solo imprime un mensaje | **Placeholder.** Requiere configurar SSH o similar. |
| `release` | Crea release con `actions/create-release@v1` | Acción archivada; sustituir por `gh release create` o `softprops/action-gh-release`. |

Secretos requeridos en GitHub: `POSTGRES_PASSWORD`, `JWT_SECRET`, `ENCRYPTION_KEY`, `SEED_ADMIN_PASSWORD`. El secreto `ENCRYPTION_KEY` de CI debe ser de 64 hex.

---

## 13. Operación

### 13.1 Monitoreo

- Salud: `curl -fsS http://<host>:8080/api/health`. Devuelve `200` si la API responde y la base de datos contesta; `503` si no.
- Healthcheck del contenedor backend: `wget` contra `http://127.0.0.1:4000/api/health` cada 30 s (`Dockerfile`).
- Logs: `docker compose logs -f backend` (incluye errores 500 y las URLs de recuperación en modo `consola`).
- Estado: `docker compose ps`.

### 13.2 Respaldos

**Base de datos.** `backend/scripts/backup.js` ejecuta `pg_dump` con `DATABASE_URL` y escribe `backend/backups/verapaz_<timestamp>.sql`:

```bash
cd backend
npm run backup
```

Requisitos y advertencias:
- Requiere `pg_dump` en el PATH del equipo que ejecuta el script. La imagen `node:22-alpine` no lo incluye, por lo que el respaldo debe ejecutarse **desde el host**, apuntando a la base expuesta en `127.0.0.1:5433`.
- El script busca `pg_dump` en rutas de Windows (PostgreSQL 16–18) además del PATH.
- No hay respaldos programados en el proyecto. Configure un cron o tarea programada.

Restauración (procedimiento estándar de PostgreSQL; no verificado en el proyecto):

```bash
psql "postgresql://verapaz:<clave>@127.0.0.1:5433/hospital_verapaz_restore" -f verapaz_<timestamp>.sql
```

**Archivos.** Los volúmenes `uploads` (`/app/uploads`) y `backups` (`/app/backups`) deben respaldarse junto con la base. Los archivos de `uploads/` están cifrados: **sin `ENCRYPTION_KEY` no sirven**.

**Llave.** Guarde `ENCRYPTION_KEY` y `JWT_SECRET` en custodia separada del respaldo.

### 13.3 Scripts de mantenimiento (ejecutar una sola vez, con respaldo previo)

| Script | Función | Estado de ejecución |
|---|---|---|
| `scripts/migrar-egreso-cifrado.js` | Pasa los campos legacy de egreso de `Paciente` al `EgresoClinico` cifrado. No borra las columnas. | Histórico. Confirmar antes de repetir. |
| `scripts/migrar-anexos-a-documentos.js` | Migra `AnexoPaciente` a `DocumentoPaciente` antes de eliminar la tabla anexo. | Histórico. La tabla ya no existe en el esquema. |
| `scripts/recifrar-archivos.js` | Cifra archivos de `uploads/diagnosticos` que quedaron en claro, validando checksum antes de borrar el original. Idempotente. | Verificar si quedan archivos en claro. |

Ejecutarlos: `npm run migrar-egreso`, `npm run migrar-anexos`, `npm run recifrar-archivos`, desde `backend/` con `DATABASE_URL` y `ENCRYPTION_KEY` definidos.

### 13.4 Rotación y cambios de llaves

- **`JWT_SECRET`:** cambiarlo invalida todas las sesiones activas. Es seguro hacerlo en mantenimiento.
- **`ENCRYPTION_KEY`:** cambiarla sin re-cifrar los datos deja ilegibles los diagnósticos, el egreso clínico y los archivos. **No existe procedimiento de rotación en el proyecto.** Debe diseñarse y probarse antes de intentarlo.
- **Contraseñas de cuentas de prueba:** cambiar o eliminar las cuentas del seed antes de usar el sistema con datos reales.

### 13.5 Notificaciones

`services/notificacion.service.js`: con `NOTIFICACION_PROVEEDOR=consola` (único proveedor implementado), los enlaces de recuperación se escriben en la consola del backend. Para enviar correo se debe agregar un caso en `enviarEnlaceRecuperacion`; cualquier otro valor lanza error al solicitar la recuperación.

### 13.6 Lectura avanzada (opcional)

Activa solo con `ANTHROPIC_API_KEY`. Con la clave definida, la primera página del expediente escaneado se envía a Anthropic. Decisión de privacidad del hospital (ver R15).

### 13.7 Escaneo móvil

Las sesiones viven en memoria del proceso backend. Un reinicio del contenedor cancela las sesiones activas; los usuarios deben generar una nueva.

---

## 14. Guía para desarrolladores

### 14.1 Agregar un endpoint

1. Declare la ruta en `routes/<modulo>.routes.js` con `requireAuth` y `requireRole(...)`. Si es información clínica del diagnóstico, use `requireTempToken`.
2. Implemente el controlador en `controllers/<modulo>.controller.js`: valide la entrada, responda con `{error}` en los errores y use `registrarActividad` en las altas y cambios.
3. Si la operación toca varias tablas, use `prisma.$transaction`.
4. Agregue pruebas unitarias para la validación pura (patrón de `pacientes.validacion.test.mjs`) y un caso en `integracion.smoke.mjs`.

### 14.2 Agregar un modelo o cambiar el esquema

1. Edite `prisma/schema.prisma`.
2. `npx prisma migrate dev --name <nombre>` en desarrollo.
3. Revise el SQL generado. Si hay datos existentes, agregue el backfill manualmente (ver `20261013120000_paso15_ingresos_paciente` como ejemplo).
4. Versione la carpeta de la migración con el código.
5. Verifique con `npx prisma migrate deploy` en una base limpia y en una base con datos.

### 14.3 Agregar un rol

1. Agréguelo a `backend/src/utils/roles.util.js` y a `frontend/src/utils/roles.js` (`ROLES` y `ROLE_LABELS`).
2. Ajuste las rutas en `routes/` que deban aceptarlo.
3. Ajuste las páginas del frontend que muestran acciones según rol.
4. Actualice la sección 3 del manual de usuario.

### 14.4 Convenciones observadas

- Comentarios y mensajes de error en español; referencias a requerimientos (RF-xx, RNF-xx) en los comentarios.
- Errores de negocio con código HTTP explícito; no lanzar excepciones sin mapear en controladores públicos.
- Montos con `Decimal` en base y `round2` antes de persistir totales.

---

## 15. Limitaciones conocidas y deuda técnica

| ID | Tema | Descripción | Acción sugerida |
|---|---|---|---|
| D1 | Datos duplicados | Con `RUN_SEED=true`, cada arranque vuelve a insertar el inventario inicial porque `MedicamentoInventario.nombre` no es único y `createMany` con `skipDuplicates` no detecta duplicados. Verificado en la base de desarrollo: cada medicamento inicial tiene **12 copias**. | Poner `RUN_SEED=false` tras la instalación. Corregir el seed con una restricción única o con `findFirst` + `create`. Depurar duplicados existentes con cuidado: pueden tener movimientos y ventas asociados. |
| D2 | Decisión pendiente | Resultados clínicos adjuntos en `DocumentoPaciente` (R3) contradicen el modelo. | Definir si se mueven a `DiagnosticoArchivo` o si se reclasifica la tabla. |
| D3 | Documentación | `README.md` está desactualizado: indica `npm run test` para E2E (el script es `test:e2e`) y que la navegación no usa rutas (ya usa `react-router`). Los comentarios de `app.js` citan `docs/Estructura_y_Requerimientos.docx`, pero el archivo real es `docs/Req_y_Estructura.docx`. | Actualizar el README y los comentarios con este manual como referencia. |
| D4 | Límite de páginas | `DOCUMENT_MAX_PAGES` se valida en `POST /pacientes/:id/documentos`, pero no en el alta de paciente con escaneo (`crear`), que acepta cualquier número de páginas en `paginas`. | Aplicar la misma validación en `crear`. |
| D5 | Variables sin uso | `UPLOAD_MAX_MB_ANEXOS` en `.env.example` no se usa en el código. | Eliminarla. |
| D6 | Bitácora | El módulo fue retirado de la interfaz, pero su API y tabla permanecen. | Decidir si se elimina en una versión posterior (requiere migración de datos). |
| D7 | Pruebas | Pruebas de integración dependientes del orden y de límites de tasa (11.2). Error de la limpieza sobre `movimientoInventario`. | Aislar datos por ejecución y reducir el límite en entorno de pruebas. |
| D8 | CI | Job `lint` y `deploy-staging` son placeholders; `release` usa una acción archivada. | Ver sección 12. |
| D9 | Errores | `app.js` expone `err.message` en 500 (R11). | Mensaje genérico y registro interno. |
| D10 | Escalabilidad | Rate limiting, sesiones de escaneo y contadores en memoria: no escalan a varias instancias. | Mover a almacén compartido (Redis) si se requiere más de una instancia. |
| D11 | Auditoría de lectura | Los accesos a documentos del paciente no quedan en `AccesoDiagnostico` ni en un registro equivalente de lectura (solo se registran descargas en `LogActividad`). | Evaluar auditoría de lectura para documentos clínicos (ver R2). |
| D12 | Impresión clínica | La impresión clínica de ingreso existe en dos lugares (`Paciente` e `Ingreso`) en texto plano. | Unificar en `Ingreso` y cifrar (R1). |
| D13 | Columnas legacy | `Paciente` conserva `diagnosticoEgresoCodigo`, `complicacionesCodigo`, `operacionesCodigo`, `autopsia` y `causaMuerte` en texto plano. La API actual no las escribe, pero `egresoClinicoPara` las usa como respaldo cuando no hay `EgresoClinico`. | Confirmar con conteos que la migración histórica cubrió todos los pacientes; después, retirar las columnas en una migración dedicada con respaldo previo. |
| D14 | **Alta** · Arranque | El `CMD` del backend encadena `prisma migrate deploy` con `;`. Si la migración falla, el servidor arranca con un esquema incompatible con el código. | Cambiar a `set -e` o a `&&` entre los pasos. Mientras tanto, revisar los logs tras cada actualización. |

---

## 16. Glosario

| Término | Definición en este sistema |
|---|---|
| **Admisión / Ingreso** | Una estadía del paciente en el hospital. Un paciente puede tener varias. |
| **Egreso clínico** | Diagnósticos, complicaciones, operaciones, autopsia y causa de muerte al salir del hospital. Cifrado. |
| **Expediente** | Conjunto de diagnósticos (versiones) y estudios de un paciente. |
| **Historia clínica (HC)** | Identificador numérico del paciente en el hospital, único. Si no se captura, el sistema genera `HC-AAAA-NNNNNN`. |
| **Token temporal** | Credencial de 15 minutos y uso único para leer o registrar un diagnóstico. |
| **Sobre cifrado** | Formato de archivo `[IV][tag][ciphertext]` en disco, con AES-256-GCM. |
| **Costeo** | Suma de tratamientos intrahospitalarios y de farmacia pendientes de facturar. |
| **Kardex** | Historial de movimientos de inventario de un medicamento. |
| **RF / RNF** | Requerimiento funcional / no funcional, según `docs/Req_y_Estructura.docx`. |

Requerimientos citados en el código: RF-01 a RF-04 (pacientes y DPI), RF-10 y RF-11 (diagnóstico confidencial), RF-15 (cargos intrahospitalarios), RF-16 (referidos), RF-17 a RF-19 (facturación), RF-20 y RF-24 y RF-27 (farmacia), RF-21 (reporte financiero), RF-22 a RF-23 (inventario), RF-25 y RF-26 (alertas), RF-29 (inicio de sesión), RF-30 y RF-32 (roles y usuarios), RF-31 (reportes), RF-33 y RF-34 (tokens), RNF-03 (respaldos), RNF-08 (auditoría), RNF-10 (kardex), RNF-12 (uso único), RNF-13 (transacciones).
