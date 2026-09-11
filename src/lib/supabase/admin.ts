// =============================================================================
// SUPABASE: Cliente service_role (saltea RLS)
// =============================================================================
// SÓLO para operaciones administrativas reales:
//   - crear/borrar usuarios de auth
//   - escribir security_logs / blocked_ips / rate-limit
//   - jobs de sistema (evaluación de mora, etc.)
// NUNCA para servir datos a un usuario en respuesta a un request suyo:
// para eso va el cliente por request de './server' y que RLS filtre.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let adminClient: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno');
  }

  adminClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return adminClient;
}
