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

- Next 16 deprecó el archivo `middleware` a favor de `proxy` (`node_modules/next/dist/docs/`). Se resuelve en el Bloque 1.
