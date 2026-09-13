-- =============================================================================
-- MIGRACIÓN 007 — Fase 1: cuenta corriente por unidad + importador (ROADMAP §4)
-- =============================================================================
-- Idempotente. Aplicar contra la DB viva.
--
-- Arranca el "cambio conceptual" del ROADMAP: a partir de ahora la verdad de
-- la deuda de una unidad vive en `cuenta_corriente` (débitos y créditos),
-- no en una constante hardcodeada. `importaciones` registra de dónde salió
-- cada tanda de movimientos (padrón o liquidación), para poder previsualizar,
-- confirmar o revertir sin perder auditoría.
--
-- No toca evaluar_y_actualizar_mora() (ya deprecada y sin EXECUTE, ver 006).

-- -----------------------------------------------------------------------------
-- 0. Enums
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE movimiento_tipo AS ENUM ('debito', 'credito');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE movimiento_origen AS ENUM ('importacion', 'liquidacion', 'pago', 'ajuste');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE importacion_tipo AS ENUM ('padron', 'liquidacion');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE importacion_estado AS ENUM ('pendiente', 'confirmada', 'revertida', 'error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 1. Tabla importaciones (archivo subido, mapeo de columnas, estado, log)
-- -----------------------------------------------------------------------------
-- administradora_id / consorcio_id acá NO los deriva un trigger: esta tabla no
-- tiene FK a una unidad de la que inferirlos (es la raíz de la importación,
-- la decide quien sube el archivo). El aislamiento de tenant lo garantiza el
-- WITH CHECK de la policy de INSERT (sección 5), no set_tenant_cols().
CREATE TABLE IF NOT EXISTS importaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  administradora_id UUID NOT NULL REFERENCES administradoras(id) ON DELETE CASCADE,
  consorcio_id UUID NOT NULL REFERENCES consorcios(id) ON DELETE CASCADE,
  tipo importacion_tipo NOT NULL,
  archivo_nombre TEXT NOT NULL,
  mapeo_columnas JSONB NOT NULL,
  periodo DATE,
  estado importacion_estado NOT NULL DEFAULT 'pendiente',
  filas_totales INTEGER NOT NULL DEFAULT 0,
  filas_importadas INTEGER NOT NULL DEFAULT 0,
  filas_error INTEGER NOT NULL DEFAULT 0,
  log JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmada_at TIMESTAMPTZ,
  revertida_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_importaciones_consorcio ON importaciones (consorcio_id, tipo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_importaciones_administradora ON importaciones (administradora_id);

-- -----------------------------------------------------------------------------
-- 2. Tabla cuenta_corriente (débitos y créditos por unidad — append-only)
-- -----------------------------------------------------------------------------
-- Movimiento de plata: inmutable. Nunca UPDATE/DELETE de una fila ya escrita;
-- un error se corrige con un contraasiento nuevo que referencia a
-- `contraasiento_de`. La inmutabilidad se garantiza abajo con RLS (sección 5:
-- sólo hay policies de SELECT e INSERT, ni UPDATE ni DELETE), no por
-- disciplina del código que la escribe.
CREATE TABLE IF NOT EXISTS cuenta_corriente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidad_id UUID NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  administradora_id UUID NOT NULL REFERENCES administradoras(id) ON DELETE CASCADE,
  consorcio_id UUID NOT NULL REFERENCES consorcios(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo movimiento_tipo NOT NULL,
  concepto TEXT NOT NULL,
  importe DECIMAL(12,2) NOT NULL CHECK (importe > 0),
  periodo DATE NOT NULL,
  origen movimiento_origen NOT NULL,
  importacion_id UUID REFERENCES importaciones(id) ON DELETE SET NULL,
  pago_id UUID REFERENCES pagos(id) ON DELETE SET NULL,
  contraasiento_de UUID REFERENCES cuenta_corriente(id) ON DELETE SET NULL,
  tasa_interes DECIMAL(6,4),
  fundamento_tasa TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cc_unidad_periodo ON cuenta_corriente (unidad_id, periodo);
CREATE INDEX IF NOT EXISTS idx_cc_importacion ON cuenta_corriente (importacion_id);
CREATE INDEX IF NOT EXISTS idx_cc_administradora ON cuenta_corriente (administradora_id);

-- -----------------------------------------------------------------------------
-- 3. Trigger set_tenant_cols(): rama nueva para cuenta_corriente
-- -----------------------------------------------------------------------------
-- Se agrega sólo la rama de cuenta_corriente (deriva administradora_id /
-- consorcio_id de unidades vía unidad_id, igual que la rama de pagos). Las
-- ramas existentes de edificios/unidades/propietarios/pagos/mora_logs/arreglos
-- quedan intactas. importaciones queda deliberadamente fuera (ver sección 1).
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
  END IF;
  RETURN NEW;
END $$;

-- cuenta_corriente es append-only (sin policy de UPDATE, ver sección 5), así
-- que el trigger sólo necesita cubrir INSERT — a diferencia de los "BEFORE
-- INSERT OR UPDATE OF ..." de la 002, acá no hay un UPDATE legítimo que
-- recalcular (y la cláusula "OF columna" de todos modos sólo es válida en
-- Postgres para el evento UPDATE, no para INSERT solo).
DROP TRIGGER IF EXISTS trg_tenant_cuenta_corriente ON cuenta_corriente;
CREATE TRIGGER trg_tenant_cuenta_corriente BEFORE INSERT ON cuenta_corriente
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_cols();

-- -----------------------------------------------------------------------------
-- 4. RLS: habilitar en ambas tablas nuevas
-- -----------------------------------------------------------------------------
ALTER TABLE importaciones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuenta_corriente ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 5. Policies
-- -----------------------------------------------------------------------------
-- cuenta_corriente: sólo SELECT e INSERT, a propósito. No hay policy de
-- UPDATE ni DELETE: bajo RLS eso ya bloquea esas operaciones para cualquier
-- rol autenticado vía PostgREST (el dueño de la tabla / service_role sigue
-- pudiendo, pero la app nunca debería usar ese cliente para esto).
DROP POLICY IF EXISTS cuenta_corriente_select ON cuenta_corriente;
CREATE POLICY cuenta_corriente_select ON cuenta_corriente FOR SELECT
  USING (public.puede_consorcio(consorcio_id, administradora_id));

DROP POLICY IF EXISTS cuenta_corriente_insert ON cuenta_corriente;
CREATE POLICY cuenta_corriente_insert ON cuenta_corriente FOR INSERT
  WITH CHECK (public.puede_consorcio(consorcio_id, administradora_id));

-- importaciones: SELECT, INSERT y UPDATE (para pasar de 'pendiente' a
-- 'confirmada'/'revertida'/'error' después de previsualizar). Sin DELETE:
-- una importación revertida queda como fila con estado='revertida', nunca se
-- borra (es auditoría).
--
-- El INSERT exige además administradora_id = mi_administradora_id(): como
-- estas dos columnas no las deriva ningún trigger (sección 1), el cliente
-- manda consorcio_id pero no puede mentir a qué administradora pertenece la
-- importación.
--
-- Ojo con puede_consorcio() acá: para rol='admin' sólo compara
-- administradora_id (ya forzado arriba a ser el propio) y nunca mira si
-- consorcio_id pertenece de verdad a esa administradora — eso está bien en
-- el resto de las tablas porque su administradora_id/consorcio_id los
-- deriva el trigger set_tenant_cols() del FK real (un admin no puede
-- mentirlos). Pero importaciones no tiene ese trigger (sección 1): el
-- cliente manda consorcio_id directo. Sin este EXISTS, un admin podría
-- insertar una importación con administradora_id=la suya y consorcio_id de
-- OTRO tenant (impacto bajo — no habilita leer/escribir nada ajeno, porque
-- cualquier uso posterior de esa fila chocaría con el RLS real de
-- unidades/cuenta_corriente — pero es una fila fantasma que no debería
-- poder crearse).
DROP POLICY IF EXISTS importaciones_select ON importaciones;
CREATE POLICY importaciones_select ON importaciones FOR SELECT
  USING (public.puede_consorcio(consorcio_id, administradora_id));

DROP POLICY IF EXISTS importaciones_insert ON importaciones;
CREATE POLICY importaciones_insert ON importaciones FOR INSERT
  WITH CHECK (
    administradora_id = public.mi_administradora_id()
    AND EXISTS (
      SELECT 1 FROM consorcios c
      WHERE c.id = consorcio_id AND c.administradora_id = public.mi_administradora_id()
    )
    AND public.puede_consorcio(consorcio_id, administradora_id)
  );

DROP POLICY IF EXISTS importaciones_update ON importaciones;
CREATE POLICY importaciones_update ON importaciones FOR UPDATE
  USING (public.puede_consorcio(consorcio_id, administradora_id))
  WITH CHECK (public.puede_consorcio(consorcio_id, administradora_id));

-- -----------------------------------------------------------------------------
-- 6. get_saldo_deudor(): reescritura completa — aging FIFO sobre cuenta_corriente
-- -----------------------------------------------------------------------------
-- Reemplaza el `150000 * 1.20` hardcodeado (y el cálculo por "meses desde el
-- último mes_pagado") de la versión de la 006. Misma firma y forma de
-- retorno para no romper a quien la llama (src/actions/mora.ts).
--
-- Lógica de aging (FIFO, el período más viejo cobra primero): se agrupan los
-- débitos por período y se calcula su acumulado ordenado por `periodo`; los
-- créditos totales de la unidad se aplican contra ese acumulado en el mismo
-- orden, así que un período queda "cubierto" sólo si la suma de créditos
-- alcanza para pagar todos los períodos anteriores a él más el suyo. Por
-- construcción los períodos cubiertos son siempre un prefijo cronológico
-- (no hay huecos), por eso ultimo_mes_pagado = MAX(periodo) entre los
-- cubiertos es correcto. No se usa mes_pagado de `pagos`: un pago no
-- necesariamente dice a qué período se aplica (Fase 1.4 del ROADMAP permite
-- imputar un pago al saldo más antiguo), así que la única fuente de verdad
-- de qué está pago es el propio saldo de cuenta_corriente.
CREATE OR REPLACE FUNCTION get_saldo_deudor(p_unidad_id UUID)
RETURNS TABLE(
  meses_atrasados INTEGER,
  monto_total DECIMAL(12,2),
  ultimo_mes_pagado DATE,
  es_mora BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_administradora_id UUID;
  v_consorcio_id UUID;
  v_meses_atrasados INTEGER := 0;
  v_monto_total DECIMAL(12,2) := 0;
  v_ultimo_mes DATE;
BEGIN
  SELECT administradora_id, consorcio_id INTO v_administradora_id, v_consorcio_id
  FROM unidades WHERE id = p_unidad_id;

  -- Unidad inexistente, o el llamador no puede verla (otro tenant): sin filas.
  IF v_administradora_id IS NULL OR NOT public.puede_consorcio(v_consorcio_id, v_administradora_id) THEN
    RETURN;
  END IF;

  -- Todavía no se importó ningún movimiento para esta unidad: no hay dato,
  -- no se inventa deuda.
  IF NOT EXISTS (SELECT 1 FROM cuenta_corriente WHERE unidad_id = p_unidad_id) THEN
    RETURN QUERY SELECT 0, 0::DECIMAL(12,2), NULL::DATE, FALSE;
    RETURN;
  END IF;

  WITH debitos AS (
    SELECT periodo, SUM(importe) AS importe
    FROM cuenta_corriente
    WHERE unidad_id = p_unidad_id AND tipo = 'debito'
    GROUP BY periodo
  ),
  acumulado AS (
    SELECT periodo, importe,
           SUM(importe) OVER (ORDER BY periodo) AS acumulado_debito
    FROM debitos
  ),
  creditos AS (
    SELECT COALESCE(SUM(importe), 0) AS total_creditos
    FROM cuenta_corriente
    WHERE unidad_id = p_unidad_id AND tipo = 'credito'
  ),
  aging AS (
    -- saldo_pendiente de cada período luego de aplicar, en orden FIFO, los
    -- créditos que todavía quedan disponibles tras cubrir los períodos
    -- anteriores (acumulado_debito - importe = deuda acumulada ANTES de
    -- este período).
    SELECT
      a.periodo,
      GREATEST(
        0,
        a.importe - GREATEST(0, c.total_creditos - (a.acumulado_debito - a.importe))
      ) AS saldo_pendiente
    FROM acumulado a, creditos c
  )
  SELECT
    COALESCE(COUNT(*) FILTER (WHERE saldo_pendiente > 0), 0)::INTEGER,
    COALESCE(SUM(saldo_pendiente) FILTER (WHERE saldo_pendiente > 0), 0)::DECIMAL(12,2),
    MAX(periodo) FILTER (WHERE saldo_pendiente = 0)
  INTO v_meses_atrasados, v_monto_total, v_ultimo_mes
  FROM aging;

  RETURN QUERY SELECT v_meses_atrasados, v_monto_total, v_ultimo_mes, (v_meses_atrasados >= 3);
END;
$$;

-- =============================================================================
-- Resumen
-- =============================================================================
-- Esta migración introduce el núcleo de Fase 1 del ROADMAP: `cuenta_corriente`
-- (débitos/créditos por unidad, append-only, inmutable vía RLS) e
-- `importaciones` (auditoría de qué archivo generó qué movimientos, con
-- estado pendiente/confirmada/revertida/error). `get_saldo_deudor()` deja de
-- usar una constante hardcodeada y pasa a calcular la mora haciendo aging
-- FIFO sobre los movimientos reales: el crédito más viejo se aplica siempre
-- al débito más viejo pendiente, nunca a uno más nuevo, porque el pago no
-- necesariamente declara a qué período corresponde (eso es justamente lo que
-- Fase 1.4 del ROADMAP formaliza como "imputación al saldo más antiguo").
-- =============================================================================
