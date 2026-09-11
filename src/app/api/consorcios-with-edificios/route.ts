// =============================================================================
// API: Get Consorcios with Edificios and Unidades
// =============================================================================
import { createClient } from '@/lib/supabase/server';
import { requireUsuario, ROLES_GESTION } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const auth = await requireUsuario(ROLES_GESTION);
    if (!auth.ok) return auth.response;

    const supabase = await createClient();

    const { data: consorcios, error } = await supabase
      .from('consorcios')
      .select(`
        id,
        nombre,
        edificios (
          id,
          nombre,
          unidades (id, numero, piso)
        )
      `)
      .order('nombre');

    if (error) {
      logger.error('Error fetching consorcios with buildings', error);
      return Response.json({ success: false, error: 'No se pudieron obtener los consorcios' }, { status: 500 });
    }

    return Response.json({ success: true, data: consorcios });
  } catch (err: unknown) {
    logger.error('Exception fetching consorcios', err);
    return Response.json({
      success: false,
      error: err instanceof Error ? err.message : 'Error interno'
    }, { status: 500 });
  }
}
