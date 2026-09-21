# Estrategia de testing — CRM

> Versión 1.0 · 2026-09-21

## 1. Objetivos

- Garantizar que las **reglas de negocio críticas** (autenticación, autorización, alcance, conversión de leads, pipeline, integridad) no se rompen al avanzar por fases.
- Preferir **tests de integración contra SQL Server real**: Prisma, constraints, índices filtrados y transacciones solo se prueban de verdad contra el motor.
- Mantener una suite rápida (< 2 min en local) y determinista.

## 2. Niveles y herramientas

| Nivel | Herramientas | Qué cubre | Ubicación |
|---|---|---|---|
| Integración API | **Vitest** + **Supertest** + Prisma sobre `crm_test` | Endpoints completos: middlewares, validación, services, base de datos | `server/tests/integration/*.test.js` |
| Unitario backend | Vitest | Funciones puras: validadores Zod, `scope`, transiciones de estado, forecast, CSV, helpers de tokens | `server/tests/unit/*.test.js` |
| Unitario/componente frontend | Vitest + **React Testing Library** + **MSW** (mock de API) | Login, rutas protegidas, formularios, tablas, Kanban, estados de carga/vacío/error | `client/tests/**/*.test.jsx` |
| E2E (opcional, fase final) | Playwright | Flujo crítico completo contra servidor y cliente reales | `e2e/` |
| Estático | ESLint, Prettier, `npm audit` | Calidad y vulnerabilidades | CI |

## 3. Base de datos de test

- Base dedicada `crm_test` (misma instancia que desarrollo, collation `Modern_Spanish_100_CI_AI`), URL en `TEST_DATABASE_URL`.
- `tests/setup/globalSetup.js`: ejecuta `prisma migrate deploy` con `DATABASE_URL = TEST_DATABASE_URL` una vez por corrida.
- `tests/helpers/db.js`:
  - `resetDb()`: borra todas las tablas en orden seguro (`DELETE` respetando FKs; `DBCC CHECKIDENT` para reiniciar identidades) y vuelve a sembrar catálogos (roles, permisos, etapas, fuentes, settings).
  - Se ejecuta en `beforeEach` de cada archivo (los tests de un archivo son independientes entre sí).
- Vitest corre los archivos de integración **en serie** (`fileParallelism: false` para ese proyecto) para evitar interferencia sobre la misma base.
- Nunca se apunta a `crm_dev`: `globalSetup` aborta si `TEST_DATABASE_URL` no contiene `_test`.

## 4. Helpers

| Helper | Uso |
|---|---|
| `createUser({ role: 'Vendedor', … })` | Crea usuario con contraseña conocida |
| `loginAs(user)` → `{ token, cookie }` | Obtiene credenciales para Supertest |
| `authed(request, token)` | Añade `Authorization` |
| Factories: `makeCompany()`, `makeContact()`, `makeClient()`, `makeLead()`, `makeOpportunity()`, `makeActivity()` | Datos válidos por defecto, sobrescribibles |
| `expectApiError(res, status, code)` | Aserción del envoltorio de error |

## 5. Casos críticos por módulo (mínimos obligatorios)

### 5.1 Autenticación
- Login correcto devuelve access token, cookie httpOnly y usuario sin `passwordHash`.
- Login con email inexistente y con contraseña incorrecta devuelven el **mismo** 401.
- Usuario inactivo no puede iniciar sesión.
- 5 fallos → 423; tras `LOCKOUT_MINUTES` vuelve a permitir.
- Refresh rota el token; reutilizar el anterior → 401 y revoca la cadena.
- Logout revoca; refresh posterior → 401.
- Access token expirado/manipulado → 401.
- `mustChangePassword` bloquea `/clients` con 403 `PASSWORD_CHANGE_REQUIRED` y permite `/auth/change-password`.
- Política de contraseñas rechaza débiles.

### 5.2 Autorización y alcance
- Vendedor sin `users:read` → 403 en `/users`.
- Vendedor lista solo sus clientes/leads/oportunidades/actividades; `GET /:id` ajeno → 404; `PUT` ajeno → 404/403.
- Manager ve todos y puede asignar; Vendedor no puede `PATCH /assign` (403).
- Cambio de permisos de un rol afecta a las siguientes requests (cache invalidada).

