-- =============================================================================
-- MIGRACIÓN 006 — Fixes de la auditoría RLS post-Bloque-3
-- =============================================================================
-- Idempotente. Cuatro hallazgos de severidad alta/media de la primera
-- auditoría completa de aislamiento multi-tenant sobre el modelo de la
-- migración 002 (subagente auditor-rls, 2026-09-11). Cada bloque es
-- independiente y se puede releer por separado.

-- -----------------------------------------------------------------------------
-- 1. Escalación admin -> super_admin (CRÍTICO)
-- -----------------------------------------------------------------------------
-- El WITH CHECK de usuarios_admin_rw acotaba la administradora de la fila
-- nueva pero no su `rol`: un admin podía hacer
--   PATCH /rest/v1/usuarios?id=eq.<su propia fila>  { "rol": "super_admin" }
-- El USING se evalúa contra la fila vieja (todavía rol='admin' -> pasa) y el
-- WITH CHECK nunca miraba el rol de la fila resultante. A partir de ahí
-- es_super_admin() da true y puede_consorcio() cortocircuita para TODOS los
-- tenants: lectura y escritura completa sobre cualquier administradora.
-- Fix: un admin (no super_admin) nunca puede escribir una fila cuyo rol
-- resultante sea 'super_admin' — ni la propia ni la de otro usuario.
DROP POLICY IF EXISTS usuarios_admin_rw ON usuarios;
CREATE POLICY usuarios_admin_rw ON usuarios FOR ALL
  USING (
    public.es_super_admin()
    OR (administradora_id = public.mi_administradora_id() AND public.mi_rol() = 'admin')
  )
  WITH CHECK (
    public.es_super_admin()
    OR (
      administradora_id = public.mi_administradora_id()
      AND public.mi_rol() = 'admin'
      AND rol <> 'super_admin'
    )
  );

-- -----------------------------------------------------------------------------
-- 2. Bucket "mantenimiento" sin scoping por tenant (CRÍTICO)
-- -----------------------------------------------------------------------------
-- La policy de 003_storage_privado.sql sólo exigía "es un usuario activo",
-- sin mirar administradora_id: cualquier usuario de cualquier administradora
-- podía listar/leer/sobreescribir/borrar los objetos subidos por otra
-- (incluye DELETE porque la policy es FOR ALL).
--
-- El componente que sube archivos (src/components/UploadImage.tsx) todavía
-- no está enchufado en ninguna página (confirmado: cero imports fuera de sí
-- mismo), así que no hay objetos reales en el bucket con un path sin
-- prefijo que este cambio pueda romper. La convención que arranca acá y que
-- hay que respetar cuando se enchufe en Fase 2: el primer segmento del path
-- del objeto tiene que ser el administradora_id del usuario que sube
-- (storage.foldername() separa el path por "/"), ej.
-- "<administradora_id>/arreglos/<arreglo_id>/foto.webp".
DROP POLICY IF EXISTS mantenimiento_usuarios_rw ON storage.objects;
CREATE POLICY mantenimiento_usuarios_rw ON storage.objects FOR ALL
  USING (
    bucket_id = 'mantenimiento'
    AND EXISTS (SELECT 1 FROM public.usuarios WHERE auth_user_id = auth.uid() AND activo)
    AND (
      public.es_super_admin()
      OR (storage.foldername(name))[1] = public.mi_administradora_id()::text
    )
  )
  WITH CHECK (
    bucket_id = 'mantenimiento'
    AND EXISTS (SELECT 1 FROM public.usuarios WHERE auth_user_id = auth.uid() AND activo)
    AND (
      public.es_super_admin()
      OR (storage.foldername(name))[1] = public.mi_administradora_id()::text
    )
  );

-- -----------------------------------------------------------------------------
-- 3. get_saldo_deudor(): lectura cross-tenant vía RPC directo (ALTO)
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER + sin chequeo de tenant: cualquier autenticado con un
-- unidad_id ajeno (filtrado, adivinado, de un propietario dado de baja) podía
-- leer el estado de deuda real de esa unidad vía
--   POST /rest/v1/rpc/get_saldo_deudor { "p_unidad_id": "<de otra adm>" }
-- La app (src/actions/mora.ts) sólo la llama con unidad_id que ya salieron
-- de una query RLS-scoped, así que el fix no cambia el comportamiento legítimo
-- — sólo cierra la llamada directa con un id ajeno devolviendo cero filas
-- (mismo resultado que "la unidad no existe", para no filtrar por qué falla).
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
  v_administradora_id UUID;
  v_consorcio_id UUID;
BEGIN
  SELECT administradora_id, consorcio_id INTO v_administradora_id, v_consorcio_id
  FROM unidades WHERE id = p_unidad_id;

  -- Unidad inexistente, o el llamador no puede verla (otro tenant): sin filas.
  IF v_administradora_id IS NULL OR NOT public.puede_consorcio(v_consorcio_id, v_administradora_id) THEN
    RETURN;
  END IF;

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
-- 4. Funciones SECURITY DEFINER de sistema, sin REVOKE (ALTO / MEDIO)
-- -----------------------------------------------------------------------------
-- evaluar_y_actualizar_mora(): reemplazada por la lógica en JS de
-- src/actions/mora.ts (evaluarYEnviarMora, que sí filtra por RLS) desde el
-- Bloque 0/1 — confirmado sin llamadores en src/. Queda definida (por si se
-- quiere retomar como job de DB más adelante) pero sin poder ejecutarla vía
-- RPC: hoy cualquier autenticado podía disparar evaluaciones y escrituras de
-- mora_logs cruzando TODOS los tenants (recorre unidades sin filtrar por RLS
-- al ser SECURITY DEFINER).
--
-- rate_limit_hit() / rate_limits_cleanup(): sólo los llama
-- src/lib/security/blocklist.ts con el cliente service_role — nunca desde
-- una sesión de usuario. Revocarles el EXECUTE a anon/authenticated no rompe
-- nada legítimo y cierra que cualquier autenticado pudiera resetear el rate
-- limiting global o inflar el contador de una IP ajena.
REVOKE EXECUTE ON FUNCTION public.evaluar_y_actualizar_mora() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rate_limit_hit(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rate_limits_cleanup() FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. Trigger set_tenant_cols(): asimetría en la rama "edificios" (MEDIO)
-- -----------------------------------------------------------------------------
-- Todas las demás ramas (unidades, propietarios/pagos/mora_logs, arreglos)
-- recalculan administradora_id/consorcio_id incondicionalmente (o siempre que
-- hay FK padre). "edificios" era la única con un guard `IF ... IS NULL`, que
-- respeta lo que mande el cliente si no es NULL. Combinado con que
-- puede_consorcio() no valida el consortium_id real para el rol admin (sólo
-- compara administradora_id, que el atacante controla), un admin podía hacer
--   POST /rest/v1/edificios { consortium_id: <de otro tenant>, administradora_id: <el suyo> }
-- y colgar un edificio propio de un consorcio ajeno. No es fuga de lectura
-- (la policy de SELECT sigue filtrando por administradora_id), pero
-- consortium_id tiene ON DELETE CASCADE hacia unidades/propietarios/pagos/
-- mora_logs: si el otro tenant borra ese consorcio, arrastra en cascada
-- datos de este. El código de la app nunca manda administradora_id acá
-- (usa src/lib/supabase/tenant-insert.ts), así que este fix no cambia nada
-- del comportamiento legítimo — sólo iguala "edificios" al resto de las
-- ramas: se recalcula siempre, sin importar lo que mande el cliente.
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
  END IF;
  RETURN NEW;
END $$;
