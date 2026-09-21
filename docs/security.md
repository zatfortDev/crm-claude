# Seguridad — CRM

> Versión 1.0 · 2026-09-21

## 1. Principios

1. **Defensa en profundidad**: validación, autenticación, autorización y scope se aplican en el servidor aunque el cliente ya los aplique.
2. **Mínimo privilegio**: roles con permisos explícitos; login de base de datos con permisos mínimos en producción.
3. **Fallar de forma segura**: errores genéricos hacia afuera, detalle en logs; sin información que permita enumerar usuarios o recursos.
4. **Secretos fuera del código**: solo variables de entorno; `.env` ignorado por Git; `.env.example` sin valores.
5. **Registro sin fuga**: se loguean eventos de seguridad, nunca contraseñas, tokens ni cookies.

## 2. Modelo de amenazas y mitigaciones

| # | Amenaza | Mitigación | Dónde |
|---|---|---|---|
| T-01 | Robo de credenciales por fuerza bruta / credential stuffing | Rate limit específico en login (10 req / 15 min / IP), bloqueo de cuenta (5 fallos → 15 min), mensaje genérico, log `warn` de fallos | `middleware/rateLimiter`, `auth.service` |
| T-02 | Robo de token por XSS | Access token **solo en memoria** del SPA; refresh token en cookie `HttpOnly`; CSP con `helmet`; React escapa por defecto; no se usa `dangerouslySetInnerHTML` | `AuthContext`, `app.js` |
| T-03 | CSRF sobre `/auth/refresh` y `/auth/logout` | Cookie `SameSite=Strict`, `Path=/api/auth`; verificación de cabecera `Origin` contra `CORS_ORIGINS`; el resto de la API exige `Authorization: Bearer` (no cookie) | `auth.routes` |
| T-04 | Reuso de refresh token robado | Rotación en cada uso; hash SHA-256 en base; detección de reuso → revocación de toda la cadena (`replacedById`) | `auth.service` |
| T-05 | Acceso a registros ajenos (IDOR) | Scope por ownership en **services**; recurso fuera de alcance → `404` | `utils/scope`, services |
| T-06 | Escalada de privilegios | Solo `users:manage` cambia roles; nadie edita su propio rol; último Admin protegido; permisos resueltos en servidor por request (no desde el JWT) | `users.service`, `middleware/authorize` |
| T-07 | Mass assignment | Zod `.strict()` en bodies; whitelist de campos por operación; campos de sistema (`createdById`, `deletedAt`, `passwordHash`) nunca aceptados desde el cliente | `validators/*` |
| T-08 | SQL Injection | Prisma parametriza; `$queryRaw` solo con *tagged templates* (`Prisma.sql`), jamás concatenación; `sortBy` validado contra whitelist | services |
| T-09 | Exposición de datos sensibles | Serializadores por entidad (`toPublicUser` excluye `passwordHash`, `failedLoginAttempts`, `lockedUntil`); `errorHandler` sin stack en producción; `pino.redact` | `utils/serializers`, `middleware/errorHandler`, `lib/logger` |
| T-10 | Secretos en el repositorio | `.gitignore` (`.env*`, certificados); revisión manual pre-push; `gitleaks` en CI | CI, proceso |
| T-11 | Credenciales de SQL Server | Producción: login SQL dedicado (`db_datareader`, `db_datawriter`, `EXECUTE`); migraciones con login separado con `db_ddladmin`; desarrollo: autenticación integrada sin contraseña | `deployment.md` |
| T-12 | DoS por payloads / consultas costosas | `express.json({ limit: '1mb' })`; `pageSize ≤ 100`; timeouts de request (30 s); rate limit global (300 req / 15 min / IP) | `app.js`, validators |
| T-13 | Dependencias vulnerables | `npm audit --audit-level=high` en CI; lockfile versionado; actualizaciones periódicas | CI |
| T-14 | Condiciones de carrera (doble conversión, doble cierre, último admin) | `$transaction` con relectura del estado dentro de la transacción; unicidad en base como última barrera | services |
| T-15 | Clickjacking, sniffing, downgrade | `helmet`: `frameguard: deny`, `noSniff`, HSTS (prod), `referrerPolicy: strict-origin-when-cross-origin`; sin `X-Powered-By` | `app.js` |
| T-16 | CORS permisivo | Lista blanca explícita `CORS_ORIGINS`; `credentials: true` solo para esos orígenes; métodos y cabeceras acotados | `config/cors` |
| T-17 | Enumeración de usuarios | Login y refresh responden lo mismo para usuario inexistente/inactivo/contraseña incorrecta; `404` para recursos fuera de alcance | `auth.service` |
| T-18 | Sesiones huérfanas | Desactivar usuario, cambiar contraseña o resetearla revoca todos sus refresh tokens; access token expira en 15 min | `users.service`, `auth.service` |
| T-19 | Logs con datos sensibles | `redact` de `authorization`, `cookie`, `password`, `passwordHash`, `token`, `newPassword`, `currentPassword`; no se loguean bodies completos | `lib/logger` |
| T-20 | Contraseñas débiles | Política: ≥ 10 caracteres, mayúscula, minúscula, número; bcrypt cost 12; cambio obligatorio de temporales | `validators/auth` |

