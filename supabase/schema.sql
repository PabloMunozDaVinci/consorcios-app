-- =============================================================================
-- SCHEMA: CONSORCIOS APP - Supabase PostgreSQL
-- =============================================================================
-- Administración de Edificios y Consorcios
-- Zero-Cost Stack: Supabase (PostgreSQL, Auth, Storage) + Resend + GitHub Actions

-- =============================================================================
-- 1. ENUMS
-- =============================================================================

CREATE TYPE tipo_unidad AS ENUM ('depto', 'cochera', 'baulera');

CREATE TYPE estado_mora AS ENUM (
  'al_dia',
  'deudor',
  'apto_carta',
  'inicio_juicio',
  'juicio_en_curso'
);

CREATE TYPE estado_arreglo AS ENUM (
  'pendiente',
  'aprobado',
  'en_progreso',
  'completado',
  'cancelado'
);

-- =============================================================================
-- 2. TABLAS PRINCIPALES
-- =============================================================================

-- consorcios
CREATE TABLE consorcios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(255) NOT NULL,
  direccion TEXT NOT NULL,
  codigo_postal VARCHAR(10),
  ciudad VARCHAR(100),
  provincia VARCHAR(100) DEFAULT 'CABA',
  email_admin TEXT,
  telefono VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- edificios
CREATE TABLE edificios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consortium_id UUID NOT NULL REFERENCES consorcios(id) ON DELETE CASCADE,
  nombre VARCHAR(255),
  direccion TEXT,
  pisos INTEGER DEFAULT 1,
  unidades_por_piso INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- unidades
CREATE TABLE unidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES edificios(id) ON DELETE CASCADE,
  numero VARCHAR(20) NOT NULL,
  piso INTEGER NOT NULL DEFAULT 0,
  tipo tipo_unidad NOT NULL DEFAULT 'depto',
  coeficiente DECIMAL(5,4) DEFAULT 1.0,
  es_especial BOOLEAN DEFAULT FALSE,
  metros_cuadrados DECIMAL(8,2),
  habitada BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_unidad_por_edificio UNIQUE (building_id, numero)
);

-- propietarios
CREATE TABLE propietarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidad_id UUID NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  dni VARCHAR(20) NOT NULL,
  email VARCHAR(255) NOT NULL,
  telefono VARCHAR(20),
  celular VARCHAR(20),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  es_dueño_principal BOOLEAN DEFAULT TRUE,
  porcentaje_propiedad DECIMAL(5,2) DEFAULT 100.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_propietario_por_unidad UNIQUE (unidad_id)
);

-- pagos
CREATE TABLE pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidad_id UUID NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  propietario_id UUID NOT NULL REFERENCES propietarios(id) ON DELETE CASCADE,
  monto DECIMAL(12,2) NOT NULL,
  mes_pagado DATE NOT NULL,
  fecha_pago DATE DEFAULT CURRENT_DATE,
  medio_pago VARCHAR(50),
  nro_comprobante VARCHAR(100),
  estado VARCHAR(20) DEFAULT 'confirmado',
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- arreglos
CREATE TABLE arreglos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidad_id UUID REFERENCES unidades(id) ON DELETE SET NULL,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,
  estado estado_arreglo DEFAULT 'pendiente',
  prioridad VARCHAR(20) DEFAULT 'media',
  fecha_solicitud TIMESTAMPTZ DEFAULT NOW(),
  fecha_aprobacion TIMESTAMPTZ,
  fecha_inicio TIMESTAMPTZ,
  fecha_completado TIMESTAMPTZ,
  presupuesto DECIMAL(12,2),
  costo_real DECIMAL(12,2),
  es_area_comun BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- mora_logs
CREATE TABLE mora_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidad_id UUID NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  propietario_id UUID NOT NULL REFERENCES propietarios(id) ON DELETE CASCADE,
  estado_anterior estado_mora,
  estado_nuevo estado_mora NOT NULL,
  motivo TEXT,
  meses_deuda INTEGER DEFAULT 0,
  monto_deuda DECIMAL(12,2) DEFAULT 0,
  observaciones TEXT,
  email_enviado BOOLEAN DEFAULT FALSE,
  fecha_email TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 3. ÍNDICES
