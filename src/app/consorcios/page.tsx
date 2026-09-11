// =============================================================================
// PAGE: Consorcios - Listar Consorcios
// =============================================================================
import Link from 'next/link';
import { Building2, Plus, MapPin, Mail, Phone } from 'lucide-react';
import { getConsorcios } from '@/actions/consorcios';

// FORZAR RENDERIZADO DINÁMICO - Sin cache para que siempre muestre datos frescos
export const dynamic = 'force-dynamic';

export default async function ConsorciosPage() {
  const result = await getConsorcios();
  const consorcios = result.success ? result.data || [] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Consorcios</h1>
          <p className="text-gray-500">Gestión de edificios y complejos</p>
        </div>
        <Link
          href="/consorcios/nuevo"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo Consortium
        </Link>
      </div>

      {/* List */}
      {consorcios.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {consorcios.map((c) => (
            <Link
              key={c.id}
              href={`/consorcios/${c.id}`}
              className="block bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-blue-600" />
                </div>
                <span className="text-sm text-gray-500">
                  {c.edificios?.length || 0} edificio
                </span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{c.nombre}</h3>
              <div className="space-y-2 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span>{c.direccion}, {c.ciudad}</span>
                </div>
                {c.email_admin && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    <span>{c.email_admin}</span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12 bg-white rounded-xl border">
      <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">No hay consorcios</h3>
      <p className="text-gray-500 mb-4">Creá tu primer consorcio para comenzar</p>
      <Link
        href="/consorcios/nuevo"
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg"
      >
        <Plus className="w-4 h-4" />
        Crear Consortium
      </Link>
    </div>
  );
}