## 3. Autenticación

### 3.1 Flujo

```
Login ─▶ verifica bcrypt ─▶ emite { accessToken (JWT 15 min), refreshToken (opaco 7 d) }
                             │                         └─▶ hash SHA-256 → tabla RefreshToken
                             └─▶ cookie crm_refresh (HttpOnly, Secure, SameSite=Strict, Path=/api/auth)

Request API ─▶ Authorization: Bearer <access> ─▶ authenticate: verifica firma/expiración, carga usuario
                                                  activo + permisos del rol (cache 60 s) → req.user

Access expira ─▶ SPA recibe 401 ─▶ POST /auth/refresh (cookie) ─▶ valida hash, no revocado, no expirado
                                     ├─ OK: revoca el actual, crea uno nuevo (replacedById), nuevo access
                                     └─ Token ya rotado (reuso): revoca toda la cadena → 401 (fuerza re-login)

Logout ─▶ revoca refresh actual, limpia cookie. Access expira solo.
```

### 3.2 JWT de acceso

| Campo | Valor |
|---|---|
| Algoritmo | HS256, secreto ≥ 64 bytes aleatorios (`JWT_ACCESS_SECRET`) |
| Claims | `sub` (userId), `role` (nombre, solo hint UI), `jti`, `iat`, `exp` (15 min), `iss: "crm-api"`, `aud: "crm-client"` |
| Verificación | Firma, `exp`, `iss`, `aud`; luego usuario existe y `isActive` |
| Rotación de secreto | Cambiar la variable y reiniciar invalida todos los access tokens (los refresh siguen válidos → sesiones se recuperan solas) |

### 3.3 Refresh token

- 64 bytes de `crypto.randomBytes` en base64url; en base se guarda solo el SHA-256.
- Un registro por sesión (dispositivo). Limpieza de expirados por job diario.
- `REFRESH_TOKEN_EXPIRES_DAYS=7`; cada rotación crea un registro nuevo con la misma expiración absoluta (no se extiende indefinidamente).

### 3.4 Contraseñas

- bcrypt con `BCRYPT_ROUNDS=12`.
- Política aplicada en Zod: longitud ≥ 10, al menos una mayúscula, una minúscula y un dígito; máximo 128.
- Comparación con `bcrypt.compare` incluso si el usuario no existe (se compara contra un hash dummy) para igualar tiempos.
- `mustChangePassword`: bloquea todo salvo `/auth/me`, `/auth/change-password`, `/auth/logout`.

## 4. Autorización (RBAC)

### 4.1 Catálogo de permisos

Formato `modulo:accion`. `read_all`/`update_all` amplían el alcance de `read`/`update` a registros de otros usuarios.

| Módulo | Permisos |
|---|---|
| users | `users:read`, `users:create`, `users:update`, `users:manage` (estado, rol, reset) |
| roles | `roles:read`, `roles:manage` |
| companies | `companies:read`, `companies:create`, `companies:update`, `companies:delete` (archivar/restaurar) |
| contacts | `contacts:read`, `contacts:create`, `contacts:update`, `contacts:delete` |
| clients | `clients:read`, `clients:read_all`, `clients:create`, `clients:update`, `clients:update_all`, `clients:delete`, `clients:assign` |
| leads | `leads:read`, `leads:read_all`, `leads:create`, `leads:update`, `leads:update_all`, `leads:delete`, `leads:assign`, `leads:convert` |
| opportunities | `opportunities:read`, `opportunities:read_all`, `opportunities:create`, `opportunities:update`, `opportunities:update_all`, `opportunities:delete`, `opportunities:assign`, `opportunities:reopen` |
| activities | `activities:read`, `activities:read_all`, `activities:create`, `activities:update`, `activities:update_all`, `activities:delete`, `activities:delete_all` |
| notes | `notes:create`, `notes:update`, `notes:delete` (propias), `notes:manage` (ajenas) |
| dashboard | `dashboard:view`, `dashboard:view_all` |
| reports | `reports:view`, `reports:view_all`, `reports:export` |
| settings | `settings:read`, `settings:manage` |
| audit | `audit:read` |

### 4.2 Matriz de roles

