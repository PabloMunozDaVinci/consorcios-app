// =============================================================================
// MIDDLEWARE: Seguridad y rate limiting básico
// =============================================================================
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rate limiting simple (en memoria, para producción usar Redis)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

// Configuración
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minuto
const RATE_LIMIT_MAX = 100; // max requests por minuto por IP

// IPs whitelist (ej: tu IP de desarrollo)
const WHITELIST = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

// Helper para obtener IP del request
function getClientIP(request: NextRequest): string {
  // Try x-forwarded-for header first (for proxy/load balancer)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  // Fallback to x-real-ip (common in nginx/proxies)
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  return 'unknown';
}

export function middleware(request: NextRequest) {
  const ip = getClientIP(request);
  
  // Skip rate limit para whitelisted IPs
  if (WHITELIST.includes(ip)) {
    return addSecurityHeaders(NextResponse.next());
  }

  // Rate limiting
  const now = Date.now();
  const record = requestCounts.get(ip);
  
  if (record && now < record.resetTime) {
    record.count++;
    if (record.count > RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes, intenta más tarde' },
        { status: 429 }
      );
    }
  } else {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
  }

  return addSecurityHeaders(NextResponse.next());
}

function addSecurityHeaders(response: NextResponse) {
  // Headers de seguridad
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  return response;
}

export const config = {
  matcher: [
    // Match todas las rutas excepto estáticos y API
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};