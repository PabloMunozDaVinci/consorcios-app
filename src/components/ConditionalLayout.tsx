// =============================================================================
// COMPONENT: Layout Condicional - Muestra Header solo en páginas protegidas
// =============================================================================
'use client';

import { usePathname } from 'next/navigation';
import { Header } from '@/components/Header';
import { UserProvider, useUser } from '@/hooks/useUser';

// Rutas donde NO se muestra el header
const NO_HEADER_ROUTES = ['/login', '/register', '/logout', '/recuperar-password'];

function ConditionalLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Misma fuente de verdad que el Header (ver useUser.tsx): antes acá había
  // un getSession() propio, separado del getUser() del Header, y las dos
  // lecturas independientes podían resolver en momentos distintos — eso
  // producía la pantalla post-login mostrando "Iniciar sesión" con el
  // Header ya montado. Ahora ambos leen del mismo UserProvider.
  const { user, loading } = useUser();

  const isAuthRoute = NO_HEADER_ROUTES.includes(pathname);
  const showHeader = !!user && !isAuthRoute;

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

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <ConditionalLayoutInner>{children}</ConditionalLayoutInner>
    </UserProvider>
  );
}