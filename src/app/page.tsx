// =============================================================================
// PAGE: Home - Landing Page (Public when not authenticated)
// =============================================================================
import Link from 'next/link';
import { Building2, LogIn, Users, Wrench, CreditCard, AlertTriangle, CheckCircle } from 'lucide-react';

// FORZAR RENDERIZADO DINÁMICO
export const dynamic = 'force-dynamic';

// Metadata
export const metadata = {
  title: 'Consorcios App',
  description: 'Administración de consorcios',
};

export default async function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Hero Section - Always visible */}
      <section className="flex-1 flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="max-w-2xl">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-2xl mb-6">
            <Building2 className="w-10 h-10 text-white" />
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            🏢 Consorcios App
          </h1>
          
          <p className="text-xl text-gray-600 mb-8">
            Administración de consorcios Zero-Cost. 
            <br />
            Gestión de edificios, expensas, mora automática y mantenimiento.
          </p>

          {/* Login CTA */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-xl text-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              <LogIn className="w-5 h-5" />
              Iniciar Sesión
            </Link>
          </div>

          <p className="mt-4 text-sm text-gray-500">
            ¿No tenés cuenta? Contactá al administrador de tu consorcio.
          </p>
        </div>
      </section>

      {/* Features - Visible to everyone */}
      <section className="bg-white border-t py-12">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-8">Características</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Feature 
              icon={Building2} 
              title="Gestión de Consorcios" 
              description="Administra múltiples edificios y complejos residenciales"
            />
            <Feature 
              icon={CreditCard} 
              title="Control de Expensas" 
              description="Registrá pagos y seguí el estado de cada unidad"
            />
            <Feature 
              icon={AlertTriangle} 
              title="Mora Automática" 
              description="El sistema detecta y gestiona automáticamente la mora"
            />
            <Feature 
              icon={Wrench} 
              title="Mantenimiento" 
              description="Solicitá y seguí arreglos y mejoras"
            />
            <Feature 
              icon={Users} 
              title="Propietarios" 
              description="Gestión completa de propietarios e inquilinos"
            />
            <Feature 
              icon={CheckCircle} 
              title="Zero-Cost" 
              description="Totalmente gratuito - código abierto"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 text-center">
        <p>© 2026 Consorcios App • Administración Zero-Cost</p>
      </footer>
    </div>
  );
}

function Feature({ 
  icon: Icon, 
  title, 
  description 
}: { 
  icon: React.ElementType; 
  title: string; 
  description: string;
}) {
  return (
    <div className="flex flex-col items-center text-center p-4">
      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-blue-600" />
      </div>
      <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}
