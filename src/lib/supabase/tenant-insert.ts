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
