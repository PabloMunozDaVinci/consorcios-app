// =============================================================================
// API: Create Arreglo/Mantenimiento
// =============================================================================
import { createClient } from '@/lib/supabase/server';
import { requireUsuario, ROLES_GESTION } from '@/lib/auth';
import { createArregloSchema, validateInput, badRequest } from '@/lib/sanitize';
import { logger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';

export async function POST(request: Request) {
  try {
    const auth = await requireUsuario(ROLES_GESTION);
    if (!auth.ok) return auth.response;

    const parsed = validateInput(createArregloSchema, await request.json());
    if (!parsed.ok) return badRequest(parsed.errors);
    const { titulo, descripcion, unidad_id, prioridad, presupuesto, es_area_comun } = parsed.data;

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('arreglos')
      .insert({
        titulo,
        descripcion: descripcion || null,
        unidad_id: unidad_id || null,
        prioridad: prioridad || 'media',
        presupuesto: presupuesto ?? null,
        es_area_comun: es_area_comun || false,
        estado: 'pendiente',
        fecha_solicitud: new Date().toISOString().split('T')[0],
        // arreglo con unidad: trigger pone administradora_id/consorcio_id.
        // área común (sin unidad): lo tomamos de la administradora del usuario.
        administradora_id: unidad_id ? undefined : auth.usuario.administradoraId,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating arreglo', error);
      return Response.json({ success: false, error: 'No se pudo crear el arreglo' }, { status: 500 });
    }

    logger.info('Created arreglo', { id: data.id });
    revalidatePath('/mantenimiento');

    return Response.json({ success: true, data });
  } catch (err: unknown) {
    logger.error('Exception creating arreglo', err);
    return Response.json({ success: false, error: err instanceof Error ? err.message : 'Error interno' }, { status: 500 });
  }
}
