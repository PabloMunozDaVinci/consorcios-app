# PENDIENTES — revisión al final

> Lista viva. Cada bloque agrega lo suyo. No borrar ítems: tacharlos (`~~...~~`) cuando se cierren.

## Conexión a Supabase (resuelto)

- El sandbox **sólo tiene salida HTTPS (443)** — no llega al puerto 5432 de la DB.
  `psql` / `supabase db push` no funcionan desde acá.
- **Vía que sí funciona**: `npx supabase db query --linked` (ejecuta SQL vía Management API,
  con el token de `supabase login`). El proyecto está linkeado (`jbikxksdignshfgnbipi`, **Postgres 17**).
- `.env.local` tiene credenciales reales (gitignored). Contiene la password de DB y el
  service_role → no commitear nunca.
- La CLI de Supabase no está en la allowlist de permisos → cada `npx supabase ...` pide
  confirmación (o lo frena el classifier para subcomandos tipo `api-keys`).

## Verificación Bloque 0 — ✅ HECHA contra la DB viva (PG17)

- [x] `001_bloque0_arranque.sql` aplicada (vía `supabase db query --linked -f`).
- [x] `unidad_id` nullable = YES; constraint vieja eliminada; índice parcial `ux_propietario_por_unidad` creado.
- [x] `get_saldo_deudor` y `evaluar_y_actualizar_mora` con `search_path=public, pg_temp`.
- [x] **Antes**: `get_saldo_deudor(...)` → `ERROR: function min(integer, integer) does not exist` (confirmado).
- [x] **Después**: sin error. Deuda de 14 meses → `meses_atrasados = 14` (fórmula vieja daba 2, verificado); `monto_total = 2.160.000` (tope de 12 en el monto).
- [x] `POST /api/auth/create-admin` con secreto correcto → **200**; con `admin-secret-123` → **401**.
- [x] `POST /api/auth/create-propietario` con unidad válida → **200**.
- [x] `tempPassword` generado por `crypto.randomBytes` (16 chars + `!`).
- Datos de prueba creados y **borrados** (0 propietarios, 0 pagos al final).
- [ ] Falta ver `admin/mora` con datos reales en el browser (no hay mora_logs todavía).

## ⚠️ Divergencia schema.sql ↔ DB viva encontrada (nueva, no estaba en la auditoría)

- **`pagos.propietario_id` es `NOT NULL` en la DB viva** (en `schema.sql` es nullable
  con `ON DELETE SET NULL`). `src/app/api/pagos/route.ts` dice "permitir el pago aunque
  no haya propietario" e inserta `propietario_id: undefined` → ese INSERT **rompe** con
  NOT NULL si la unidad no tiene propietario. Revisar en Bloque 2 (correctitud) o antes.
- La DB no tiene tabla `supabase_migrations.schema_migrations` (nunca se usó `supabase db push`;
  el schema se aplicó a mano). Las migraciones del repo son idempotentes, así que
  re-aplicarlas es seguro, pero no hay tracking. Evaluar si vale la pena inicializarlo.

## Decisiones tomadas que conviene revisar

### Bloque 0
- **Tope de 12 meses**: `get_saldo_deudor.meses_atrasados` devuelve el conteo **real** (14 → 14). El `LEAST(12, …)` quedó aplicado **solo a la fórmula del monto**. Si se quería el tope duro en 12 en todo, revertir esa parte de la migración 001.
- Se agregó `export const dynamic = 'force-dynamic'` a `src/app/admin/mora/page.tsx` para que las stats no queden congeladas en el build.
- Se corrigió de paso el typo `accumulate` → `acumula` en el template de email de `mora.ts`.

## Setup / infraestructura

- **git**: no había identidad configurada. Se seteó *solo en este repo*: `user.email=pmunoz@ewwoconsulting.com`, `user.name=pmunoz`. Cambiar si corresponde.
- **`.env.local`**: ahora tiene credenciales **reales** del proyecto `jbikxksdignshfgnbipi` (gitignored). Incluye password de DB y service_role → nunca commitear.
- **`npm run lint`**: arrancó con 51 errores preexistentes (archivos de bloques 3). El Bloque 0 no introdujo errores nuevos. El verde total llega recién en el Bloque 3.
- Archivos sin trackear que no tocó Claude: `PROMPT-claude-code.md`, `SETUP.md`, `setup.sh`.

## Avisos del build

- ~~Next 16 deprecó el archivo `middleware` a favor de `proxy`.~~ Resuelto: `src/middleware.ts` → `src/proxy.ts`.

---

# BLOQUE 1 — estado

