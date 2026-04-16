// =============================================================================
// PAGE: Pagos Nuevo - Registrar Pago
// =============================================================================
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function NuevoPagoPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const formData = new FormData(e.currentTarget as HTMLFormElement);
      
      const data = {
        unidad_id: formData.get('unidad_id') as string,
        monto: formData.get('monto') as string,
        mes_pagado: formData.get('mes_pagado') as string,
        medio_pago: formData.get('medio_pago') as string || 'transferencia',
        nro_comprobante: formData.get('nro_comprobante') as string || undefined,
      };
      
      console.log('Creating:', data);
      
      const response = await fetch('/api/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      const result = await response.json();
      console.log('Result:', result);
      
      if (result.success) {
        setSuccess(true);
        setTimeout(() => router.push('/pagos'), 2000);
      } else {
        setError(result.error || 'Error al registrar pago');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Error de conexión');
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/pagos" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Registrar Pago</h1>
          <p className="text-gray-500">Cargar comprobante de expensa</p>
        </div>
      </div>

      {/* Success */}
      {success && (
        <div className="p-6 bg-green-50 border-2 border-green-300 rounded-xl text-green-800 flex items-start gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="font-bold text-lg">¡Pago registrado!</p>
            <p className="text-sm mt-1">Redirigiendo...</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-6 bg-red-50 border-2 border-red-300 rounded-xl text-red-800 flex items-start gap-4">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="font-bold text-lg">Error</p>
            <p className="text-sm mt-1">{error}</p>
            <button onClick={() => setError(null)} className="text-sm underline mt-2">Cerrar</button>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border shadow-sm p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Monto *</label>
          <input
            name="monto"
            type="number"
            required
            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="150000"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mes que se paga *</label>
          <input
            name="mes_pagado"
            type="month"
            required
            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Medio de Pago</label>
          <select name="medio_pago" className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500">
            <option value="transferencia">Transferencia</option>
            <option value="rapipago">Rapipago</option>
            <option value="boca">Pago en boca</option>
            <option value="tarjeta">Tarjeta</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Número de Comprobante</label>
          <input
            name="nro_comprobante"
            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Opcional"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 flex items-center justify-center gap-2 text-lg font-medium"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          {isLoading ? 'Registrando...' : 'Registrar Pago'}
        </button>
      </form>
    </div>
  );
}
