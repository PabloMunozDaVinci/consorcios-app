# PENDIENTES — revisión al final

> Lista viva. Cada bloque agrega lo suyo. No borrar ítems: tacharlos (`~~...~~`) cuando se cierren.

---

## 📍 PARA RETOMAR LA PRÓXIMA SESIÓN (corte del 2026-09-11, sesión 3)

**Estado**: Bloques 0-4 completos, ítem 33 (Bloque 3) cerrado del todo, CSP
estricta también en estilos, y las 4 ramas `fix/bloque-*` ya mergeadas a
`master` (incluye los PRs #1 y #2 que se habían mergeado por GitHub aparte).
Lo único que falta de todo lo pedido hasta ahora es `PROMPT-features.md`
(Fases 1-3 del ROADMAP) — no empezado, es la parte más grande, dimensionalo así.

### Ítem 33 (Bloque 3) — cerrado esta sesión
Se tiparon los paths de lectura de `src/actions/consorcios.ts` (`getConsorcios`,
`getConsorcio`, `getEdificios`, `getUnidades`, `getUnidad`, `getAllUnidades`,
`getPagos`, `getAllPagos`, `getArreglos`) con tipos de join a mano en
`src/types/joins.ts` (uno por cada forma real de `.select()`, con la
cardinalidad — array vs. objeto nullable — de cada embed documentada según la
dirección real de la FK). Se sacaron también los ~15 `.map((x: any) => ...)`
en las páginas que consumían esos arrays.

**Dos bugs reales que el tipado sacó a la luz** (no eran evidentes con `any`,
la DB de test no tenía datos para que se notaran a simple vista):
1. El embed `propietario:propietarios(...)` visto DESDE `unidades` es la
   dirección "hijo" de la FK (`propietarios.unidad_id -> unidades.id`) — Supabase
   lo devuelve como **array**, no como objeto nullable, pese a que hay un índice
   único parcial (migración 001) que en la práctica limita a 0 o 1 fila. Un
   índice único parcial no alcanza para que Supabase lo detecte como
   one-to-one (necesitaría una `UNIQUE CONSTRAINT` completa). Confirmado
   empíricamente contra la DB real. Las páginas (`unidades/page.tsx`,
   `unidades/[id]/page.tsx`) leían `unidad.propietario.nombre` directo, como si
   fuera un objeto — como `[]` es *truthy* en JS, el chequeo `unidad.propietario
   && (...)` siempre entraba y mostraba "undefined, undefined" en vez de
   ocultar la sección o mostrar "Sin propietario registrado". Fix: extraer
   `unidad.propietario[0]` explícitamente. Verificado en el browser (build de
   producción real, sesión de `admin-a` real): ahora "Sin propietario
   registrado" se muestra correctamente cuando no hay dueño.
2. `getConsorcio` (detalle de un consorcio) seleccionaba `'*, edificios(*)'`
   sin anidar `unidades` — la página (`consorcios/[id]/page.tsx`) hacía
   `edificios.reduce((acc, e) => acc + (e.unidades?.length || 0), 0)` para el
   total de unidades, que con `any` nunca tiraba error pero siempre daba 0
   (silenciado por el optional chaining). Fix: el select ahora es
   `'*, edificios(*, unidades(id))'` (sólo el id, alcanza para contar). Verificado
   en el browser contra un consorcio real con 1 edificio y 1 unidad: la página
   ahora muestra "Unidades: 1" en vez de "Unidades: 0".

De paso: `getEdificios` estaba importada pero nunca usada en
`consorcios/[id]/page.tsx` (import muerto, se sacó), y varios `estado`/fechas
tipados como `string | null` por el schema real (nullable en la DB aunque la
app siempre los completa) rompían contra `EstadoBadge`/`new Date()` una vez
tipado — se resolvió con fallbacks explícitos (`?? ''`, `'-'` si es null) en
`mantenimiento/page.tsx` y `pagos/page.tsx`. `npx tsc --noEmit` 0 errores,
`npm run lint` bajó de 39 a 12 errores preexistentes (ninguno nuevo, todos en
componentes cliente de formularios fuera de este alcance), `npm run build` y
`npm test` (33/33) OK.

### CSP estricta en estilos (deuda del Bloque 2, cerrada esta sesión)
El único `style={{}}` dinámico del proyecto (barra de progreso de
`UploadImage.tsx`, que todavía no está enchufada en ninguna página) pasó a
clases Tailwind bucketeadas cada 5% (`progress` siempre llega en múltiplos de
5). `style-src` en `src/proxy.ts` ya no tiene `'unsafe-inline'`. Verificado con
build de producción real: header CSP sin `unsafe-inline` en `style-src`, sin
violaciones de consola en `/login`, clases `w-[N%]` presentes en el CSS
compilado.

### Ramas mergeadas a `master` esta sesión
Los 4 `fix/bloque-*` formaban una pila lineal (cada uno construido sobre el
anterior, no sobre `master` directo) — se pudo hacer fast-forward de `master`
a la punta de `fix/bloque-3-limpieza`. `origin/master` ya tenía los PRs #1 y #2
mergeados por GitHub (mismo contenido, merge commits en vez de historia
lineal) — se reconcilió con un merge commit sin conflictos (mismo contenido,
distinto grafo). `master` local y remoto están sincronizados y al día con todo
el trabajo de Bloques 0-4 + auditoría RLS + ítem 33 + CSP. Las ramas
`fix/bloque-*` no se borraron (quedó a criterio tuyo). El trabajo del ítem 33
vive en una rama nueva, `fix/item-33-tipos-lectura`, todavía sin mergear a
`master` (ver "Para arrancar de nuevo" abajo).

### Auditoría RLS (subagente `auditor-rls`, primera vez que corre) — 5 hallazgos, los 5 arreglados
Migración `supabase/migrations/006_auditoria_rls.sql`, aplicada y verificada
con requests reales (`admin-a`/`admin-b`) antes/después de cada fix:
1. **Crítico**: un `admin` común podía escalarse a `super_admin` (PATCH a su
   propia fila en `usuarios`) y a partir de ahí ver/escribir todos los tenants.
2. **Crítico**: el bucket `mantenimiento` no scopeaba por administradora —
   cualquier usuario podía leer/sobreescribir/borrar archivos de otro tenant
   (el componente de upload sigue sin usarse en ninguna página, así que no
   había objetos reales afectados, pero la policy ya estaba viva).
3. **Alto**: `get_saldo_deudor()` (RPC) filtraba deuda de cualquier unidad de
   cualquier tenant si se llamaba directo (no vía la app).
4. **Alto/medio**: `evaluar_y_actualizar_mora()` (sin llamadores en `src/`,
   resto del Bloque 0) y `rate_limit_hit()`/`rate_limits_cleanup()` eran
   invocables por cualquier autenticado vía RPC directo — `REVOKE EXECUTE`.
5. **Medio**: el trigger `set_tenant_cols()` tenía una rama (`edificios`)
   asimétrica al resto que permitía colgar un edificio propio de un consorcio
   ajeno — con `ON DELETE CASCADE`, eso significaba que otro tenant podía
   arrastrar en cascada datos de éste al borrar su propio consorcio.

No quedó nada pendiente de esta auditoría — los 5 están cerrados. Si se
retoma el proyecto y se toca `src/actions/`, `src/app/api/` o
`supabase/migrations/` de nuevo, correr `auditor-rls` otra vez antes de
mergear (ver criterio en `CLAUDE.md`).

### Bloque 4 (subagente `tester`) — completo
Vitest instalado (`vitest@3.2.4`), 33 tests pasando: `safeRedirectPath` (17
casos), máquina de estados de mora parametrizada por umbral (extraída a
`src/lib/mora-estado.ts`, 10 casos), y 2 tests de integración contra Supabase
real (`tests/integration/`) — aislamiento multi-tenant automatizado (el que
antes sólo estaba verificado a mano) y el caso de regresión de 14 meses de
`get_saldo_deudor`. `.github/workflows/ci.yml` nuevo: lint+tsc+build+tests
unitarios siempre, tests de integración sólo si están los secrets de Supabase
configurados en GitHub (**acción pendiente del usuario, no bloqueante**: ir a
Settings → Secrets → Actions del repo y cargar `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` si se quiere que
ese job corra en CI; sin eso el job se saltea solo, no rompe nada).
Prorrateo por coeficiente: sin test porque no existe función real todavía
(Fase 1/4 sin empezar).

### Ramas (todas pusheadas a `origin`, todas sincronizadas)
`fix/bloque-0-arranque`, `fix/bloque-1-seguridad`, `fix/bloque-2-negocio`,
`fix/bloque-3-limpieza` (activa ahora). Ninguna tiene PR abierto todavía — son
commits directos a cada rama, sin mergear a `master`.

### Para arrancar de nuevo
1. `master` ya tiene todo mergeado (Bloques 0-4, auditoría RLS, ítem 33 núcleo,
   CSP). El trabajo del ítem 33 (paths de lectura) vive en
   `fix/item-33-tipos-lectura`, creada sobre `master` — sin mergear todavía
   (nadie lo pidió esta sesión). `git checkout master` para seguir desde ahí, o
   `git checkout fix/item-33-tipos-lectura` si hay que retocar algo de esa rama
   antes de mergearla.
2. `.env.local` ya tiene las credenciales reales (gitignored) — proyecto
   `jbikxksdignshfgnbipi` (Postgres 17). `npx supabase db query --linked -f <migracion>`
   sigue siendo la única vía para aplicar SQL.
3. `npm run dev` / `npm run build` && `npx tsc --noEmit` && `npm run lint` — hoy
   0 errores de tsc, ~39 errores/36 warnings de lint (preexistentes, documentados
   abajo), build OK.

### Bug del usuario resuelto esta sesión (fuera del roadmap)
"Después de loguearse, la pantalla siguiente seguía mostrando el botón de
Iniciar Sesión": `ConditionalLayout` y `Header` leían la sesión con dos llamadas
independientes al cliente de Supabase (`getSession()` uno, `getUser()` el otro),
que podían resolver en momentos distintos según la latencia real. `src/hooks/useUser.tsx`
pasó a ser un Context (`UserProvider`) con una sola lectura compartida. Verificado
en dev y en el build de producción real (standalone + CSP estricto). Commit `88b9000`.

### Ítem 33 (Bloque 3) — qué se hizo y qué queda
Se tipearon los 3 clientes Supabase con `SupabaseClient<Database>` (usando
`src/types/database.types.ts`, generado con `supabase gen types typescript --linked`).
Esto rompía ~20 inserts que dependen de que el trigger `set_tenant_cols()`
(migración 002) complete `administradora_id`/`consorcio_id` desde la fila padre
— se resolvió con `src/lib/supabase/tenant-insert.ts` (seis funciones, una por
tabla derivada, que castean el `Insert` documentando por qué es seguro). Se
tipearon también los enums (`EstadoMora`, `EstadoArreglo`, `tipo_unidad`) en vez
de `string`, y se corrigió un bug real en `lib/sanitize.ts` (`optionalNumber`/
`requiredNumber` tipados sobre `ZodTypeAny` perdían el tipo de salida real,
invisible mientras los inserts no estaban tipados). Ver commit con mensaje
"feat: tipa los clientes Supabase con Database...".

**Resto del ítem (paths de lectura) — cerrado en la sesión 3.** Ver la sección
"Ítem 33 (Bloque 3) — cerrado esta sesión" al principio de este archivo para
el detalle completo, incluyendo dos bugs reales que salieron a la luz al
tipar (`propietario` como array, no objeto; conteo de unidades en 0 siempre
en el detalle de consorcio). Los tipos de join viven en `src/types/joins.ts`.

### Bloque 3 — resto de ítems
- **31**: ✅ `AuthGuard.tsx` borrado (sesión anterior). `lib/geolocation.ts`
  borrado esta sesión — código muerto real: `getCountryCode()` siempre devolvía
  `'XX'` porque su cache nunca se poblaba. `checkAndBlockIfNeeded()` en
  `blocklist.ts` también borrada (resto del geo-blocking, sin llamadores).
- **32**: ✅ hecho.
- **33**: ✅ cerrado del todo en la sesión 3 (inserts + paths de lectura).
- **34**: ✅ ya resuelto en el bloque 1.
- **35**: ✅ `test-api.js` borrado.
- **36**: ✅ `ecosystem.config.js` arranca el standalone build, sin `cwd` hardcodeado.
- **37**: ✅ `README.md` reescrito con el setup real.

### Después de la auditoría y el Bloque 4 (ambos ya cerrados)
- **`PROMPT-features.md` (Fases 1-3 del ROADMAP)**: no empezado. Es un producto
  entero (cuenta corriente, importador de liquidaciones, portal del propietario,
  reclamos, mora reescrita sobre cuenta_corriente, certificado de deuda,
  cobranzas). El multi-tenant que pide como prerequisito (§1.1) ya está hecho —
  pero igual hay que mostrar el plan de la Fase 1 (DDL de `cuenta_corriente` +
  `importaciones` + policies) y esperar aprobación antes de escribir código.
- Decidir si/cuándo mergear los 4 `fix/bloque-*` a `master` (nada mergeado
  todavía, todo en ramas separadas).

### Pendiente de acción del usuario
Nada bloqueante. Rol asignado, password reseteada, autorización de push vigente
("opción B"). Los secrets de Supabase no están configurados en GitHub Actions
todavía (ver sección del Bloque 4 más arriba) — el workflow de CI documenta
cuáles hacen falta para que el test de aislamiento multi-tenant corra en CI (hoy
sólo corre local, con `.env.local`).

---

## Conexión a Supabase

- El sandbox **sólo tiene salida HTTPS (443)** — no llega al puerto 5432 de la DB.
  `psql` / `supabase db push` no funcionan desde acá.
- **Vía que sí funciona**: `npx supabase db query --linked` (ejecuta SQL vía Management API,
  con el token de `supabase login`). Proyecto linkeado: `jbikxksdignshfgnbipi` (**Postgres 17**).
- `.env.local` tiene credenciales reales (gitignored: password de DB + service_role). No commitear.
- La DB no tiene `supabase_migrations.schema_migrations` (nunca se usó `supabase db push`; el
  schema se aplicó a mano). Las migraciones del repo son idempotentes, así que re-aplicarlas
  es seguro, pero no hay tracking automático de cuáles corrieron.

## ⚠️ ACCIÓN TUYA PENDIENTE — tu cuenta real no tiene rol

`pablo.ariel.199@gmail.com` (la fila en la vieja tabla `admins`) **no tiene fila en `usuarios`**.
Con el modelo nuevo, sin esa fila no ves nada por RLS aunque inicies sesión. El classifier de
Claude Code bloqueó que yo te asigne `super_admin` a mí mismo (correcto, es una escalada de
privilegios). Corré esto vos en el SQL Editor de Supabase para poder usar la app con tu cuenta:

```sql
insert into usuarios (auth_user_id, administradora_id, rol, activo)
select id, '00000000-0000-0000-0000-000000000001', 'super_admin', true
from auth.users where email = 'pablo.ariel.199@gmail.com'
on conflict (auth_user_id) do update set rol = 'super_admin', activo = true;
```

## Usuarios/datos de prueba que quedaron en tu Supabase

- `administradoras`: `00000000-0000-0000-0000-000000000001` ("Administradora (por definir)" —
  placeholder, renombrala) y `00000000-0000-0000-0000-000000000002` ("Administradora B (test)").
- Usuarios de prueba (podés borrarlos cuando quieras, o dejarlos para el test de aislamiento
  multi-tenant del Bloque 4): `claude-test@example.invalid` (super_admin), `admin-a@example.invalid`
  / `admin-b@example.invalid` (uno por administradora, para probar aislamiento).
  `admin-a` tiene la contraseña cambiada a `VerifyTypes2026!` (la usé para verificar en el
  browser el fix del ítem 33 contra un build de producción real, sesión 3).
- 15 consorcios de test acumulados por corridas viejas de `test-api.js` y pruebas manuales
  (nombres tipo "1", "2", "Nuevo Test", "Test SA ..."), todos asignados a la administradora
  `00000000...0001` por el backfill de la migración 002. Si querés una base limpia, borralos.

## Verificación Bloque 0 — ✅ hecha contra la DB viva (PG17)

- [x] `001_bloque0_arranque.sql` aplicada. `get_saldo_deudor` antes tiraba
  `function min(integer, integer) does not exist`; ahora corre. Deuda de 14 meses →
  `meses_atrasados = 14` (la fórmula vieja daba 2). `create-admin`/`create-propietario` → 200.

## Verificación Bloque 1 — ✅ hecha contra la DB viva + browser real

Los 13 ítems (8-20) están hechos y verificados, no sólo con tsc/build:

- **9 (@supabase/ssr)**: login escribe cookie de sesión; `/consorcios` carga logueado;
  sin sesión → 302 a `/login` (páginas) / 401 (`/api`). Probado en el browser.
- **14/15/16 (multi-tenant + RLS + rol)**: migración `002_multitenant.sql` aplicada.
  Probado con dos administradoras reales: admin de A ve sus 15 consorcios, admin de B ve 0,
  B puede crear en su propio tenant, A **no puede ver ni modificar** lo de B. `super_admin`
  cruza tenants. Un usuario `rol=propietario` no ve nada de la API de gestión (Fase 2 le
  da su propio portal). `admin/mora` y su server action verifican rol adentro.
- **17 (zod)**: `POST /api/consorcios` con campos vacíos → 400 con errores por campo;
  con datos válidos → 200. Probado en el browser (fetch real contra la ruta).
- **19 (bucket privado)**: `storage/v1/object/public/mantenimiento/...` → 400 (antes servía
  cualquier archivo a cualquiera).
- **Bug reportado por el usuario, resuelto**: `recuperar-password` no tenía la segunda
  pantalla (setear la contraseña nueva). Ahora sí, y se probó el flujo completo generando
  un link de recovery real, navegando con la sesión resultante y logueando con la
  contraseña nueva.

## ⚠️ Divergencias schema.sql ↔ DB viva encontradas (no estaban en la auditoría original)

- **`pagos.propietario_id` es `NOT NULL`** en la DB viva (en `schema.sql` es nullable).
  Ya lo manejé: las rutas de pagos ahora rechazan con 400 si la unidad no tiene propietario,
  en vez de romper con un 500 de constraint.
- Existía una tabla `admins` (no está en `schema.sql`, código muerto, RLS ya la protegía con
  0 policies) — la dejé como pediste, sin tocar.
- Existían policies (`admins_manage_security_logs`, `admins_manage_blocked_ips`) que usaban
  el hack viejo `propietarios.unidad_id IS NULL`; la migración 002 las reemplazó por
  `es_super_admin()`.

## Decisiones tomadas que conviene revisar

- **Tope de 12 meses** (bloque 0): `get_saldo_deudor.meses_atrasados` devuelve el conteo
  **real** (14 → 14); el `LEAST(12, …)` sólo se aplica a la fórmula del monto.
- **`create-admin` / `create-propietario`** quedan gateados por `ADMIN_CREATE_SECRET`
  (`create-admin` tiene que serlo, es el bootstrap). Ideal a futuro: que
  `create-propietario` también exija una sesión de admin, ahora que el modelo de rol existe.
- **`usuarios.propietario_id`**: un propietario-usuario apunta a su fila en `propietarios`.
  El scoping RLS de "el propietario ve sólo su unidad" es explícitamente Fase 2 (portal);
  hoy un usuario con `rol=propietario` no ve nada por las policies de gestión (correcto,
  pero tampoco ve lo suyo todavía — eso es Fase 2, no un bug).

## Setup / infraestructura

- **git**: sin identidad configurada originalmente. Seteada *sólo en este repo*:
  `user.email=pmunoz@ewwoconsulting.com`, `user.name=pmunoz`.
- **`.env.local`**: credenciales reales del proyecto `jbikxksdignshfgnbipi` (gitignored).
- **`npm run lint`**: arrancó con 51 errores preexistentes; después de los bloques 0 y 1
  bajó a 45 (sin agregar ninguno nuevo). El verde total es tarea del Bloque 3.
- Archivos sin trackear que no tocó Claude: `PROMPT-claude-code.md`, `SETUP.md`, `setup.sh`.
- ~~Next 16 deprecó `middleware` a favor de `proxy`~~ → resuelto (`src/middleware.ts` → `src/proxy.ts`).

---

# BLOQUE 2 — ✅ completo (22-30; el 21 anulado por instrucción del usuario)

> El punto 21 (modelo de expensas simple) queda **anulado**: lo reemplaza la cuenta
> corriente de `ROADMAP.md` / `PROMPT-features.md` Fase 1 (trabajo aparte, no acá).

- **22**: `es_dueño_principal`/`porcentaje_propiedad` NOT NULL con default; decisión
  registrada en comentario de columna (gana la constraint de un solo propietario;
  copropiedad real es Fase 4).
- **23**: triggers `updated_at` en las tablas que faltaban.
- **24**: índice único `(administradora_id, nombre)` en `consorcios`.
- **25**: rate limit por minuto movido de un `Map()` en memoria a la tabla
  `rate_limits` (función atómica `rate_limit_hit`); `isIPBlocked`/`getTodayAttempts`
  cacheados 5s en memoria para no pegarle a la DB en cada request.
- **26**: `getClientIP` prioriza `x-real-ip` (lo pone nginx) sobre `x-forwarded-for`
  (spoofeable). `src/lib/trusted-ip.ts`.
- **27**: geo-blocking **eliminado** (era un no-op que además baneaba IPs para
  siempre si alguna vez se "arreglaba"). Real geo-blocking necesita un servicio
  externo (Cloudflare); no está en alcance.
- **28**: ya resuelto en el Bloque 1 (reset-password sin `listUsers()` paginado).
- **29**: CSP con nonce por request; sin `unsafe-inline`/`unsafe-eval` en prod;
  `localhost` sacado de `connect-src` en prod. Esto forzó a convertir 8 páginas
  `'use client'` que eran estáticas en server-wrapper (`force-dynamic`) +
  `XxxClient.tsx`, porque un nonce en una página prerenderizada en build no
  coincide con el nonce del request real → el browser bloqueaba los scripts.
  Verificado en `next build && next start` real: cero violaciones de CSP en
  consola, login funcional, `/admin/mora` renderiza bien.
- **30**: CSRF — mutaciones a `/api` exigen `Origin`/`Referer` propio. Verificado:
  mismo origen → 200; origen cruzado → 403.

## Decisión pendiente de tu revisión (bloque 2)

- **`style-src` sigue con `'unsafe-inline'`** (a diferencia de `script-src`, que ya
  no lo tiene). Tailwind compila a un `.css` externo, pero React genera `style={{}}`
  inline en varios componentes (ej. la barra de progreso de `admin/mora`) y esos no
  se pueden nonce-ar automáticamente. Si querés CSP estricta también en estilos, hay
  que migrar esos `style={{}}` a clases y sacar el `'unsafe-inline'` de `style-src`.

---

# BLOQUE 3 — estado

Pendiente: 31 (código muerto: `AuthGuard.tsx`, `lib/geolocation.ts` async, imports sin usar
en `proxy.ts`), 32 (unificar `search()` duplicada), 33 (sacar los 24 `any`/`as any`/`@ts-ignore`),
34 (`recuperar-password` — el import al final **ya se resolvió** al reescribir la página en
el Bloque 1), 35 (`test-api.js`), 36 (`ecosystem.config.js` hardcodea el `cwd` y no usa
`output: standalone`), 37 (`README.md`).

---

# BLOQUE 4 — estado

Pendiente: Vitest + el test de aislamiento multi-tenant (ya validado a mano en el Bloque 1
con `admin-a`/`admin-b`; falta escribirlo como test automatizado), test del cálculo de meses,
máquina de estados de mora, validación de `redirect`, GitHub Actions.
