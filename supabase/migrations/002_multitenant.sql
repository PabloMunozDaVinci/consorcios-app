-- =============================================================================
-- MIGRACIÓN 002 — Multi-tenant (ROADMAP Fase 1 §1.1)
-- =============================================================================
-- Idempotente. Aplicar contra la DB viva.
--
-- - Nivel `administradoras` arriba de `consorcios` (el tenant).
-- - Tabla `usuarios` con roles reales; reemplaza el hack "sin unidad_id = admin".
-- - `administradora_id` (+ `consorcio_id`) desnormalizados en todas las tablas
--   tenant, mantenidos por trigger.
-- - Helpers `public.mi_administradora_id()`, `public.mi_rol()`, `public.es_super_admin()`.
-- - RLS con aislamiento por tenant en TODAS las tablas (incluidas las que hoy
--   tienen RLS y 0 policies: consorcios, edificios, mora_logs).
--
-- Cubre CONTEXT.md §4.1, §4.2, §4.3, §6.2 (parcial: falta sacar service_role
-- de las rutas, ítem 14).

-- -----------------------------------------------------------------------------
-- 0. ENUM de roles
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE rol_usuario AS ENUM ('super_admin', 'admin', 'operador', 'propietario');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 1. Tabla administradoras (el tenant)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS administradoras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razon_social VARCHAR(255) NOT NULL,
  cuit VARCHAR(13),
  matricula_rpa VARCHAR(50),          -- obligatoria en recibos y certificado de deuda
  domicilio TEXT,
  email TEXT,
  telefono VARCHAR(30),
  logo_url TEXT,
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. Tabla usuarios (rol + tenant). Reemplaza el hack unidad_id IS NULL.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  administradora_id UUID NOT NULL REFERENCES administradoras(id) ON DELETE CASCADE,
  rol rol_usuario NOT NULL,
  propietario_id UUID REFERENCES propietarios(id) ON DELETE SET NULL,  -- sólo rol=propietario
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_usuarios_auth_user ON usuarios (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_administradora ON usuarios (administradora_id);

-- Acceso acotado del operador a ciertos consorcios.
CREATE TABLE IF NOT EXISTS usuarios_consorcios (
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  consorcio_id UUID NOT NULL REFERENCES consorcios(id) ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, consorcio_id)
);

-- -----------------------------------------------------------------------------
-- 3. Columnas administradora_id / consorcio_id en las tablas tenant
-- -----------------------------------------------------------------------------
ALTER TABLE consorcios   ADD COLUMN IF NOT EXISTS administradora_id UUID REFERENCES administradoras(id) ON DELETE CASCADE;
ALTER TABLE edificios    ADD COLUMN IF NOT EXISTS administradora_id UUID REFERENCES administradoras(id) ON DELETE CASCADE;
ALTER TABLE unidades     ADD COLUMN IF NOT EXISTS administradora_id UUID REFERENCES administradoras(id) ON DELETE CASCADE;
ALTER TABLE unidades     ADD COLUMN IF NOT EXISTS consorcio_id UUID REFERENCES consorcios(id) ON DELETE CASCADE;
ALTER TABLE propietarios ADD COLUMN IF NOT EXISTS administradora_id UUID REFERENCES administradoras(id) ON DELETE CASCADE;
ALTER TABLE propietarios ADD COLUMN IF NOT EXISTS consorcio_id UUID REFERENCES consorcios(id) ON DELETE CASCADE;
ALTER TABLE pagos        ADD COLUMN IF NOT EXISTS administradora_id UUID REFERENCES administradoras(id) ON DELETE CASCADE;
ALTER TABLE pagos        ADD COLUMN IF NOT EXISTS consorcio_id UUID REFERENCES consorcios(id) ON DELETE CASCADE;
ALTER TABLE arreglos     ADD COLUMN IF NOT EXISTS administradora_id UUID REFERENCES administradoras(id) ON DELETE CASCADE;
ALTER TABLE arreglos     ADD COLUMN IF NOT EXISTS consorcio_id UUID REFERENCES consorcios(id) ON DELETE CASCADE;
ALTER TABLE mora_logs    ADD COLUMN IF NOT EXISTS administradora_id UUID REFERENCES administradoras(id) ON DELETE CASCADE;
ALTER TABLE mora_logs    ADD COLUMN IF NOT EXISTS consorcio_id UUID REFERENCES consorcios(id) ON DELETE CASCADE;

