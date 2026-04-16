// =============================================================================
// LIB: Geolocation - Simple IP-based geolocation
// =============================================================================
// Uses ipapi.co (free tier: 1000 requests/day)
// For production, consider upgrading to paid plan or using Cloudflare

import { logger } from '@/lib/logger';

export interface GeoInfo {
  country: string;
  countryCode: string;
  region: string;
  city: string;
  isArgentina: boolean;
}

// In-memory cache
const geoCache = new Map<string, { data: GeoInfo; expires: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Check if IP is private/local
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
 * Get geolocation info from IP (async - for use in API routes)
 */
export async function getGeoFromIP(ip: string): Promise<GeoInfo | null> {
  // Private/local IPs are allowed (from Argentina context)
  if (isPrivateIP(ip)) {
    return {
      country: 'Local',
      countryCode: 'AR',
      region: '',
      city: '',
      isArgentina: true,
    };
  }

  // Check cache
  const cached = geoCache.get(ip);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  try {
    // Use ipapi.co free tier
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`http://ipapi.co/${ip}/json/`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as {
      country_name?: string;
      country_code?: string;
      region?: string;
      city?: string;
    };

    const geo: GeoInfo = {
      country: data.country_name || 'Unknown',
      countryCode: data.country_code || 'XX',
      region: data.region || '',
      city: data.city || '',
      isArgentina: data.country_code === 'AR',
    };

    // Cache
    geoCache.set(ip, { data: geo, expires: Date.now() + CACHE_TTL });

    return geo;
  } catch (error) {
    // Fail open - allow if geo lookup fails
    logger.warn('GeoIP lookup failed', { ip, error: String(error) });
    return null;
  }
}

/**
 * Synchronous version for middleware (uses cached data)
 */
let syncCache = new Map<string, { data: GeoInfo; timestamp: number }>();

export function getGeoFromCached(ip: string): GeoInfo {
  // Private/local IPs
  if (isPrivateIP(ip)) {
    return {
      country: 'Local',
      countryCode: 'AR',
      region: '',
      city: '',
      isArgentina: true,
    };
  }

  const cached = syncCache.get(ip);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // Return default (fail open for unknown IPs)
  return {
    country: 'Unknown',
    countryCode: 'XX',
    region: '',
    city: '',
    isArgentina: false,
  };
}

/**
 * Check if IP is from allowed country (Argentina)
 */
export function isAllowedCountry(ip: string): boolean {
  const geo = getGeoFromCached(ip);
  return geo.isArgentina;
}

/**
 * Get country code
 */
export function getCountryCode(ip: string): string {
  const geo = getGeoFromCached(ip);
  return geo.countryCode;
}