'use client';

// =============================================================================
// COMPONENT: Header - Responsive Navigation
// =============================================================================
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, Wrench, CreditCard, Users, Home, List, X } from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { href: '/consorcios', label: 'Consorcios', icon: Building2 },
  { href: '/unidades', label: 'Unidades', icon: Home },
  { href: '/mantenimiento', label: 'Mantenimiento', icon: Wrench },
  { href: '/pagos', label: 'Pagos', icon: CreditCard },
  { href: '/admin/mora', label: 'Mora', icon: Users },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    // Close mobile menu on navigation
    setMobileMenuOpen(false);
    // Allow default link behavior to continue
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      {/* Main Bar */}
      <div className="flex items-center justify-between h-14 px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Building2 className="w-7 h-7 text-blue-600" />
          <span className="text-lg font-bold text-gray-900">Consorcios</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors
                  ${isActive 
                    ? 'text-blue-700 bg-blue-50 font-medium' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }
                `}
              >
                <item.icon className="w-4 h-4" />
                <span className="hidden lg:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Mobile Menu Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-lg bg-blue-100 hover:bg-blue-200 active:bg-blue-300 transition-colors"
          aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? (
            <X className="w-6 h-6 text-blue-700" />
          ) : (
            <List className="w-6 h-6 text-blue-700" />
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-gray-50 animate-in slide-in-from-top-2 duration-200">
          <nav className="flex flex-col p-2 gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 text-base rounded-lg transition-colors
                    ${isActive 
                      ? 'text-blue-700 bg-blue-100 font-medium' 
                      : 'text-gray-800 hover:bg-blue-100'
                    }
                  `}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}