-- -----------------------------------------------------------------------------
-- 4. Backfill: 1 administradora "por definir" + asignar todo lo existente
-- -----------------------------------------------------------------------------
INSERT INTO administradoras (id, razon_social)
SELECT '00000000-0000-0000-0000-000000000001', 'Administradora (por definir)'
WHERE NOT EXISTS (SELECT 1 FROM administradoras);

DO $$
DECLARE
  v_admin_id UUID;
BEGIN
  SELECT id INTO v_admin_id FROM administradoras ORDER BY created_at LIMIT 1;

  UPDATE consorcios   SET administradora_id = v_admin_id WHERE administradora_id IS NULL;
  UPDATE edificios e  SET administradora_id = c.administradora_id
    FROM consorcios c WHERE c.id = e.consortium_id AND e.administradora_id IS NULL;
  UPDATE unidades u   SET administradora_id = e.administradora_id, consorcio_id = e.consortium_id
    FROM edificios e WHERE e.id = u.building_id AND u.administradora_id IS NULL;
  UPDATE propietarios p SET administradora_id = u.administradora_id, consorcio_id = u.consorcio_id
    FROM unidades u WHERE u.id = p.unidad_id AND p.administradora_id IS NULL;
  UPDATE pagos pg     SET administradora_id = u.administradora_id, consorcio_id = u.consorcio_id
    FROM unidades u WHERE u.id = pg.unidad_id AND pg.administradora_id IS NULL;
  UPDATE mora_logs ml SET administradora_id = u.administradora_id, consorcio_id = u.consorcio_id
    FROM unidades u WHERE u.id = ml.unidad_id AND ml.administradora_id IS NULL;
  -- arreglos: los que tienen unidad, del padre; los de área común, a la administradora default
  UPDATE arreglos a   SET administradora_id = u.administradora_id, consorcio_id = u.consorcio_id
    FROM unidades u WHERE u.id = a.unidad_id AND a.administradora_id IS NULL;
  UPDATE arreglos     SET administradora_id = v_admin_id WHERE administradora_id IS NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 5. NOT NULL + índices
-- -----------------------------------------------------------------------------
ALTER TABLE consorcios   ALTER COLUMN administradora_id SET NOT NULL;
ALTER TABLE edificios    ALTER COLUMN administradora_id SET NOT NULL;
ALTER TABLE unidades     ALTER COLUMN administradora_id SET NOT NULL;
ALTER TABLE unidades     ALTER COLUMN consorcio_id SET NOT NULL;
ALTER TABLE propietarios ALTER COLUMN administradora_id SET NOT NULL;
ALTER TABLE pagos        ALTER COLUMN administradora_id SET NOT NULL;
ALTER TABLE mora_logs    ALTER COLUMN administradora_id SET NOT NULL;
ALTER TABLE arreglos     ALTER COLUMN administradora_id SET NOT NULL;
-- propietarios.consorcio_id / pagos.consorcio_id / mora_logs.consorcio_id / arreglos.consorcio_id
-- quedan nullable: propietario admin sin unidad, arreglo de área común, etc.

CREATE INDEX IF NOT EXISTS idx_consorcios_administradora   ON consorcios (administradora_id);
CREATE INDEX IF NOT EXISTS idx_edificios_administradora    ON edificios (administradora_id);
CREATE INDEX IF NOT EXISTS idx_unidades_administradora     ON unidades (administradora_id);
CREATE INDEX IF NOT EXISTS idx_unidades_consorcio          ON unidades (consorcio_id);
CREATE INDEX IF NOT EXISTS idx_propietarios_administradora ON propietarios (administradora_id);
CREATE INDEX IF NOT EXISTS idx_pagos_administradora        ON pagos (administradora_id);
CREATE INDEX IF NOT EXISTS idx_arreglos_administradora     ON arreglos (administradora_id);
CREATE INDEX IF NOT EXISTS idx_mora_logs_administradora    ON mora_logs (administradora_id);

-- -----------------------------------------------------------------------------
-- 6. Trigger: derivar administradora_id / consorcio_id del padre en INSERT/UPDATE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_tenant_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_TABLE_NAME = 'edificios' THEN
    IF NEW.administradora_id IS NULL THEN
      SELECT c.administradora_id INTO NEW.administradora_id FROM consorcios c WHERE c.id = NEW.consortium_id;
    END IF;
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

