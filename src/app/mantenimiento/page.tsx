// =============================================================================
// PAGE: Mantenimiento - Lista de Arreglos/Solicitudes
// =============================================================================
import Link from 'next/link';
import { Wrench, Plus, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { getArreglos } from '@/actions/consorcios';

// FORZAR RENDERIZADO DINÁMICO - Sin cache
export const dynamic = 'force-dynamic';

export default async function MantenimientoPage() {
  const result = await getArreglos();
  const arreglos = result.success ? result.data || [] : [];

  // Filtrar por estado
  const pendientes = arreglos.filter((a: any) => a.estado === 'pendiente');
  const enProgreso = arreglos.filter((a: any) => a.estado === 'en_progreso');
  const completados = arreglos.filter((a: any) => a.estado === 'completado');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mantenimiento</h1>
          <p className="text-gray-500">Solicitudes de arreglos y mantenimiento</p>
        </div>
        <Link
          href="/mantenimiento/nuevo"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Nueva Solicitud
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total" value={arreglos.length} color="blue" />
        <StatCard title="Pendientes" value={pendientes.length} color="yellow" />
        <StatCard title="En Progreso" value={enProgreso.length} color="blue" />
        <StatCard title="Completados" value={completados.length} color="green" />
      </div>

      {/* List */}
      {arreglos.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Título</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Unidad</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Estado</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {arreglos.map((arreglo: any) => (
                <tr key={arreglo.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{arreglo.titulo}</p>
                      <p className="text-sm text-gray-500">{arreglo.descripcion?.slice(0, 50)}...</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {arreglo.unidad?.numero || 'Área común'}
                  </td>
                  <td className="px-6 py-4">
                    <EstadoBadge estado={arreglo.estado} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(arreglo.fecha_solicitud).toLocaleDateString('es-AR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, color }: { title: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'text-blue-600 bg-blue-100',
    green: 'text-green-600 bg-green-100',
    yellow: 'text-yellow-600 bg-yellow-100',
    red: 'text-red-600 bg-red-100',
  };
  return (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-gray-500">{title}</p>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const estados: Record<string, { bg: string; text: string; label: string }> = {
    pendiente: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pendiente' },
    aprobado: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Aprobado' },
    en_progreso: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'En Progreso' },
    completado: { bg: 'bg-green-100', text: 'text-green-800', label: 'Completado' },
    cancelado: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelado' },
  };
  const s = estados[estado] || estados.pendiente;
  return (
    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12 bg-white rounded-xl border">
      <Wrench className="w-12 h-12 text-gray-300 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">No hay solicitudes</h3>
      <p className="text-gray-500 mb-4">Creá tu primera solicitud de mantenimiento</p>
      <Link href="/mantenimiento/nuevo" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg">
        <Plus className="w-4 h-4" />
        Nueva Solicitud
      </Link>
    </div>
  );
}