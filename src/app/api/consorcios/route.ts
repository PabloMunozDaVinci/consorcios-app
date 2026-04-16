// =============================================================================
// API: Create Consortium
// =============================================================================
import { createSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nombre, direccion, ciudad, email_admin, telefono } = body;
    
    logger.debug('Create Consortium request', body);
    
    if (!nombre || !direccion) {
      return Response.json({ 
        success: false, 
        error: 'Nombre y dirección son obligatorios' 
      }, { status: 400 });
    }
    
    const supabase = createSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('consorcios')
      .insert({
        nombre,
        direccion,
        ciudad: ciudad || 'CABA',
        email_admin: email_admin || null,
        telefono: telefono || null,
      })
      .select()
      .single();
    
    if (error) {
      logger.error('Supabase error creating consortium', error);
      return Response.json({ 
        success: false, 
        error: error.message 
      }, { status: 500 });
    }
    
    logger.info('Created consortium', { id: data.id });
    revalidatePath('/consorcios');
    revalidatePath('/');
    
    return Response.json({ success: true, data });
  } catch (err: unknown) {
    logger.error('Exception creating consortium', err);
    return Response.json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Error interno' 
    }, { status: 500 });
  }
}
