# CONTEXT.md — consorcios-app

> Documento de contexto para revisiones asistidas por IA.
> **Generado:** 2026-09-10 · **Commit auditado:** `f1b8996` · **Auditor:** Claude (Cowork)
> **Alcance:** revisión estática completa del repo + verificación empírica del schema SQL contra PostgreSQL 16 local.
> **No verificado:** `npm install` / `next build` / runtime (el entorno de auditoría no tenía acceso al registry de npm).

---

## 1. Qué es este proyecto

App web de **administración de consorcios de propiedad horizontal** (Argentina). Gestiona consorcios → edificios → unidades → propietarios, con registro de pagos de expensas, un flujo de mora escalonado (al día → deudor → apto carta documento → inicio de juicio → juicio en curso) y un módulo de mantenimiento/arreglos.

Se autodescribe como **"Zero-Cost Stack"**: Supabase free tier + Resend + PM2 en VPS propio.

### Estado real del proyecto (importante)

Es un **prototipo funcional a medias, no apto para producción**. Concretamente:

- ~~**Ningún usuario se puede crear** contra el schema commiteado → la app no se puede bootstrappear.~~ Corregido en bloque 0 (migración 001 + `create-propietario`); pendiente de verificar contra la DB viva.
- ~~**El motor de mora no corre**: `get_saldo_deudor()` tira error en la primera línea útil.~~ Corregido en bloque 0 (migración 001); pendiente de verificar contra la DB viva.
- **El login no persiste sesión donde el middleware la busca** → o el middleware rechaza todo, o corre con `DISABLE_AUTH=true` y **no hay autenticación en absoluto** (§5).
- **Toda la capa de datos usa la `service_role` key**, que saltea RLS. Las policies del schema son decorativas (§4.3).
- **`sanitize.ts` (295 líneas, todos los schemas zod) es código muerto**: se importa, nunca se llama (§7).

La estructura y la intención están bien. La ejecución tiene agujeros de seguridad críticos y bugs que impiden que el core funcione.

---

## 2. Stack y estructura

| Capa | Tecnología |
|---|---|
| Framework | Next.js **16.2.3** (App Router, Turbopack, `output: 'standalone'`) |
| Runtime | React 19.2.4, TypeScript 5 (`strict: true`) |
| Base de datos / Auth / Storage | Supabase (`@supabase/supabase-js` ^2.103) |
| Email | Resend ^6.11 (**instalado pero comentado en el código**) |
| Validación | Zod ^4.3 (**declarado, nunca ejecutado**) |
| UI | Tailwind CSS 3.4 + lucide-react |
| Deploy | PM2 (`ecosystem.config.js`, cwd hardcodeado a `/home/pablo/consorcios-app`) |
| Tests | **Ninguno.** No hay test runner configurado. |

```
src/
├── middleware.ts              # 300 LOC: geo-block, rate limit, JWT, headers, blocklist
├── actions/                   # Server Actions ('use server')
│   ├── consorcios.ts          # CRUD consorcios/edificios/unidades/pagos/arreglos + counts
│   ├── mora.ts                # evaluarYEnviarMora() — motor de mora
│   └── search.ts              # búsqueda global
├── app/
│   ├── (auth)/                # login, logout, register (deshabilitado), recuperar-password
│   ├── api/                   # 10 route handlers, TODOS con service_role
│   │   ├── auth/create-admin, create-propietario, reset-password
│   │   ├── consorcios, edificios, unidades, pagos, arreglos
│   │   ├── consorcios-with-edificios, health
│   ├── consorcios/, unidades/, pagos/, mantenimiento/, admin/mora/
├── components/                # AuthGuard (NUNCA USADO), Header, SearchBox, UploadImage, ConditionalLayout
├── hooks/useUser.ts
├── lib/
│   ├── auth.ts                # verifyJWT, requiresAdmin, redirectToLogin
│   ├── supabase.ts            # singletons admin (service_role) + público (anon)
│   ├── sanitize.ts            # CÓDIGO MUERTO (295 LOC)
│   ├── geolocation.ts / geolocation-mw.ts
│   ├── logger.ts
│   └── security/blocklist.ts, security/logger.ts
└── types/index.ts
supabase/schema.sql            # 343 líneas: tablas, 2 funciones plpgsql, RLS, seed
```

