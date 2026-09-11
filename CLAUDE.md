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

### Criterio para elegir modelo (subagentes nuevos o existentes)

- **haiku** — tarea mecánica, sin ambigüedad, con un criterio de "correcto/incorrecto"
  verificable (lint, borrar código muerto confirmado, renombrar, mover un archivo).
  `limpiador` usa haiku.
- **sonnet** — tarea con pasos claros pero que requiere entender el dominio del
  proyecto (escribir una migración siguiendo el patrón multi-tenant existente,
  escribir tests de lógica de negocio). `migrador` y `tester` usan sonnet.
- **opus** — tarea de juicio donde un falso negativo es costoso y no hay forma
  mecánica de verificar el resultado (auditar fugas de datos entre administradoras
  en RLS/policies antes de un merge). `auditor-rls` usa opus.

Regla general: el modelo lo determina el riesgo de una respuesta mala, no el
tamaño de la tarea. Si dudás entre dos niveles, elegí el de arriba (más
capacidad) para una auditoría/decisión de diseño, y el de abajo (más barato)
para algo mecánico y fácil de verificar después con tsc/lint/build.
