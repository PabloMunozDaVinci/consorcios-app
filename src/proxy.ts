// =============================================================================
// PROXY (ex middleware, Next 16): Full Security Protection
// =============================================================================
// - Sesión (@supabase/ssr)
// - Blocklist de IPs + rate limiting (persistente, tabla rate_limits)
// - CSRF (Origin/Referer) en mutaciones
// - Security logging
// - Security headers (CSP con nonce)
// =============================================================================
// NOTE: Set DISABLE_AUTH=true in .env.local para bypassear auth en dev.
//
// El geo-blocking (Argentina-only) que había acá se ELIMINÓ (bloque 2, ítem 27):
// era un no-op que siempre devolvía isArgentina=true para IPs desconocidas
// ("TODO: Replace with proper geolocation service" nunca se hizo), y si alguna
// vez se hubiera arreglado, un falso positivo baneaba una IP PARA SIEMPRE sin
// proceso de apelación (blockIP(..., null) = permanente). Implementarlo de
// verdad requiere Cloudflare u otro servicio real -- no está en el alcance de
// este proyecto hoy. Si se retoma, que nazca con un proceso de desbloqueo.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getTrustedClientIP } from '@/lib/trusted-ip';
import { isIPBlocked, getTodayAttempts, checkRateLimitDB } from '@/lib/security/blocklist';
import {
  logIPBlocked,
  logJWTInvalid,
  logRateLimitExceeded,
  logSuspiciousRequest,
} from '@/lib/security/logger';
import { redirectToLogin } from '@/lib/auth';
import { updateSession } from '@/lib/supabase/proxy';