**~8.500 LOC** en `src/`. 17 commits, todos en `main`, sin PRs ni branches.

---

## 3. Modelo de datos

```
consorcios ──< edificios ──< unidades ──< propietarios (1:1, UNIQUE unidad_id)
                                 │              │
                                 ├──< pagos ────┘
                                 ├──< arreglos
                                 └──< mora_logs
tablas de seguridad: security_logs, blocked_ips
```

### Inconsistencias schema ↔ código (todas verificadas contra PG16)

| El código pide | El schema tiene | Dónde rompe |
|---|---|---|
| `unidades.pisos` | `unidades.piso` | `api/auth/create-propietario` línea 161 → **no se puede crear ningún propietario** |
| `unidades.edificio_id` | `unidades.building_id` | `actions/mora.ts` línea 690 |
| `unidades.estado_mora` | *(no existe)* | `getMoraStats()` en `actions/consorcios.ts` |
| `propietarios.unidad_id` nullable | `NOT NULL` | `api/auth/create-admin` → **no se puede crear ningún admin** |

### Nomenclatura mezclada
`consortium_id` / `building_id` (inglés) conviven con `unidad_id` / `nombre` / `direccion` (español) en las mismas tablas. `es_dueño_principal` tiene una `ñ` en el nombre de columna.

### Lo que NO está modelado (y el negocio lo necesita)
No hay tabla de **expensas** ni de **liquidación**. No hay período, ni prorrateo por coeficiente, ni intereses, ni saldo por unidad, ni proveedores, ni facturas, ni sueldos del encargado, ni asambleas, ni seguros. `coeficiente` existe en `unidades` pero **nunca se usa en ningún cálculo**. El monto de la expensa está **hardcodeado en `150000 * 1.20`** dentro de `get_saldo_deudor()`. Ver §9.

---

## 4. Modelo de autenticación y autorización

### 4.1 Roles
No hay tabla de roles. **`isAdmin` = "el propietario no tiene `unidad_id`"**. Se calcula en tres lugares con dos definiciones distintas:

| Archivo | Definición |
|---|---|
| `lib/auth.ts:64` | `isAdmin = !propietario?.unidad_id` |
| `components/AuthGuard.tsx:1089` | `isAdmin = !propietario?.unidad_id` |
| `hooks/useUser.ts:996` | `setIsAdmin(!prop)` ← **distinta** |

En `useUser.ts` la query usa el cliente **anon** con RLS activa; si la policy bloquea la fila o `.single()` no encuentra nada, `prop` es `null` y el usuario queda marcado **admin** en la UI. Es escalada de privilegios por defecto (solo visual, pero guía el menú).

### 4.2 Multi-tenancy: no existe
No hay relación `admin ↔ consorcio`. Cualquier usuario autenticado que llegue a un endpoint ve **todos los consorcios, todas las unidades, todos los propietarios y todos los pagos** del sistema. Para un SaaS que apunta a varias administraciones, esto es bloqueante.

### 4.3 RLS: decorativa
El schema habilita RLS en 7 tablas y define 5 policies. Pero **el 100% de las lecturas y escrituras del servidor usan `createSupabaseAdmin()` (service_role), que saltea RLS por diseño**. Verificado: `consorcios`, `edificios`, `mora_logs`, `security_logs` y `blocked_ips` tienen RLS activa y **cero policies** — deny-all para el cliente anon, irrelevante para el servidor.

---

## 5. El problema central de auth

```
login/page.tsx  →  supabase.auth.signInWithPassword()
                   persistSession: true  →  guarda la sesión en localStorage
                                                    ↓
middleware.ts   →  verifyJWT() busca la cookie 'sb-access-token'
                                                    ↓
                            esa cookie NUNCA se escribe
```

`@supabase/supabase-js` sin los helpers SSR (`@supabase/ssr`) guarda la sesión en **localStorage**, que el middleware (que corre en el servidor/Edge) no puede leer. El token tampoco se manda en el header `Authorization` desde ningún fetch del cliente.

**Consecuencia:** todo request a ruta protegida falla la verificación → redirect a `/login` → loop. La única forma de que la app ande es `DISABLE_AUTH=true` en `.env.local`, que en `middleware.ts:151` hace `return NextResponse.next()` **antes de cualquier chequeo**. El historial de commits (`fix: use window.location for reliable redirect after login`, `fix: simplify login - add console logs`) sugiere que se peleó con este síntoma sin llegar a la causa.

