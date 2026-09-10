// =============================================================================
// SUPABASE: compat
// =============================================================================
// Los clientes ahora viven en src/lib/supabase/:
//   - '@/lib/supabase/client'  -> browser ('use client'), sesión en cookies
//   - '@/lib/supabase/server'  -> por request, con la sesión del usuario (RLS aplica)
//   - '@/lib/supabase/admin'   -> service_role, sólo operaciones administrativas
//   - '@/lib/supabase/proxy'   -> refresh de sesión en el proxy
//
// Este archivo sólo re-exporta el admin con el nombre viejo para no romper
// imports existentes mientras se migran ruta por ruta (bloque 1, ítem 14).
export { createAdminClient as createSupabaseAdmin } from '@/lib/supabase/admin';