// Configuration
const CONFIG = {
  DAILY_ATTEMPT_LIMIT: 20, // Max attempts per day before block
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getClientIP(request: NextRequest): string {
  return getTrustedClientIP((name) => request.headers.get(name));
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

function isSafeMethod(method: string): boolean {
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
}

/**
 * CSRF: con auth por cookie, cualquier sitio de terceros puede hacer que el
 * browser mande esa cookie a nuestras rutas. Exigimos que Origin (o, si el
 * browser no lo manda, Referer) sea nuestro propio sitio.
 */
function hasValidOrigin(request: NextRequest): boolean {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const selfOrigin = siteUrl ? new URL(siteUrl).origin : request.nextUrl.origin;

  const origin = request.headers.get('origin');
  if (origin) return origin === selfOrigin;

  const referer = request.headers.get('referer');
  if (referer) {
    try {
      return new URL(referer).origin === selfOrigin;
    } catch {
      return false;
    }
  }

  // Ni Origin ni Referer: la mayoría de los browsers siempre mandan uno de
  // los dos en un POST/PUT/DELETE cross-site o same-site: si falta, no lo
  // dejamos pasar.
  return false;
}

// =============================================================================
// MAIN MIDDLEWARE
// =============================================================================

export async function proxy(request: NextRequest) {
  const ip = getClientIP(request);
  const pathname = request.nextUrl.pathname;
  const userAgent = getUserAgent(request);

  // Nonce único por request para el CSP (ver "SECURITY HEADERS" más abajo).
  // Se manda tanto en la request (para que Next lo lea y lo aplique a sus
  // propios scripts durante el render) como en la response (para el browser).
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const cspHeaderValue = buildCSP(nonce);
  const baseRequestHeaders = new Headers(request.headers);
  baseRequestHeaders.set('x-nonce', nonce);
  baseRequestHeaders.set('Content-Security-Policy', cspHeaderValue);

  // 1. Add security headers (SIEMPRE, incluso con DISABLE_AUTH)
  const response = NextResponse.next({ request: { headers: baseRequestHeaders } });
  addSecurityHeaders(response, cspHeaderValue);

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
  
  // 4. RATE LIMIT - intentos diarios (tabla blocked_ips/security_logs, cacheado 5s)
  const todayAttempts = await getTodayAttempts(ip);
  if (todayAttempts >= CONFIG.DAILY_ATTEMPT_LIMIT) {
    await logIPBlocked(ip, 'rate_limit', { attemptsToday: todayAttempts, duration: '24h' });
    return NextResponse.json(
      { error: 'Demasiados intentos hoy. Intenta mañana.' },
      { status: 429 }
    );
  }

  // 5. RATE LIMIT - por minuto, persistente (tabla rate_limits, no en memoria)
  const isAuth = isAuthRoute(pathname);
  const rateCheck = await checkRateLimitDB(ip, isAuth);
  if (!rateCheck.allowed) {
    await logRateLimitExceeded(ip, pathname);
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Intenta más tarde.' },
      { status: 429 }
    );
  }

  // 6. CSRF - las mutaciones vía cookie necesitan que Origin/Referer coincida
  // con nuestro propio sitio (no aplica a GET/HEAD/OPTIONS, que no mutan).
  if (!isSafeMethod(request.method) && pathname.startsWith('/api/')) {
    if (!hasValidOrigin(request)) {
      await logSuspiciousRequest(ip, 'csrf_origin_mismatch', {
        origin: request.headers.get('origin'),
        referer: request.headers.get('referer'),
        pathname,
      });
      return NextResponse.json({ error: 'Origen inválido' }, { status: 403 });
    }
  }

  // 7. AUTH - refresh de sesión (@supabase/ssr) + chequeo optimista.
  //    La autorización fina (rol, tenant) va en cada route handler / action.
  const { response: sessionResponse, user } = await updateSession(request);

  if (!user) {
    await logJWTInvalid(ip, 'no_session', userAgent);
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    return redirectToLogin(request);
  }

  // Autenticado: propagar identidad a las rutas downstream. request.headers.set()
  // no llega: hay que reconstruir la request con NextResponse.next({ request: { headers } }).
  baseRequestHeaders.set('x-user-id', user.id);
  baseRequestHeaders.set('x-user-email', user.email ?? '');

  const authedResponse = NextResponse.next({ request: { headers: baseRequestHeaders } });
  // Conservar las cookies de sesión que updateSession pudo haber refrescado.
  sessionResponse.cookies.getAll().forEach((cookie) => authedResponse.cookies.set(cookie));
  addSecurityHeaders(authedResponse, cspHeaderValue);
  return authedResponse;
}

// =============================================================================
// SECURITY HEADERS
// =============================================================================

/**
 * CSP con nonce (ítem 29). Reemplaza 'unsafe-inline'/'unsafe-eval' en
 * producción; en dev hace falta 'unsafe-eval' porque React lo usa para los
 * stack traces del debugger (ver docs de Next 16 sobre proxy + CSP nonces).
 * OJO: usar nonce implica que TODAS las páginas rendericen dinámicamente —
 * ver 'force-dynamic' agregado a las páginas cliente que antes eran estáticas.
 */
function buildCSP(nonce: string): string {
  const isDev = process.env.NODE_ENV !== 'production';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://*.supabase.co';

  const connectSrc = [`'self'`, supabaseUrl, 'https://*.resend.dev', 'https://api.ipify.org', 'https://ipapi.co'];
  if (isDev) connectSrc.push('http://localhost:*', 'ws://localhost:*');

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline'`, // Tailwind no usa nonce; ver PENDIENTES.md
    `img-src 'self' data: https:`,
    `font-src 'self'`,
    `connect-src ${connectSrc.join(' ')}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
  ];
  if (!isDev) csp.push('upgrade-insecure-requests');

  return csp.join('; ');
}

function addSecurityHeaders(response: NextResponse, cspHeaderValue: string) {
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

  response.headers.set('Content-Security-Policy', cspHeaderValue);

  // Additional headers
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');

  return response;
}

// =============================================================================
// CONFIG
// =============================================================================

export const config = {
  // Corre en todo (incluidas /, /login, etc.) para que los security headers y
  // el CSP con nonce protejan también las páginas públicas — antes el matcher
  // sólo cubría rutas protegidas y /login se servía sin CSP ni X-Frame-Options.
  // El auth-gating real sigue acotado por isPublicRoute() adentro de proxy().
  // Se excluyen assets estáticos reales por extensión (no "cualquier path con
  // un punto", que era el bypass original de §6.4).
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|map|woff2?|ttf|ico)$).*)',
  ],
};