### 5.3 Usuarios y roles
- Alta con email duplicado → 409.
- No se desactiva ni degrada el último Admin (422).
- Un usuario no cambia su propio rol (422).
- Desactivar revoca refresh tokens.
- Rol del sistema no se borra; rol con usuarios no se borra.

### 5.4 Empresas y contactos
- CRUD, validación de campos, `taxId` duplicado → 409, `taxId` de una archivada no bloquea.
- Búsqueda insensible a mayúsculas y acentos (`"perez"` encuentra `"Pérez"`).
- Archivar empresa con cliente activo → 422; restaurar funciona.
- Contacto principal de cliente activo no se archiva.

### 5.5 Clientes
- `COMPANY` sin `companyId` → 400; `INDIVIDUAL` sin `primaryContactId` → 400.
- Empresa ya cliente → 409.
- Asignación notifica al nuevo responsable.
- Archivar con oportunidades abiertas → 422.

### 5.6 Leads
- Transiciones válidas e inválidas (tabla de casos); `LOST` sin motivo → 400.
- Conversión completa crea Company, Contact, Client y Opportunity en una transacción; fallo en un paso no deja restos.
- Conversión reutiliza Client si la empresa ya es cliente.
- Segunda conversión → 409; editar convertido → 422.

### 5.7 Oportunidades
- Probabilidad inicial = de la etapa.
- Contacto de otra empresa → 422.
- Mover a perdida sin `lostReason` → 400; a ganada fija probabilidad 100 y `actualCloseDate`; historial registrado.
- Editar cerrada → 422; reabrir requiere permiso y registra historial.
- Kanban agrupa por etapa activa con totales correctos.
- Archivar ganada → 422.

### 5.8 Actividades y notas
- TASK sin `dueDate` → 400.
- Completar fija `completedAt`; filtro `overdue` correcto.
- Nota con dos padres o sin padre → 400.
- Vendedor no edita nota ajena (403); Manager sí.

### 5.9 Dashboard y reportes
- `summary` coincide con datos sembrados (conteos y sumas exactas).
- Vendedor obtiene solo sus métricas; Manager globales.
- CSV con cabeceras y filas esperadas; sin permiso `reports:export` → 403.

### 5.10 Frontend
- `LoginPage`: validación, error de credenciales, redirección tras login.
- `ProtectedRoute`: redirige a `/login` sin sesión y a `/change-password` cuando corresponde; oculta acciones sin permiso.
- Formularios de cliente/lead/oportunidad: errores de validación local y mapeo de `details[]` del servidor.
- `DataTable`: skeleton, vacío, error con reintento, paginación.
- `KanbanBoard`: mover tarjeta llama al endpoint de etapa; a perdida abre diálogo de motivo; rollback en error.

## 6. Cobertura

- Umbral en CI: **80 %** de líneas/ramas en `server/src/services` y `server/src/middleware`.
- Sin umbral global en frontend (se prioriza cobertura de casos críticos).

## 7. Ejecución

```bash
# Todo (desde la raíz)
npm test

# Backend
npm run test -w server            # una pasada
npm run test:watch -w server
npm run test:coverage -w server

# Frontend
npm run test -w client
```

Requisitos locales: SQL Server accesible por TCP 1433 y base `crm_test` creada (`npm run db:create`).

## 8. Integración continua

`.github/workflows/ci.yml` (se implementa en la fase de producción):

1. `ubuntu-latest` con servicio `mcr.microsoft.com/mssql/server:2022-latest` (`ACCEPT_EULA=Y`, `MSSQL_SA_PASSWORD` desde secreto del workflow).
2. Crea `crm_test` con la collation del proyecto (`sqlcmd`).
3. `npm ci` → `npm run lint` → `npm run test -w server` (con `TEST_DATABASE_URL` apuntando al contenedor, login SQL solo en CI) → `npm run test -w client` → `npm run build -w client`.
4. `npm audit --audit-level=high` y `gitleaks`.
5. Bloquea el merge si falla cualquier paso.

## 9. Criterio de "fase terminada"

Una fase se considera terminada cuando:

- [ ] Todos los tests existentes y los nuevos de la fase pasan (`npm test`).
- [ ] La cobertura de services/middleware no baja del umbral.
- [ ] Lint sin errores.
- [ ] Revisión del checklist de seguridad ([security.md § 9](security.md#9-checklist-de-revisión-por-fase)).
- [ ] Documentación de la fase actualizada.
