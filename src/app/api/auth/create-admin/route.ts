// =============================================================================
// API: Create Admin User - Solo para uso inicial
// =============================================================================
import { createSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, nombre, secret } = body;

    // Secret para proteger el endpoint (cambiar después)
    const ADMIN_SECRET = process.env.ADMIN_CREATE_SECRET || 'admin-secret-123';
    
    if (secret !== ADMIN_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!email || !password || !nombre) {
      return Response.json({ 
        success: false, 
        error: 'email, password y nombre son requeridos' 
      }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirmar email
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

    logger.info('Admin created', { email, userId: authData.user.id });

    return Response.json({ 
      success: true, 
      message: 'Admin creado',
      userId: authData.user.id 
    });
  } catch (err) {
    logger.error('Exception creating admin', err);
    return Response.json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Error interno' 
    }, { status: 500 });
  }
}