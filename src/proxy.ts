// =============================================================================
// PROXY (ex middleware, Next 16): Full Security Protection
// =============================================================================
// - JWT verification
// - Geolocation blocking (Argentina only)
// - Rate limiting
// - Security logging
// - Security headers
// =============================================================================
// NOTE: Set DISABLE_AUTH=true in .env.local to bypass auth for testing

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { isAllowedCountryMiddleware, getCountryCodeMiddleware } from '@/lib/geolocation-mw';
import { isIPBlocked, blockIP, getTodayAttempts } from '@/lib/security/blocklist';
import { 
  logSecurityEvent, 
  logLoginFailed, 
  logIPBlocked,
  logJWTInvalid,
  logRateLimitExceeded,
  logUnauthorizedAccess,
  logSuspiciousRequest
} from '@/lib/security/logger';
import { verifyJWT, verifyAdmin, requiresAuth, requiresAdmin, redirectToLogin } from '@/lib/auth';
import { containsSQLInjection, containsXSS } from '@/lib/sanitize';

// Configuration
const CONFIG = {
  // Rate limits
  RATE_LIMIT_WINDOW: 60 * 1000, // 1 minute
  RATE_LIMIT_MAX: 100, // Max requests per minute per IP (general)
  AUTH_RATE_LIMIT_MAX: 5, // Max auth attempts per minute
  DAILY_ATTEMPT_LIMIT: 20, // Max attempts per day before block
  
  // Block durations  
  BLOCK_DURATION_BRUTE_FORCE: 15 * 60 * 1000, // 15 minutes for brute force
  BLOCK_DURATION_DAILY_LIMIT: 24 * 60 * 60 * 1000, // 24 hours for rate limit
  
  // Timeouts
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
};

// Rate limit tracking (in-memory for production use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number; authFails: number }>();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  return 'unknown';
}

function getUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') || 'unknown';
}

function isPublicRoute(pathname: string): boolean {
  // Public routes - no auth required
  const publicRoutes = [
    '/login',
    '/logout',
    '/register',
    '/recuperar-password',
    '/api/health',
  ];

  // Exact match
  if (publicRoutes.includes(pathname)) {
    return true;
  }

  // Endpoints protegidos por su propio secreto (no por sesión):
  // - reset-password: no enumerable, público por diseño.
  // - create-admin / create-propietario: gateados por ADMIN_CREATE_SECRET
  //   (create-admin es el bootstrap, no puede requerir una sesión previa).
  const secretGatedEndpoints = [
    '/api/auth/reset-password',
    '/api/auth/create-admin',
    '/api/auth/create-propietario',
  ];
  if (secretGatedEndpoints.includes(pathname)) {
    return true;
  }

  return false;
}

function isAuthRoute(pathname: string): boolean {
  return pathname.startsWith('/api/auth/');
}

// Rate limiter
function checkRateLimit(ip: string, isAuthEndpoint: boolean): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const limit = isAuthEndpoint ? CONFIG.AUTH_RATE_LIMIT_MAX : CONFIG.RATE_LIMIT_MAX;
  
  let record = rateLimitStore.get(ip);
  
  if (!record || now > record.resetTime) {
    record = { count: 0, resetTime: now + CONFIG.RATE_LIMIT_WINDOW, authFails: 0 };
    rateLimitStore.set(ip, record);
  }
  
  record.count++;
  
  // Clean old entries
  if (rateLimitStore.size > 10000) {
    const cutoff = now - CONFIG.RATE_LIMIT_WINDOW;
    for (const [key, value] of rateLimitStore) {
      if (value.resetTime < cutoff) {
        rateLimitStore.delete(key);
      }
    }
  }
  
  return {
    allowed: record.count <= limit,
    remaining: Math.max(0, limit - record.count),
  };
}

// =============================================================================
// MAIN MIDDLEWARE
// =============================================================================

