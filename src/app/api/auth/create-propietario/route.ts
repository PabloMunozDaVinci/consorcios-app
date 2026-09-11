// =============================================================================
// API: Create Propietario (gateado por ADMIN_CREATE_SECRET)
// =============================================================================
// Crea auth user + fila en `propietarios` (con unidad) + fila en `usuarios`
// (rol propietario). El tenant se deriva de la unidad.
import { createAdminClient } from '@/lib/supabase/admin';
import { insertPropietario } from '@/lib/supabase/tenant-insert';
import { logger } from '@/lib/logger';
import { getAdminCreateSecret, secretMatches, generateTempPassword } from '@/lib/admin-secret';
import { createPropietarioSchema, validateInput, badRequest } from '@/lib/sanitize';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    if (!secretMatches(body?.secret, getAdminCreateSecret())) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = validateInput(createPropietarioSchema, body);
    if (!parsed.ok) return badRequest(parsed.errors);
    const { email, nombre, apellido, dni, telefono, unidad_id, sendInvitation } = parsed.data;

    const supabase = createAdminClient();

    // 1. Unidad + su administradora
    const { data: unidad, error: unidadError } = await supabase
      .from('unidades')
      .select('id, numero, piso, administradora_id')
      .eq('id', unidad_id)
      .single();
    if (unidadError || !unidad) {
      return Response.json({ success: false, error: 'La unidad no existe' }, { status: 400 });
    }

    // 2. Unidad libre
    const { data: existingProp } = await supabase
      .from('propietarios')
      .select('id, nombre, apellido')
      .eq('unidad_id', unidad_id)
      .maybeSingle();
    if (existingProp) {
      return Response.json({
        success: false,
        error: `La unidad ya tiene propietario: ${existingProp.nombre} ${existingProp.apellido}`
      }, { status: 400 });
    }

    const tempPassword = generateTempPassword();

    // 3. Auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });
    if (authError || !authData.user) {
      logger.error('Error creating propietario auth', authError);
      return Response.json({ success: false, error: 'No se pudo crear el usuario' }, { status: 500 });
    }
    const authUserId = authData.user.id;

    // 4. Propietario (trigger set_tenant_cols pone administradora_id/consorcio_id)
    const { data: prop, error: propError } = await insertPropietario(supabase, {
      auth_user_id: authUserId, unidad_id, nombre, apellido, dni, email, telefono: telefono || null,
    })
      .select('id')
      .single();
    if (propError || !prop) {
      await supabase.auth.admin.deleteUser(authUserId);
      logger.error('Error creating propietario', propError);
      return Response.json({ success: false, error: 'No se pudo crear el propietario' }, { status: 500 });
    }

    // 5. Fila en usuarios (rol propietario)
    const { error: usuarioError } = await supabase.from('usuarios').insert({
      auth_user_id: authUserId,
      administradora_id: unidad.administradora_id,
      rol: 'propietario',
      propietario_id: prop.id,
      activo: true,
    });
    if (usuarioError) {
      await supabase.from('propietarios').delete().eq('id', prop.id);
      await supabase.auth.admin.deleteUser(authUserId);
      logger.error('Error creating usuarios row', usuarioError);
      return Response.json({ success: false, error: 'No se pudo crear el usuario' }, { status: 500 });
    }

    if (sendInvitation) {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/recuperar-password`,
      });
      if (resetError) logger.warn('Could not send invitation email');
    }

    logger.info('Propietario created', { userId: authUserId, unidad_id, sendInvitation });

    return Response.json({
      success: true,
      message: sendInvitation ? 'Propietario creado. Se envió email de invitación.' : 'Propietario creado',
      userId: authUserId,
      tempPassword: sendInvitation ? null : tempPassword,
    });
  } catch (err) {
    logger.error('Exception creating propietario', err);
    return Response.json({
      success: false,
      error: err instanceof Error ? err.message : 'Error interno'
    }, { status: 500 });
  }
}