**Bug adicional:** `middleware.ts:246-248` hace `request.headers.set('x-user-id', ...)`. En Next.js eso **no propaga nada** a las rutas downstream — hay que devolver `NextResponse.next({ request: { headers: nuevosHeaders } })`. Por eso ninguna API route sabe quién es el usuario, y por eso todas terminan usando service_role sin filtrar.

---

## 6. Hallazgos — Seguridad

Severidad: 🔴 crítico · 🟠 alto · 🟡 medio · ⚪ bajo

### 🔴 6.1 — Secreto de creación de admin hardcodeado
`api/auth/create-admin/route.ts:16` y `create-propietario/route.ts:135`:
```ts
const ADMIN_SECRET = process.env.ADMIN_CREATE_SECRET || 'admin-secret-123';
```
Si la env var no está seteada (y no hay `.env.example` que lo recuerde), **cualquiera con el código a la vista crea un administrador del sistema**. El repo estuvo público. **Fix:** fallar el arranque si falta la variable; nunca un default.

### 🔴 6.2 — Toda la capa de datos con `service_role`, sin filtro por usuario
Los 10 route handlers y los 3 archivos de `actions/` usan `createSupabaseAdmin()`. Ninguno verifica identidad ni pertenencia. La única defensa es el middleware — que es bypasseable de tres formas (§6.3, §6.4, §5).

### 🔴 6.3 — `DISABLE_AUTH=true` desactiva absolutamente todo
`middleware.ts:151`. Un flag de env en la primera línea del middleware apaga auth, rate limiting, geo-block, blocklist **y los security headers**. En un `.env` de producción mal copiado, la app queda completamente abierta. **Fix:** que solo funcione si `NODE_ENV !== 'production'`.

### 🔴 6.4 — El `matcher` del middleware deja pasar todo lo que tenga un punto
```ts
matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*$).*)']
```
`.*\..*$` excluye del middleware **cualquier path que contenga un punto**. Combinado con `isPublicRoute()` que devuelve `true` para `pathname.includes('.ico')`, es superficie de bypass innecesaria. **Fix:** matcher explícito por prefijo (`/api/:path*`, etc.).

### 🔴 6.5 — Open redirect (y posible XSS) en el login
`redirectToLogin()` (`lib/auth.ts:178`) mete la URL completa en `?redirect=`, y `login/page.tsx:1600` hace:
```ts
window.location.href = redirect;   // redirect viene de searchParams, sin validar
```
`/login?redirect=https://sitio-falso.com` redirige a cualquier lado tras un login exitoso — vector de phishing perfecto para robar la siguiente credencial. `javascript:` en ese slot también es plausible. **Fix:** aceptar solo paths que empiecen con `/` y no con `//`.

### 🟠 6.6 — Geo-blocking que no bloquea nada
`geolocation-mw.ts:760` devuelve, para toda IP desconocida:
```ts
return { country: 'Argentina', countryCode: 'AR', isArgentina: true };
```
La feature entera es un no-op (el comentario dice "TODO: Replace with proper geolocation service"). Peor: `middleware.ts` en el path de geo-block llama a `blockIP(ip, 'geo_block', cc, null)` → **bloqueo permanente** en DB. Si alguna vez se arregla la geolocalización, un falso positivo banea a un propietario para siempre sin proceso de apelación.

### 🟠 6.7 — IP tomada de `x-forwarded-for` sin validar
`getClientIP()` (`middleware.ts:62`) confía en el header crudo. Es spoofeable: rotar el header saltea rate limit, blocklist y el límite diario. Si la app queda expuesta sin un reverse proxy que reescriba el header, no hay defensa. **Fix:** tomar la IP del proxy de confianza (`x-real-ip` seteado por nginx, o `request.ip`).

### 🟠 6.8 — Rate limiting en memoria
`rateLimitStore = new Map()` en `middleware.ts:47`. Se pierde en cada restart/deploy y no se comparte entre instancias PM2. El propio comentario lo admite ("for production use Redis"). Además el chequeo de "intentos diarios" hace **una query a Supabase por request** (`getTodayAttempts`) + otra (`isIPBlocked`) — 2 round-trips a la DB en el hot path de cada navegación.

