# PENDIENTES — revisión al final

> Lista viva. Cada bloque agrega lo suyo. No borrar ítems: tacharlos (`~~...~~`) cuando se cierren.

## Verificación que no se pudo hacer en el entorno de trabajo

El entorno de Claude Code no tiene PostgreSQL ni Docker, así que **ninguna migración SQL fue probada**. Hay que aplicarlas contra la DB viva (Supabase / PG16) y confirmar:

### Bloque 0
- [ ] Aplicar `supabase/migrations/001_bloque0_arranque.sql` contra la DB.
- [ ] `POST /api/auth/create-admin` con el secreto correcto → **200**.
- [ ] `POST /api/auth/create-propietario` con unidad válida → **200**.
- [ ] `SELECT * FROM get_saldo_deudor('<uuid>')` → una fila, sin error, con `meses_atrasados = 14` para una deuda de 14 meses.
- [ ] `admin/mora` muestra los conteos reales (no ceros).

## Decisiones tomadas que conviene revisar

### Bloque 0
- **Tope de 12 meses**: `get_saldo_deudor.meses_atrasados` devuelve el conteo **real** (14 → 14). El `LEAST(12, …)` quedó aplicado **solo a la fórmula del monto**. Si se quería el tope duro en 12 en todo, revertir esa parte de la migración 001.
- Se agregó `export const dynamic = 'force-dynamic'` a `src/app/admin/mora/page.tsx` para que las stats no queden congeladas en el build.
- Se corrigió de paso el typo `accumulate` → `acumula` en el template de email de `mora.ts`.

## Setup / infraestructura

- **git**: no había identidad configurada. Se seteó *solo en este repo*: `user.email=pmunoz@ewwoconsulting.com`, `user.name=pmunoz`. Cambiar si corresponde.
- **`.env.local`**: creado con valores **placeholder** (está en `.gitignore`) para poder correr `build`/`tsc`/`lint`. Reemplazar por credenciales reales antes de usar la app.
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
