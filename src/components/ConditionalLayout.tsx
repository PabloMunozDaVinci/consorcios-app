// =============================================================================
// COMPONENT: Layout Condicional - Muestra Header solo en páginas protegidas
// =============================================================================
'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { createSupabaseClient } from '@/lib/supabase';

const supabase = createSupabaseClient();

// Rutas donde NO se muestra el header
const NO_HEADER_ROUTES = ['/login', '/register', '/logout', '/recuperar-password'];

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [showHeader, setShowHeader] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        // Mostrar header si:
        // 1. Hay sesión Y no es ruta de auth
        // 2. La ruta NO es pública (login, register, etc)
        
        const isAuthRoute = NO_HEADER_ROUTES.includes(pathname);
        const isPublicRoute = pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/register') || pathname.startsWith('/recuperar-password');
        
        // Mostrar header solo si hay sesión Y estamos en ruta protegida
        setShowHeader(!!(session?.user && !isAuthRoute));
      } catch {
        setShowHeader(false);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [pathname]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {showHeader && <Header />}
      <main className={`flex-1 container mx-auto px-3 sm:px-4 py-4 sm:py-6 ${showHeader ? '' : ''}`}>
        {children}
      </main>
      {showHeader && (
        <footer className="border-t border-gray-200 bg-white py-4 text-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} Consorcios App • Administración Zero-Cost</p>
        </footer>
      )}
    </div>
  );
}