// =============================================================================
// LIB: Geolocation - Simple IP-based geolocation for middleware
// =============================================================================
// Lightweight version for middleware - synchronous, no HTTP calls
// Uses cached data from API calls made elsewhere

import type { GeoInfo } from './geolocation';

// In-memory cache for middleware - sync with API calls
let geoCache = new Map<string, { info: GeoInfo; time: number }>();

/**
 * Check if IP is private/local (synchronous)
 */
function isPrivateIP(ip: string): boolean {
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('127.')) return true;
  if (ip === 'localhost') return true;
  if (ip === '127.0.0.1') return true;
  if (ip.startsWith('::1')) return true;
  if (ip.startsWith('fe80:')) return true;
  return false;
}

/**
 * Get cached geolocation info synchronously (for middleware)
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

  // If not cached, default to blocking (fail safe for unknown IPs)
  // The actual lookup happens in API routes
  return {
    country: 'Unknown',
    countryCode: 'XX',
    region: '',
    city: '',
    isArgentina: false,
  };
}

/**
 * Update cache from async lookup
 */
export function updateGeoCache(ip: string, info: GeoInfo): void {
  geoCache.set(ip, { info, time: Date.now() });
  
  // Limit cache size
  if (geoCache.size > 100) {
    const now = Date.now();
    for (const [key, val] of geoCache) {
      if (now - val.time > 3600000) {
        geoCache.delete(key);
      }
    }
  }
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