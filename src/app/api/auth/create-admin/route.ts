// =============================================================================
// API: Create Admin User
// =============================================================================
// Crea un administrador (sin unidad_id = es admin)
// Usa email invitation - el usuario configura su password desde el email
import { createSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { getAdminCreateSecret, secretMatches, generateTempPassword } from '@/lib/admin-secret';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, nombre, sendInvitation, secret } = body;

    // Secret para proteger el endpoint (sin fallback; comparación en tiempo constante)
    if (!secretMatches(secret, getAdminCreateSecret())) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!email || !nombre) {
      return Response.json({ 
        success: false, 
        error: 'email y nombre son requeridos' 
      }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // Generar password temporal aleatorio
    const tempPassword = generateTempPassword();

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true, // Auto-confirmar para que pueda login inmediatamente
    });

    if (authError) {
      logger.error('Error creating admin auth', authError);
      return Response.json({ success: false, error: authError.message }, { status: 500 });
    }

    if (!authData.user) {
      return Response.json({ success: false, error: 'Error creando usuario' }, { status: 500 });
    }

    // 2. Create propietario admin (sin unidad = es admin)
    const { error: propError } = await supabase
      .from('propietarios')
      .insert({
        auth_user_id: authData.user.id,
        nombre,
        apellido: 'Admin',
        dni: '00000000',
        email,
        telefono: null,
        // NO setear unidad_id = es admin
      });

    if (propError) {
      // Rollback auth user
      await supabase.auth.admin.deleteUser(authData.user.id);
      logger.error('Error creating admin propietario', propError);
      return Response.json({ success: false, error: propError.message }, { status: 500 });
    }

    // 3. Si sendInvitation=true, enviar email de invitación para cambiar password
    if (sendInvitation) {
      // Enviar email de reset para que el usuario configure su password
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/recuperar-password`,
      });
      
      if (resetError) {
        logger.warn('Could not send invitation email', { error: resetError.message });
        // No fallamos - el usuario igual fue creado
      }
    }

    logger.info('Admin created', { email, userId: authData.user.id, sendInvitation });

    return Response.json({ 
      success: true, 
      message: sendInvitation 
        ? 'Admin creado. Se envió email de invitación.' 
        : 'Admin creado',
      userId: authData.user.id,
      tempPassword: sendInvitation ? null : tempPassword
    });
  } catch (err) {
    logger.error('Exception creating admin', err);
    return Response.json({
      success: false,
      error: err instanceof Error ? err.message : 'Error interno'
    }, { status: 500 });
  }
}