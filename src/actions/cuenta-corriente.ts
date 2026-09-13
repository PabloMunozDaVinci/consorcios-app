'use server';

// =============================================================================
// ACTIONS: Cuenta Corriente - lectura de saldo y movimientos (ROADMAP Fase 1.2)
// =============================================================================
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import type { ActionResponse } from '@/types';
import type { Database } from '@/types/database.types';

type CuentaCorrienteRow = Database['public']['Tables']['cuenta_corriente']['Row'];

export interface SaldoUnidad {
  meses_atrasados: number;
  monto_total: number;
  ultimo_mes_pagado: string | null;
  es_mora: boolean;
}

export interface CuentaCorrienteUnidad {
  saldo: SaldoUnidad;
  movimientos: CuentaCorrienteRow[];
}

/** Saldo (aging FIFO, ver get_saldo_deudor en 007) + movimientos de una unidad, más recientes primero. */
export async function getCuentaCorriente(unidadId: string): Promise<ActionResponse<CuentaCorrienteUnidad>> {
  try {
    const supabase = await createClient();

    const { data: saldoRows, error: errorSaldo } = await supabase.rpc('get_saldo_deudor', {
      p_unidad_id: unidadId,
    });

    if (errorSaldo) {
      logger.error('Error getCuentaCorriente (saldo):', errorSaldo);
      return { success: false, error: 'No se pudo obtener el saldo' };
    }

    const { data: movimientos, error: errorMovimientos } = await supabase
      .from('cuenta_corriente')
      .select('*')
      .eq('unidad_id', unidadId)
      .order('periodo', { ascending: false })
      .order('created_at', { ascending: false });

    if (errorMovimientos) {
      logger.error('Error getCuentaCorriente (movimientos):', errorMovimientos);
      return { success: false, error: 'No se pudo obtener los movimientos' };
    }

    const saldo = saldoRows?.[0] ?? {
      meses_atrasados: 0,
      monto_total: 0,
      ultimo_mes_pagado: null,
      es_mora: false,
    };

    return { success: true, data: { saldo, movimientos: movimientos || [] } };
  } catch (error) {
    logger.error('Error getCuentaCorriente:', error);
    return { success: false, error: 'Error interno' };
  }
}
