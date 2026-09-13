-- =============================================================================
-- MIGRACIÓN 008 — Fixes de la auditoría RLS sobre la Fase 1 (cuenta_corriente/importaciones)
-- =============================================================================
-- Idempotente. Cinco hallazgos del subagente auditor-rls sobre
-- 007_fase1_cuenta_corriente.sql (2026-09-13), + un fix de robustez en la
-- función de aging. `importaciones` no tenía columna `edificio_id` en la 007
-- (nació con `consorcio_id` puesto por la app, "de la mejor forma que se
-- podía sin FK a una unidad") — la mejora real que se aplica acá es agregar
-- ese FK y dejar que administradora_id/consorcio_id se deriven de él con el
-- mismo trigger que ya usan unidades/pagos/etc., en vez de confiar en lo que
-- manda el cliente. Eso cierra de raíz dos hallazgos a la vez (el 1 y el 2).

-- -----------------------------------------------------------------------------
-- 1. importaciones gana edificio_id (tabla vacía en producción — sin backfill)
-- -----------------------------------------------------------------------------
ALTER TABLE importaciones ADD COLUMN IF NOT EXISTS edificio_id UUID REFERENCES edificios(id) ON DELETE CASCADE;

-- Falla fuerte si alguna vez hay filas sin edificio_id (no debería pasar: la
-- tabla nació en la 007 sin esta columna y hoy está vacía en producción),
-- en vez de saltear el SET NOT NULL en silencio — eso dejaría el schema
-- distinto entre entornos, y peor, esas filas heredadas quedarían
-- imposibles de tocar (el trigger de la sección 2 las recalcularía a NULL
-- y chocarían con el NOT NULL de administradora_id).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM importaciones WHERE edificio_id IS NULL) THEN
    RAISE EXCEPTION 'importaciones tiene filas con edificio_id NULL — hace falta backfill manual antes de aplicar esta migración';
  END IF;
  ALTER TABLE importaciones ALTER COLUMN edificio_id SET NOT NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_importaciones_edificio ON importaciones (edificio_id, tipo, created_at DESC);

-- -----------------------------------------------------------------------------
-- 2. set_tenant_cols(): importaciones deriva administradora_id/consorcio_id
--    de edificio_id, igual que la rama de unidades (edificios.building_id).
--    Cierra el hallazgo "MEDIA — edificio_id nunca se valida contra
--    consorcio_id": ahora consorcio_id ni siquiera lo manda el cliente, lo
--    calcula el trigger a partir del único id de verdad (edificio_id).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_tenant_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_TABLE_NAME = 'edificios' THEN
    SELECT c.administradora_id INTO NEW.administradora_id FROM consorcios c WHERE c.id = NEW.consortium_id;
  ELSIF TG_TABLE_NAME = 'unidades' THEN
    SELECT e.administradora_id, e.consortium_id
      INTO NEW.administradora_id, NEW.consorcio_id
      FROM edificios e WHERE e.id = NEW.building_id;
  ELSIF TG_TABLE_NAME IN ('propietarios', 'pagos', 'mora_logs') THEN
    IF NEW.unidad_id IS NOT NULL THEN
      SELECT u.administradora_id, u.consorcio_id
        INTO NEW.administradora_id, NEW.consorcio_id
        FROM unidades u WHERE u.id = NEW.unidad_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'arreglos' THEN
    IF NEW.unidad_id IS NOT NULL THEN
      SELECT u.administradora_id, u.consorcio_id
        INTO NEW.administradora_id, NEW.consorcio_id
        FROM unidades u WHERE u.id = NEW.unidad_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'cuenta_corriente' THEN
    IF NEW.unidad_id IS NOT NULL THEN
      SELECT u.administradora_id, u.consorcio_id
        INTO NEW.administradora_id, NEW.consorcio_id
        FROM unidades u WHERE u.id = NEW.unidad_id;
    END IF;
    -- contraasiento_de tiene que ser un movimiento de la MISMA unidad. Sin
    -- este chequeo, el UNIQUE de la sección 6 es un candado cross-tenant: los
    -- constraints de Postgres (FK, UNIQUE) siempre bypassean RLS, así que sin
    -- esta validación de negocio un admin de otro tenant podría insertar un
    -- movimiento propio con contraasiento_de = <id de un débito ajeno>
    -- (filtrado por un log, un export, etc. — no adivinable, pero tampoco
    -- hace falta más que eso) y "gastarle" el valor único a la víctima:
    -- cuando el dueño real intente revertir esa importación, su propio
    -- insert de contraasientos chocaría contra el UNIQUE y fallaría para
    -- siempre. Como esta función corre con SECURITY DEFINER, puede leer
    -- cuenta_corriente sin RLS para hacer la validación; lo que devuelve NO
    -- se expone al cliente, sólo se usa para permitir o abortar el INSERT.
    IF NEW.contraasiento_de IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM cuenta_corriente cc
        WHERE cc.id = NEW.contraasiento_de AND cc.unidad_id = NEW.unidad_id
      ) THEN
        RAISE EXCEPTION 'contraasiento_de debe referenciar un movimiento de la misma unidad';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'importaciones' THEN
    SELECT e.administradora_id, e.consortium_id
      INTO NEW.administradora_id, NEW.consorcio_id
      FROM edificios e WHERE e.id = NEW.edificio_id;
  END IF;
  RETURN NEW;
