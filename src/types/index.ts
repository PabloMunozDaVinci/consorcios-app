// =============================================================================
// TYPES: Consorcios App - TypeScript Definitions
// =============================================================================

// ---- Enums (mapeados desde SQL) ----
export type TipoUnidad = 'depto' | 'cochera' | 'baulera';
export type EstadoMora = 'al_dia' | 'deudor' | 'apto_carta' | 'inicio_juicio' | 'juicio_en_curso';
export type EstadoArreglo = 'pendiente' | 'aprobado' | 'en_progreso' | 'completado' | 'cancelado';

// ---- Database Tables ----

export interface Unidad {
  id: string;
  building_id: string;
  numero: string;
  piso: number;
  tipo: TipoUnidad;
  coeficiente: number;
  es_especial: boolean;
  metros_cuadrados?: number;
  habitada: boolean;
  created_at: string;
  updated_at: string;
}

export interface Edificio {
  id: string;
  consortium_id: string;
  nombre?: string;
  direccion?: string;
  pisos?: number;
  unidades_por_piso?: number;
  created_at: string;
  updated_at: string;
}

export interface Consortium {
  id: string;
  nombre: string;
  direccion: string;
  codigo_postal?: string;
  ciudad?: string;
  provincia?: string;
  email_admin?: string;
  telefono?: string;
  created_at: string;
  updated_at: string;
}

export interface Owner {
  id: string;
  unidad_id: string;
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  telefono?: string;
  celular?: string;
  auth_user_id?: string;
  es_dueño_principal: boolean;
  porcentaje_propiedad: number;
  created_at: string;
  updated_at: string;
}

export interface Pago {
  id: string;
  unidad_id: string;
  propietario_id: string;
  monto: number;
  mes_pagado: string;
  fecha_pago: string;
  medio_pago?: string;
  nro_comprobante?: string;
  estado: 'confirmado' | 'pendiente' | 'rechazado';
  validated_by?: string;
  validated_at?: string;
  created_at: string;
}

export interface Arreglo {
  id: string;
  unidad_id?: string;
  titulo: string;
  descripcion?: string;
  estado: EstadoArreglo;
  prioridad: 'baja' | 'media' | 'alta' | 'urgente';
  fecha_solicitud: string;
  fecha_aprobacion?: string;
  fecha_inicio?: string;
  fecha_completado?: string;
  presupuesto?: number;
  costo_real?: number;
  es_area_comun: boolean;
  created_at: string;
  updated_at: string;
}

export interface MoraLog {
  id: string;
  unidad_id: string;
  propietario_id: string;
  estado_anterior?: EstadoMora;
  estado_nuevo: EstadoMora;
  motivo?: string;
  meses_deuda: number;
  monto_deuda: number;
  observaciones?: string;
  email_enviado: boolean;
  fecha_email?: string;
  created_at: string;
}

// ---- Computed Types ----

export interface SaldoDeudor {
  meses_atrasados: number;
  monto_total: number;
  ultimo_mes_pagado: string;
  es_mora: boolean;
}

// ---- Search Types ----

export interface SearchResult {
  type: 'propietario' | 'unidad' | 'consorcio';
  id: string;
  title: string;
  subtitle: string;
  url: string;
}

// ---- Form Types ----

export interface PagoFormData {
  monto: number;
  mes_pagado: string;
  medio_pago: string;
  nro_comprobante?: string;
}

export interface ArregloFormData {
  unidad_id?: string;
  titulo: string;
  descripcion?: string;
  prioridad: 'baja' | 'media' | 'alta' | 'urgente';
  presupuesto?: number;
  es_area_comun: boolean;
  fotos?: File[];
}

// ---- API Response Types ----

export interface ActionResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}