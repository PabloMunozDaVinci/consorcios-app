-- =============================================================================
-- MIGRACIÓN 004 — Bloque 2: correctitud (ítems 22, 23, 24)
-- =============================================================================
-- Idempotente.

-- -----------------------------------------------------------------------------
-- 22. Copropiedad: es_dueño_principal / porcentaje_propiedad vs UNIQUE(unidad_id)
-- -----------------------------------------------------------------------------
-- Decisión: por ahora GANA la constraint (un propietario "titular" por unidad;
-- el registro civil vive afuera de esta app). La copropiedad real (varios
-- titulares con % cada uno) es del dominio de la Fase 4 (liquidación nativa) y
-- no está en el alcance de PROMPT-features.md Fases 1-3. Dejamos las columnas
-- para no romper el schema, pero les ponemos NOT NULL + default explícito para
-- que un futuro modelo de copropiedad no herede filas ambiguas (NULL).
ALTER TABLE propietarios ALTER COLUMN es_dueño_principal SET DEFAULT TRUE;
ALTER TABLE propietarios ALTER COLUMN es_dueño_principal SET NOT NULL;
ALTER TABLE propietarios ALTER COLUMN porcentaje_propiedad SET DEFAULT 100.0;
ALTER TABLE propietarios ALTER COLUMN porcentaje_propiedad SET NOT NULL;
COMMENT ON COLUMN propietarios.es_dueño_principal IS
  'Reservada para copropiedad (Fase 4). Hoy siempre TRUE: unique_propietario_por_unidad/ux_propietario_por_unidad permite un solo propietario por unidad.';
COMMENT ON COLUMN propietarios.porcentaje_propiedad IS
  'Reservada para copropiedad (Fase 4). Hoy siempre 100: ver es_dueño_principal.';

-- -----------------------------------------------------------------------------
-- 23. Triggers updated_at (usa public.set_updated_at() de la migración 002)
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_updated_consorcios ON consorcios;
CREATE TRIGGER trg_updated_consorcios BEFORE UPDATE ON consorcios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_updated_edificios ON edificios;
CREATE TRIGGER trg_updated_edificios BEFORE UPDATE ON edificios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_updated_unidades ON unidades;
CREATE TRIGGER trg_updated_unidades BEFORE UPDATE ON unidades
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_updated_propietarios ON propietarios;
CREATE TRIGGER trg_updated_propietarios BEFORE UPDATE ON propietarios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_updated_arreglos ON arreglos;
CREATE TRIGGER trg_updated_arreglos BEFORE UPDATE ON arreglos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 24. El seed duplica: ON CONFLICT DO NOTHING sin constraint única no hace nada.
--     Único por administradora (dos administradoras pueden tener el mismo nombre
--     de consorcio; una misma administradora no debería repetirlo).
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS ux_consorcios_administradora_nombre
  ON consorcios (administradora_id, nombre);