DROP TRIGGER IF EXISTS trg_tenant_edificios ON edificios;
CREATE TRIGGER trg_tenant_edificios BEFORE INSERT OR UPDATE OF consortium_id ON edificios
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_cols();
DROP TRIGGER IF EXISTS trg_tenant_unidades ON unidades;
CREATE TRIGGER trg_tenant_unidades BEFORE INSERT OR UPDATE OF building_id ON unidades
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_cols();
DROP TRIGGER IF EXISTS trg_tenant_propietarios ON propietarios;
CREATE TRIGGER trg_tenant_propietarios BEFORE INSERT OR UPDATE OF unidad_id ON propietarios
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_cols();
DROP TRIGGER IF EXISTS trg_tenant_pagos ON pagos;
CREATE TRIGGER trg_tenant_pagos BEFORE INSERT OR UPDATE OF unidad_id ON pagos
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_cols();
DROP TRIGGER IF EXISTS trg_tenant_mora_logs ON mora_logs;
CREATE TRIGGER trg_tenant_mora_logs BEFORE INSERT OR UPDATE OF unidad_id ON mora_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_cols();
DROP TRIGGER IF EXISTS trg_tenant_arreglos ON arreglos;
CREATE TRIGGER trg_tenant_arreglos BEFORE INSERT OR UPDATE OF unidad_id ON arreglos
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_cols();

-- -----------------------------------------------------------------------------
-- 7. updated_at automático (nuevas tablas; el resto lo cubre el bloque 2)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_updated_administradoras ON administradoras;
CREATE TRIGGER trg_updated_administradoras BEFORE UPDATE ON administradoras
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_updated_usuarios ON usuarios;
CREATE TRIGGER trg_updated_usuarios BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 8. Helpers para RLS (en public; SECURITY DEFINER => bypassean RLS de usuarios,
--    así no hay recursión al usarlos dentro de policies de esa misma tabla)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mi_usuario_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid() AND activo LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.mi_administradora_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT administradora_id FROM public.usuarios WHERE auth_user_id = auth.uid() AND activo LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.mi_rol()
RETURNS rol_usuario LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT rol FROM public.usuarios WHERE auth_user_id = auth.uid() AND activo LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.es_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE auth_user_id = auth.uid() AND activo AND rol = 'super_admin'
  )
$$;

-- ids de consorcios que el operador tiene asignados (para el scoping fino).
CREATE OR REPLACE FUNCTION public.consorcios_asignados()
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT consorcio_id FROM public.usuarios_consorcios WHERE usuario_id = public.mi_usuario_id()
$$;

-- ¿el usuario actual puede tocar el consorcio <cid>? admin/super_admin: todo su
-- tenant; operador: sólo los asignados. NO consulta la tabla consorcios para
-- evitar el problema de snapshot en INSERT ... RETURNING sobre esa misma tabla.
CREATE OR REPLACE FUNCTION public.puede_consorcio(cid UUID, adm UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.es_super_admin()
     OR (adm = public.mi_administradora_id() AND (
           public.mi_rol() = 'admin'
        OR cid IN (SELECT public.consorcios_asignados())
        ))
$$;

-- -----------------------------------------------------------------------------
-- 9. RLS: nuevas tablas
-- -----------------------------------------------------------------------------
ALTER TABLE administradoras       ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios              ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios_consorcios   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS administradoras_select ON administradoras;
CREATE POLICY administradoras_select ON administradoras FOR SELECT
  USING (public.es_super_admin() OR id = public.mi_administradora_id());
DROP POLICY IF EXISTS administradoras_update ON administradoras;
CREATE POLICY administradoras_update ON administradoras FOR UPDATE
  USING (public.es_super_admin() OR (id = public.mi_administradora_id() AND public.mi_rol() = 'admin'))
  WITH CHECK (public.es_super_admin() OR (id = public.mi_administradora_id() AND public.mi_rol() = 'admin'));
DROP POLICY IF EXISTS administradoras_insert ON administradoras;
CREATE POLICY administradoras_insert ON administradoras FOR INSERT
  WITH CHECK (public.es_super_admin());

DROP POLICY IF EXISTS usuarios_self ON usuarios;
CREATE POLICY usuarios_self ON usuarios FOR SELECT USING (auth_user_id = auth.uid());
DROP POLICY IF EXISTS usuarios_admin_rw ON usuarios;
CREATE POLICY usuarios_admin_rw ON usuarios FOR ALL
  USING (public.es_super_admin() OR (administradora_id = public.mi_administradora_id() AND public.mi_rol() = 'admin'))
  WITH CHECK (public.es_super_admin() OR (administradora_id = public.mi_administradora_id() AND public.mi_rol() = 'admin'));

DROP POLICY IF EXISTS usuarios_consorcios_rw ON usuarios_consorcios;
CREATE POLICY usuarios_consorcios_rw ON usuarios_consorcios FOR ALL
  USING (public.es_super_admin() OR EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = usuarios_consorcios.usuario_id
      AND u.administradora_id = public.mi_administradora_id()
      AND public.mi_rol() = 'admin'))
  WITH CHECK (public.es_super_admin() OR EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = usuarios_consorcios.usuario_id
      AND u.administradora_id = public.mi_administradora_id()
      AND public.mi_rol() = 'admin'));