export async function proxy(request: NextRequest) {
  const ip = getClientIP(request);
  const pathname = request.nextUrl.pathname;
  const userAgent = getUserAgent(request);

  // 1. Add security headers (SIEMPRE, incluso con DISABLE_AUTH)
  const response = NextResponse.next();
  addSecurityHeaders(response);

  // DISABLE_AUTH: sólo tiene efecto fuera de producción. En prod se ignora
  // y se loguea un warning (evita que un .env mal copiado abra la app entera).
  if (process.env.DISABLE_AUTH === 'true') {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[middleware] DISABLE_AUTH=true está IGNORADO en producción.');
    } else {
      return response;
    }
  }

  // 2. Public routes - skip auth checks
  if (isPublicRoute(pathname)) {
    return response;
  }
  
  // 3. Check if IP is blocked
  const blocked = await isIPBlocked(ip);
  if (blocked) {
    const blockedUntil = blocked.blocked_until ? new Date(blocked.blocked_until) : null;
    if (blockedUntil && blockedUntil > new Date()) {
      // Still blocked
      await logSuspiciousRequest(ip, 'blocked_ip_access', { reason: blocked.reason });
      return NextResponse.json(
        { error: 'Tu IP está temporalmente bloqueada. Intenta más tarde.' },
        { status: 403 }
      );
    } else if (!blockedUntil) {
      // Permanently blocked
      await logSuspiciousRequest(ip, 'permanent_blocked_ip', { reason: blocked.reason });
      return NextResponse.json(
        { error: 'Tu IP está bloqueada permanentemente.' },
        { status: 403 }
      );
    }
    // Block expired - continue
  }
  
  // 4. GEOLOCATION BLOCK - Block non-Argentinian IPs
  if (!isAllowedCountryMiddleware(ip)) {
    const countryCode = getCountryCodeMiddleware(ip);
    await logIPBlocked(ip, 'geo_block', { country: countryCode });
    await blockIP(ip, 'geo_block', countryCode, null); // Permanent
    return NextResponse.json(
      { error: 'Acceso denegado. Esta aplicación solo está disponible desde Argentina.' },
      { status: 403 }
    );
  }
  
  // 5. RATE LIMIT - Check daily attempts from Argentina
  const todayAttempts = await getTodayAttempts(ip);
  if (todayAttempts >= CONFIG.DAILY_ATTEMPT_LIMIT) {
    await logIPBlocked(ip, 'rate_limit', { attemptsToday: todayAttempts, duration: '24h' });
    return NextResponse.json(
      { error: 'Demasiados intentos hoy. Intenta mañana.' },
      { status: 429 }
    );
  }
  
  // 6. RATE LIMIT - Check per-minute rate limit
  const isAuth = isAuthRoute(pathname);
  const rateCheck = checkRateLimit(ip, isAuth);
  if (!rateCheck.allowed) {
    await logRateLimitExceeded(ip, pathname);
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Intenta más tarde.' },
      { status: 429 }
    );
  }
  
  // 7. BLOCKED LOGIN ATTEMPTS - Track failed login attempts
  if (pathname === '/api/auth/reset-password' && request.method === 'POST') {
    // This is handled at the API level
  }
  
  // 8. AUTH VERIFICATION - JWT check for protected routes
  if (!isPublicRoute(pathname)) {
    const authResult = await verifyJWT(request);
    
    if (!authResult.success) {
      // Log the failed auth
      await logJWTInvalid(ip, authResult.error || 'invalid_token', userAgent);
      
      // Redirect to login for page routes
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'No autorizado' },
          { status: 401 }
        );
      }
      
      // For pages, redirect to login
      return redirectToLogin(request);
    }
    
    // 9. ADMIN VERIFICATION - Some routes require admin
    if (requiresAdmin(pathname)) {
      if (!authResult.session?.isAdmin) {
        await logUnauthorizedAccess(ip, pathname, userAgent);
        return NextResponse.json(
          { error: 'Acceso de administrador requerido' },
          { status: 403 }
        );
      }
    }
    
    // Success - propagar identidad a las rutas downstream.
    // request.headers.set(...) NO llega a las rutas: hay que reconstruir
    // la request con NextResponse.next({ request: { headers } }).
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', authResult.session?.userId || '');
    requestHeaders.set('x-user-email', authResult.session?.email || '');
    requestHeaders.set('x-is-admin', String(authResult.session?.isAdmin || false));

    const authedResponse = NextResponse.next({ request: { headers: requestHeaders } });
    addSecurityHeaders(authedResponse);
    return authedResponse;
  }

  return response;
}

// =============================================================================
// SECURITY HEADERS
// =============================================================================

function addSecurityHeaders(response: NextResponse) {
  // Core security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // HSTS (only in production)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security', 
      'max-age=31536000; includeSubDomains; preload'
    );
  }
  
  // CSP - Strict Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self'; " +
    "connect-src 'self' http://localhost:* https://*.supabase.co https://*.resend.dev https://api.ipify.org https://ipapi.co; " +
    "frame-ancestors 'none'; " +
    "form-action 'self';"
  );
  
  // Additional headers
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  
  return response;
}

// =============================================================================
// CONFIG
// =============================================================================

export const config = {
  // Matcher explícito por prefijo. Cubre la API y las rutas de páginas
  // protegidas; deja fuera assets, _next, y las páginas públicas (/, /login...).
  matcher: [
    '/api/:path*',
    '/admin/:path*',
    '/consorcios/:path*',
    '/edificios/:path*',
    '/unidades/:path*',
    '/pagos/:path*',
    '/mantenimiento/:path*',
  ],
};