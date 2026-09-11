// =============================================================================
// API: Create Consortium
// =============================================================================
import { createClient } from '@/lib/supabase/server';
import { requireUsuario, ROLES_GESTION } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';

export async function POST(request: Request) {
  try {
    const auth = await requireUsuario(ROLES_GESTION);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { nombre, direccion, ciudad, email_admin, telefono } = body;

    if (!nombre || !direccion) {
      return Response.json({
        success: false,
        error: 'Nombre y dirección son obligatorios'
      }, { status: 400 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('consorcios')
      .insert({
        nombre,
        direccion,
        ciudad: ciudad || 'CABA',
        email_admin: email_admin || null,
        telefono: telefono || null,
        administradora_id: auth.usuario.administradoraId,
      })
      .select()
      .single();

    if (error) {
      logger.error('Supabase error creating consortium', error);
      return Response.json({ success: false, error: 'No se pudo crear el consorcio' }, { status: 500 });
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
