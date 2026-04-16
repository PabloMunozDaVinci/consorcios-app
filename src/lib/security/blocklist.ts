// =============================================================================
// LIB: Blocklist - IP blocking management
// =============================================================================
// Manages blocked IPs based on geolocation, rate limiting, and brute force

import { createSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';

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
  const supabase = createSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('blocked_ips')
    .select('*')
    .eq('ip_address', ip)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  // Check if temporary block has expired
  if (data.blocked_until) {
    const blockedUntil = new Date(data.blocked_until);
    if (blockedUntil < new Date()) {
      // Block expired, remove it
      await unblockIP(ip);
      return null;
    }
  }
  
  return data as BlockedIP;
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
  
  return count || 0;
}

/**
 * Check if IP should be blocked due to rate limiting
 * Rules:
 * - >5 failed logins = block for 15 min
 * - >20 attempts in a day (any type) = block for 24 hours
 */
export async function checkAndBlockIfNeeded(ip: string, countryCode: string): Promise<boolean> {
  // Check failed login attempts (for brute force)
  // This would need to query security_logs
  // For now, we'll use blocked_ips attempts_count
  
  const blocked = await isIPBlocked(ip);
  if (blocked) {
    return true;
  }
  
  // For now, not blocking based on this in middleware
  // The actual blocking happens in middleware based on events
  return false;
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