### 🟠 6.9 — Bucket de Storage público
`schema.sql:295`: `INSERT INTO storage.buckets VALUES ('mantenimiento','mantenimiento', true)`. Las fotos de arreglos (que pueden mostrar interiores de unidades, patentes, personas) quedan legibles por URL para cualquiera. `UploadImage.tsx` usa `getPublicUrl()`. **Fix:** bucket privado + signed URLs.

### 🟡 6.10 — Filtrado de errores internos al cliente
Todas las rutas devuelven `error.message` de Supabase tal cual (`return Response.json({ error: error.message })`). Se filtran nombres de tablas, columnas y constraints. `/api/health` es público y expone uptime, uso de memoria y el mensaje de error de conexión a la DB.

### 🟡 6.11 — Enumeración de usuarios ineficiente en reset-password
`reset-password/route.ts:293` hace `supabase.auth.admin.listUsers()` **y lo recorre en memoria**. Está paginado (50 por default), así que con >50 usuarios el reset deja de funcionar para los que no entran en la primera página. La respuesta genérica está bien; el mecanismo no. **Fix:** llamar `resetPasswordForEmail()` directo, que ya es no-enumerable.

### 🟡 6.12 — CSP débil
`script-src 'self' 'unsafe-inline' 'unsafe-eval'` anula buena parte del valor de la CSP. Además `connect-src` incluye `http://localhost:*` en **producción** (commit `5e5ce5a`). **Fix:** nonces de Next.js y sacar localhost del build de prod.

### 🟡 6.13 — Sin protección CSRF
Las API routes aceptan `POST` con JSON sin verificar `Origin`/`Referer`. Con auth por cookie (que es a donde hay que ir), esto se vuelve explotable.

### 🟡 6.14 — Server Actions sin control de acceso
`admin/mora/page.tsx` expone un Server Action inline que corre `evaluarYEnviarMora()` sin ningún chequeo de rol. Cuando se descomenten los emails de Resend, ese action **manda cartas de intimación legal a los propietarios**. Debe verificar admin adentro del action, no confiar en el middleware.

### 🟡 6.15 — ~~Funciones `SECURITY DEFINER` sin `search_path`~~ · RESUELTO (bloque 0)
~~`get_saldo_deudor` y `evaluar_y_actualizar_mora` corren como owner sin `SET search_path = public, pg_temp`. Es el vector clásico de secuestro de search_path en Postgres.~~
**Resuelto** en `supabase/migrations/001_bloque0_arranque.sql`: ambas funciones se recrean con `SET search_path = public, pg_temp`.

### ⚪ 6.16 — Logging de bodies completos
`logger.debug('Create Consortium request', body)` y similares en 6 rutas. En dev loguea DNI, emails y teléfonos a stdout → a los logs de PM2 en disco, sin rotación configurada.

### ⚪ 6.17 — `console.log` de credenciales en el login
`login/page.tsx:1681`: `console.log('[LOGIN] Password changed, length:', ...)` y `console.log('[LOGIN] Supabase response:', { data, authError })` — **imprime el objeto session completo, con el access token, en la consola del browser**. 21 `console.log` en total en `src/`.

### ✅ Lo que sí está bien
- **No hay secretos commiteados.** Revisé todo el historial (17 commits): ningún `.env`, ninguna key de Supabase, ningún token de Resend. El `.gitignore` cubre `.env*` desde el commit inicial. Haber hecho el repo público no filtró credenciales.
- No hay `dangerouslySetInnerHTML`, `eval()` ni concatenación de SQL crudo. El SDK de Supabase parametriza todo → **sin riesgo de SQL injection**.
- Los headers de seguridad base (HSTS, X-Frame-Options, nosniff, Referrer-Policy, COOP/CORP) están bien puestos.
- Rollback del usuario de auth si falla el insert del propietario: buen detalle.
- La respuesta genérica del reset-password (no revela si el email existe) es correcta.

---

## 7. Hallazgos — Bugs funcionales

**Verificados empíricamente** levantando PostgreSQL 16 local, aplicando `supabase/schema.sql` con stubs de `auth.users`/`auth.uid()`, y ejecutando las llamadas que hace la app.

