// =============================================================================
// PAGE: Home - Dashboard Principal
// =============================================================================
import Link from 'next/link';
import { Building2, Users, Wrench, CreditCard, AlertTriangle, CheckCircle } from 'lucide-react';
import { getAllCounts } from '@/actions/consorcios';

// FORZAR RENDERIZADO DINÁMICO - Sin cache
export const dynamic = 'force-dynamic';

export default async function Home() {
  // Get all counts from database
  const countsResult = await getAllCounts();
  const counts = countsResult.success && countsResult.data
    ? countsResult.data 
    : { consorcios: 0, unidades: 0, mora: 0, arreglos: 0 };

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <section className="text-center py-8 sm:py-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
          🏢 Consorcios App
        </h1>
        <p className="text-base sm:text-xl text-gray-600 max-w-2xl mx-auto px-4">
          Administración de consorcios Zero-Cost. 
          Gestión de edificios, expensas, mora automática y mantenimiento.
        </p>
      </section>

      {/* Stats Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Consorcios"
          value={String(counts.consorcios)}
          icon={Building2}
          href="/consorcios"
          color="blue"
        />
        <StatCard
          title="Unidades"
          value={String(counts.unidades)}
          icon={Users}
          href="/unidades"
          color="green"
        />
        <StatCard
          title="En Mora"
          value={String(counts.mora)}
          icon={AlertTriangle}
          href="/admin/mora"
          color="red"
        />
        <StatCard
          title="Arreglos"
          value={String(counts.arreglos)}
          icon={Wrench}
          href="/mantenimiento"
          color="yellow"
        />
      </section>

      {/* Quick Actions */}
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-xl font-semibold mb-4">Acciones Rápidas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickAction
            title="Nuevo Consorcio"
            description="Crear edificio o complejo"
            href="/consorcios/nuevo"
          />
          <QuickAction
            title="Registrar Pago"
            description="Cargar expensa pagada"
            href="/pagos/nuevo"
          />
          <QuickAction
            title="Solicitar Arreglo"
            description="Reportar mantenimiento"
            href="/mantenimiento/nuevo"
          />
          <QuickAction
            title="Evaluar Mora"
            description="Revisión automática"
            href="/admin/mora"
          />
        </div>
      </section>

      {/* Features */}
      <section className="bg-blue-50 rounded-xl border border-blue-100 p-6">
        <h2 className="text-xl font-semibold mb-4 text-blue-900">Características</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Feature icon={CheckCircle} text="PostgreSQL con Supabase" />
          <Feature icon={CheckCircle} text="Búsqueda global por nombre/DNI/unidad" />
          <Feature icon={CheckCircle} text="Flujo automático de mora" />
          <Feature icon={CheckCircle} text="Subida de fotos con compresión WebP" />
          <Feature icon={CheckCircle} text="RLS: cada propietario ve su unidad" />
          <Feature icon={CheckCircle} text="Email automatizado con Resend" />
        </div>
      </section>
    </div>
  );
}

// ----------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------

function StatCard({
  title,
  value,
  icon: Icon,
  href,
  color,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  href: string;
  color: 'blue' | 'green' | 'red' | 'yellow';
}) {
  const colors = {
    blue: 'text-blue-600 bg-blue-100',
    green: 'text-green-600 bg-green-100',
    red: 'text-red-600 bg-red-100',
    yellow: 'text-yellow-600 bg-yellow-100',
  };

  return (
    <Link
      href={href}
      className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow"
    >
      <div className={`w-12 h-12 rounded-lg ${colors[color]} flex items-center justify-center mb-4`}>
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{title}</p>
    </Link>
  );
}

function QuickAction({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block p-4 border rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
    >
      <p className="font-medium text-gray-900">{title}</p>
      <p className="text-sm text-gray-500">{description}</p>
    </Link>
  );
}

function Feature({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-5 h-5 text-green-600" />
      <span className="text-gray-700">{text}</span>
    </div>
  );
}