// =============================================================================
// LIB: Supabase Client - OPTIMIZED
// =============================================================================
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// SINGLETON: Connection pooling - NO crear nuevas conexiones por request
// =============================================================================
let adminClient: SupabaseClient | null = null;
let publicClient: SupabaseClient | null = null;

/**
 * Creates optimized Supabase admin client (singleton pattern)
 * - Reutiliza conexiones entre requests
 * - Auto-refresh desactivado para server-side (no tiene sentido)
 * - Persistencia desactivada (no hay sesión de usuario)
 */
export function createSupabaseAdmin(): SupabaseClient {
  if (adminClient) {
    return adminClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno');
  }

  adminClient = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    // Pool de conexiones - permite reutilizar conexiones
    db: {
      schema: 'public',
    },
  });

  return adminClient;
}

/**
 * Creates optimized Supabase public client (singleton pattern)
 * - Para uso en cliente (browser)
 * - Auto-refresh activo para sesiones de usuario
 */
export function createSupabaseClient(): SupabaseClient {
  if (publicClient) {
    return publicClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error('Faltan variables de entorno de Supabase. Verifica .env.local');
  }

  publicClient = createClient(url, key, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });

  return publicClient;
}

// Alias para compatibilidad
export const supabase = createSupabaseClient();
