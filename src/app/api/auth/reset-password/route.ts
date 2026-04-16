// =============================================================================
// API: Reset Password
// =============================================================================
// Permite a usuarios solicitar reset de contraseña
// Endpoint público - no requiere auth
import { createSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return Response.json({ 
        success: false, 
        error: 'Email es requerido' 
      }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // Verificar que el email existe en auth.users
    const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      logger.error('Error listing users', userError);
      return Response.json({ success: false, error: 'Error verificando usuario' }, { status: 500 });
    }

    const user = userData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      // No revelar si el email existe o no (seguridad)
      // Sempre mostrar mensaje exitoso
      return Response.json({ 
        success: true, 
        message: 'Si el email está registrado, recibirás un link para recuperar tu contraseña' 
      });
    }

    // Enviar email de reset password
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/recuperar-password`,
    });

    if (resetError) {
      logger.error('Error sending reset email', resetError);
      return Response.json({ success: false, error: resetError.message }, { status: 500 });
    }

    logger.info('Password reset email sent', { email });

    return Response.json({ 
      success: true, 
      message: 'Si el email está registrado, recibirás un link para recuperar tu contraseña' 
    });
  } catch (err) {
    logger.error('Exception reset password', err);
    return Response.json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Error interno' 
    }, { status: 500 });
  }
}