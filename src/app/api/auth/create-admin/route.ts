// =============================================================================
// API: Create Admin User (bootstrap, gateado por ADMIN_CREATE_SECRET)
// =============================================================================
// Crea un usuario de auth + su fila en `usuarios` con rol admin/super_admin,
// ligado a una administradora. NO crea fila en `propietarios`.
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';
import { getAdminCreateSecret, secretMatches, generateTempPassword } from '@/lib/admin-secret';
import { createAdminSchema, validateInput, badRequest } from '@/lib/sanitize';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    if (!secretMatches(body?.secret, getAdminCreateSecret())) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = validateInput(createAdminSchema, body);
    if (!parsed.ok) return badRequest(parsed.errors);
    const { email, nombre, sendInvitation, rol = 'admin' } = parsed.data;
    let administradoraId: string | undefined = parsed.data.administradora_id;

    const supabase = createAdminClient();

    // Resolver la administradora: la del body, o la única existente.
    if (!administradoraId) {
      const { data: admins } = await supabase.from('administradoras').select('id').limit(2);
      if (!admins || admins.length === 0) {
        return Response.json({ success: false, error: 'No hay ninguna administradora. Creá una primero.' }, { status: 400 });
      }
      if (admins.length > 1) {
        return Response.json({ success: false, error: 'Hay varias administradoras; indicá administradora_id.' }, { status: 400 });
      }
      administradoraId = admins[0].id;
    }

    const tempPassword = generateTempPassword();

    // 1. Auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { nombre },
    });
    if (authError || !authData.user) {
      logger.error('Error creating admin auth', authError);
      return Response.json({ success: false, error: 'No se pudo crear el usuario' }, { status: 500 });
    }

    // 2. Fila en usuarios
    const { error: usuarioError } = await supabase.from('usuarios').insert({
      auth_user_id: authData.user.id,
      administradora_id: administradoraId,
      rol,
      activo: true,
    });
    if (usuarioError) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      logger.error('Error creating usuarios row', usuarioError);
      return Response.json({ success: false, error: 'No se pudo crear el usuario' }, { status: 500 });
    }

    if (sendInvitation) {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/recuperar-password`,
      });
      if (resetError) logger.warn('Could not send invitation email');
    }

    logger.info('Admin created', { userId: authData.user.id, rol, sendInvitation });

    return Response.json({
      success: true,
      message: sendInvitation ? 'Admin creado. Se envió email de invitación.' : 'Admin creado',
      userId: authData.user.id,
      tempPassword: sendInvitation ? null : tempPassword,
    });
  } catch (err) {
    logger.error('Exception creating admin', err);
    return Response.json({
      success: false,
      error: err instanceof Error ? err.message : 'Error interno'
    }, { status: 500 });
  }
}