### 🔴 7.1 — ~~`get_saldo_deudor()` explota en runtime~~ · RESUELTO (bloque 0)
~~`MIN(12, EXTRACT(MONTH FROM AGE(...)))` → `function min(integer, integer) does not exist`. En PostgreSQL `MIN()` es agregación, no acepta dos escalares.~~
**Resuelto** en `migrations/001_bloque0_arranque.sql`: `LEAST` en vez de `MIN` (el tope de 12 se aplica sólo a la fórmula del monto). Falta verificar contra la DB viva.

### 🔴 7.2 — ~~No se puede crear ningún administrador~~ · RESUELTO (bloque 0)
~~`create-admin` inserta sin `unidad_id` (marca de admin) pero la columna es `NOT NULL` → 500 siempre.~~
**Resuelto** en `migrations/001_bloque0_arranque.sql`: `unidad_id` pasa a nullable y la constraint `UNIQUE (unidad_id)` se reemplaza por un índice único parcial `WHERE unidad_id IS NOT NULL`. Falta verificar 200 contra la DB viva.

### 🔴 7.3 — ~~No se puede crear ningún propietario~~ · RESUELTO (bloque 0)
~~`create-propietario` hace `.select('id, numero, pisos')` sobre `unidades`; la columna es `piso`.~~
**Resuelto**: `src/app/api/auth/create-propietario/route.ts` ahora consulta `piso`. Falta verificar 200 contra la DB viva.

### 🟠 7.4 — ~~El cálculo de meses de deuda ignora los años~~ · RESUELTO (bloque 0)
~~`EXTRACT(MONTH FROM AGE(...))` toma sólo el componente de meses: 14 meses se calculaba como 2, y el escalamiento legal nunca disparaba para los peores casos.~~
**Resuelto** en `migrations/001_bloque0_arranque.sql`: `EXTRACT(YEAR FROM edad)*12 + EXTRACT(MONTH FROM edad)`. `meses_atrasados` devuelve el conteo real (sin tope). Falta verificar contra la DB viva.

### 🟠 7.5 — Monto de expensa hardcodeado
`schema.sql:182`: `v_monto_total := v_meses_atrasados * 150000 * 1.20;`
Toda unidad debe lo mismo, sin importar el coeficiente, el edificio ni el período. El 1.20 (¿interés? ¿IVA?) no está documentado. Es el corazón del negocio y es una constante mágica.

### 🟠 7.6 — ~~`getMoraStats()` consulta una columna que no existe~~ · RESUELTO (bloque 0)
~~`.from('unidades').select('estado_mora')` → `column "estado_mora" does not exist`. `admin/mora` mostraba ceros hardcodeados ("Stats simuladas").~~
**Resuelto**: `getMoraStats()` deriva el estado de cada unidad del `mora_logs` más reciente; `admin/mora/page.tsx` la consume (render dinámico).

### 🟠 7.7 — ~~`evaluarYEnviarMora()` cuenta emails que nunca manda~~ · RESUELTO (bloque 0)
~~El bloque de Resend está comentado pero `emailsEnviados++` está afuera del comentario. Además la query previa pedía `edificio_id`, columna inexistente.~~
**Resuelto**: el `++` suelto se eliminó (`emailsEnviados` queda en 0 mientras Resend esté deshabilitado); la query usa `building_id`.

### 🟡 7.8 — ~~Typo `aptoo_carta` en el mapa de estados~~ · RESUELTO (bloque 0)
~~`aptoo_carta` (doble o) en `ESTADOS_MORA` y `getEmailTemplate()`; el template de carta documento nunca se seleccionaba.~~
**Resuelto**: `aptoo_carta` → `apto_carta` en `src/actions/mora.ts`.

### 🟡 7.9 — El seed duplica filas en cada ejecución
`ON CONFLICT DO NOTHING` sin constraint único sobre `consorcios(nombre)` no hace nada. Verificado: dos corridas → dos "Consorcio Torre Centro".

### 🟡 7.10 — `updated_at` nunca se actualiza
Ocho tablas tienen la columna con `DEFAULT NOW()` y **cero triggers**. Queda congelada en la fecha de creación.

