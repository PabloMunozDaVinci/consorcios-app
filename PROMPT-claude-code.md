# One-shot prompt para Claude Code

Copiá todo lo que está debajo de la línea y pegalo en Claude Code, parado en la raíz de `consorcios-app`.

---

Sos un ingeniero senior full-stack trabajando sobre `consorcios-app`: una app Next.js 16 (App Router) + Supabase para administración de consorcios de propiedad horizontal en Argentina.

Leé `CONTEXT.md` y `AGENTS.md` antes de tocar una línea de código. `AGENTS.md` avisa que Next.js 16 tiene breaking changes respecto de versiones anteriores: consultá `node_modules/next/dist/docs/` antes de usar cualquier API de Next, no asumas patrones de Next 14/15.

Hay una auditoría hecha (`CONTEXT.md`) que verificó empíricamente contra PostgreSQL 16 que la app **hoy no se puede usar**: no se puede crear ningún usuario y el motor de mora tira excepción. Tu tarea es dejarla funcional y segura, en este orden estricto.

## Reglas de trabajo

- Trabajá en ramas: una por bloque (`fix/bloque-0-arranque`, `fix/bloque-1-seguridad`, `fix/bloque-2-negocio`). Un commit por ítem, mensaje en español, formato convencional (`fix:`, `feat:`, `refactor:`).
- **No avances al siguiente bloque sin que el anterior compile.** Después de cada bloque: `npx tsc --noEmit && npm run lint && npm run build`. Si alguno falla, arreglá antes de seguir.
- Todo cambio de schema va en un archivo nuevo `supabase/migrations/NNN_descripcion.sql`, idempotente (`IF EXISTS` / `IF NOT EXISTS`). **No edites `supabase/schema.sql` en su lugar**: el schema de la DB viva ya divergió del archivo.
- No agregues dependencias salvo `@supabase/ssr` (bloque 1) y el runner de tests (bloque 4). Nada más sin preguntarme.
- Si encontrás que un hallazgo de `CONTEXT.md` ya está resuelto o mal diagnosticado, decímelo y seguí; no inventes trabajo.
- Al terminar cada bloque, actualizá `CONTEXT.md` tachando (`~~texto~~`) los hallazgos resueltos, sin borrarlos.

---

## BLOQUE 0 — Que la app arranque

Sin esto no se puede crear ni un solo usuario. Verificado contra PG16.

1. **`get_saldo_deudor()` tira `function min(integer, integer) does not exist`.** En Postgres `MIN()` es agregación, no acepta dos escalares → usar `LEAST`. Aprovechá y arreglá el cálculo de meses: `EXTRACT(MONTH FROM AGE(...))` devuelve solo el componente de meses, así que una deuda de 14 meses se calcula como 2. Usá `EXTRACT(YEAR FROM edad)*12 + EXTRACT(MONTH FROM edad)`. Agregá `SET search_path = public, pg_temp` a las dos funciones `SECURITY DEFINER`.
2. **No se puede crear un admin:** `create-admin` inserta en `propietarios` sin `unidad_id` (esa ausencia *es* la marca de admin) pero la columna es `NOT NULL`. Migración: hacerla nullable y reemplazar la constraint `unique_propietario_por_unidad` por un índice único parcial `WHERE unidad_id IS NOT NULL`.
3. **No se puede crear un propietario:** `src/app/api/auth/create-propietario/route.ts:161` hace `.select('id, numero, pisos')`; la columna es `piso`.
4. **`src/actions/mora.ts:690`** pide `edificio_id`; la columna es `building_id`.
5. **`getMoraStats()` en `src/actions/consorcios.ts:584`** consulta `unidades.estado_mora`, columna que no existe. Derivá el estado del último `mora_logs` de cada unidad. `src/app/admin/mora/page.tsx` hoy muestra ceros hardcodeados ("Stats simuladas") — conectalo a la función real.
6. **Typo `aptoo_carta`** (doble o) en `ESTADOS_MORA` y `getEmailTemplate()` de `src/actions/mora.ts`; el enum de la DB dice `apto_carta`. Efecto actual: el template de carta documento nunca se selecciona y un deudor de 5 meses recibe el mail suave.
7. **`emailsEnviados++` está fuera del bloque comentado de Resend** en `evaluarYEnviarMora()` → reporta emails que nunca manda. Corregí el contador.

**Criterio de aceptación del bloque:** con la DB migrada, `POST /api/auth/create-admin` devuelve 200, `POST /api/auth/create-propietario` devuelve 200, y `SELECT * FROM get_saldo_deudor('<uuid>')` devuelve una fila sin error con el conteo de meses correcto para una deuda de 14 meses.

---

## BLOQUE 1 — Seguridad crítica

Nada de datos reales antes de esto.

