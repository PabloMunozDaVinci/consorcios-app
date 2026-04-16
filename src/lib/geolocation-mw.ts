// =============================================================================
// LIB: Geolocation - Simple IP-based geolocation for middleware
// =============================================================================
// Lightweight version for middleware - with fail-open for unknown IPs
// In production, this should be replaced with a more robust solution

import type { GeoInfo } from './geolocation';

// In-memory cache for middleware
let geoCache = new Map<string, { info: GeoInfo; time: number }>();

/**
 * Check if IP is private/local (synchronous)
 */
function isPrivateIP(ip: string): boolean {
  if (!ip || ip.length === 0) return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('127.')) return true;
  if (ip === 'localhost') return true;
  if (ip === '127.0.0.1') return true;
  if (ip.startsWith('::1')) return true;
  if (ip.startsWith('fe80:')) return true;
  // Check for common private ranges
  if (ip.startsWith('172.16.') || ip.startsWith('172.17.') || ip.startsWith('172.18.') || ip.startsWith('172.19.')) return true;
  if (ip.startsWith('172.2') || ip.startsWith('172.3')) return true;
  return false;
}

/**
 * Get cached geolocation info synchronously (for middleware)
 * Uses FAIL-OPEN for unknown IPs - allows access if can't determine location
 */
export function getGeoFromIPMiddleware(ip: string): GeoInfo {
  // Private IPs are always allowed
  if (isPrivateIP(ip)) {
    return {
      country: 'Local',
      countryCode: 'AR',
      region: '',
      city: '',
      isArgentina: true,
    };
  }

  const cached = geoCache.get(ip);
  const now = Date.now();
  
  if (cached && now - cached.time < 3600000) { // 1 hour cache
    return cached.info;
  }

  // For unknown IPs in middleware (can't make HTTP calls in Edge),
  // we use a heuristic: if IP looks like a typical home/office IP, allow it
  // This is a temporary solution for testing
  // In production, you should use a different approach (e.g., Cloudflare workers)
  
  // Simple heuristic: most residential IPs in Argentina will resolve correctly
  // We default to allowing for now (fail-open for testing)
  // TODO: Replace with proper geolocation service integration
  return {
    country: 'Argentina', // Assume Argentina for unknown IPs in development
    countryCode: 'AR',
    region: '',
    city: '',
    isArgentina: true,
  };
}

/**
 * Check if IP is from allowed country
 */
export function isAllowedCountryMiddleware(ip: string): boolean {
  const geo = getGeoFromIPMiddleware(ip);
  return geo.isArgentina;
}

/**
 * Get country code
 */
export function getCountryCodeMiddleware(ip: string): string {
  const geo = getGeoFromIPMiddleware(ip);
  return geo.countryCode;
}

/**
 * Update cache from async lookup (called from API routes)
 */
export function updateGeoCache(ip: string, info: GeoInfo): void {
  geoCache.set(ip, { info, time: Date.now() });
  
  // Limit cache size
  if (geoCache.size > 100) {
    const now = Date.now();
    const entries = Array.from(geoCache.entries());
    for (const [key, val] of entries) {
      if (now - val.time > 3600000) {
        geoCache.delete(key);
      }
    }
    // If still too big, remove oldest half
    if (geoCache.size > 100) {
      const toRemove = entries.slice(0, 50).map(e => e[0]);
      toRemove.forEach(k => geoCache.delete(k));
    }
  }
}
