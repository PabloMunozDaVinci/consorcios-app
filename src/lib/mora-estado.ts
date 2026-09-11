// =============================================================================
// LIB: mora-estado — máquina de estados de mora por umbral de meses atrasados
// =============================================================================
// Extraída de `src/actions/mora.ts` para poder testearla sin la DB: ese archivo
// tiene `'use server'` al tope, y ahí sólo pueden vivir funciones async
// exportadas (todo export de un archivo 'use server' se trata como Server
// Function) — una constante u una función sync exportada rompería el build.
//
// Los umbrales hoy son fijos (3 / 6 / 12 meses); la Fase 3 del ROADMAP los
// vuelve configurables por consorcio. Por eso viajan como parámetro con
// default, no hardcodeados en el cuerpo de la función.
import type { EstadoMora } from '@/types';

export const UMBRALES_MORA_DEFAULT = {
  apto_carta: 3,
  inicio_juicio: 6,
  juicio_en_curso: 12,
} as const;

export type UmbralesMora = {
  apto_carta: number;
  inicio_juicio: number;
  juicio_en_curso: number;
};

/**
 * Estado de mora según meses atrasados, dado un set de umbrales.
 *
 * Nota de dominio: en `evaluarYEnviarMora` esta función sólo se invoca para
 * unidades que `get_saldo_deudor` ya marcó `es_mora` (meses_atrasados >= 3
 * hoy), así que en la práctica actual nunca se le pasa un valor por debajo
 * del umbral de `apto_carta` — el piso de esta función es 'deudor', nunca
 * 'al_dia'. El estado 'al_dia' (y los umbrales 0-2 meses) sólo existen hoy en
 * la función SQL `evaluar_y_actualizar_mora` (supabase/migrations/001_bloque0_arranque.sql),
 * que no se invoca desde la app.
 */
export function estadoPorMesesAtrasados(
  mesesAtrasados: number,
  umbrales: UmbralesMora = UMBRALES_MORA_DEFAULT
): EstadoMora {
  if (mesesAtrasados >= umbrales.juicio_en_curso) return 'juicio_en_curso';
  if (mesesAtrasados >= umbrales.inicio_juicio) return 'inicio_juicio';
  if (mesesAtrasados >= umbrales.apto_carta) return 'apto_carta';
  return 'deudor';
}
