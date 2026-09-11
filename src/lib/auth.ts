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

export type Rol = 'super_admin' | 'admin' | 'operador' | 'propietario';

export interface Usuario {
  id: string;
  authUserId: string;
  administradoraId: string;
  rol: Rol;
  propietarioId: string | null;
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
 * Fila de `usuarios` del request actual (rol + administradora). null si no hay
 * sesión o el usuario no tiene fila activa en `usuarios`.
 */
export async function getUsuario(): Promise<Usuario | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('usuarios')
    .select('id, auth_user_id, administradora_id, rol, propietario_id')
    .eq('auth_user_id', user.id)
    .eq('activo', true)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    authUserId: data.auth_user_id,
    administradoraId: data.administradora_id,
    rol: data.rol,
    propietarioId: data.propietario_id,
  };
}

/**
 * Para route handlers / server actions: exige sesión + (opcional) uno de los
 * roles. Devuelve el usuario o una Response lista para retornar.
 */
export async function requireUsuario(
  roles?: Rol[]
): Promise<{ ok: true; usuario: Usuario } | { ok: false; response: Response }> {
  const usuario = await getUsuario();
  if (!usuario) {
    return { ok: false, response: Response.json({ error: 'No autenticado' }, { status: 401 }) };
  }
  if (roles && roles.length > 0 && !roles.includes(usuario.rol)) {
    return { ok: false, response: Response.json({ error: 'Sin permiso' }, { status: 403 }) };
  }
  return { ok: true, usuario };
}

/** Roles con acceso de gestión (todo lo que no es el portal del propietario). */
export const ROLES_GESTION: Rol[] = ['super_admin', 'admin', 'operador'];

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
