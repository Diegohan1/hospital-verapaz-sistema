# Sistema de Gestión de Expediente Clínico y Administrativo
### Hospital de Especialidades Verapaz — Cobán, Alta Verapaz

Proyecto de Seminario — Ingeniería en Sistemas de Información y Ciencias
de la Computación, Universidad Mariano Gálvez de Guatemala.

## Stack tecnológico

- **Frontend:** React (Vite)
- **Backend:** Node.js + Express
- **Base de datos:** PostgreSQL
- **Autenticación:** JWT + tokens de acceso temporal (RF-33, RF-34)
- **Servidor / Hosting:** pendiente de definir (local en el hospital vs. nube)

## Estructura del proyecto

```
hospital-verapaz-sistema/
├── frontend/                  React (Vite) — interfaz de usuario
│   ├── src/
│   │   ├── components/        componentes reutilizables (Button, Card, Table...)
│   │   ├── pages/              una carpeta por módulo del sistema
│   │   ├── context/            AuthContext (usuario, rol, token de sesión)
│   │   ├── services/           api.js — llamadas al backend
│   │   ├── styles/             tokens de diseño (navy/gold) y Tailwind
│   │   ├── App.jsx             prototipo funcional ya construido
│   │   └── main.jsx
│   └── package.json
│
├── backend/                    Node.js + Express — API REST
│   ├── src/
│   │   ├── config/             conexión a PostgreSQL (db.js)
│   │   ├── controllers/        un controlador por módulo
│   │   ├── routes/              un router por módulo
│   │   ├── models/              (o prisma/schema.prisma como ORM)
│   │   ├── middlewares/        auth.middleware.js — JWT, roles, tokens temporales
│   │   ├── services/            lógica de negocio (ej. facturacion.service.js con rollback)
│   │   └── utils/               crypto.util.js — cifrado del diagnóstico (RF-10)
│   ├── prisma/schema.prisma    esquema de base de datos (9 módulos)
│   └── package.json
│
└── docs/                        documentación del proyecto
    ├── Req_y_Estructura.docx
    ├── product_backlog.docx
    ├── cronograma_gantt_10dias.docx
    ├── cronograma_actividades_projectlibre.xml
    ├── seminario_infome_final.docx
    └── diagramas/                (pendiente: diagramas de actividades)
```

## Módulos del sistema (9)

1. Registro y Admisión de Pacientes
2. Expediente Clínico (diagnóstico confidencial, cifrado)
3. Tratamiento y Medicamentos Intrahospitalarios
4. Clientes Referidos
5. Área Financiera (Facturación Hospital + Facturación Farmacia)
6. Farmacia (inventario, módulo independiente)
7. Bitácora de Visitas
8. Seguridad y Roles
9. Reportes

Cada módulo tiene su propio router/controlador en el backend y su propia
carpeta de página en el frontend, para que cualquier integrante del
equipo pueda trabajar en un módulo sin chocar con el trabajo de los
demás.

## Cómo levantar el proyecto (cuando se instalen las dependencias)

```bash
# Backend
cd backend
cp .env.example .env      # completar DATABASE_URL, JWT_SECRET
npm install
npm run dev                # http://localhost:4000

# Frontend
cd frontend
npm install
npm run dev                # http://localhost:5173
```

## Cómo ejecutar las pruebas E2E (Playwright)

### Opción A: Con Docker (recomendado para CI/CD)

```bash
# Levantar todo el stack
docker compose up -d --build

# En otra terminal, ejecutar tests E2E
cd frontend
npm run test               # Headless (CI)
npm run test:headed        # Con navegador visible
npm run test:ui            # UI interactiva de Playwright
```

### Opción B: Desarrollo local (sin Docker)

```bash
# Terminal 1: Backend + Base de datos
cd backend
cp .env.example .env
npm install
npx prisma migrate deploy
npm run prisma:seed
npm run dev

# Terminal 2: Frontend
cd frontend
npm install
npm run dev

# Terminal 3: Tests E2E
cd frontend
npm run test               # Headless
npm run test:headed        # Con navegador visible
npm run test:ui            # UI interactiva
```

### Qué cubren los tests E2E

