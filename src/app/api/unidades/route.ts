// =============================================================================
// API: Create Unidad
// =============================================================================
import { createSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';

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