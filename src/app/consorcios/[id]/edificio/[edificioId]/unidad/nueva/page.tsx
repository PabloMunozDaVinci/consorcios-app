// =============================================================================
// PAGE: Nueva Unidad - Crear Unidad Manual en un Edificio
// =============================================================================
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Home, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ id: string; edificioId: string }>;
}

export default function NuevaUnidadPage({ params }: PageProps) {
  const router = useRouter();
  const [consorcioId, setConsorcioId] = useState<string>('');
  const [edificioId, setEdificioId] = useState<string>('');
  const formRef = useRef<HTMLFormElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdData, setCreatedData] = useState<any>(null);

  useEffect(() => {
    params.then(p => {
      setConsorcioId(p.id);
      setEdificioId(p.edificioId);
    });
  }, [params]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    
    if (!consorcioId || !edificioId) return;
    
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const formElement = e.currentTarget as HTMLFormElement;
      const formData = new FormData(formElement);
      
      const data = {
        building_id: edificioId,
        numero: formData.get('numero') as string,
        piso: parseInt(formData.get('piso') as string) || 0,
        tipo: formData.get('tipo') as string || 'depto',
        coeficiente: parseFloat(formData.get('coeficiente') as string) || 1.0,
        es_especial: formData.get('es_especial') === 'on',
        habitada: formData.get('habitada') === 'on',
      };

      const response = await fetch('/api/unidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(true);
        setCreatedData(result.data);
        setTimeout(() => {
          router.push(`/consorcios/${consorcioId}`);
        }, 2000);
      } else {
        setError(result.error || 'Error al crear la unidad');
        setIsLoading(false);
      }
    } catch (err) {
      setError('Error de conexión. Intenta de nuevo.');
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link 
          href={`/consorcios/${consorcioId}`} 
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nueva Unidad</h1>
          <p className="text-gray-500">Agregar unidad al edificio</p>
        </div>
      </div>

      {/* Success */}
      {success && (
        <div className="p-6 bg-green-50 border-2 border-green-300 rounded-xl text-green-800 flex items-start gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="font-bold text-lg">¡Unidad creada exitosamente!</p>
            {createdData && (
              <p className="text-sm mt-1">
                Unidad {createdData.numero} - Piso {createdData.piso}
              </p>
            )}
            <p className="text-sm mt-2">Redirigiendo...</p>
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
      <form 
        ref={formRef}
        onSubmit={handleSubmit} 
        className={`bg-white rounded-xl border shadow-sm p-6 space-y-6 ${isLoading ? 'opacity-70 pointer-events-none' : ''}`}
      >
        {/* Número */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Número de Unidad *
          </label>
          <input
            name="numero"
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
            placeholder="Ej: 101, A-1, PB-1"
            autoFocus
          />
        </div>

        {/* Piso */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Piso
          </label>
          <input
            name="piso"
            type="number"
            defaultValue="0"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
          />
        </div>

        {/* Tipo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tipo de Unidad
          </label>
          <select 
            name="tipo" 
            defaultValue="depto"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
          >
            <option value="depto">Departamento</option>
            <option value="cochera">Cochera</option>
            <option value="baulera">Baulera</option>
          </select>
        </div>

        {/* Coeficiente */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Coeficiente de Participación
          </label>
          <input
            name="coeficiente"
            type="number"
            step="0.01"
            defaultValue="1.0"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
          />
          <p className="text-xs text-gray-500 mt-1">
            Porcentaje de participación en gastos comunes
          </p>
        </div>

        {/* Checkboxes */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input type="checkbox" name="es_especial" id="es_especial" className="w-5 h-5" />
            <label htmlFor="es_especial" className="text-sm text-gray-700">
              Unidad especial (ej: local comercial, oficina)
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" name="habitada" id="habitada" className="w-5 h-5" />
            <label htmlFor="habitada" className="text-sm text-gray-700">
              Actualmente habitada
            </label>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors flex items-center justify-center gap-3 text-lg font-medium"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Creando...
            </>
          ) : (
            <>
              <Home className="w-5 h-5" />
              Crear Unidad
            </>
          )}
        </button>
      </form>
    </div>
  );
}