| Permiso | Admin | Manager | Vendedor |
|---|:---:|:---:|:---:|
| users:* / roles:* | ✔ | — | — |
| settings:read | ✔ | ✔ | ✔ |
| settings:manage · audit:read | ✔ | — | — |
| companies: read/create/update | ✔ | ✔ | ✔ |
| companies:delete | ✔ | ✔ | — |
| contacts: read/create/update | ✔ | ✔ | ✔ |
| contacts:delete | ✔ | ✔ | — |
| clients: read/create/update | ✔ | ✔ | ✔ (propios) |
| clients: read_all/update_all/delete/assign | ✔ | ✔ | — |
| leads: read/create/update/convert | ✔ | ✔ | ✔ (propios) |
| leads: read_all/update_all/delete/assign | ✔ | ✔ | — |
| opportunities: read/create/update | ✔ | ✔ | ✔ (propias) |
| opportunities: read_all/update_all/delete/assign/reopen | ✔ | ✔ | — |
| activities: read/create/update/delete | ✔ | ✔ | ✔ (propias) |
| activities: read_all/update_all/delete_all | ✔ | ✔ | — |
| notes: create/update/delete | ✔ | ✔ | ✔ (propias) |
| notes:manage | ✔ | ✔ | — |
| dashboard:view · reports:view | ✔ | ✔ | ✔ (propios) |
| dashboard:view_all · reports:view_all · reports:export | ✔ | ✔ | — |

### 4.3 Aplicación

- `authorize('clients:update')` → 403 si el permiso no está en `req.user.permissions`.
- Scope: `ownerScope(user, 'clients')` añade `ownerId = user.id` al `where` si falta `clients:read_all`.
- Modificación: `assertCanModify(user, 'clients', record)` exige `update_all` o `record.ownerId === user.id`.
- Cache de permisos por rol (60 s) invalidada al modificar un rol; los cambios de rol de usuario son inmediatos porque `authenticate` relee `roleId` en cada request.

## 5. Validación de entrada

- Todo endpoint declara `validate({ body, params, query })` con esquemas Zod; el controlador solo lee `req.validated`.
- Tipos, obligatorios, longitudes máximas (coinciden con `NVARCHAR(n)`), emails (`z.string().email()`), fechas (`z.coerce.date()` / `YYYY-MM-DD`), números (`z.coerce.number()` con rangos), IDs (`int().positive()`), estados (`z.enum`), relaciones (existencia y coherencia verificadas en services).
- `sortBy` y filtros: enumeraciones cerradas por recurso.
- Strings se recortan (`trim`) y se rechazan vacíos cuando son obligatorios.

## 6. Cabeceras y transporte

| Medida | Configuración |
|---|---|
| `helmet` | CSP (`default-src 'self'`; fuentes e imágenes `'self' data:`), HSTS 180 días en producción, `frameguard: deny`, `noSniff`, `referrerPolicy` |
| CORS | `origin` en lista `CORS_ORIGINS`, `credentials: true`, métodos `GET,POST,PUT,PATCH,DELETE`, cabeceras `Content-Type, Authorization` |
| Cookies | `HttpOnly`, `Secure` (`COOKIE_SECURE=true` en producción), `SameSite=Strict`, `Path=/api/auth` |
| HTTPS | Terminado en reverse proxy; `TRUST_PROXY=true` para que Express y rate-limit lean `X-Forwarded-*` |
| Rate limit | Global 300 / 15 min / IP; login 10 / 15 min / IP; respuesta 429 `RATE_LIMITED` con `Retry-After` |

## 7. Registro de eventos de seguridad

| Evento | Nivel | Datos |
|---|---|---|
| Login OK | info | userId, ip, userAgent |
| Login fallido | warn | email (normalizado), ip, motivo genérico |
| Cuenta bloqueada | warn | userId, ip |
| Reuso de refresh token | warn | userId, ip |
| 401 / 403 | warn | ruta, userId (si hay), permiso requerido |
| Cambio de rol, estado, contraseña, reset | info + AuditLog | actor, objetivo |
| Conversión de lead, cierre/reapertura de oportunidad | info + AuditLog | actor, entidad |
| Error 5xx | error | requestId, stack (solo log) |

## 8. Gestión de secretos y configuración

- Variables requeridas validadas al arranque (`config/env.js`); el proceso no inicia sin `JWT_ACCESS_SECRET` (≥ 32 caracteres) ni `DATABASE_URL`.
- Generar secretos: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`.
- Producción: secretos en el gestor del host (variables del servicio, Docker secrets, Azure Key Vault…), nunca en la imagen ni en el repositorio.
- Rotación: JWT secret (invalida access tokens), credenciales de base (reinicio coordinado).

## 9. Checklist de revisión por fase

Antes de cada merge/push se verifica:

- [ ] Ningún archivo `.env`, certificado ni credencial en `git status` / `git diff --cached`.
- [ ] Endpoints nuevos tienen `authenticate` + `authorize` + `validate`.
- [ ] Services aplican scope y `assertCanModify`.
- [ ] Serializadores no exponen campos sensibles.
- [ ] Tests de autorización (403/404 para usuario sin permiso/alcance) para cada recurso nuevo.
- [ ] `npm audit` sin vulnerabilidades altas/críticas.
- [ ] Logs nuevos no incluyen datos sensibles.
