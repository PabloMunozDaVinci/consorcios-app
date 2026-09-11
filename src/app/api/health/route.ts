// =============================================================================
// API: Health Check
// =============================================================================
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET() {
  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {} as Record<string, string>,
  };

  // Check Supabase connection (sin exponer detalles internos)
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('consorcios').select('id').limit(1);
    checks.services.supabase = error ? 'error' : 'connected';
    if (error) checks.status = 'degraded';
  } catch {
    checks.services.supabase = 'error';
    checks.status = 'degraded';
  }

  const statusCode = checks.status === 'ok' ? 200 : 503;
  return NextResponse.json(checks, { status: statusCode });
}