END $$;

-- BEFORE INSERT OR UPDATE sin "OF columna": a diferencia de unidades/pagos
-- (donde sólo hace falta recalcular si cambia el FK padre), acá el trigger
-- tiene que correr en CUALQUIER UPDATE — si sólo mirara "OF edificio_id", un
-- PATCH que cambie otra columna sin tocar edificio_id no dispararía el
-- recálculo y el WITH CHECK de la policy (sección 4) quedaría evaluando el
-- consorcio_id/administradora_id viejos, no protegiendo nada nuevo. Mismo
-- razonamiento que ya usa la rama de edificios desde la 006.
DROP TRIGGER IF EXISTS trg_tenant_importaciones ON importaciones;
CREATE TRIGGER trg_tenant_importaciones BEFORE INSERT OR UPDATE ON importaciones
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_cols();

-- -----------------------------------------------------------------------------
-- 3. Policies de importaciones: ya no hace falta el EXISTS contra consorcios
--    (era un parche para cuando consorcio_id venía del cliente sin trigger).
--    Con el trigger de la sección 2, administradora_id/consorcio_id son
--    siempre el valor real derivado de edificio_id — mismo patrón que el
--    resto de las tablas tenant. Esto también cierra solo el hallazgo de la
--    policy de UPDATE (no tenía el chequeo extra que sí tenía el INSERT):
--    ahora ninguna de las dos lo necesita, porque el trigger corre antes que
--    cualquiera de las dos y pisa lo que mande el cliente.
DROP POLICY IF EXISTS importaciones_insert ON importaciones;
CREATE POLICY importaciones_insert ON importaciones FOR INSERT
  WITH CHECK (
    public.puede_consorcio(consorcio_id, administradora_id)
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS importaciones_update ON importaciones;
CREATE POLICY importaciones_update ON importaciones FOR UPDATE
  USING (public.puede_consorcio(consorcio_id, administradora_id))
  WITH CHECK (public.puede_consorcio(consorcio_id, administradora_id));

-- -----------------------------------------------------------------------------
-- 4. Guard "no duplicar período" a nivel DB (cierra la carrera del hallazgo
--    "no duplicar es evadible") — antes se indexaba por consorcio_id pero se
--    escribía por edificio_id, lo que además bloqueaba de más (dos edificios
--    de un mismo consorcio no podían importar el mismo período) y de menos
--    (una carrera podía duplicar). Un índice único parcial en la propia DB
--    hace que el segundo INSERT concurrente falle con 23505 en vez de
--    depender de un SELECT-then-INSERT no atómico en la app.
CREATE UNIQUE INDEX IF NOT EXISTS idx_importaciones_liquidacion_unica
  ON importaciones (edificio_id, periodo)
  WHERE tipo = 'liquidacion' AND estado = 'confirmada';

-- -----------------------------------------------------------------------------
-- 5. created_by: nunca se escribía (quedaba NULL siempre) y era falsificable
--    por no tener WITH CHECK. DEFAULT auth.uid() lo completa solo cuando la
--    app no lo manda (que es siempre, hoy); el WITH CHECK exige que sea
--    siempre el uid real del que inserta — sin escape para NULL: un cliente
--    que mande `created_by: null` explícito pisaría el DEFAULT y, con un
--    "OR created_by IS NULL", lo dejaría pasar sin firma. Ninguna ruta de la
--    app manda esta columna hoy, así que exigirla no rompe nada real.
-- -----------------------------------------------------------------------------
ALTER TABLE cuenta_corriente ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE importaciones    ALTER COLUMN created_by SET DEFAULT auth.uid();

DROP POLICY IF EXISTS cuenta_corriente_insert ON cuenta_corriente;
CREATE POLICY cuenta_corriente_insert ON cuenta_corriente FOR INSERT
  WITH CHECK (
    public.puede_consorcio(consorcio_id, administradora_id)
    AND created_by = auth.uid()
  );

-- -----------------------------------------------------------------------------
-- 6. Doble reversión concurrente: un UNIQUE sobre contraasiento_de asegura
--    que un débito no pueda tener dos contraasientos aunque dos POST a
--    /revertir corran en simultáneo (NULLs no cuentan como duplicados en un
--    UNIQUE de Postgres, así que no afecta a los movimientos normales que no
--    son contraasientos de nada). El chequeo de "misma unidad" que le puso
--    a set_tenant_cols() la sección 2 es lo que hace que este UNIQUE no se
--    pueda usar como candado cross-tenant.
-- -----------------------------------------------------------------------------
-- El nombre de un UNIQUE constraint choca como "relation ya existe" (42P07,
-- duplicate_table) porque Postgres le crea un índice con ese mismo nombre —
-- no duplicate_object, que es el que usan los enums de la 002/007.
DO $$
BEGIN
  ALTER TABLE cuenta_corriente ADD CONSTRAINT uq_cc_contraasiento_de UNIQUE (contraasiento_de);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- =============================================================================
-- Resumen
-- =============================================================================
-- (1)-(3) cierran los dos hallazgos MEDIOS de la primera pasada de auditoría
-- (policy de UPDATE sin el chequeo del INSERT; edificio_id sin validar contra
-- consorcio_id) de raíz, dándole a `importaciones` el mismo trigger de
-- derivación de tenant que ya tienen el resto de las tablas, en vez de
-- parchear cada policy por separado. (4) cierra la condición de carrera del
-- guard de "no duplicar período" con un índice único (y de paso corrige el
-- scoping: por edificio, no por consorcio). (5) hace que created_by quede
-- completo y no falsificable, sin escape para NULL. (6) hace imposible
-- duplicar un contraasiento aunque /revertir se llame dos veces en
-- simultáneo — y la validación de "misma unidad" que se le agregó a
-- set_tenant_cols() en la sección 2 es lo que impide que ese UNIQUE se use
-- como candado cross-tenant (hallazgo de la segunda pasada de auditoría,
-- sobre esta misma migración: los constraints de Postgres bypassean RLS, así
-- que sin esa validación de negocio un admin de otro tenant podía "gastarle"
-- el valor único a una víctima con sólo conocer el UUID de un débito ajeno).
--
-- Footgun para el futuro: set_tenant_cols() se redefine completa con
-- CREATE OR REPLACE en 002, 006, 007 y acá — no son conmutativas. Reaplicar
-- una migración vieja (002/006/007) DESPUÉS de esta borra las ramas que
-- agregaron las migraciones posteriores (cuenta_corriente, importaciones) y
-- reabre el hallazgo 2 en silencio para cuenta_corriente (para importaciones
-- al menos falla ruidoso: administradora_id quedaría NULL contra un NOT
-- NULL). Si hay que tocar el trigger de nuevo, la única función 008 hacia
-- adelante es esta — no reescribir la de una migración anterior.
--
-- El fix del código de la aplicación (dejar de mandar consorcio_id, validar
-- la respuesta atómica de la reversión) va en el mismo commit que esta
-- migración, no acá.
-- =============================================================================
