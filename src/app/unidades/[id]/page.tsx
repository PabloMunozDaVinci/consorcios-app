// =============================================================================
// PAGE: Unidad Detalle - Ver Una Unidad
// =============================================================================
import Link from 'next/link';
import { ArrowLeft, User, Home, Car, Box, CreditCard, Wrench } from 'lucide-react';
import { getUnidad } from '@/actions/consorcios';
import { getPagos } from '@/actions/consorcios';

export default async function UnidadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getUnidad(id);
  const unidad = result.success ? result.data : null;

  if (!unidad) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Unidad no encontrada</h1>
        <Link href="/unidades" className="text-blue-600 hover:underline">
          Volver a unidades
        </Link>
      </div>
    );
  }

  // Get pagos for this unidad
  const pagosResult = await getPagos(id);
  const pagos = pagosResult.success ? pagosResult.data || [] : [];

  // El embed propietario:propietarios(*) devuelve array por la dirección de
  // la FK (propietarios.unidad_id -> unidades.id); en la práctica hay 0 o 1
  // (índice único parcial, ver src/types/joins.ts).
  const propietario = unidad.propietario[0];

  const icons: Record<string, React.ReactNode> = {
    depto: <Home className="w-6 h-6" />,
    cochera: <Car className="w-6 h-6" />,
    baulera: <Box className="w-6 h-6" />,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/unidades" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
            {icons[unidad.tipo] || <Home className="w-6 h-6" />}
          </div>
          <div>
            <h1 className="text-2xl font-bold">Unidad {unidad.numero}</h1>
            <p className="text-gray-500">Piso {unidad.piso} • {unidad.tipo}</p>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Datos de la unidad */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold mb-4">Datos de la Unidad</h2>
          <div className="space-y-3">
            <InfoRow label="Tipo" value={unidad.tipo} />
            <InfoRow label="Piso" value={String(unidad.piso)} />
            <InfoRow label="Coeficiente" value={String(unidad.coeficiente)} />
            <InfoRow label="Especial" value={unidad.es_especial ? 'Sí' : 'No'} />
            {unidad.metros_cuadrados && (
              <InfoRow label="Metros" value={`${unidad.metros_cuadrados} m²`} />
            )}
          </div>
        </div>

        {/* Propietario */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold mb-4">Propietario</h2>
          {propietario ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium">{propietario.nombre} {propietario.apellido}</p>
                  <p className="text-sm text-gray-500">{propietario.email}</p>
                </div>
              </div>
              <InfoRow label="DNI" value={propietario.dni} />
              <InfoRow label="Celular" value={propietario.celular || '-'} />
            </div>
          ) : (
            <p className="text-gray-500">Sin propietario registrado</p>
          )}
        </div>
      </div>

      {/* Pagos */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Últimos Pagos</h2>
          <Link href="/pagos/nuevo" className="text-sm text-blue-600 hover:underline">
            Registrar pago
          </Link>
        </div>
        {pagos.length === 0 ? (
          <p className="text-gray-500">No hay pagos registrados</p>
        ) : (
          <div className="space-y-2">
            {pagos.slice(0, 5).map((pago) => (
              <div key={pago.id} className="flex items-center justify-between py-2 border-b">
                <div>
                  <p className="font-medium">${Number(pago.monto).toLocaleString('es-AR')}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(pago.mes_pagado).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  pago.estado === 'confirmado' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {pago.estado}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-4">
        <Link
          href={`/pagos/nuevo?unidad=${unidad.id}`}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <CreditCard className="w-4 h-4" />
          Registrar Pago
        </Link>
        <Link
          href={`/mantenimiento/nuevo?unidad=${unidad.id}`}
          className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
        >
          <Wrench className="w-4 h-4" />
          Solicitar Arreglo
        </Link>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}