// =============================================================================
// API: Edificios - List and Create
// =============================================================================
import { createClient } from '@/lib/supabase/server';
import { requireUsuario, ROLES_GESTION } from '@/lib/auth';
import { createEdificioSchema, validateInput, badRequest } from '@/lib/sanitize';
import { logger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';

// GET: edificios visibles para el usuario (RLS filtra por tenant)
export async function GET() {
  try {
    const auth = await requireUsuario(ROLES_GESTION);
    if (!auth.ok) return auth.response;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('edificios')
      .select(`
        id, nombre, direccion, pisos, unidades_por_piso, consortium_id,
        consortium:consorcios(id, nombre, direccion)
      `)
      .order('nombre');

    if (error) {
      logger.error('Error fetching edificios', error);
      return Response.json({ success: false, error: 'No se pudieron obtener los edificios' }, { status: 500 });
    }

    return Response.json({ success: true, data: data || [] });
  } catch (err: unknown) {
    logger.error('Exception fetching edificios', err);
    return Response.json({
      success: false,
      error: err instanceof Error ? err.message : 'Error interno'
    }, { status: 500 });
  }
}

// POST: Create Edificio
export async function POST(request: Request) {
  try {
    const auth = await requireUsuario(ROLES_GESTION);
    if (!auth.ok) return auth.response;

    const parsed = validateInput(createEdificioSchema, await request.json());
    if (!parsed.ok) return badRequest(parsed.errors);
    const { nombre, direccion, pisos, unidades_por_piso, consortium_id } = parsed.data;

    const supabase = await createClient();

    // administradora_id lo pone el trigger set_tenant_cols desde el consorcio.
    // RLS (WITH CHECK) rechaza si el consorcio no es del tenant del usuario.
    const { data, error } = await supabase
      .from('edificios')
      .insert({
        consortium_id,
        nombre,
        direccion: direccion || null,
        pisos: pisos || 1,
        unidades_por_piso: unidades_por_piso || 1,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating edificio', error);
      return Response.json({ success: false, error: 'No se pudo crear el edificio' }, { status: 500 });
    }

    logger.info('Created edificio', { id: data.id });
    revalidatePath(`/consorcios/${consortium_id}`);

    return Response.json({ success: true, data });
  } catch (err: unknown) {
    logger.error('Exception creating edificio', err);
    return Response.json({
      success: false,
      error: err instanceof Error ? err.message : 'Error interno'
    }, { status: 500 });
  }
}