8. **Secreto hardcodeado.** `src/app/api/auth/create-admin/route.ts:16` y `create-propietario/route.ts:135` tienen `process.env.ADMIN_CREATE_SECRET || 'admin-secret-123'`. El repo estuvo público. Eliminá el fallback y hacé que el módulo tire error si la variable falta. Comparación con `crypto.timingSafeEqual`, no con `!==`.
9. **Arreglá el flujo de auth de raíz.** Hoy `signInWithPassword` guarda la sesión en localStorage y el middleware busca una cookie `sb-access-token` que nunca se escribe → o loopea el redirect, o corre con `DISABLE_AUTH=true` y no hay auth en absoluto. Migrá a `@supabase/ssr`: cliente de browser, cliente de servidor y cliente de middleware con manejo de cookies. Reemplazá el `verifyJWT` casero de `src/lib/auth.ts`.
10. **El middleware no propaga la identidad.** `middleware.ts:246-248` hace `request.headers.set('x-user-id', ...)`, que en Next.js no llega a ninguna ruta downstream. Hay que devolver `NextResponse.next({ request: { headers: nuevosHeaders } })`. Es la razón por la que todas las rutas terminan usando `service_role` a ciegas.
11. **`DISABLE_AUTH=true` apaga auth, rate limit, geo-block, blocklist y los security headers, todo junto, en la primera línea del middleware.** Que solo funcione si `process.env.NODE_ENV !== 'production'`. En producción, ignorarlo y loguear un warning.
12. **El `matcher` deja pasar todo lo que tenga un punto:** `'/((?!_next/static|_next/image|favicon.ico|.*\\..*$).*)'`. Reemplazalo por un matcher explícito por prefijo que cubra `/api/:path*` y las rutas de páginas protegidas. Sacá también el `pathname.includes('.ico')` de `isPublicRoute()`.
13. **Open redirect en el login.** `redirectToLogin()` mete la URL absoluta en `?redirect=` y `login/page.tsx:1600` hace `window.location.href = redirect` sin validar. `/login?redirect=https://sitio-falso.com` es phishing servido. Aceptá solo paths internos: debe empezar con `/` y no con `//`; cualquier otra cosa cae a `/`.
14. **Dejá de usar `service_role` para leer datos de usuario.** Los 10 route handlers y los 3 archivos de `src/actions/` usan `createSupabaseAdmin()` sin filtrar por usuario: cualquier autenticado ve todos los consorcios, unidades, propietarios y pagos del sistema. Creá un cliente por request con el JWT del usuario y hacé que RLS haga el trabajo. Reservá `service_role` solo para operaciones administrativas reales (crear usuarios de auth, escribir `security_logs`).
15. **Escribí las policies RLS que faltan.** `consorcios`, `edificios`, `mora_logs`, `security_logs` y `blocked_ips` tienen RLS habilitada y **cero policies**. Las policies existentes solo cubren SELECT. Necesitás un modelo de rol explícito: agregá una tabla `usuarios` (o una columna `rol` en `propietarios`) en vez de inferir admin de `unidad_id IS NULL`, que hoy se calcula distinto en tres archivos (`lib/auth.ts`, `AuthGuard.tsx`, `hooks/useUser.ts` — este último marca admin a cualquiera cuya fila no sea visible).
16. **Server Action sin control de acceso.** `src/app/admin/mora/page.tsx` expone un action inline que corre `evaluarYEnviarMora()` sin chequear rol. Cuando se activen los emails, ese action manda intimaciones legales a los propietarios. Verificá admin **dentro** del action.
17. **Aplicá los schemas zod que ya existen y nadie usa.** `src/lib/sanitize.ts` son 295 líneas de código muerto: se importa en `middleware.ts` y ninguna de sus funciones se llama. Usá `validateInput()` con los schemas de ese archivo en las 10 API routes. Devolvé 400 con errores de campo, sin filtrar el `error.message` crudo de Supabase (hoy todas las rutas filtran nombres de tablas y constraints al cliente).
18. **Sacá los `console.log` que imprimen credenciales.** `login/page.tsx` loguea el objeto session completo con el access token en la consola del browser, y el largo de la contraseña. Son 21 `console.log` en `src/`; sacá todos o pasalos por `logger.debug`. Quitá también los `logger.debug('...', body)` que loguean DNI, email y teléfono completos.
19. **Bucket de Storage público.** `schema.sql:295` crea `mantenimiento` con `public = true`; las fotos de arreglos quedan legibles por URL para cualquiera. Pasalo a privado y usá signed URLs en `UploadImage.tsx`.
20. **`generateTempPassword()` usa `Math.random()`.** Cambialo por `crypto.randomBytes`, y unificá la función duplicada en las dos rutas.

**Criterio de aceptación del bloque:** login funciona sin `DISABLE_AUTH`; un propietario autenticado que pide `/api/consorcios` o `/api/unidades` recibe solo lo suyo; `curl` a `/api/auth/create-admin` con el secreto viejo devuelve 401.

