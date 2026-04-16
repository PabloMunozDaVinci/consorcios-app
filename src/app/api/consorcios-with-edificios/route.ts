// =============================================================================
// API: Get Consorcios with Edificios and Unidades
// =============================================================================
import { createSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const supabase = createSupabaseAdmin();
    
    // Get all consorcios with their buildings and units
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
      return Response.json({ 
        success: false, 
        error: error.message 
      }, { status: 500 });
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