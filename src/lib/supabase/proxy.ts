// =============================================================================
// SUPABASE: refresh de sesión para el proxy (@supabase/ssr)
// =============================================================================
// Corre en cada request que matchea el proxy. Refresca el token si hace falta
// y re-escribe las cookies en la respuesta. Devuelve el user (o null) para que
// el proxy decida si redirige a /login.
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';

export async function updateSession(
  request: NextRequest
): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { response, user: null };

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // getUser() valida el token contra Supabase (no confía en la cookie a ciegas).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
