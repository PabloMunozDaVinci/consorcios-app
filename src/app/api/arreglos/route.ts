// =============================================================================
// API: Create Arreglo/Mantenimiento
// =============================================================================
import { createSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { titulo, descripcion, unidad_id, prioridad, presupuesto, es_area_comun } = body;
    
    logger.debug('Create Arreglo request', body);
    
    if (!titulo) {
      return Response.json({ 
        success: false, 
        error: 'El título es obligatorio' 
      }, { status: 400 });
    }
    
    const supabase = createSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('arreglos')
      .insert({
        titulo,
        descripcion: descripcion || null,
        unidad_id: unidad_id || null,
        prioridad: prioridad || 'media',
        presupuesto: presupuesto ? parseFloat(presupuesto) : null,
        es_area_comun: es_area_comun || false,
        estado: 'pendiente',
        fecha_solicitud: new Date().toISOString().split('T')[0],
      })
      .select()
      .single();
    
    if (error) {
      logger.error('Error creating arreglo', error);
      return Response.json({ 
        success: false, 
        error: error.message 
      }, { status: 500 });
    }
    
    logger.info('Created arreglo', { id: data.id });
    revalidatePath('/mantenimiento');
    
    return Response.json({ success: true, data });
  } catch (err: unknown) {
    logger.error('Exception creating arreglo', err);
    return Response.json({ success: false, error: err instanceof Error ? err.message : 'Error interno' }, { status: 500 });
  }
}
