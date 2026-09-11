// =============================================================================
// LIB: Blocklist - IP blocking management
// =============================================================================
// Manages blocked IPs based on geolocation, rate limiting, and brute force

import { createSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';

// =============================================================================
// Cache corto en memoria (por proceso) para no pegarle a la DB en cada request
// del hot path. NO reemplaza el rate limit persistente (eso es la tabla
// rate_limits / blocked_ips) — sólo evita 2 round-trips por request cuando la
// misma IP pega varias veces seguidas en pocos segundos. Con varias instancias
// PM2 cada una cachea la suya: es una optimización de latencia, no la fuente
// de verdad.
// =============================================================================
const CACHE_TTL_MS = 5000;
const blockedCache = new Map<string, { value: BlockedIP | null; expires: number }>();
const attemptsCache = new Map<string, { value: number; expires: number }>();

function cacheGet<T>(cache: Map<string, { value: T; expires: number }>, key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet<T>(cache: Map<string, { value: T; expires: number }>, key: string, value: T) {
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
  // Poda simple para que no crezca sin límite.
  if (cache.size > 5000) {
    const cutoff = Date.now();
    for (const [k, v] of cache) {
      if (v.expires < cutoff) cache.delete(k);
    }
  }
}

export interface BlockedIP {
  id: string;
  ip_address: string;
  reason: string;
  country_code: string;
  attempts_count: number;
  blocked_until: string | null;
  created_at: string;
}

export type BlockReason = 'geo_block' | 'rate_limit' | 'brute_force';

/**
 * Check if an IP is blocked
 */
export async function isIPBlocked(ip: string): Promise<BlockedIP | null> {
  const cached = cacheGet(blockedCache, ip);
  if (cached !== undefined) return cached;

  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase
    .from('blocked_ips')
    .select('*')
    .eq('ip_address', ip)
    .maybeSingle();

  if (error || !data) {
    cacheSet(blockedCache, ip, null);
    return null;
  }

  // Check if temporary block has expired
  if (data.blocked_until) {
    const blockedUntil = new Date(data.blocked_until);
    if (blockedUntil < new Date()) {
      // Block expired, remove it
      await unblockIP(ip);
      cacheSet(blockedCache, ip, null);
      return null;
    }
  }

  const result = data as BlockedIP;
  cacheSet(blockedCache, ip, result);
  return result;
}

/**
 * Block an IP
 */
export async function blockIP(
  ip: string,
  reason: BlockReason,
  countryCode: string = 'XX',
  blockedUntil: Date | null = null
): Promise<void> {
  const supabase = createSupabaseAdmin();
  
  const { error } = await supabase
    .from('blocked_ips')
    .upsert({
      ip_address: ip,
      reason,
      country_code: countryCode,
      attempts_count: 1,
      blocked_until: blockedUntil?.toISOString() || null,
    }, { onConflict: 'ip_address' });
  
  if (error) {
    logger.error('Error blocking IP', { ip, reason, error });
  } else {
    logger.info('IP blocked', { ip, reason, blockedUntil });
  }
  blockedCache.delete(ip);
}

/**
 * Unblock an IP
 */
export async function unblockIP(ip: string): Promise<void> {
  const supabase = createSupabaseAdmin();
  
  const { error } = await supabase
    .from('blocked_ips')
    .delete()
    .eq('ip_address', ip);
  
  if (error) {
    logger.error('Error unblocking IP', { ip, error });
  } else {
    logger.info('IP unblocked', { ip });
  }
  blockedCache.delete(ip);
}

/**
 * Increment failed attempts for an IP
 */
export async function incrementFailedAttempts(ip: string): Promise<number> {
  const supabase = createSupabaseAdmin();
  
  // Get current count
  const { data: existing } = await supabase
    .from('blocked_ips')
    .select('attempts_count')
    .eq('ip_address', ip)
    .single();
  
  const newCount = (existing?.attempts_count || 0) + 1;
  
  // Update count
  await supabase
    .from('blocked_ips')
    .upsert({
      ip_address: ip,
      attempts_count: newCount,
      reason: 'brute_force', // Will be updated if actually blocked
    }, { onConflict: 'ip_address' });
  
  return newCount;
}

/**
 * Get today's failed attempts for an IP
 */
export async function getTodayAttempts(ip: string): Promise<number> {
  const cached = cacheGet(attemptsCache, ip);
  if (cached !== undefined) return cached;

  const supabase = createSupabaseAdmin();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('security_logs')
    .select('*', { count: 'exact', head: true })
    .eq('ip_address', ip)
    .eq('event_type', 'login_failed')
    .gte('created_at', today.toISOString());

  if (error) {
    logger.error('Error getting today attempts', { ip, error });
    return 0;
  }

  const result = count || 0;
  cacheSet(attemptsCache, ip, result);
  return result;
}

/**
 * Rate limit por minuto, persistente (tabla rate_limits vía RPC atómica).
 * Reemplaza el Map() en memoria del proxy: sobrevive a restarts y se comparte
 * entre instancias PM2 (todas pegan a la misma DB).
 */
export async function checkRateLimitDB(
  ip: string,
  isAuthEndpoint: boolean
): Promise<{ allowed: boolean; remaining: number }> {
  const WINDOW_SECONDS = 60;
  const limit = isAuthEndpoint ? 5 : 100;

  const supabase = createSupabaseAdmin();
  const { data: count, error } = await supabase.rpc('rate_limit_hit', {
    p_ip: ip,
    p_window_seconds: WINDOW_SECONDS,
  });

  if (error) {
    // Si la DB falla, no tumbamos el sitio entero por el rate limiter: dejamos pasar.
    logger.error('Error en rate_limit_hit', error);
    return { allowed: true, remaining: limit };
  }

  return { allowed: (count as number) <= limit, remaining: Math.max(0, limit - (count as number)) };
}

/**
 * Get all blocked IPs (for admin panel)
 */
export async function getAllBlockedIPs(): Promise<BlockedIP[]> {
  const supabase = createSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('blocked_ips')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  
  if (error) {
    logger.error('Error getting blocked IPs', error);
    return [];
  }
  
  return (data || []) as BlockedIP[];
}

/**
 * Clean up expired blocks (for cronjob or manual cleanup)
 */
export async function cleanupExpiredBlocks(): Promise<number> {
  const supabase = createSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('blocked_ips')
    .select('id, blocked_until')
    .lt('blocked_until', new Date().toISOString());
  
  if (error || !data) {
    return 0;
  }
  
  const expiredIds = data.map(d => d.id);
  
  if (expiredIds.length > 0) {
    await supabase
      .from('blocked_ips')
      .delete()
      .in('id', expiredIds);
  }
  
  return expiredIds.length;
}