### 🟡 7.11 — `es_dueño_principal` + `porcentaje_propiedad` vs `UNIQUE (unidad_id)`
El schema modela copropiedad (porcentaje, dueño principal) pero la constraint `unique_propietario_por_unidad` permite **un solo propietario por unidad**. Contradicción de diseño: en propiedad horizontal la copropiedad es común (sucesiones, matrimonios).

### ⚪ 7.12 — `recuperar-password/page.tsx` tiene el `import` al final del archivo
`import { useRouter } from 'next/navigation'` está en la última línea (funciona por hoisting), y `router` nunca se usa → error de lint.

### ⚪ 7.13 — `test-api.js` requiere `dotenv`, que no está en `package.json`
Falla con `MODULE_NOT_FOUND`. Además hace un INSERT+DELETE real contra la DB con service_role.

---

## 8. Deuda técnica

| Tema | Detalle |
|---|---|
| **Código muerto** | `lib/sanitize.ts` completo (295 LOC, 9 schemas zod): importado en `middleware.ts` pero **ninguna función se llama**. Verificado: 0 usos de `sanitizeString`, `validateInput`, `createPagoSchema`, etc. en todo `src/`. |
| **Código muerto** | `components/AuthGuard.tsx` (`AuthGuard`, `AuthRequired`, `AdminOnly`): **cero referencias** en `src/app/`. La protección client-side no existe. |
| **Código muerto** | `lib/geolocation.ts` (versión async) no la usa nadie salvo `getCountryCode` desde el security logger. `verifyAdmin`, `requiresAuth`, `logLoginFailed`, `logSecurityEvent` se importan en el middleware y no se usan. |
| **Validación** | Ninguna API route usa zod. Todas hacen `if (!campo)` a mano. Sin límites de longitud → un `titulo` de 10 MB entra sin problema. |
| **Tipos** | 24 usos de `: any` / `as any` / `@ts-ignore`. `ActionResponse<any[]>` en todos los getters anula el `strict: true` del tsconfig. |
| **Tests** | Cero. Sin runner, sin CI, sin GitHub Actions (a pesar de que el schema menciona "GitHub Actions" en el header). |
| **Duplicación** | `search()` está implementada dos veces (`actions/consorcios.ts` y `actions/search.ts`) con lógicas distintas. `generateTempPassword()` copiado en dos rutas. |
| **Crypto** | `generateTempPassword()` usa `Math.random()`, no `crypto.randomUUID()`/`randomBytes`. Predecible. |
| **Deploy** | `ecosystem.config.js` tiene `cwd: '/home/pablo/consorcios-app'` hardcodeado. `output: 'standalone'` genera `.next/standalone/server.js`, pero PM2 arranca `next start` — se pierde el beneficio del standalone. |
| **Docs** | El `README.md` es el de `create-next-app` sin tocar. No hay `.env.example`. |
| **Git** | 17 commits, todos directos a `main`, 12 de ellos `fix:` sobre los mismos síntomas de login. |

---

## 9. Modelo de negocio

