// =============================================================================
// API: Unidades - GET list / POST create
// =============================================================================
import { createClient } from '@/lib/supabase/server';
import { requireUsuario, ROLES_GESTION } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';

// GET: List unidades (RLS filtra por tenant)
export async function GET(request: Request) {
  try {
    const auth = await requireUsuario(ROLES_GESTION);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const listMode = searchParams.get('list') === 'true';

    const supabase = await createClient();

    if (listMode) {
      const { data, error } = await supabase
        .from('unidades')
        .select(`id, numero, piso, edificios:edificios (id, nombre)`)
        .order('piso')
        .order('numero');

      if (error) {
        logger.error('Error listing unidades', error);
        return Response.json({ success: false, error: 'No se pudieron listar las unidades' }, { status: 500 });
      }

      const formatted = (data || []).map((u: Record<string, unknown>) => ({
        id: u.id,
        numero: u.numero,
        piso: u.piso,
        edificio_nombre:
          (u.edificios as { nombre?: string } | null)?.nombre || 'Sin edificio',
      }));

      return Response.json({ success: true, data: formatted });
    }

    const { data, error } = await supabase
      .from('unidades')
      .select('*')
      .order('piso')
      .order('numero');

    if (error) {
      logger.error('Error listing unidades', error);
      return Response.json({ success: false, error: 'No se pudieron listar las unidades' }, { status: 500 });
    }

    return Response.json({ success: true, data: data || [] });
  } catch (err: unknown) {
    logger.error('Exception listing unidades', err);
    return Response.json({ success: false, error: err instanceof Error ? err.message : 'Error interno' }, { status: 500 });
  }
}

// POST: Create Unidad
export async function POST(request: Request) {
  try {
    const auth = await requireUsuario(ROLES_GESTION);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { building_id, numero, piso, tipo, coeficiente, es_especial, habitada } = body;

    if (!building_id || !numero) {
      return Response.json({
        success: false,
        error: 'building_id y numero son obligatorios'
      }, { status: 400 });
    }

    const supabase = await createClient();

    // administradora_id / consorcio_id los pone el trigger desde el edificio.
    const { data, error } = await supabase
      .from('unidades')
      .insert({
        building_id,
        numero,
        piso: piso || 0,
        tipo: tipo || 'depto',
        coeficiente: coeficiente || 1.0,
        es_especial: es_especial || false,
        habitada: habitada || false,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating unidad', error);
      return Response.json({ success: false, error: 'No se pudo crear la unidad' }, { status: 500 });
    }

    logger.info('Created unidad', { id: data.id });

    const { data: edificio } = await supabase
      .from('edificios')
      .select('consortium_id')
      .eq('id', building_id)
      .single();
    if (edificio) revalidatePath(`/consorcios/${edificio.consortium_id}`);
    revalidatePath('/unidades');

    return Response.json({ success: true, data });
  } catch (err: unknown) {
    logger.error('Exception creating unidad', err);
    return Response.json({
      success: false,
      error: err instanceof Error ? err.message : 'Error interno'
    }, { status: 500 });
  }
}
