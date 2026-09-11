// =============================================================================
// SUPABASE: Cliente de servidor por request (@supabase/ssr)
// =============================================================================
// Para Server Components, Route Handlers y Server Actions. Usa la sesión del
// usuario (cookies) → las policies RLS aplican. NO es service_role.
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component: no puede escribir cookies. El refresh de sesión
          // lo hace el proxy (src/lib/supabase/proxy.ts), así que es seguro ignorar.
        }
      },
    },
  });
}
