// =============================================================================
// API: Create Propietario (Admin only)
// =============================================================================
// Crea un propietario con unidad asignada
// El usuario recibe email de invitación para configurar su password
import { createSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      email, 
      nombre, 
      apellido, 
      dni, 
      telefono, 
      unidad_id, 
      sendInvitation, 
      secret 
    } = body;

    // Secret para proteger el endpoint
    const ADMIN_SECRET = process.env.ADMIN_CREATE_SECRET || 'admin-secret-123';
    
    if (secret !== ADMIN_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validación de campos requeridos
    const errores: string[] = [];
    if (!email) errores.push('email es requerido');
    if (!nombre) errores.push('nombre es requerido');
    if (!apellido) errores.push('apellido es requerido');
    if (!dni) errores.push('dni es requerido');
    if (!unidad_id) errores.push('unidad_id es requerido');
    
    if (errores.length > 0) {
      return Response.json({ 
        success: false, 
        error: errores.join(', ') 
      }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // 1. Verificar que la unidad existe
    const { data: unidad, error: unidadError } = await supabase
      .from('unidades')
      .select('id, numero, piso')
      .eq('id', unidad_id)
      .single();

    if (unidadError || !unidad) {
      return Response.json({ 
        success: false, 
        error: 'La unidad no existe' 
      }, { status: 400 });
    }

    // 2. Verificar que la unidad no tenga ya un propietario
    const { data: existingProp } = await supabase
      .from('propietarios')
      .select('id, nombre, apellido')
      .eq('unidad_id', unidad_id)
      .single();

    if (existingProp) {
      return Response.json({ 
        success: false, 
        error: `La unidad ya tiene propietario asignado: ${existingProp.nombre} ${existingProp.apellido}` 
      }, { status: 400 });
    }

    // Generar password temporal aleatorio
    const tempPassword = generateTempPassword();

    // 3. Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });

    if (authError) {
      logger.error('Error creating propietario auth', authError);
      return Response.json({ success: false, error: authError.message }, { status: 500 });
    }

    if (!authData.user) {
      return Response.json({ success: false, error: 'Error creando usuario' }, { status: 500 });
    }

    // 4. Create propietario con la unidad asignada
    const { error: propError } = await supabase
      .from('propietarios')
      .insert({
        auth_user_id: authData.user.id,
        unidad_id,
        nombre,
        apellido,
        dni,
        email,
        telefono: telefono || null,
      });

    if (propError) {
      // Rollback auth user
      await supabase.auth.admin.deleteUser(authData.user.id);
      logger.error('Error creating propietario', propError);
      return Response.json({ success: false, error: propError.message }, { status: 500 });
    }

    // 5. Si sendInvitation=true, enviar email de invitación
    if (sendInvitation) {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/recuperar-password`,
      });
      
      if (resetError) {
        logger.warn('Could not send invitation email', { error: resetError.message });
      }
    }

    logger.info('Propietario created', { 
      email, 
      userId: authData.user.id, 
      unidad_id,
      sendInvitation 
    });

    return Response.json({ 
      success: true, 
      message: sendInvitation 
        ? 'Propietario creado. Se envió email de invitación.' 
        : 'Propietario creado',
      userId: authData.user.id,
      tempPassword: sendInvitation ? null : tempPassword
    });
  } catch (err) {
    logger.error('Exception creating propietario', err);
    return Response.json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Error interno' 
    }, { status: 500 });
  }
}

// Generar password temporal
function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password + '!';
}