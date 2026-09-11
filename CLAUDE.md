@AGENTS.md

## Subagentes del proyecto

Definidos en `.claude/agents/`. Invocalos por su nombre cuando la tarea encaje:

- **migrador** — escribir una migración SQL nueva en `supabase/migrations/`
  (tablas, columnas, funciones, triggers, policies RLS). No la aplica contra la DB.
- **auditor-rls** — antes de mergear algo que toque `src/actions/`, `src/app/api/`
  o `supabase/migrations/`, o ante cualquier sospecha de fuga de datos entre
  administradoras. Solo lee y reporta, no edita.
- **limpiador** — tareas mecánicas sin criterio de diseño: código muerto
  confirmado, `console.log` sueltos, imports, lint/tsc. No lo uses para nada que
  toque schema, RLS, roles o lógica de negocio.
- **tester** — tests de lógica de cálculo (prorrateo, mora, aislamiento entre
  administradoras) y de validaciones de seguridad (`safeRedirectPath`, etc.).

Ver el frontmatter de cada archivo en `.claude/agents/` para su alcance exacto
de herramientas y modelo.
