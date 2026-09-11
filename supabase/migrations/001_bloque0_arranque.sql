-- =============================================================================
-- MIGRACIÓN 001 — Bloque 0: que la app arranque
-- =============================================================================
-- Idempotente (IF EXISTS / IF NOT EXISTS / CREATE OR REPLACE / DROP NOT NULL).
-- Aplicar contra la DB viva: supabase/schema.sql ya divergió y NO se edita.
-- Cubre CONTEXT.md §7.1, §7.2, §7.4 y §6.15.

-- -----------------------------------------------------------------------------
-- 1. propietarios.unidad_id nullable + índice único parcial  (§7.2)
--    La ausencia de unidad_id ES la marca de "admin". Hoy la columna es
--    NOT NULL y la constraint UNIQUE (unidad_id) impide crear el primer admin
--    y romperían dos admins (dos NULL colisionan en algunas versiones de índice).
-- -----------------------------------------------------------------------------
ALTER TABLE propietarios ALTER COLUMN unidad_id DROP NOT NULL;

ALTER TABLE propietarios DROP CONSTRAINT IF EXISTS unique_propietario_por_unidad;

CREATE UNIQUE INDEX IF NOT EXISTS ux_propietario_por_unidad
  ON propietarios (unidad_id)
  WHERE unidad_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. get_saldo_deudor()  (§7.1, §7.4, §6.15)
--    - MIN(a, b) no existe en Postgres para escalares -> LEAST.
--    - EXTRACT(MONTH FROM AGE(...)) toma sólo el componente de meses del
--      intervalo: una deuda de 14 meses se calculaba como 2. Se suman los años.
--    - Función SECURITY DEFINER sin search_path fijo -> vector de secuestro.
--    meses_atrasados devuelve el conteo REAL de meses; el tope de 12 se aplica
--    sólo a la fórmula del monto (comportamiento previo del cálculo económico).
-- -----------------------------------------------------------------------------
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
  v_meses_atrasados INTEGER := 0;
  v_meses_facturables INTEGER := 0;
  v_monto_total DECIMAL(12,2) := 0;
  v_ultimo_mes DATE;
  v_es_mora BOOLEAN := FALSE;
  v_edad INTERVAL;
BEGIN
  SELECT MAX(mes_pagado) INTO v_ultimo_mes
  FROM pagos
  WHERE unidad_id = p_unidad_id AND estado = 'confirmado';

  IF v_ultimo_mes IS NULL THEN
    v_ultimo_mes := CURRENT_DATE - INTERVAL '12 months';
  END IF;

  v_edad := AGE(CURRENT_DATE, v_ultimo_mes);
  v_meses_atrasados := GREATEST(
    0,
    (EXTRACT(YEAR FROM v_edad) * 12 + EXTRACT(MONTH FROM v_edad))::INTEGER
  );

  v_meses_facturables := LEAST(12, v_meses_atrasados);
  v_monto_total := v_meses_facturables * 150000 * 1.20;
  v_es_mora := v_meses_atrasados >= 3;

  RETURN QUERY SELECT v_meses_atrasados, v_monto_total, v_ultimo_mes, v_es_mora;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. evaluar_y_actualizar_mora()  (§6.15)
--    Mismo cuerpo que schema.sql; sólo se agrega SET search_path. El BETWEEN
--    6 AND 11 / ELSE ahora escala bien porque meses_atrasados ya no está topeado.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION evaluar_y_actualizar_mora()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r_unidad RECORD;
  v_meses INTEGER;
  v_monto DECIMAL(12,2);
  v_ultimo DATE;
  v_es_mora BOOLEAN;
  v_estado estado_mora;
  v_existe_log UUID;
BEGIN
  FOR r_unidad IN
    SELECT u.id, u.numero, p.id as propietario_id
    FROM unidades u
    JOIN propietarios p ON p.unidad_id = u.id
  LOOP
    SELECT meses_atrasados, monto_total, ultimo_mes_pagado, es_mora
    INTO v_meses, v_monto, v_ultimo, v_es_mora
    FROM get_saldo_deudor(r_unidad.id);

    IF v_meses = 0 OR v_meses IS NULL THEN
      v_estado := 'al_dia';
    ELSIF v_meses BETWEEN 1 AND 2 THEN
      v_estado := 'deudor';
    ELSIF v_meses BETWEEN 3 AND 5 THEN
      v_estado := 'apto_carta';
    ELSIF v_meses BETWEEN 6 AND 11 THEN
      v_estado := 'inicio_juicio';
    ELSE
      v_estado := 'juicio_en_curso';
    END IF;

    IF v_es_mora OR v_meses > 0 THEN
      SELECT MIN(id) INTO v_existe_log
      FROM mora_logs
      WHERE unidad_id = r_unidad.id
        AND estado_nuevo = v_estado
        AND created_at > CURRENT_DATE - INTERVAL '1 day';

      IF v_existe_log IS NULL THEN
        INSERT INTO mora_logs (unidad_id, propietario_id, estado_nuevo, meses_deuda, monto_deuda, motivo)
        VALUES (r_unidad.id, r_unidad.propietario_id, v_estado, v_meses, v_monto,
          CASE v_estado
            WHEN 'al_dia' THEN 'Unidad al día'
            WHEN 'deudor' THEN 'Meses impagos: ' || v_meses::TEXT
            WHEN 'apto_carta' THEN 'Apto para carta documento'
            WHEN 'inicio_juicio' THEN 'Inicio de acción judicial'
            ELSE 'Juicio en curso'
          END);
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE 'Evaluación de mora completada';
END;
$$;
