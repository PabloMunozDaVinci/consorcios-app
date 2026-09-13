// =============================================================================
// SUPABASE: insert en tablas cuyo administradora_id/consorcio_id completa
// el trigger set_tenant_cols() (supabase/migrations/002_multitenant.sql)
// =============================================================================
// edificios, unidades, propietarios, pagos, mora_logs y arreglos derivan su
// tenant de la fila padre (consorcio/edificio/unidad), NO de lo que mande el
// cliente: el trigger BEFORE INSERT los recalcula siempre a partir del FK
// (unidades: siempre; el resto: cuando el unidad_id/building_id está
// presente, que es siempre en estos flujos — ver la migración). Ese
// recálculo corre ANTES de que RLS evalúe el WITH CHECK, así que aunque acá
// pasemos cualquier string con el shape correcto, lo que termina en la fila
// es el valor real derivado del padre — nunca lo que mandamos nosotros.
//
// El tipo `Insert` generado por `supabase gen types` marca esas columnas
// como requeridas porque no sabe del trigger. Estos wrappers concentran el
// cast (documentado) en un solo lugar tipado por tabla: quien los usa manda
// todo MENOS administradora_id/consorcio_id, y el resto de los campos se
// sigue verificando contra el `Insert` real (typos, campos faltantes, tipos
// de enum, etc. siguen dando error de tsc).
//
// (Nota: se probó un único helper genérico `insertTenantDerived<T>` en vez
// de seis funciones — la inferencia de tipos de `supabase-js` para
// `.from(table).insert(...)` con `table` como type param genérico no
// resuelve bien el overload y termina comparando contra la unión de TODAS
// las tablas. Seis funciones concretas evitan ese problema.)
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

type Tables = Database['public']['Tables'];
type Client = SupabaseClient<Database>;

export type EdificioInsert = Omit<Tables['edificios']['Insert'], 'administradora_id'>;
export function insertEdificio(supabase: Client, values: EdificioInsert) {
  return supabase.from('edificios').insert(values as Tables['edificios']['Insert']);
}

export type UnidadInsert = Omit<Tables['unidades']['Insert'], 'administradora_id' | 'consorcio_id'>;
export function insertUnidad(supabase: Client, values: UnidadInsert) {
  return supabase.from('unidades').insert(values as Tables['unidades']['Insert']);
}

export type PropietarioInsert = Omit<Tables['propietarios']['Insert'], 'administradora_id'>;
export function insertPropietario(supabase: Client, values: PropietarioInsert) {
  return supabase.from('propietarios').insert(values as Tables['propietarios']['Insert']);
}

/** Igual que insertPropietario, pero upsert por unidad_id (una unidad = un propietario, unique_propietario_por_unidad). Usado por el importador de padrón para reimportar sin duplicar. */
export function upsertPropietario(supabase: Client, values: PropietarioInsert) {
  return supabase
    .from('propietarios')
    .upsert(values as Tables['propietarios']['Insert'], { onConflict: 'unidad_id' });
}

export type PagoInsert = Omit<Tables['pagos']['Insert'], 'administradora_id'>;
export function insertPago(supabase: Client, values: PagoInsert) {
  return supabase.from('pagos').insert(values as Tables['pagos']['Insert']);
}

export type MoraLogInsert = Omit<Tables['mora_logs']['Insert'], 'administradora_id'>;
export function insertMoraLog(supabase: Client, values: MoraLogInsert) {
  return supabase.from('mora_logs').insert(values as Tables['mora_logs']['Insert']);
}

export type ArregloInsert = Omit<Tables['arreglos']['Insert'], 'administradora_id'>;
export function insertArreglo(supabase: Client, values: ArregloInsert) {
  return supabase.from('arreglos').insert(values as Tables['arreglos']['Insert']);
}

// cuenta_corriente (007_fase1_cuenta_corriente.sql): administradora_id y
// consorcio_id se derivan de unidades vía unidad_id, igual que unidades.
export type CuentaCorrienteInsert = Omit<Tables['cuenta_corriente']['Insert'], 'administradora_id' | 'consorcio_id'>;
export function insertCuentaCorriente(supabase: Client, values: CuentaCorrienteInsert | CuentaCorrienteInsert[]) {
  return supabase.from('cuenta_corriente').insert(values as Tables['cuenta_corriente']['Insert'][]);
}

// importaciones (008_fase1_fixes_auditoria.sql): administradora_id y
// consorcio_id se derivan de edificios vía edificio_id, igual que edificios
// deriva el suyo de consorcios. (En la 007 esta tabla no tenía edificio_id y
// los mandaba la aplicación directo; la auditoría encontró que eso permitía
// un edificio_id y un consorcio_id inconsistentes entre sí, así que se
// agregó el FK y se pasó al mismo patrón que el resto.)
export type ImportacionInsert = Omit<Tables['importaciones']['Insert'], 'administradora_id' | 'consorcio_id'>;
export function insertImportacion(supabase: Client, values: ImportacionInsert) {
  return supabase.from('importaciones').insert(values as Tables['importaciones']['Insert']);
}
