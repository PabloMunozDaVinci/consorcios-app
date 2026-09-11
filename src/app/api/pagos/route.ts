// =============================================================================
// API: Create Pago
// =============================================================================
import { createClient } from '@/lib/supabase/server';
import { insertPago } from '@/lib/supabase/tenant-insert';
import { requireUsuario, ROLES_GESTION } from '@/lib/auth';
import { createPagoSchema, validateInput, badRequest } from '@/lib/sanitize';
import { logger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';

export async function POST(request: Request) {
  try {
    const auth = await requireUsuario(ROLES_GESTION);
    if (!auth.ok) return auth.response;

    const parsed = validateInput(createPagoSchema, await request.json());
    if (!parsed.ok) return badRequest(parsed.errors);
    const { unidad_id, monto, mes_pagado, medio_pago, nro_comprobante } = parsed.data;

    const supabase = await createClient();

    // Propietario de la unidad (pagos.propietario_id es NOT NULL en la DB viva).
    const { data: propietarios } = await supabase
      .from('propietarios')
      .select('id')
      .eq('unidad_id', unidad_id)
      .limit(1);

    const propietario_id = propietarios?.[0]?.id;
    if (!propietario_id) {
      return Response.json({
        success: false,
        error: 'La unidad no tiene propietario asignado. Asigná uno antes de registrar el pago.'
      }, { status: 400 });
    }

    const mesCompleto = `${mes_pagado}-01`;

    const { data, error } = await insertPago(supabase, {
      unidad_id,
      propietario_id,
      monto,
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
      return Response.json({ success: false, error: 'No se pudo registrar el pago' }, { status: 500 });
    }

    logger.info('Created pago', { id: data.id });
    revalidatePath('/pagos');

    return Response.json({ success: true, data });
  } catch (err: unknown) {
    logger.error('Exception creating pago', err);
    return Response.json({ success: false, error: err instanceof Error ? err.message : 'Error interno' }, { status: 500 });
  }
}
