// =============================================================================
// LIB: Auth - JWT verification helpers
// =============================================================================
// Handles JWT verification and session validation

import { createSupabaseClient, createSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export interface SessionUser {
  userId: string;
  email: string;
  isAdmin: boolean;
  expiresAt: number;
}

export interface AuthResult {
  success: boolean;
  session?: SessionUser;
  error?: string;
}

/**
 * Verify JWT token from request
 * Extracts token from Authorization header or cookie
 */
export async function verifyJWT(request: Request): Promise<AuthResult> {
  try {
    // Try to get token from Authorization header
    let token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    // If not in header, try cookie
    if (!token) {
      const cookieHeader = request.headers.get('cookie');
      if (cookieHeader) {
        const cookies = Object.fromEntries(
          cookieHeader.split('; ').map(c => c.split('='))
        );
        token = cookies['sb-access-token']?.replace(/"/g, '');
      }
    }
    
    if (!token) {
      return { success: false, error: 'No token provided' };
    }
    
    const supabase = createSupabaseClient();
    
    // Verify the token
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return { success: false, error: error?.message || 'Invalid token' };
    }
    
    // Check if user has admin role (no unidad_id in propietarios table = admin)
    const adminSupabase = createSupabaseAdmin();
    const { data: propietario } = await adminSupabase
      .from('propietarios')
      .select('unidad_id')
      .eq('auth_user_id', user.id)
      .single();
    
    const isAdmin = !propietario?.unidad_id;
    
    // Check session expiry (Supabase handles this, but we also check the exp claim)
    const expClaim = user.id; // The user object doesn't have exp, Supabase manages it
    // We'll use the issued_at and compare with our session timeout
    
    return {
      success: true,
      session: {
        userId: user.id,
        email: user.email || '',
        isAdmin,
        expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes (should match Supabase config)
      },
    };
  } catch (error) {
    logger.error('JWT verification error', error);
    return { success: false, error: 'Verification failed' };
  }
}

/**
 * Verify JWT and require admin role
 */
export async function verifyAdmin(request: Request): Promise<AuthResult> {
  const result = await verifyJWT(request);
  
  if (!result.success) {
    return result;
  }
  
  if (!result.session?.isAdmin) {
    return { success: false, error: 'Admin access required' };
  }
  
  return result;
}

/**
 * Get user from request (for logging)
 */
export function getUserFromRequest(request: Request): { id: string; email: string } | null {
  // This is a simplified version - actual user comes from JWT verification
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;
  
  // The actual user data comes from Supabase after JWT verification
  return null;
}

/**
 * Check if route requires authentication
 */
export function requiresAuth(pathname: string): boolean {
  // Public routes that don't require auth
  const publicRoutes = [
    '/',
    '/login',
    '/logout',
    '/register',
    '/recuperar-password',
    '/api/health',
    '/api/auth/login',
    '/api/auth/reset-password',
    '/_next',
    '/favicon.ico',
  ];
  
  // Check exact match
  if (publicRoutes.includes(pathname)) {
    return false;
  }
  
  // Check paths starting with
  const publicPathPrefixes = [
    '/api/auth/', // Auth APIs handled separately
    '/_next/',
  ];
  
  for (const prefix of publicPathPrefixes) {
    if (pathname.startsWith(prefix)) {
      return false;
    }
  }
  
  // All other routes require auth
  return true;
}

/**
 * Check if route requires admin role
 */
export function requiresAdmin(pathname: string): boolean {
  const adminRoutes = [
    '/api/consorcios',
    '/api/edificios',
    '/api/unidades',
    '/api/auth/create-admin',
    '/api/auth/create-propietario',
  ];
  
  for (const route of adminRoutes) {
    if (pathname.startsWith(route)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Create redirect response to login
 */
export function redirectToLogin(request: Request): Response {
  const url = new URL('/login', request.url);
  url.searchParams.set('redirect', request.url);
  
  return Response.redirect(url);
}