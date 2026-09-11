// =============================================================================
// API: Reset Password (público, no enumerable)
// =============================================================================
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';
import { resetPasswordSchema, validateInput, badRequest } from '@/lib/sanitize';

const RESPUESTA_GENERICA = {
  success: true,
  message: 'Si el email está registrado, vas a recibir un link para recuperar tu contraseña.',
};

export async function POST(request: Request) {
  try {
    const parsed = validateInput(resetPasswordSchema, await request.json().catch(() => ({})));
    if (!parsed.ok) return badRequest(parsed.errors);
    const { email } = parsed.data;

    const supabase = createAdminClient();

    // resetPasswordForEmail ya es no-enumerable: no revela si el email existe.
    // (Antes se hacía listUsers() paginado -> fallaba con > 50 usuarios.)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/recuperar-password`,
    });

    if (error) {
      logger.error('Error sending reset email', error);
      // Igual respondemos genérico para no filtrar información.
    }

    return Response.json(RESPUESTA_GENERICA);
  } catch (err) {
    logger.error('Exception reset password', err);
    return Response.json(RESPUESTA_GENERICA);
  }
}
