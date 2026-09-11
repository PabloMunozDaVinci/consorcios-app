-- =============================================================================
-- MIGRACIÓN 005 — Rate limiting persistente (Bloque 2, ítem 25)
-- =============================================================================
-- El rate limit por minuto vivía en un Map() en memoria del proceso: se perdía
-- en cada restart/deploy y no se compartía entre instancias PM2. Esta tabla lo
-- reemplaza. blocked_ips / security_logs (ataques por día, brute force) ya
-- vivían en la DB desde antes; esto sólo cubre el contador de "requests por
-- minuto" que faltaba.

CREATE TABLE IF NOT EXISTS rate_limits (
  ip_address VARCHAR(45) PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_updated ON rate_limits (updated_at);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Sólo super_admin puede mirarla (panel de diagnóstico eventual); el server
-- escribe/lee con service_role (bypassa RLS), igual que blocked_ips/security_logs.
DROP POLICY IF EXISTS rate_limits_super_admin ON rate_limits;
CREATE POLICY rate_limits_super_admin ON rate_limits FOR SELECT USING (public.es_super_admin());

-- Función atómica: incrementa el contador de la ventana actual (o la reinicia
-- si expiró) y devuelve el conteo resultante. Evita el read-then-write desde
-- la aplicación (dos requests concurrentes de la misma IP ya no pisan el
-- contador del otro).
CREATE OR REPLACE FUNCTION public.rate_limit_hit(p_ip TEXT, p_window_seconds INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO rate_limits (ip_address, window_start, count, updated_at)
  VALUES (p_ip, NOW(), 1, NOW())
  ON CONFLICT (ip_address) DO UPDATE SET
    count = CASE
      WHEN rate_limits.window_start < NOW() - (p_window_seconds || ' seconds')::interval
        THEN 1
      ELSE rate_limits.count + 1
    END,
    window_start = CASE
      WHEN rate_limits.window_start < NOW() - (p_window_seconds || ' seconds')::interval
        THEN NOW()
      ELSE rate_limits.window_start
    END,
    updated_at = NOW()
  RETURNING count INTO v_count;

  RETURN v_count;
END;
$$;

-- Housekeeping: filas viejas (no tocadas en 1 día) no sirven para nada.
CREATE OR REPLACE FUNCTION public.rate_limits_cleanup()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  DELETE FROM rate_limits WHERE updated_at < NOW() - INTERVAL '1 day';
$$;
