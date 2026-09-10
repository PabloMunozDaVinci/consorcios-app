// =============================================================================
// PAGE: Admin Mora - Gestión de Mora
// =============================================================================
import { Users, Play, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { evaluarYEnviarMora } from '@/actions/mora';
import { getMoraStats } from '@/actions/consorcios';
import type { MoraStats } from '@/types';

// Las stats se consultan por request (no prerender en build).
export const dynamic = 'force-dynamic';

const STATS_VACIAS: MoraStats = {
  total: 0,
  al_dia: 0,
  deudor: 0,
  apto_carta: 0,
  inicio_juicio: 0,
  juicio_en_curso: 0,
};

export default async function MoraPage() {
  const statsResult = await getMoraStats();
  const stats: MoraStats = statsResult.success && statsResult.data ? statsResult.data : STATS_VACIAS;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Mora</h1>
          <p className="text-gray-500">Control automático de deuda por expensas</p>
        </div>
        <form action={async () => {
          'use server';
          await evaluarYEnviarMora();
        }}>
          <button
            type="submit"
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <Play className="w-4 h-4" />
            Evaluar Mora
          </button>
        </form>
      </div>

      {/* Info del Flujo */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-4">Flujo Automático de Mora</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <FlujoStep
            estado="al_dia"
            label="Al Día"
            desc="Sin deuda"
            meses="0"
            icon={<CheckCircle className="w-5 h-5" />}
            active={stats.al_dia > 0}
          />
          <FlujoStep
            estado="deudor"
            label="Deudor"
            desc="1-2 meses"
            meses="1-2"
            icon={<Clock className="w-5 h-5" />}
            active={stats.deudor > 0}
          />
          <FlujoStep
            estado="apto_carta"
            label="Apto Carta"
            desc="3-5 meses"
            meses="3-5"
            icon={<AlertTriangle className="w-5 h-5" />}
            active={stats.apto_carta > 0}
          />
          <FlujoStep
            estado="inicio_juicio"
            label="Juicio"
            desc="6-11 meses"
            meses="6-11"
            icon={<AlertTriangle className="w-5 h-5" />}
            active={stats.inicio_juicio > 0}
          />
          <FlujoStep
            estado="juicio_en_curso"
            label="En Juicio"
            desc="12+ meses"
            meses="12+"
            icon={<Users className="w-5 h-5" />}
            active={stats.juicio_en_curso > 0}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <StatCard title="Total Unidades" value={stats.total} />
        <StatCard title="Al Día" value={stats.al_dia} color="green" />
        <StatCard title="Deudor" value={stats.deudor} color="yellow" />
        <StatCard title="Apto Carta" value={stats.apto_carta} color="orange" />
        <StatCard title="En Juicio" value={stats.inicio_juicio + stats.juicio_en_curso} color="red" />
      </div>

      {/* Tabla de morosos */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="font-semibold">Unidades con Mora</h3>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Unidad</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Propietario</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Estado</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Meses</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Monto</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Última Notificación</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {/* Rows van a completar cuando haya datos */}
            <tr>
              <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                No hay morosos detectados. Ejecutá "Evaluar Mora" para actualizar.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Config Email */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <h3 className="font-semibold mb-4">Configuración de Emails</h3>
        <div className="space-y-4 text-sm text-gray-600">
          <p>Los emails se envían automáticamente según el estado:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Deudor (1-2 meses):</strong> Notificación amigable</li>
            <li><strong>Apto Carta (3-5 meses):</strong> Carta documento - 10 días para pagar</li>
            <li><strong>Inicio Juicio (6-11 meses):</strong> Aviso de acción legal</li>
            <li><strong>Juicio en Curso (12+ meses):</strong> Juicio de ejecución</li>
          </ul>
          <p className="text-gray-400">Configurá Resend API Key en .env.local para habilitar emails.</p>
        </div>
      </div>
    </div>
  );
}

function FlujoStep({
  estado,
  label,
  desc,
  meses,
  icon,
  active,
}: {
  estado: string;
  label: string;
  desc: string;
  meses: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <div className={`text-center p-4 rounded-lg border ${active ? 'bg-white border-blue-300' : 'bg-white/50 border-gray-200'}`}>
      <div className={`mx-auto w-10 h-10 rounded-full flex items-center justify-center mb-2 ${active ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
        {icon}
      </div>
      <p className="font-medium text-gray-900">{label}</p>
      <p className="text-xs text-gray-500">{desc}</p>
      <p className="text-xs text-gray-400">{meses} meses</p>
    </div>
  );
}

function StatCard({ title, value, color = 'blue' }: { title: string; value: number; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    yellow: 'text-yellow-600',
    orange: 'text-orange-600',
    red: 'text-red-600',
  };
  return (
    <div className="bg-white rounded-xl border p-4">
      <p className={`text-2xl font-bold ${colors[color]}`}>{value}</p>
      <p className="text-sm text-gray-500">{title}</p>
    </div>
  );
}