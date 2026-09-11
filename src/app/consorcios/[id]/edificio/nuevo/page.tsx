// =============================================================================
// PAGE: Nuevo Edificio - Crear Edificio dentro de un Consorcio
// =============================================================================
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Building2, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function NuevoEdificioPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const router = useRouter();
  const [consorcioId, setConsorcioId] = useState<string>('');
  const formRef = useRef<HTMLFormElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdData, setCreatedData] = useState<{ nombre: string } | null>(null);

  useEffect(() => {
    params.then(p => setConsorcioId(p.id));
  }, [params]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    
    if (!consorcioId) return;
    
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const formElement = e.currentTarget as HTMLFormElement;
      const formData = new FormData(formElement);
      
      const data = {
        nombre: formData.get('nombre') as string,
        direccion: (formData.get('direccion') as string) || null,
        pisos: parseInt(formData.get('pisos') as string) || 1,
        unidades_por_piso: parseInt(formData.get('unidades_por_piso') as string) || 1,
        consortium_id: consorcioId,
      };

      const response = await fetch('/api/edificios', {
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
        setError(result.error || 'Error al crear el edificio');
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
          <h1 className="text-2xl font-bold text-gray-900">Nuevo Edificio</h1>
          <p className="text-gray-500">Agregar edificio al consorcio</p>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="p-6 bg-green-50 border-2 border-green-300 rounded-xl text-green-800 flex items-start gap-4 animate-pulse">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="font-bold text-lg">¡Edificio creado exitosamente!</p>
            {createdData && (
              <p className="text-sm mt-1 opacity-80">
                &quot;{createdData.nombre}&quot;
              </p>
            )}
            <p className="text-sm mt-2">Redirigiendo...</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-6 bg-red-50 border-2 border-red-300 rounded-xl text-red-800 flex items-start gap-4">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="font-bold text-lg">Error al crear</p>
            <p className="text-sm mt-1">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="text-sm underline mt-2 hover:no-underline"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Form */}
      <form 
        ref={formRef}
        onSubmit={handleSubmit} 
        className={`bg-white rounded-xl border shadow-sm p-6 space-y-6 ${isLoading ? 'opacity-70 pointer-events-none' : ''}`}
      >
        {/* Nombre */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre del Edificio *
          </label>
          <input
            name="nombre"
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
            placeholder="Ej: Torre A, Edificio Principal"
            autoFocus
          />
        </div>

        {/* Dirección */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dirección (opcional)
          </label>
          <input
            name="direccion"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
            placeholder="Ej: Av. Principal 100"
          />
        </div>

        {/* Pisos y Unidades por piso */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cantidad de Pisos
            </label>
            <input
              name="pisos"
              type="number"
              min="1"
              defaultValue="1"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unidades por Piso
            </label>
            <input
              name="unidades_por_piso"
              type="number"
              min="1"
              defaultValue="1"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
            />
          </div>
        </div>

        {/* Info */}
        <div className="p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
          <p>Al crear el edificio se generarán automáticamente las unidades según la cantidad de pisos y unidades por piso.</p>
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
              <Building2 className="w-5 h-5" />
              Crear Edificio
            </>
          )}
        </button>
      </form>
    </div>
  );
}