-- =============================================================================

CREATE INDEX idx_propietarios_search ON propietarios 
  USING GIN (to_tsvector('spanish', nombre || ' ' || apellido || ' ' || COALESCE(dni, '')));

CREATE INDEX idx_unidades_edificio ON unidades (building_id, piso, numero);
CREATE INDEX idx_mora_fecha ON mora_logs (created_at DESC);
CREATE INDEX idx_pagos_mes ON pagos (mes_pagado);

-- =============================================================================
-- 4. FUNCIONES
-- =============================================================================

-- get_saldo_deudor
CREATE OR REPLACE FUNCTION get_saldo_deudor(p_unidad_id UUID)
RETURNS TABLE(
  meses_atrasados INTEGER,
  monto_total DECIMAL(12,2),
  ultimo_mes_pagado DATE,
  es_mora BOOLEAN
) AS $$
DECLARE
  v_meses_atrasados INTEGER := 0;
  v_monto_total DECIMAL(12,2) := 0;
  v_ultimo_mes DATE;
  v_es_mora BOOLEAN := FALSE;
BEGIN
  SELECT MAX(mes_pagado) INTO v_ultimo_mes
  FROM pagos
  WHERE unidad_id = p_unidad_id AND estado = 'confirmado';
  
  IF v_ultimo_mes IS NULL THEN
    v_ultimo_mes := CURRENT_DATE - INTERVAL '12 months';
  END IF;
  
  v_meses_atrasados := MIN(12, EXTRACT(MONTH FROM AGE(CURRENT_DATE, v_ultimo_mes))::INTEGER);
  v_monto_total := v_meses_atrasados * 150000 * 1.20;
  v_es_mora := v_meses_atrasados >= 3;
  
  RETURN QUERY SELECT v_meses_atrasados, v_monto_total, v_ultimo_mes, v_es_mora;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- evaluar_y_actualizar_mora
CREATE OR REPLACE FUNCTION evaluar_y_actualizar_mora()
RETURNS VOID AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 5. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE consorcios ENABLE ROW LEVEL SECURITY;
ALTER TABLE edificios ENABLE ROW LEVEL SECURITY;
ALTER TABLE unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE propietarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE arreglos ENABLE ROW LEVEL SECURITY;
ALTER TABLE mora_logs ENABLE ROW LEVEL SECURITY;

-- Propietarios ven solo SU unidad
CREATE POLICY "propietarios_ven_su_unidad"
ON propietarios FOR SELECT
USING (auth.uid() = auth_user_id);

-- Unidades
CREATE POLICY "unidades_propietario"
ON unidades FOR SELECT
USING (
  EXISTS (SELECT 1 FROM propietarios p WHERE p.unidad_id = unidades.id AND p.auth_user_id = auth.uid())
);

-- Pagos
CREATE POLICY "pagos_propietario"
ON pagos FOR SELECT
USING (
  propietario_id IN (SELECT id FROM propietarios WHERE auth_user_id = auth.uid())
);

-- Arreglos
CREATE POLICY "arreglos_all_read"
ON arreglos FOR SELECT USING (TRUE);

CREATE POLICY "arreglos_admin_insert"
ON arreglos FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "arreglos_admin_update"
ON arreglos FOR UPDATE
USING (EXISTS (SELECT 1 FROM consorcios c WHERE c.email_admin = auth.jwt()->>'email'));

-- =============================================================================
-- 6. STORAGE
-- =============================================================================

-- Crear bucket para mantenimiento (solo id, name, public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('mantenimiento', 'mantenimiento', true)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 7. SEED DATA
-- =============================================================================

INSERT INTO consorcios (nombre, direccion, ciudad, email_admin)
VALUES 
  ('Consorcio Torre Centro', 'Av. Corrientes 1234', 'CABA', 'admin@consorcio.com'),
  ('Consorcio Los Arales', 'Los Arales 456', 'CABA', 'admin@consorcio.com')
ON CONFLICT DO NOTHING;