// =============================================================================
// PAGE: Unidades - Lista de Todas las Unidades
// =============================================================================
import Link from 'next/link';
import { Users, Building2, Home, Car, Box, Plus } from 'lucide-react';
import { getAllUnidades } from '@/actions/consorcios';
import type { UnidadConPropietarioYEdificioResumen } from '@/types/joins';

// FORZAR RENDERIZADO DINÁMICO - Sin cache
export const dynamic = 'force-dynamic';

export default async function UnidadesPage() {
  const result = await getAllUnidades();
  const unidades = result.success ? result.data || [] : [];

  const deptos = unidades.filter((u) => u.tipo === 'depto');
  const cocheras = unidades.filter((u) => u.tipo === 'cochera');
  const bauleras = unidades.filter((u) => u.tipo === 'baulera');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Unidades</h1>
          <p className="text-gray-500">Todas las unidades funcionales</p>
        </div>
        <Link 
          href="/unidades/nueva"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Agregar Unidad
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total" value={unidades.length} icon={<Users className="w-5 h-5" />} />
        <StatCard title="Departamentos" value={deptos.length} icon={<Home className="w-5 h-5" />} />
        <StatCard title="Cocheras" value={cocheras.length} icon={<Car className="w-5 h-5" />} />
        <StatCard title="Bauleras" value={bauleras.length} icon={<Box className="w-5 h-5" />} />
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Link href="/unidades" className="px-4 py-2 bg-blue-600 text-white rounded-lg">Todos</Link>
        <Link href="/unidades?tipo=depto" className="px-4 py-2 border rounded-lg hover:bg-gray-50">Deptos</Link>
        <Link href="/unidades?tipo=cochera" className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cocheras</Link>
        <Link href="/unidades?tipo=baulera" className="px-4 py-2 border rounded-lg hover:bg-gray-50">Bauleras</Link>
      </div>

      {/* List */}
      {unidades.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {unidades.map((u) => (
            <UnidadCard key={u.id} unidad={u} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
      <div className="text-gray-400">{icon}</div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-gray-500">{title}</p>
      </div>
    </div>
  );
}

function UnidadCard({ unidad }: { unidad: UnidadConPropietarioYEdificioResumen }) {
  const icons: Record<string, React.ReactNode> = {
    depto: <Home className="w-5 h-5" />,
    cochera: <Car className="w-5 h-5" />,
    baulera: <Box className="w-5 h-5" />,
  };
  // El embed propietario:propietarios(*) devuelve array por la dirección de
  // la FK; en la práctica hay 0 o 1 (ver src/types/joins.ts).
  const propietario = unidad.propietario[0];

  return (
    <Link href={`/unidades/${unidad.id}`} className="block bg-white rounded-xl border p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
          {icons[unidad.tipo] || <Building2 className="w-5 h-5" />}
        </div>
        <span className="text-2xl font-bold">{unidad.numero}</span>
      </div>
      <p className="text-sm text-gray-500">Piso {unidad.piso}</p>
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-gray-400">Coef: {unidad.coeficiente}</p>
        {unidad.es_especial && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">Especial</span>}
      </div>
      {propietario && (
        <p className="text-xs text-gray-500 mt-2">{propietario.apellido}, {propietario.nombre}</p>
      )}
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12 bg-white rounded-xl border">
      <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">No hay unidades</h3>
      <p className="text-gray-500 mb-4">Agregá tu primera unidad a un edificio existente.</p>
      <Link href="/unidades/nueva" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg">
        <Plus className="w-4 h-4" />
        Agregar Unidad
      </Link>
    </div>
  );
}