| Archivo | Qué prueba |
|---------|------------|
| `tests/auth.spec.ts` | Login, login fallido, recuperación contraseña |
| `tests/pacientes.spec.ts` | Navegación pestañas, formulario, campos requeridos |
| `tests/expediente.spec.ts` | Navegación a expediente, botón diagnóstico |
| `tests/scanner.spec.ts` | Botón escáner, modal, input archivo |
| `tests/restricted-mode.spec.ts` | Logo botón, modo restringido, persistencia |
| `tests/*.test.mjs` | Tests unitarios (fechas, OCR, validadores) |

### Artefactos en CI (GitHub Actions)

- **Reporte HTML**: `playwright-report/` (subido como artifact)
- **Screenshots/videos en fallos**: `test-results/` (subido en fallos)
- **Cobertura**: Tests unitarios backend (`backend/tests/`)

### Comandos útiles

```bash
# Ver reporte HTML local
cd frontend
npx playwright show-report

# Ejecutar solo un archivo de test
npx playwright test tests/auth.spec.ts

# Ejecutar en modo debug
npx playwright test --debug

# Generar reporte de trazabilidad
npx playwright test --trace on
```

## Estado del backend

El backend ya tiene lógica real conectada a Prisma/PostgreSQL (antes eran
controladores de ejemplo que devolvían datos vacíos):

- Login con bcrypt + JWT, roles y tokens de acceso temporal de un solo uso
  (RF-29, RF-33, RF-34, RNF-12), validados contra la tabla `TokenTemporal`.
- Diagnóstico cifrado con AES-256-GCM (RF-10); solo el Administrador o quien
  tenga un token vigente puede leerlo o escribirlo (RF-11).
- CRUD real de pacientes con historia clínica autogenerada y validación de
  DPI duplicado (RF-01 a RF-04).
- Facturación hospital/farmacia con transacciones Prisma (`$transaction`)
  para que costeo + factura + movimiento de inventario se registren de forma
  atómica (RNF-13), incluida la generación automática de la factura de
  farmacia al vender (RF-20, RF-27).
- Alertas de stock bajo y próximo a vencer (RF-25, RF-26) y kardex de
  movimientos de inventario (RNF-10).
- Reportes administrativos por rol Administrador (RF-31).

Ver `backend/prisma/schema.prisma` para el modelo de datos completo (con
relaciones entre entidades) y `backend/prisma/seed.js` para datos de prueba
(un usuario por rol + inventario inicial de farmacia).

También hay un módulo de **usuarios** (`/api/usuarios`, solo Administrador)
para listar, crear y reasignar rol/permiso de autogenerar token (RF-32,
RF-34) desde la interfaz de Seguridad y Roles.

## Estado del frontend

El frontend ya no usa datos de ejemplo: está reestructurado en
`components/`, `hooks/`, `pages/` y `context/` (como describe la estructura
de carpetas de arriba) y cada módulo llama a la API real:

- Login real contra `/api/auth/login`, sesión persistida en `localStorage`.
- Registro de pacientes con búsqueda (RF-02, con debounce) y manejo del
  error de DPI duplicado (RF-04).
- Expediente Clínico con el flujo completo de token temporal: el
  Administrador entra directo, los demás roles autogeneran su token (si
  tienen el permiso, RF-34) o pegan uno emitido por el Administrador desde
  Seguridad y Roles (RF-33).
- Farmacia con entradas/salidas, y Área Financiera generando facturas desde
  el costeo pendiente del paciente.
- Cada página oculta las acciones de escritura que el rol del usuario no
  tiene permitido hacer en el backend (ver `frontend/src/utils/roles.js`).

Se probó de punta a punta (login, crear paciente, ciclo completo de token
temporal, venta de farmacia con descuento de stock, facturación con
transacción) con un smoke test que reveló y permitió corregir un bug real:
los medicamentos de farmacia usados de forma intrahospitalaria no se
estaban cargando al costeo del paciente.

## Pendientes

- Definir servidor/hosting (local vs. nube).
- Elaborar los diagramas de actividades por proceso (docs/diagramas/).
- Revisar visualmente la interfaz en el navegador (las pruebas hasta ahora
  fueron contra la API con curl/scripts, no clic a clic en la UI).
- Evaluar migrar la navegación interna a `react-router-dom` (ya está
  instalado pero el cambio de página sigue siendo con estado de React, no
  con URLs).