---

## BLOQUE 2 — Correctitud del negocio

21. **El monto de expensa está hardcodeado en `schema.sql:182`: `v_meses_atrasados * 150000 * 1.20`.** Toda unidad debe lo mismo, sin importar coeficiente ni edificio ni período. `unidades.coeficiente` existe y nunca se usa en ningún cálculo. Diseñá y proponeme (antes de implementar) un modelo mínimo de `expensas`: período, consorcio, total a prorratear, y `expensas_detalle` por unidad calculado con el coeficiente. `get_saldo_deudor` debe leer de ahí.
22. **Copropiedad contradictoria.** El schema tiene `es_dueño_principal` y `porcentaje_propiedad` pero la constraint permite **un solo propietario por unidad**. Definí cuál de las dos gana y hacé consistente el modelo.
23. **Triggers `updated_at`.** Ocho tablas tienen la columna y cero triggers; queda congelada en la fecha de creación.
24. **El seed duplica.** `ON CONFLICT DO NOTHING` sin constraint única no hace nada: dos corridas → dos "Consorcio Torre Centro". Agregá el índice único.
25. **Rate limiting en memoria** (`Map` en `middleware.ts`) se pierde en cada deploy y no se comparte entre instancias PM2. Movelo a una tabla de Supabase con TTL, o a Redis. Además hoy hace 2 queries a la DB por request en el hot path (`isIPBlocked` + `getTodayAttempts`) — cachéalas.
26. **IP spoofeable.** `getClientIP()` confía en el header `x-forwarded-for` crudo: rotar el header saltea rate limit y blocklist. Tomá la IP del proxy de confianza y documentá en `SETUP.md` que nginx debe **sobrescribir** el header (`proxy_set_header X-Forwarded-For $remote_addr`), no agregarlo.
27. **El geo-blocking no bloquea nada:** `geolocation-mw.ts` devuelve `isArgentina: true` para toda IP desconocida. O implementalo de verdad (Cloudflare, o el header `x-vercel-ip-country` según dónde deployen), o borralo entero. **No lo dejes a medias**: el path de geo-block llama a `blockIP(..., null)` que es bloqueo *permanente* en DB, sin proceso de desbloqueo — un falso positivo banea a un propietario para siempre.
28. **`reset-password` hace `listUsers()` y filtra en memoria.** Está paginado (50 por default), así que con más de 50 usuarios el reset deja de funcionar para los que no entran en la primera página. Llamá `resetPasswordForEmail()` directo, que ya es no-enumerable.
29. **CSP débil:** `script-src` con `'unsafe-inline' 'unsafe-eval'` y `connect-src` con `http://localhost:*` en producción. Usá nonces de Next y sacá localhost del build de prod.
30. **Sin protección CSRF.** Con auth por cookie (bloque 1) se vuelve explotable: verificá `Origin`/`Referer` en las mutaciones.

---

## BLOQUE 3 — Limpieza

31. Borrá el código muerto: `AuthGuard.tsx` (cero referencias en `src/app/`) o usalo de verdad; `lib/geolocation.ts` async; los imports sin usar de `middleware.ts` (`containsSQLInjection`, `containsXSS`, `verifyAdmin`, `requiresAuth`, `logLoginFailed`, `logSecurityEvent`).
32. Unificá `search()`, implementada dos veces con lógicas distintas en `actions/consorcios.ts` y `actions/search.ts`.
33. Eliminá los 24 `: any` / `as any` / `@ts-ignore`. Generá los tipos con `supabase gen types typescript` y tipá `ActionResponse<T>` de verdad.
34. `src/app/(auth)/recuperar-password/page.tsx` tiene un `import` en la última línea del archivo y un `router` que no se usa.
35. `test-api.js` requiere `dotenv`, que no está en `package.json`, y hace INSERT+DELETE reales con `service_role`. Borralo o convertilo en un test.
36. `ecosystem.config.js` tiene `cwd: '/home/pablo/consorcios-app'` hardcodeado, y arranca `next start` desperdiciando el `output: 'standalone'` de `next.config.ts`.
37. Reescribí el `README.md`, que hoy es el de `create-next-app` sin tocar.

---

## BLOQUE 4 — Tests

38. Agregá Vitest. Cubrí como mínimo: el cálculo de meses de deuda (incluido el caso de 14 meses que hoy da 2), la máquina de estados de mora, la validación del parámetro `redirect` del login, y que un propietario no pueda leer datos de otra unidad. Agregá un workflow de GitHub Actions que corra `lint`, `tsc --noEmit`, `build` y `test` en cada PR.

---

## Antes de empezar

Hacé un plan con los archivos que vas a tocar en el Bloque 0 y mostrámelo. Después implementá bloque por bloque, deteniéndote al final de cada uno para que revise. En el punto 21 (modelo de expensas) parate y esperá mi aprobación del diseño antes de escribir código.
