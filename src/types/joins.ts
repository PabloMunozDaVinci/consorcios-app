// =============================================================================
// TYPES: formas de join usadas en los `select()` de src/actions/consorcios.ts
// =============================================================================
// Supabase no infiere el tipo de un embed sólo a partir del string de
// `.select()` con la certeza suficiente para los casos con alias/columnas
// parciales de este archivo — cada forma real que se usa se tipa acá a mano
// (ver PENDIENTES.md, ítem 33). La cardinalidad (array vs. objeto nullable)
// sigue la dirección real de la FK:
//   - edificios -> consorcios y unidades -> edificios son "muchos", van array.
//   - `propietario:propietarios(...)` visto DESDE unidades es la dirección
//     "hijo" de la FK (propietarios.unidad_id -> unidades.id): PostgREST lo
//     devuelve como ARRAY pese a que hay un índice único parcial en la
//     migración 001 que en la práctica limita a 0 o 1 fila (copropiedad real
//     es Fase 4) — confirmado empíricamente contra la DB real, un índice
//     único PARCIAL no alcanza para que Supabase lo detecte como one-to-one
//     (necesita una UNIQUE CONSTRAINT completa). `database.types.ts` (generado)
//     ya lo tipa como array; estos tipos siguen esa misma forma real.
//   - `propietario:propietarios(...)` visto DESDE pagos (pagos.propietario_id
//     -> propietarios.id) es la dirección "padre" de la FK: ahí sí es "uno".
//   - unidades -> pagos/arreglos (vía unidad_id) y unidades -> edificios (vía
//     building_id) son "uno" desde el lado que hace el select.
import type { Database } from './database.types';

type Tables = Database['public']['Tables'];
type ConsorcioRow = Tables['consorcios']['Row'];
type EdificioRow = Tables['edificios']['Row'];
type UnidadRow = Tables['unidades']['Row'];
type PropietarioRow = Tables['propietarios']['Row'];
type PagoRow = Tables['pagos']['Row'];
type ArregloRow = Tables['arreglos']['Row'];

// ---- getConsorcios: '*, edificios(*)' ----
export type ConsorcioConEdificios = ConsorcioRow & {
  edificios: EdificioRow[];
};

// ---- getConsorcio: '*, edificios(*, unidades(id))' ----
// La página de detalle (src/app/consorcios/[id]/page.tsx) necesita el total
// de unidades por consorcio; alcanza con el id de cada unidad para contarlas.
export type ConsorcioConEdificiosYUnidades = ConsorcioRow & {
  edificios: (EdificioRow & { unidades: Pick<UnidadRow, 'id'>[] })[];
};

// ---- getEdificios: '*, unidades(*)' ----
export type EdificioConUnidades = EdificioRow & {
  unidades: UnidadRow[];
};

// ---- getUnidades: '*, propietario:propietarios(*)' ----
export type UnidadConPropietario = UnidadRow & {
  propietario: PropietarioRow[];
};

// ---- getUnidad: '*, propietario:propietarios(*), edificio:edificios(*)' ----
export type UnidadConPropietarioYEdificio = UnidadRow & {
  propietario: PropietarioRow[];
  edificio: EdificioRow | null;
};

// ---- getAllUnidades: '*, propietario:propietarios(*), edificio:edificios(nombre, consortium_id)' ----
export type UnidadConPropietarioYEdificioResumen = UnidadRow & {
  propietario: PropietarioRow[];
  edificio: Pick<EdificioRow, 'nombre' | 'consortium_id'> | null;
};

// ---- getPagos: '*, propietario:propietarios(nombre, apellido)' ----
export type PagoConPropietario = PagoRow & {
  propietario: Pick<PropietarioRow, 'nombre' | 'apellido'> | null;
};

// ---- getAllPagos: '*, propietario:propietarios(nombre, apellido), unidad:unidades(numero)' ----
export type PagoConPropietarioYUnidad = PagoRow & {
  propietario: Pick<PropietarioRow, 'nombre' | 'apellido'> | null;
  unidad: Pick<UnidadRow, 'numero'> | null;
};

// ---- getArreglos: '*, unidad:unidades(numero)' ----
export type ArregloConUnidad = ArregloRow & {
  unidad: Pick<UnidadRow, 'numero'> | null;
};
