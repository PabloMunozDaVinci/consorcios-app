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
    
    // Validación granular
    const errores: string[] = [];
    if (!unidad_id || unidad_id === '') errores.push('Selecciona una unidad');
    if (!monto || monto === '' || parseFloat(monto) <= 0) errores.push('Ingresa un monto válido');
    if (!mes_pagado || mes_pagado === '') errores.push('Selecciona el mes a pagar');
    
    if (errores.length > 0) {
      return Response.json({ 
        success: false, 
        error: errores.join('. ') 
      }, { status: 400 });
    }
    
    const supabase = createSupabaseAdmin();
    
    // Buscar propietario de la unidad
    const { data: propietarios } = await supabase
      .from('propietarios')
      .select('id')
      .eq('unidad_id', unidad_id)
      .limit(1);
    
    const propietario_id = propietarios?.[0]?.id;
    
    // Si no hay propietario, dar aviso pero permitir igual el pago
    if (!propietario_id) {
      logger.warn('Pago sin propietario asignado', { unidad_id });
    }
    
    // Convertir "YYYY-MM" a fecha completa "YYYY-MM-01"
    const mesCompleto = `${mes_pagado}-01`;
    
    const { data, error } = await supabase
      .from('pagos')
      .insert({
        unidad_id,
        propietario_id,
        monto: parseFloat(monto),
        mes_pagado: mesCompleto,
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
