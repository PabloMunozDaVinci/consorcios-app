// =============================================================================
// LIB: Auth - helpers de sesión (server-side)
// =============================================================================
// La verificación real corre contra Supabase vía @supabase/ssr. El proxy hace
// el refresh de sesión (chequeo optimista); la autorización fina va en cada
// route handler / server action con estos helpers.

import { createClient } from '@/lib/supabase/server';
import { safeRedirectPath } from '@/lib/safe-redirect';
import type { User } from '@supabase/supabase-js';

export interface SessionUser {
  userId: string;
  email: string;
}

/**
 * Devuelve el usuario autenticado del request, o null.
 * getUser() valida el token contra Supabase, no confía en la cookie.
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Igual que getCurrentUser pero devuelve el shape mínimo que usan las rutas.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return { userId: user.id, email: user.email ?? '' };
}

/**
 * Rutas de páginas que requieren sesión (el proxy redirige a /login).
 * Las rutas /api se listan aparte porque devuelven 401, no redirect.
 */
export function requiresAuth(pathname: string): boolean {
  const publicPrefixes = ['/login', '/logout', '/register', '/recuperar-password'];
  if (pathname === '/') return false;
  if (publicPrefixes.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return false;
  }
  return true;
}

/**
 * Crea un redirect a /login preservando SÓLO el path interno de destino.
 */
export function redirectToLogin(request: Request): Response {
  const requested = new URL(request.url);
  const url = new URL('/login', request.url);
  url.searchParams.set(
    'redirect',
    safeRedirectPath(requested.pathname + requested.search, '/')
  );
  return Response.redirect(url);
}