### 9.1 El mercado
- **~123.000 consorcios solo en CABA** ([Pequeñas Noticias](https://www.pequenasnoticias.com.ar/NotasDeTapa/2023/NotaDeTapa0760.asp)), más el conurbano y las capitales del interior. Mercado grande, fragmentado y con muy baja penetración de software moderno.
- El comprador es el **administrador** (estudio o profesional independiente), no el propietario. Un administrador chico maneja 5–20 edificios; uno mediano, 50–150.
- **Honorarios de referencia CAPHAI (feb–mar 2026):** ~$400.000 a $990.000 por edificio/mes según categoría y cantidad de unidades. El software es un costo marginal frente a ese ingreso → **hay margen para cobrar, pero solo si el software le ahorra horas reales**.

### 9.2 Regulación (es la barrera de entrada, y también el gancho)
- **Ley 941 CABA** + **Disposición 1129/DGDYPC/26**: el administrador debe inscribirse en el RPA, dar de alta cada consorcio administrado **dentro de los 30 días de la asamblea**, notificar la baja en 30 días, presentar DDJJ anual, e informar a los consorcistas de estas obligaciones. Incumplir cae bajo las sanciones del art. 16 ([Liga del Consorcista](https://ligadelconsorcista.org/caba-administradores-obligaciones-disposicion-1129-2026)).
- La liquidación de expensas tiene requisitos formales de contenido y respaldo documental (comprobantes, QR de rendición).
- **Sueldos del encargado bajo escala SUTERH (CCT 589/10)**: categorías, antigüedad, plus, SAC, vacaciones. Es la tarea que más tiempo y riesgo le consume al administrador.

**Esto es la oportunidad:** el producto que automatiza *cumplimiento* (RPA, DDJJ, liquidación conforme, sueldos SUTERH) se vende solo. El que solo muestra listas de unidades, no.

### 9.3 Competencia
| Producto | Precio publicado | Notas |
|---|---|---|
| **KM44** | **Gratis hasta 16 UF**, luego ~$940/UF/mes | Liquidación automática, recibos con QR, sueldos SUTERH, balances. Promo 2x1. |
| **CONSO** | ~$2.950/UF/mes | Copilot de IA, lectura de facturas con IA, sueldos SUTERH incluidos. |
| Octopus, AdminProp, Redconar, Adminia Manager, Urbian, ConsorcioAbierto, Kavanagh Cloud | No publican precio | Varios con cobranza QR integrada; AdminProp y Redconar con sueldos. |

Fuente: [comparativa CONSO 2026](https://conso.com.ar/blog/herramientas/mejor-software-administracion-edificios-argentina), [KM44](https://expensas.km44.com.ar/).

### 9.4 Diagnóstico honesto del posicionamiento actual

**El problema:** el mercado ya tiene un competidor **gratis hasta 16 unidades** que ya hace liquidación de expensas, recibos con QR y sueldos SUTERH. La propuesta "Zero-Cost" no es un diferencial — es la mesa de entrada.

**Lo que la app hace hoy** (ABM de consorcios/edificios/unidades + registro manual de pagos + mantenimiento) es el **20% menos valioso** del trabajo del administrador. Le falta exactamente lo que se cobra:

| Función core del negocio | ¿Está? |
|---|---|
| Liquidación de expensas (prorrateo por coeficiente, período, intereses) | ❌ No hay ni tabla |
| Emisión del cupón/liquidación al propietario | ❌ |
| Sueldos del encargado con escala SUTERH | ❌ |
| Gestión de proveedores y facturas | ❌ |
| Conciliación bancaria / cobranza | ❌ (pagos se cargan a mano) |
| Rendición con respaldo documental / QR | ❌ |
| Asambleas, actas, convocatorias | ❌ |
| Seguros, mantenimiento obligatorio (ascensores, gas) | Parcial (arreglos ad-hoc) |
| Cumplimiento RPA / DDJJ Ley 941 | ❌ |
| Portal del propietario | Parcial (login existe, no muestra nada propio) |
| Flujo de mora escalonado | 🟡 Diseñado, **no funciona** (§7.1) |

**Lo único genuinamente diferencial que ya está pensado** es el **workflow de mora automatizado con escalamiento legal** (al día → deudor → apto carta documento → inicio juicio → juicio en curso, con emails automáticos). Ningún competidor lo publicita como feature central. La morosidad es *el* dolor #1 del administrador y del consorcio.

### 9.5 Recomendación estratégica

**Opción A — Nicho: "el que cobra".** Abandonar la idea de competir en suite completa. Posicionarse como la **capa de gestión de morosidad y cobranza** que se conecta al sistema de liquidación que el administrador ya usa. Vender por resultado (% de recupero o fee fijo por unidad en mora), no por unidad funcional. Requiere: arreglar el motor de mora, integrar carta documento digital, plantillas legales, integración con estudios jurídicos. Es el camino con menos superficie a construir y con el diferencial más claro.

**Opción B — Suite completa.** Competir de frente. Requiere construir liquidación + SUTERH + proveedores + rendición, o sea ~12-18 meses de trabajo antes de tener paridad con un producto gratuito. Solo tiene sentido con un ángulo fuerte (IA sobre facturas y liquidaciones, por ejemplo) y financiamiento.

**Opción C — Uso interno.** Si el destino es administrar los propios consorcios, todo el §9.4 es irrelevante: solo hay que arreglar §6 y §7. Es la opción más barata y la que el estado actual del código sugiere.

**Antes de decidir cualquiera de las tres**: los bugs de §7.1–7.3 impiden que la app se use aunque sea para uno mismo.

---

## 10. Cómo levantar el proyecto en Ubuntu

Ver **`SETUP.md`** en la raíz para el paso a paso con comandos.

Resumen: Node 20+ (el proyecto usa Next 16, probado con Node 22), `npm ci`, un proyecto Supabase con `supabase/schema.sql` aplicado (**con los parches de §7 antes de aplicarlo**), y un `.env.local` con:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_CREATE_SECRET=          # obligatorio, sin default
NEXT_PUBLIC_SITE_URL=http://localhost:3000
RESEND_API_KEY=               # opcional
# DISABLE_AUTH=true           # solo dev, NUNCA en producción
```

---

## 11. Orden de trabajo sugerido

**Bloque 0 — que arranque** (sin esto no hay app)
1. `LEAST` en vez de `MIN` en `get_saldo_deudor` (§7.1)
2. `propietarios.unidad_id` → nullable, o tabla `usuarios` con rol explícito (§7.2)
3. `pisos` → `piso` en `create-propietario` (§7.3)
4. `edificio_id` → `building_id` en `actions/mora.ts`; sacar `estado_mora` de `getMoraStats` (§7.6)

**Bloque 1 — seguridad crítica** (antes de cualquier dato real)
5. Sacar el default `'admin-secret-123'` (§6.1)
6. Migrar a `@supabase/ssr` con cookies → arreglar el flujo de auth de raíz (§5)
7. `DISABLE_AUTH` solo en dev (§6.3)
8. Matcher explícito del middleware (§6.4)
9. Validar el `redirect` del login (§6.5)
10. Dejar de usar `service_role` en las rutas de lectura: cliente por request con el JWT del usuario + RLS real (§6.2, §4.3)

**Bloque 2 — correctitud del negocio**
11. Cálculo de meses con años incluidos (§7.4)
12. Tabla `expensas` / `liquidaciones` y sacar el `150000 * 1.20` (§7.5)
13. Typo `aptoo_carta` (§7.8)
14. Aplicar los schemas zod que ya existen en las API routes (§8)

**Bloque 3 — hardening y calidad**
15. Rate limiting en Supabase/Redis, IP desde proxy confiable (§6.7, §6.8)
16. Bucket privado + signed URLs (§6.9)
17. Sacar los `console.log` con tokens y bodies (§6.16, §6.17)
18. Triggers `updated_at`, `search_path` en las funciones, constraint única para el seed
19. Tests (al menos del motor de mora) + CI

---

## 12. Convenciones para revisiones futuras

- **`AGENTS.md` avisa que Next.js 16 tiene breaking changes** respecto de versiones anteriores. Antes de escribir código, leer `node_modules/next/dist/docs/`. No asumir APIs de Next 14/15.
- El schema real puede haber divergido de `supabase/schema.sql` (varias columnas que el código usa no están ahí). **Verificar contra la DB viva** antes de afirmar que algo está roto.
- Idioma del código: comentarios y dominio en español, código en inglés/español mezclado. Mantener el español en lo nuevo.
- No hay tests: cualquier cambio se valida con `npm run lint` + `npx tsc --noEmit` + prueba manual.
- Este documento se actualiza en cada review. Marcar los hallazgos resueltos con ~~tachado~~ en vez de borrarlos, para tener trazabilidad.

---

### Fuentes consultadas para §9
- [Pequeñas Noticias — En la CABA hay exactamente 123 mil consorcios](https://www.pequenasnoticias.com.ar/NotasDeTapa/2023/NotaDeTapa0760.asp)
- [Liga del Consorcista — Disposición 1129/DGDYPC/26](https://ligadelconsorcista.org/caba-administradores-obligaciones-disposicion-1129-2026)
- [CEDOM — Ley 941 reglamentación](https://www.cedom.gob.ar/legislacion/normas/leyes/RepoLeyes/anexos/drl941.html)
- [CONSO — Comparativa de software de administración de edificios 2026](https://conso.com.ar/blog/herramientas/mejor-software-administracion-edificios-argentina)
- [CONSO — Administración de consorcios: guía 2026](https://conso.com.ar/administracion-de-consorcios)
- [KM44 — Sistema de liquidación de expensas](https://expensas.km44.com.ar/)
