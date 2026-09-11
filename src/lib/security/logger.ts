// =============================================================================
// LIB: Security Logger - Audit logging for security events
// =============================================================================
// Logs security events to the security_logs table

import { createSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export type SecurityEventType = 
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'jwt_invalid'
  | 'jwt_expired'
  | 'jwt_created'
  | 'blocked_ip'
  | 'blocked_ip_geo'
  | 'blocked_ip_rate_limit'
  | 'blocked_ip_brute_force'
  | 'password_reset_requested'
  | 'password_reset_success'
  | 'user_created'
  | 'user_deleted'
  | 'unauthorized_access'
  | 'rate_limit_exceeded'
  | 'suspicious_request';

export interface SecurityEvent {
  event_type: SecurityEventType;
  email?: string;
  ip_address: string;
  country_code?: string;
  user_agent?: string;
  details?: Record<string, unknown>;
}

/**
 * Log a security event
 */
export async function logSecurityEvent(event: SecurityEvent): Promise<void> {
  // Always log to console as backup
  logger.info(`[SECURITY] ${event.event_type}`, {
    ip: event.ip_address,
    email: event.email,
    details: event.details,
  });

  // Get country code if not provided (default to 'XX' - no geolocation service)
  const countryCode = event.country_code || 'XX';

  try {
    const supabase = createSupabaseAdmin();
    
    const { error } = await supabase
      .from('security_logs')
      .insert({
        event_type: event.event_type,
        email: event.email || null,
        ip_address: event.ip_address,
        country_code: countryCode,
        user_agent: event.user_agent || null,
        details: event.details ? JSON.stringify(event.details) : null,
      });

    if (error) {
      // Don't fail if logging fails - log to console as fallback
      console.error('Failed to write security_log to DB:', error);
    }
  } catch (err) {
    // Silent fail - don't expose internal errors
    console.error('Security event logging error:', err);
  }
}

/**
 * Log successful login
 */
export async function logLoginSuccess(email: string, ip: string, userAgent?: string): Promise<void> {
  await logSecurityEvent({
    event_type: 'login_success',
    email,
    ip_address: ip,
    user_agent: userAgent,
  });
}

/**
 * Log failed login attempt
 */
export async function logLoginFailed(email: string, ip: string, reason?: string, userAgent?: string): Promise<void> {
  await logSecurityEvent({
    event_type: 'login_failed',
    email,
    ip_address: ip,
    user_agent: userAgent,
    details: { reason },
  });
}

/**
 * Log logout
 */
export async function logLogout(email: string, ip: string, userAgent?: string): Promise<void> {
  await logSecurityEvent({
    event_type: 'logout',
    email,
    ip_address: ip,
    user_agent: userAgent,
  });
}

/**
 * Log IP blocking
 */
export async function logIPBlocked(
  ip: string,
  reason: 'geo_block' | 'rate_limit' | 'brute_force',
  details?: Record<string, unknown>
): Promise<void> {
  const countryCode = 'XX';
  
  await logSecurityEvent({
    event_type: 'blocked_ip',
    ip_address: ip,
    country_code: countryCode,
    details: { reason, ...details },
  });
}

/**
 * Log invalid JWT
 */
export async function logJWTInvalid(ip: string, reason: string, userAgent?: string): Promise<void> {
  await logSecurityEvent({
    event_type: 'jwt_invalid',
    ip_address: ip,
    user_agent: userAgent,
    details: { reason },
  });
}

/**
 * Log unauthorized access attempt
 */
export async function logUnauthorizedAccess(
  ip: string,
  attemptedResource: string,
  userAgent?: string
): Promise<void> {
  await logSecurityEvent({
    event_type: 'unauthorized_access',
    ip_address: ip,
    user_agent: userAgent,
    details: { attempted_resource: attemptedResource },
  });
}

/**
 * Log rate limit exceeded
 */
export async function logRateLimitExceeded(ip: string, endpoint: string): Promise<void> {
  await logSecurityEvent({
    event_type: 'rate_limit_exceeded',
    ip_address: ip,
    details: { endpoint },
  });
}

/**
 * Log suspicious request
 */
export async function logSuspiciousRequest(
  ip: string,
  reason: string,
  details?: Record<string, unknown>
): Promise<void> {
  await logSecurityEvent({
    event_type: 'suspicious_request',
    ip_address: ip,
    details: { reason, ...details },
  });
}

/**
 * Get recent security events (for admin)
 */
export async function getRecentSecurityEvents(
  limit: number = 100,
  eventType?: SecurityEventType
): Promise<SecurityEvent[]> {
  const supabase = createSupabaseAdmin();
  
  let query = supabase
    .from('security_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (eventType) {
    query = query.eq('event_type', eventType);
  }
  
  const { data, error } = await query;
  
  if (error) {
    logger.error('Error getting security events', error);
    return [];
  }
  
  return (data || []) as unknown as SecurityEvent[];
}

/**
 * Get security stats (for dashboard)
 */
export async function getSecurityStats(): Promise<{
  totalEvents: number;
  blockedIPs: number;
  failedLoginsToday: number;
  successfulLoginsToday: number;
}> {
  const supabase = createSupabaseAdmin();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Total events
  const { count: totalEvents } = await supabase
    .from('security_logs')
    .select('*', { count: 'exact', head: true });
  
  // Blocked IPs
  const { count: blockedIPs } = await supabase
    .from('blocked_ips')
    .select('*', { count: 'exact', head: true });
  
  // Failed logins today
  const { count: failedLoginsToday } = await supabase
    .from('security_logs')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'login_failed')
    .gte('created_at', today.toISOString());
  
  // Successful logins today
  const { count: successfulLoginsToday } = await supabase
    .from('security_logs')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'login_success')
    .gte('created_at', today.toISOString());
  
  return {
    totalEvents: totalEvents || 0,
    blockedIPs: blockedIPs || 0,
    failedLoginsToday: failedLoginsToday || 0,
    successfulLoginsToday: successfulLoginsToday || 0,
  };
}