// =============================================================================
// PAGE: Detalle de Consorcio
// =============================================================================
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Building2, MapPin, Mail, Phone, Plus, Home, Users } from 'lucide-react';
import { getConsorcio } from '@/actions/consorcios';

// FORZAR RENDERIZADO DINÁMICO - Sin cache
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ConsorcioDetallePage({ params }: Props) {
  const { id } = await params;
  
  const consorcioResult = await getConsorcio(id);
  
  if (!consorcioResult.success || !consorcioResult.data) {
    notFound();
  }
  
  const consorcio = consorcioResult.data;
  const edificios = consorcio.edificios || [];
  
  // Calcular stats
  const totalUnidades = edificios.reduce((acc, e) => acc + (e.unidades?.length || 0), 0);
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/consorcios"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{consorcio.nombre}</h1>
          <p className="text-gray-500">Detalles del consorcio</p>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-white rounded-xl border p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Dirección</p>
              <p className="font-medium">{consorcio.direccion}</p>
              <p className="text-sm text-gray-600">{consorcio.ciudad}</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Edificios</p>
              <p className="text-2xl font-bold">{edificios.length}</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Home className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Unidades</p>
              <p className="text-2xl font-bold">{totalUnidades}</p>
            </div>
          </div>
          
          {consorcio.email_admin && (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Email Admin</p>
                <p className="font-medium truncate">{consorcio.email_admin}</p>
              </div>
            </div>
          )}
        </div>

        {consorcio.telefono && (
          <div className="mt-4 pt-4 border-t flex items-center gap-2 text-gray-600">
            <Phone className="w-4 h-4" />
            <span>{consorcio.telefono}</span>
          </div>
        )}
      </div>

      {/* Edificios */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Edificios</h2>
          <Link 
            href={`/consorcios/${id}/edificio/nuevo`}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Nuevo Edificio
          </Link>
        </div>

        {edificios.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay edificios</h3>
            <p className="text-gray-500 mb-4">Agregá el primer edificio a este consorcio</p>
            <Link 
              href={`/consorcios/${id}/edificio/nuevo`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Crear Edificio
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {edificios.map((edificio) => (
              <div
                key={edificio.id}
                className="bg-white rounded-xl border p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-blue-600" />
                  </div>
                  <span className="text-sm text-gray-500">
                    {edificio.unidades?.length || 0} unidades
                  </span>
                </div>
                
                <h3 className="font-semibold text-gray-900 mb-2">
                  {edificio.nombre || 'Edificio'}
                </h3>
                
                {edificio.direccion && (
                  <p className="text-sm text-gray-500 mb-2">{edificio.direccion}</p>
                )}
                
                <div className="flex gap-4 text-sm text-gray-500 mb-4">
                  <span>{edificio.pisos} pisos</span>
                  <span>{edificio.unidades_por_piso} por piso</span>
                </div>

                {/* Botón para agregar unidad */}
                <Link
                  href={`/consorcios/${id}/edificio/${edificio.id}/unidad/nueva`}
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Agregar unidad
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}