# PENDIENTES — revisión al final

> Lista viva. Cada bloque agrega lo suyo. No borrar ítems: tacharlos (`~~...~~`) cuando se cierren.

---

## 📍 PARA RETOMAR LA PRÓXIMA SESIÓN (corte del 2026-09-10/11)

**Estado**: Bloques 0, 1 y 2 completos y verificados contra Supabase real. Bloque 3
recién arrancado. Bloque 4 y `PROMPT-features.md` (Fases 1-3 del ROADMAP) sin
empezar — es la parte más grande de todo lo pedido, dimensionalo así.

### Ramas (todas pusheadas a `origin`, todas sincronizadas)
`fix/bloque-0-arranque`, `fix/bloque-1-seguridad`, `fix/bloque-2-negocio`,
`fix/bloque-3-limpieza` (activa ahora, HEAD = `ac58074`). Ninguna tiene PR
abierto todavía — son commits directos a cada rama, sin mergear a `master`.

### Para arrancar de nuevo
1. `git checkout fix/bloque-3-limpieza` (o crear la siguiente si ya se decidió mergear).
2. `.env.local` ya tiene las credenciales reales (gitignored) — no hace falta
   rehacer la conexión a Supabase. Sigue siendo el proyecto `jbikxksdignshfgnbipi`
   (Postgres 17), y `npx supabase db query --linked -f <migracion>` sigue siendo
   la única vía para aplicar SQL (el sandbox no tiene salida a Postgres directo).
3. `npm run dev` / `npm run build` && `npx tsc --noEmit` && `npm run lint` para
   confirmar que se sigue en verde antes de tocar nada (81 problems / 42 errors
   de lint preexistentes, 0 de tsc, build OK — todo documentado abajo).

### Lo último que quedó a mitad de camino (ítem 33, Bloque 3)
Generé `src/types/database.types.ts` con `supabase gen types typescript --linked`
(commit `ac58074`). Intenté tipar los 3 clientes (`src/lib/supabase/{client,server,admin}.ts`)
con `SupabaseClient<Database>` para eliminar los `any` de raíz, pero **lo reverti**
porque abrió ~20 errores de tsc reales (no ruido): la mayoría son inserts que no
mandan `administradora_id`/`consorcio_id` porque **el trigger `set_tenant_cols` los
completa en la DB**, y el tipo generado los marca `required` porque no sabe eso.
Ejemplos concretos que van a reaparecer apenas alguien vuelva a intentarlo:
- `actions/consorcios.ts`: `createEdificio`, `createUnidad`, `createPago`,
  `createArreglo`, `updateArregloEstado` (el `Record<string, unknown>` de
  `updateData` no tipa contra `RejectExcessProperties`).
- `api/edificios`, `api/unidades`, `api/pagos`, `api/arreglos`,
  `api/auth/create-propietario`: mismo patrón.
- `actions/mora.ts:130`: `nuevoEstado` es `string`, no el enum `EstadoMora`.
- Varios `select('estado_mora')`-like con literal `string` contra un enum literal.

**Cómo resolverlo bien** (no lo hice por tiempo, no por dificultad): en vez de pelear
tipo por tipo, definir tipos `Insert` derivados que **omitan** las columnas que
llenan los triggers (`Omit<Database['public']['Tables']['edificios']['Insert'],
'administradora_id' | 'consorcio_id'>`) y usar esos en las funciones que insertan
confiando en el trigger. Para los enums (`estado`, `tipo`, `prioridad`, `rol_usuario`,
`EstadoMora`), tipar las variables locales con el tipo del enum en vez de `string`
en el momento en que se calculan, no en el insert.

**El archivo `database.types.ts` queda commiteado y listo para usar** — sólo falta
terminar de enchufarlo. `git stash`/`git log -p ac58074^..ac58074 -- src/lib/supabase`
si hace falta ver exactamente qué se probó y revirtió.

### Bloque 3 — lo que falta después de eso
- **31**: `AuthGuard.tsx` ✅ borrado. Falta revisar `lib/geolocation.ts` (versión
  async, sólo la usa `security/logger.ts` para el country code de logging — ya
  no bloquea nada desde que se sacó el geo-blocking en el bloque 2, podría
  simplificarse o borrarse si el country code en los logs no se considera valioso).
- **32**: ✅ hecho (se sacó la copia muerta de `search()` en `consorcios.ts`).
- **33**: en progreso, ver arriba. ~20-25 `any` reales quedan.
- **34**: ✅ ya resuelto en el bloque 1 (se reescribió `recuperar-password` entera).
- **35**: `test-api.js` — no tocado. Decidir: borrarlo o convertirlo a un test real
  (Vitest, bloque 4) que no pegue con `service_role` contra datos reales.
- **36**: `ecosystem.config.js` — no tocado. `cwd` hardcodeado a
  `/home/pablo/consorcios-app` (coincide con la ruta real, pero no debería estar
  fijo en el archivo) y arranca `next start` en vez de aprovechar
  `output: 'standalone'` (`node .next/standalone/server.js`) — el build ya tira
  ese warning ahora que se ve en producción.
- **37**: `README.md` — sigue siendo el de `create-next-app` sin tocar.

### Después del Bloque 3
- **Bloque 4**: Vitest + el test de aislamiento multi-tenant (ya probado a mano
  con `admin-a`/`admin-b`, ver más abajo — falta automatizarlo), cálculo de
  meses de mora, máquina de estados, `safeRedirectPath`, GitHub Actions.
- **`PROMPT-features.md` (Fases 1-3 del ROADMAP)**: no empezado. Es un producto
  entero (cuenta corriente, importador de liquidaciones, portal del propietario,
  reclamos, mora reescrita sobre cuenta_corriente, certificado de deuda,
  cobranzas). El multi-tenant que pide como prerequisito (§1.1) **ya está hecho**
  (bloque 1, ítem 15) — pero igual hay que mostrar el plan de la Fase 1 (DDL de
  `cuenta_corriente` + `importaciones` + policies) y esperar aprobación antes de
  escribir código, como pide el propio `PROMPT-features.md`.

### Pendiente de acción del usuario
Nada bloqueante por ahora — ya asignó su rol (`super_admin`) y ya le reseteé la
password (`Testing1234`) a `pablo.ariel.199@gmail.com`. Push a git: el usuario
autorizó explícitamente ("opción B") que yo pushee sin pedir permiso en cada
commit; seguir haciéndolo.

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
  `admin-a` tiene la contraseña cambiada a `NuevaPassA2026!` (la usé para probar recuperar-password).
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
