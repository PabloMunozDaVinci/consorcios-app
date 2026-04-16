// =============================================================================
// PAGE: Mantenimiento Nuevo - Crear Solicitud
// =============================================================================
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, CheckCircle, AlertCircle, Loader2, Home, Building2 } from 'lucide-react';
import Link from 'next/link';

interface Consorcios {
  id: string;
  nombre: string;
  edificios: { id: string; nombre: string; unidades: { id: string; numero: string; piso: number }[] }[];
}

export default function NuevoArregloPage() {
  const router = useRouter();
  const [consorcios, setConsorcios] = useState<Consorcios[]>([]);
  const [selectedConsorcio, setSelectedConsorcio] = useState<string>('');
  const [selectedEdificio, setSelectedEdificio] = useState<string>('');
  const [selectedUnidad, setSelectedUnidad] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // Cargar consorcios al inicio
  useEffect(() => {
    async function fetchConsorcios() {
      try {
        const res = await fetch('/api/consorcios-with-edificios');
        const data = await res.json();
        if (data.success) {
          setConsorcios(data.data);
        }
      } catch (err) {
        console.error('Error fetching consorcios:', err);
      } finally {
        setLoadingData(false);
      }
    }
    fetchConsorcios();
  }, []);

  // Reset edificio y unidad cuando cambia el consorcio
  useEffect(() => {
    setSelectedEdificio('');
    setSelectedUnidad('');
  }, [selectedConsorcio]);

  // Reset unidad cuando cambia el edificio
  useEffect(() => {
    setSelectedUnidad('');
  }, [selectedEdificio]);

  // Obtener edificio seleccionado
  const selectedEdificioData = selectedConsorcio 
    ? consorcios.find(c => c.id === selectedConsorcio)?.edificios.find(e => e.id === selectedEdificio)
    : null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const formData = new FormData(e.currentTarget as HTMLFormElement);
      
      const data = {
        titulo: formData.get('titulo') as string,
        descripcion: formData.get('descripcion') as string || undefined,
        unidad_id: selectedUnidad || undefined,
        prioridad: formData.get('prioridad') as string || 'media',
        presupuesto: formData.get('presupuesto') as string || undefined,
        es_area_comun: formData.get('es_area_comun') === 'on',
      };
      
      const response = await fetch('/api/arreglos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSuccess(true);
        setTimeout(() => router.push('/mantenimiento'), 2000);
      } else {
        setError(result.error || 'Error al crear solicitud');
        setIsLoading(false);
      }
    } catch (err) {
      setError('Error de conexión');
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/mantenimiento" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nueva Solicitud</h1>
          <p className="text-gray-500">Reportar mantenimiento o arreglo</p>
        </div>
      </div>

      {/* Success */}
      {success && (
        <div className="p-6 bg-green-50 border-2 border-green-300 rounded-xl text-green-800 flex items-start gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="font-bold text-lg">¡Solicitud creada!</p>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
          <input
            name="titulo"
            required
            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Ej: pierde agua del vecino"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
          <textarea
            name="descripcion"
            rows={4}
            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Describe el problema..."
          />
        </div>

        {/* Selector de Unidad */}
        <div className="border-t pt-4">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            <Home className="w-4 h-4 inline mr-1" />
            Asignar a Unidad (opcional)
          </label>
          
          {loadingData ? (
            <div className="text-gray-400 text-sm">Cargando consorcios...</div>
          ) : (
            <div className="space-y-3">
              {/* Selector de Consorcio */}
              <select
                value={selectedConsorcio}
                onChange={(e) => setSelectedConsorcio(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Seleccionar consorcio...</option>
                {consorcios.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>

              {/* Selector de Edificio */}
              {selectedConsorcio && (
                <select
                  value={selectedEdificio}
                  onChange={(e) => setSelectedEdificio(e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Seleccionar edificio...</option>
                  {consorcios
                    .find(c => c.id === selectedConsorcio)
                    ?.edificios.map(e => (
                      <option key={e.id} value={e.id}>{e.nombre || 'Edificio'}</option>
                    ))}
                </select>
              )}

              {/* Selector de Unidad */}
              {selectedEdificio && selectedEdificioData && selectedEdificioData.unidades.length > 0 && (
                <select
                  value={selectedUnidad}
                  onChange={(e) => setSelectedUnidad(e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Seleccionar unidad...</option>
                  {selectedEdificioData.unidades.map(u => (
                    <option key={u.id} value={u.id}>
                      Unidad {u.numero} - Piso {u.piso}
                    </option>
                  ))}
                </select>
              )}

              {selectedEdificio && selectedEdificioData && selectedEdificioData.unidades.length === 0 && (
                <p className="text-sm text-gray-400">El edificio no tiene unidades</p>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
          <select name="prioridad" defaultValue="media" className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500">
            <option value="baja">Baja</option>
            <option value="media">Media</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Presupuesto estimado</label>
          <input name="presupuesto" type="number" className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="0" />
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" name="es_area_comun" id="es_area_comun" className="w-5 h-5" />
          <label htmlFor="es_area_comun" className="text-sm text-gray-700">Es área común</label>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 flex items-center justify-center gap-2 text-lg font-medium"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
          {isLoading ? 'Creando...' : 'Crear Solicitud'}
        </button>
      </form>
    </div>
  );
}
