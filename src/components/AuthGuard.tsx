// =============================================================================
// COMPONENT: AuthGuard - Client-side authentication protection
// =============================================================================
// Wraps protected content and redirects to login if not authenticated

'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function AuthGuard({ children, requireAdmin = false }: AuthGuardProps) {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        // Get current session
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          // Not logged in - redirect to login
          router.push(`/login?redirect=${pathname}`);
          return;
        }

        // Rol desde la tabla usuarios (no del hack unidad_id IS NULL).
        const { data: usuario } = await supabase
          .from('usuarios')
          .select('rol')
          .eq('auth_user_id', session.user.id)
          .eq('activo', true)
          .maybeSingle();

        const isAdmin = usuario?.rol === 'admin' || usuario?.rol === 'super_admin';

        // Check admin requirement
        if (requireAdmin && !isAdmin) {
          router.push('/');
          return;
        }

        setAuthorized(true);
      } catch {
        router.push(`/login?redirect=${pathname}`);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        router.push(`/login?redirect=${pathname}`);
      }
    });

    return () => subscription.unsubscribe();
  }, [pathname, router, requireAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return <>{children}</>;
}

// =============================================================================
// COMPONENT: LoadingFallback - Shows while checking auth
// =============================================================================

export function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-gray-500">Cargando...</p>
      </div>
    </div>
  );
}

// =============================================================================
// COMPONENT: AuthRequired - Simple wrapper for pages
// =============================================================================

interface AuthRequiredProps {
  children: React.ReactNode;
}

export function AuthRequired({ children }: AuthRequiredProps) {
  return <AuthGuard>{children}</AuthGuard>;
}

// =============================================================================
// COMPONENT: AdminOnly - Wrapper requiring admin role
// =============================================================================

interface AdminOnlyProps {
  children: React.ReactNode;
}

export function AdminOnly({ children }: AdminOnlyProps) {
  return <AuthGuard requireAdmin>{children}</AuthGuard>;
}