-- -----------------------------------------------------------------------------
-- 10. RLS: tablas tenant. Reemplaza las policies viejas (hack unidad_id IS NULL).
--     Fase 1: admin/operador/super_admin. El scoping fino del propietario a su
--     unidad es Fase 2 (portal).
--
--     El predicado se expresa siempre como puede_consorcio(<cid de la fila>,
--     <administradora_id de la fila>), una función pura de las columnas de la
--     fila: así funciona igual en USING y en WITH CHECK, incluso en
--     INSERT ... RETURNING (no depende de un snapshot de la tabla).
-- -----------------------------------------------------------------------------
-- consorcios
DROP POLICY IF EXISTS consorcios_tenant ON consorcios;
CREATE POLICY consorcios_tenant ON consorcios FOR ALL
  USING (public.puede_consorcio(id, administradora_id))
  WITH CHECK (public.puede_consorcio(id, administradora_id));

-- edificios
DROP POLICY IF EXISTS edificios_tenant ON edificios;
CREATE POLICY edificios_tenant ON edificios FOR ALL
  USING (public.puede_consorcio(consortium_id, administradora_id))
  WITH CHECK (public.puede_consorcio(consortium_id, administradora_id));

-- unidades
DROP POLICY IF EXISTS unidades_propietario ON unidades;
DROP POLICY IF EXISTS unidades_tenant ON unidades;
CREATE POLICY unidades_tenant ON unidades FOR ALL
  USING (public.puede_consorcio(consorcio_id, administradora_id))
  WITH CHECK (public.puede_consorcio(consorcio_id, administradora_id));

-- propietarios (consorcio_id puede ser NULL para un propietario sin unidad)
DROP POLICY IF EXISTS propietarios_ven_su_unidad ON propietarios;
DROP POLICY IF EXISTS propietarios_tenant ON propietarios;
CREATE POLICY propietarios_tenant ON propietarios FOR ALL
  USING (public.puede_consorcio(consorcio_id, administradora_id))
  WITH CHECK (public.puede_consorcio(consorcio_id, administradora_id));

-- pagos
DROP POLICY IF EXISTS pagos_propietario ON pagos;
DROP POLICY IF EXISTS pagos_tenant ON pagos;
CREATE POLICY pagos_tenant ON pagos FOR ALL
  USING (public.puede_consorcio(consorcio_id, administradora_id))
  WITH CHECK (public.puede_consorcio(consorcio_id, administradora_id));

-- arreglos (consorcio_id NULL = área común => sólo admin/super_admin del tenant)
DROP POLICY IF EXISTS arreglos_all_read ON arreglos;
DROP POLICY IF EXISTS arreglos_admin_insert ON arreglos;
DROP POLICY IF EXISTS arreglos_admin_update ON arreglos;
DROP POLICY IF EXISTS arreglos_tenant ON arreglos;
CREATE POLICY arreglos_tenant ON arreglos FOR ALL
  USING (public.puede_consorcio(consorcio_id, administradora_id))
  WITH CHECK (public.puede_consorcio(consorcio_id, administradora_id));

-- mora_logs
DROP POLICY IF EXISTS mora_logs_tenant ON mora_logs;
CREATE POLICY mora_logs_tenant ON mora_logs FOR ALL
  USING (public.puede_consorcio(consorcio_id, administradora_id))
  WITH CHECK (public.puede_consorcio(consorcio_id, administradora_id));

-- -----------------------------------------------------------------------------
-- 11. RLS: tablas de sistema. Reemplaza el hack unidad_id IS NULL por es_super_admin().
--     El server escribe con service_role (bypassa RLS).
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS admins_manage_security_logs ON security_logs;
DROP POLICY IF EXISTS security_logs_super_admin ON security_logs;
CREATE POLICY security_logs_super_admin ON security_logs FOR SELECT USING (public.es_super_admin());

DROP POLICY IF EXISTS admins_manage_blocked_ips ON blocked_ips;
DROP POLICY IF EXISTS blocked_ips_super_admin ON blocked_ips;
CREATE POLICY blocked_ips_super_admin ON blocked_ips FOR SELECT USING (public.es_super_admin());

-- Helper obsoleto de una versión previa de esta migración (ya nadie lo referencia).
DROP FUNCTION IF EXISTS public.mis_consorcios();