## Hecho (verificable con tsc/build/lint)

- **8** — secreto hardcodeado: `src/lib/admin-secret.ts`, sin fallback, `timingSafeEqual`.
- **10** — `proxy.ts` propaga identidad con `NextResponse.next({ request: { headers } })`.
- **11** — `DISABLE_AUTH` ignorado en producción.
- **12** — matcher explícito por prefijo; sin `.ico` en `isPublicRoute`.
- **13** — `safeRedirectPath` valida el `?redirect=` del login.
- **18** — sin `console.log` en `src/`; sin `logger.debug('... request', body)`.
- **20** — `generateTempPassword` con `crypto.randomBytes`, unificada.
- Rename `middleware.ts` → `proxy.ts` (función `proxy`).

## Pendiente — necesita la DB viva y/o prueba de runtime (NO hacer a ciegas)

Estos 5 ítems son una sola pieza de arquitectura de auth. Hacerlos sin poder
correr la app contra Supabase puede dejar el login roto o la app vacía sin que
se note. **Recomendado: checkpoint con acceso a un proyecto Supabase antes de seguir.**

- **9 — Migrar a `@supabase/ssr`.** Ya está instalado (`^0.12.7`). Falta:
  - `src/lib/supabase/client.ts` → `createBrowserClient(url, anonKey)`.
  - `src/lib/supabase/server.ts` → `createServerClient` con `cookies()` de `next/headers` (getAll/setAll).
  - `src/lib/supabase/admin.ts` → mover ahí el cliente `service_role` (hoy en `src/lib/supabase.ts`).
  - `updateSession()` para `proxy.ts` (refresh de sesión + cookies en request y response).
  - Reemplazar `verifyJWT` (busca cookie `sb-access-token` que nadie escribe) por `supabase.auth.getUser()` server-side.
  - Adaptar `login/page.tsx`, `logout`, `useUser`, `ConditionalLayout`, `AuthGuard` al cliente browser SSR.
  - Borrar `src/lib/supabase.ts` (el `export const supabase = createSupabaseClient()` a nivel módulo rompe SSR).
  - **Criterio:** login sin `DISABLE_AUTH`; la cookie de sesión se escribe y el `proxy` la lee.
- **14 — Cliente por request con el JWT del usuario + RLS.** Cada route handler y
  cada archivo de `src/actions/` deja de usar `createSupabaseAdmin()` para leer datos
  de usuario; usa un cliente creado con la sesión del request. `service_role` queda
  sólo para: crear usuarios de auth, escribir `security_logs`/`blocked_ips`, rate-limit.
- **15 — Modelo de rol explícito + policies RLS.**
  - Migración nueva: tabla `usuarios` (o columna `rol` en `propietarios`) — hoy "admin"
    se infiere de `unidad_id IS NULL` en 3 lugares con 2 definiciones distintas
    (`lib/auth.ts`, `AuthGuard.tsx`, `hooks/useUser.ts`).
  - Policies para `consorcios`, `edificios`, `mora_logs`, `security_logs`, `blocked_ips`
    (RLS habilitada, 0 policies) y para INSERT/UPDATE/DELETE (hoy sólo SELECT).
  - **Sin verificación empírica posible acá** → probar contra PG16/Supabase.
- **16 — Server Action de `admin/mora/page.tsx` sin control de acceso.** El action inline
  que corre `evaluarYEnviarMora()` debe verificar rol admin **adentro** del action
  (necesita el modelo de rol del ítem 15).
- **17 — Aplicar los schemas zod de `src/lib/sanitize.ts` en las 10 API routes.**
  `validateInput()` + 400 con errores de campo, sin filtrar `error.message` de Supabase.
  Riesgo: los schemas actuales esperan tipos que el cliente hoy manda como string
  (`presupuesto`, `pisos`, `coeficiente`) → hay que revisar cada form. Necesita
  probar cada formulario.
- **19 — Bucket `mantenimiento` privado + signed URLs.**
  - SQL/dashboard: `UPDATE storage.buckets SET public = false WHERE id = 'mantenimiento';`
  - `src/components/UploadImage.tsx`: `createSignedUrl()` en vez de `getPublicUrl()`.
  - Necesita probar subida/lectura de imágenes.

## Decisión de diseño a confirmar (bloque 1)

- `create-admin` y `create-propietario` quedaron como endpoints **públicos en el proxy**,
  gateados sólo por `ADMIN_CREATE_SECRET`. `create-admin` tiene que serlo (bootstrap).
  Para `create-propietario` lo ideal es que además valide sesión de admin una vez
  que el ítem 15 esté hecho.
