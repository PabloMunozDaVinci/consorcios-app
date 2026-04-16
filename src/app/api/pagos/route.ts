// =============================================================================
// API: Create Pago
// =============================================================================
import { createSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { unidad_id, monto, mes_pagado, medio_pago, nro_comprobante } = body;
    
    logger.debug('Create Pago request', body);
    
    if (!unidad_id || !monto || !mes_pagado) {
      return Response.json({ 
        success: false, 
        error: 'Unidad, monto y mes son obligatorios' 
      }, { status: 400 });
    }
    
    const supabase = createSupabaseAdmin();
    
    const { data: propietarios } = await supabase
      .from('propietarios')
      .select('id')
      .eq('unidad_id', unidad_id)
      .limit(1);
    
    const propietario_id = propietarios?.[0]?.id || null;
    
    const { data, error } = await supabase
      .from('pagos')
      .insert({
        unidad_id,
        propietario_id,
        monto: parseFloat(monto),
        mes_pagado,
        fecha_pago: new Date().toISOString().split('T')[0],
        medio_pago: medio_pago || 'transferencia',
        nro_comprobante: nro_comprobante || null,
        estado: 'confirmado',
      })
      .select()
      .single();
    
    if (error) {
      logger.error('Error creating pago', error);
      return Response.json({ 
        success: false, 
        error: error.message 
      }, { status: 500 });
    }
    
    logger.info('Created pago', { id: data.id });
    revalidatePath('/pagos');
    
    return Response.json({ success: true, data });
  } catch (err: unknown) {
    logger.error('Exception creating pago', err);
    return Response.json({ success: false, error: err instanceof Error ? err.message : 'Error interno' }, { status: 500 });
  }
}
