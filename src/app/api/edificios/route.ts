// =============================================================================
// API: Edificios - List and Create
// =============================================================================
import { createSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';

// =============================================================================
// GET: List all Edificios with Consortium info
// =============================================================================
export async function GET() {
  try {
    const supabase = createSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('edificios')
      .select(`
        id,
        nombre,
        direccion,
        pisos,
        unidades_por_piso,
        consortium_id,
        consortium:consorcios(id, nombre, direccion)
      `)
      .order('nombre');
    
    if (error) {
      logger.error('Error fetching edificios', error);
      return Response.json({ 
        success: false, 
        error: error.message 
      }, { status: 500 });
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

// =============================================================================
// POST: Create Edificio
// =============================================================================
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nombre, direccion, pisos, unidades_por_piso, consortium_id } = body;
    
    
    if (!nombre || !consortium_id) {
      return Response.json({ 
        success: false, 
        error: 'Nombre y consortium_id son obligatorios' 
      }, { status: 400 });
    }
    
    const supabase = createSupabaseAdmin();
    
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
      return Response.json({ 
        success: false, 
        error: error.message 
      }, { status: 500 });
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