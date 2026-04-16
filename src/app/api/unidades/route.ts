// =============================================================================
// API: Unidades - GET list / POST create
// =============================================================================
import { createSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';

// GET: List unidades for dropdown
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const listMode = searchParams.get('list') === 'true';
    
    const supabase = createSupabaseAdmin();
    
    if (listMode) {
      // Get unidades with edificio info
      const { data, error } = await supabase
        .from('unidades')
        .select(`
          id,
          numero,
          piso,
          edificios:edificios (
            id,
            nombre
          )
        `)
        .order('piso')
        .order('numero');
      
      if (error) {
        logger.error('Error listing unidades', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
      }
      
      // @ts-ignore - Supabase relation typing
      const formatted = (data || []).map((u: any) => ({
        id: u.id,
        numero: u.numero,
        piso: u.piso,
        edificio_nombre: u.edificios?.nombre || 'Sin edificio',
      }));
      
      return Response.json({ success: true, data: formatted });
    }
    
    // Default: return all unidades
    const { data, error } = await supabase
      .from('unidades')
      .select('*')
      .order('piso')
      .order('numero');
    
    if (error) {
      logger.error('Error listing unidades', error);
      return Response.json({ success: false, error: error.message }, { status: 500 });
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
    const body = await request.json();
    const { building_id, numero, piso, tipo, coeficiente, es_especial, habitada } = body;
    
    logger.debug('Create Unidad request', body);
    
    if (!building_id || !numero) {
      return Response.json({ 
        success: false, 
        error: 'building_id y numero son obligatorios' 
      }, { status: 400 });
    }
    
    const supabase = createSupabaseAdmin();
    
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
      return Response.json({ 
        success: false, 
        error: error.message 
      }, { status: 500 });
    }
    
    logger.info('Created unidad', { id: data.id });
    
    // Revalidar la página del edificio
    const { data: edificio } = await supabase.from('edificios').select('consortium_id').eq('id', building_id).single();
    if (edificio) {
      revalidatePath(`/consorcios/${edificio.consortium_id}`);
    }
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