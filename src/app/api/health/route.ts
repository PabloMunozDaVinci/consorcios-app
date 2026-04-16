// =============================================================================
// API: Health Check
// =============================================================================
import { createSupabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime?.() || 'unknown',
    memory: 'unknown',
    services: {} as Record<string, string>,
  };

  // Check memory
  if (typeof process.memoryUsage === 'function') {
    const mem = process.memoryUsage();
    checks.memory = `${Math.round(mem.heapUsed / 1024 / 1024)}MB / ${Math.round(mem.heapTotal / 1024 / 1024)}MB`;
  }

  // Check Supabase connection
  try {
    const supabase = createSupabaseAdmin();
    const { error } = await supabase.from('consorcios').select('id').limit(1);
    
    checks.services.supabase = error ? `error: ${error.message}` : 'connected';
  } catch (err: any) {
    checks.services.supabase = `error: ${err.message}`;
    checks.status = 'degraded';
  }

  const statusCode = checks.status === 'ok' ? 200 : 503;
  return NextResponse.json(checks, { status: statusCode });
}