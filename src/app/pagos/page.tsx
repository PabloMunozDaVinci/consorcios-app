// =============================================================================
// PAGE: Pagos - Lista de Pagos
// =============================================================================
import Link from 'next/link';
import { CreditCard, Plus, CheckCircle, XCircle, Clock } from 'lucide-react';
import { getAllPagos } from '@/actions/consorcios';

// FORZAR RENDERIZADO DINÁMICO - Sin cache
export const dynamic = 'force-dynamic';

export default async function PagosPage() {
  const result = await getAllPagos();
  const pagos = result.success ? result.data || [] : [];

  const confirmados = pagos.filter((p) => p.estado === 'confirmado');
  const pendientes = pagos.filter((p) => p.estado === 'pendiente');
  const rechazados = pagos.filter((p) => p.estado === 'rechazado');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pagos</h1>
          <p className="text-gray-500">Registro de expensas pagadas</p>
        </div>
        <Link
          href="/pagos/nuevo"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Registrar Pago
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total" value={pagos.length} />
        <StatCard title="Confirmados" value={confirmados.length} color="green" />
        <StatCard title="Pendientes" value={pendientes.length} color="yellow" />
        <StatCard title="Rechazados" value={rechazados.length} color="red" />
      </div>

      {/* List */}
      {pagos.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Unidad</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Monto</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Mes</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Medio</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Estado</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pagos.map((pago) => (
                <tr key={pago.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {pago.unidad?.numero || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    ${Number(pago.monto).toLocaleString('es-AR')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {pago.mes_pagado ? new Date(pago.mes_pagado).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }) : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 capitalize">
                    {pago.medio_pago || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <EstadoBadge estado={pago.estado ?? ''} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {pago.fecha_pago ? new Date(pago.fecha_pago).toLocaleDateString('es-AR') : '-'}
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

function StatCard({ title, value, color = 'blue' }: { title: string; value: number; color?: string }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-gray-500">{title}</p>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const config: Record<string, { bg: string; text: string; label: string; icon: string }> = {
    confirmado: { bg: 'bg-green-100', text: 'text-green-800', label: 'Confirmado', icon: '✓' },
    pendiente: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pendiente', icon: '⏳' },
    rechazado: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rechazado', icon: '✗' },
  };
  const s = config[estado] || config.pendiente;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      <span>{s.icon}</span> {s.label}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12 bg-white rounded-xl border">
      <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">No hay pagos</h3>
      <p className="text-gray-500 mb-4">Registrá el primer pago de expensas</p>
      <Link href="/pagos/nuevo" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg">
        <Plus className="w-4 h-4" />
        Registrar Pago
      </Link>
    </div>
  );
}