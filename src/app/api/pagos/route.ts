// =============================================================================
// API: Create Pago
// =============================================================================
import { createClient } from '@/lib/supabase/server';
import { insertPago, insertCuentaCorriente } from '@/lib/supabase/tenant-insert';
import { requireUsuario, ROLES_GESTION } from '@/lib/auth';
import { createPagoSchema, validateInput, badRequest } from '@/lib/sanitize';
import { periodoMasAntiguoPendiente } from '@/lib/importador/aging';
import { logger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';

export async function POST(request: Request) {
  try {
    const auth = await requireUsuario(ROLES_GESTION);
    if (!auth.ok) return auth.response;

    const parsed = validateInput(createPagoSchema, await request.json());
    if (!parsed.ok) return badRequest(parsed.errors);
    const { unidad_id, monto, mes_pagado, medio_pago, nro_comprobante, imputar_mas_antiguo } = parsed.data;

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

    // Fase 1.4: el pago también se imputa como crédito en cuenta_corriente.
    // Por defecto al período declarado (mes_pagado); si imputar_mas_antiguo,
    // al período más viejo que todavía tenga saldo pendiente.
    let periodoImputado = mesCompleto;
    if (imputar_mas_antiguo) {
      const { data: debitos } = await supabase
        .from('cuenta_corriente')
        .select('periodo, importe')
        .eq('unidad_id', unidad_id)
        .eq('tipo', 'debito');
      const { data: creditos } = await supabase
        .from('cuenta_corriente')
        .select('importe')
        .eq('unidad_id', unidad_id)
        .eq('tipo', 'credito');

      if (debitos && debitos.length > 0) {
        const debitosPorPeriodo = new Map<string, number>();
        for (const d of debitos) {
          debitosPorPeriodo.set(d.periodo, (debitosPorPeriodo.get(d.periodo) || 0) + Number(d.importe));
        }
        const totalCreditos = (creditos || []).reduce((acc, c) => acc + Number(c.importe), 0);
        const periodoEncontrado = periodoMasAntiguoPendiente(
          Array.from(debitosPorPeriodo, ([periodo, importe]) => ({ periodo, importe })),
          totalCreditos
        );
        if (periodoEncontrado) periodoImputado = periodoEncontrado;
      }
    }

    const { error: errorCredito } = await insertCuentaCorriente(supabase, {
      unidad_id,
      fecha: new Date().toISOString().slice(0, 10),
      tipo: 'credito',
      concepto: 'Pago recibido',
      importe: monto,
      periodo: periodoImputado,
      origen: 'pago',
      pago_id: data.id,
    });
    if (errorCredito) {
      // El pago ya quedó registrado (tabla pagos, Fase 0) — no lo revertimos
      // por un error acá, pero sí lo logueamos fuerte: significa que el saldo
      // de cuenta_corriente va a quedar desactualizado hasta que se corrija a mano.
      logger.error('Pago creado pero falló el crédito en cuenta_corriente', errorCredito, { pago_id: data.id });
    }

    revalidatePath('/pagos');
    revalidatePath(`/unidades/${unidad_id}`);

    return Response.json({ success: true, data });
  } catch (err: unknown) {
    logger.error('Exception creating pago', err);
    return Response.json({ success: false, error: err instanceof Error ? err.message : 'Error interno' }, { status: 500 });
  }
}
