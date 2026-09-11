// =============================================================================
// API: Create Consortium
// =============================================================================
import { createClient } from '@/lib/supabase/server';
import { requireUsuario, ROLES_GESTION } from '@/lib/auth';
import { createConsorcioSchema, validateInput, badRequest } from '@/lib/sanitize';
import { logger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';

export async function POST(request: Request) {
  try {
    const auth = await requireUsuario(ROLES_GESTION);
    if (!auth.ok) return auth.response;

    const parsed = validateInput(createConsorcioSchema, await request.json());
    if (!parsed.ok) return badRequest(parsed.errors);
    const { nombre, direccion, ciudad, email_admin, telefono } = parsed.data;

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
