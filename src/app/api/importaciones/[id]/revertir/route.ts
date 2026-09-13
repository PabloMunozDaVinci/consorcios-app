// =============================================================================
// API: Importaciones - Revertir (ROADMAP Fase 1.3)
// =============================================================================
// Sólo para liquidaciones confirmadas: genera un contraasiento (crédito) por
// cada débito que generó la importación, y marca la importación como
// revertida. Nunca borra ni edita cuenta_corriente (es append-only, ver 007).
// El padrón no se revierte acá — crear/actualizar unidades y propietarios no
// es un movimiento de plata que tenga sentido "contraasentar"; si hace falta
// deshacerlo se edita a mano.
import { createClient } from '@/lib/supabase/server';
import { insertCuentaCorriente } from '@/lib/supabase/tenant-insert';
import { requireUsuario, ROLES_GESTION } from '@/lib/auth';
import { validateUUID } from '@/lib/sanitize';
import { logger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUsuario(ROLES_GESTION);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const importacionId = validateUUID(id);
    if (!importacionId) {
      return Response.json({ success: false, error: 'Id inválido' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: importacion, error: errorImportacion } = await supabase
      .from('importaciones')
      .select('id, tipo, estado')
      .eq('id', importacionId)
      .maybeSingle();

    if (errorImportacion || !importacion) {
      return Response.json({ success: false, error: 'Importación no encontrada' }, { status: 404 });
    }
    if (importacion.tipo !== 'liquidacion') {
      return Response.json({ success: false, error: 'Sólo se pueden revertir importaciones de liquidación' }, { status: 400 });
    }
    if (importacion.estado !== 'confirmada') {
      return Response.json({ success: false, error: `No se puede revertir una importación en estado "${importacion.estado}"` }, { status: 400 });
    }

    const { data: debitos, error: errorDebitos } = await supabase
      .from('cuenta_corriente')
      .select('id, unidad_id, importe, periodo, concepto')
      .eq('importacion_id', importacionId)
      .eq('tipo', 'debito');

    if (errorDebitos) {
      logger.error('Error leyendo débitos a revertir', errorDebitos);
      return Response.json({ success: false, error: 'No se pudieron leer los movimientos a revertir' }, { status: 500 });
    }

    if (debitos && debitos.length > 0) {
      const contraasientos = debitos.map((d) => ({
        unidad_id: d.unidad_id,
        fecha: new Date().toISOString().slice(0, 10),
        tipo: 'credito' as const,
        concepto: `Reversión: ${d.concepto}`,
        importe: d.importe,
        periodo: d.periodo,
        origen: 'ajuste' as const,
        contraasiento_de: d.id,
      }));
      const { error: errorInsert } = await insertCuentaCorriente(supabase, contraasientos);
      if (errorInsert) {
        // El UNIQUE sobre contraasiento_de (008_fase1_fixes_auditoria.sql)
        // hace que, si dos POST /revertir de la misma importación corren en
        // simultáneo, sólo uno pueda generar los contraasientos — el otro
        // cae acá. No es un error real, es la carrera resuelta a favor del
        // primero.
        if (errorInsert.code === '23505') {
          return Response.json(
            { success: false, error: 'Esta importación ya se está revirtiendo (o ya se revirtió) en otra solicitud.' },
            { status: 409 }
          );
        }
        logger.error('Error insertando contraasientos', errorInsert);
        return Response.json({ success: false, error: 'No se pudo revertir la importación' }, { status: 500 });
      }
    }

    // Condicionado a estado='confirmada' (no sólo `.eq('id', ...)`): si dos
    // reversiones llegaran a pasar ambas la lectura de arriba, sólo una
    // puede ganar este UPDATE — la otra recibe 0 filas actualizadas.
    const { data: actualizada } = await supabase
      .from('importaciones')
      .update({ estado: 'revertida', revertida_at: new Date().toISOString() })
      .eq('id', importacionId)
      .eq('estado', 'confirmada')
      .select('id')
      .maybeSingle();

    if (!actualizada) {
      return Response.json(
        { success: false, error: 'Esta importación ya se revirtió en otra solicitud.' },
        { status: 409 }
      );
    }

    revalidatePath('/unidades');
    revalidatePath('/admin/mora');
    revalidatePath('/importador');

    return Response.json({ success: true, data: { movimientos_revertidos: debitos?.length ?? 0 } });
  } catch (err: unknown) {
    logger.error('Exception revirtiendo importación', err);
    return Response.json({ success: false, error: err instanceof Error ? err.message : 'Error interno' }, { status: 500 });
  }
}
