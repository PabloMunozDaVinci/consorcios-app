'use client';

// =============================================================================
// PAGE: Nueva Unidad - Crear Unidad Manual (acceso desde módulo de unidades)
// =============================================================================
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Home, CheckCircle, AlertCircle, Loader2, Building2, MapPin } from 'lucide-react';

interface EdificioConConsorcio {
  id: string;
  nombre: string | null;
  direccion: string | null;
  pisos: number;
  unidades_por_piso: number;
  consortium_id: string;
  consortium: {
    id: string;
    nombre: string;
    direccion: string;
  } | null;
}

export default function NuevaUnidadPage() {
  const router = useRouter();
  
  // Estado para el selector
  const [edificios, setEdificios] = useState<EdificioConConsorcio[]>([]);
  const [consorciosUnicos, setConsorciosUnicos] = useState<Map<string, { id: string; nombre: string }>>(new Map());
  const [selectedConsorcioId, setSelectedConsorcioId] = useState<string>('');
  const [selectedEdificioId, setSelectedEdificioId] = useState<string>('');
  
  // Estado del formulario
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdData, setCreatedData] = useState<any>(null);
  const [loadingEdificios, setLoadingEdificios] = useState(true);

  // Cargar edificios al iniciar
  useEffect(() => {
    async function fetchEdificios() {
      try {
        const response = await fetch('/api/edificios');

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          setError(result.error || 'Error al cargar edificios');
          return;
        }
        
        if (!result.data || result.data.length === 0) {
          // No hay edificios - está bien, mostrar el estado vacío
          setEdificios([]);
          return;
        }
        
        setEdificios(result.data);
        
        // Extraer consorcios únicos
        const consorciosMap = new Map<string, { id: string; nombre: string }>();
        result.data.forEach((edificio: EdificioConConsorcio) => {
          if (edificio.consortium && !consorciosMap.has(edificio.consortium_id)) {
            consorciosMap.set(edificio.consortium_id, {
              id: edificio.consortium_id,
              nombre: edificio.consortium.nombre,
            });
          }
        });
        setConsorciosUnicos(consorciosMap);
      } catch (err) {
        setError('Error al cargar los edificios: ' + (err instanceof Error ? err.message : String(err)));
      } finally {
        setLoadingEdificios(false);
      }
    }
    
    fetchEdificios();
  }, []);

  // Filtrar edificios por consorcio seleccionado
  const edificiosFiltrados = selectedConsorcioId
    ? edificios.filter(e => e.consortium_id === selectedConsorcioId)
    : [];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    
    if (!selectedEdificioId) {
      setError('Por favor seleccioná un edificio');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const formElement = e.currentTarget as HTMLFormElement;
      const formData = new FormData(formElement);
      
      const data = {
        building_id: selectedEdificioId,
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
          router.push('/unidades');
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

  // Si no hay error perotampoco edificios, mostrar mensaje
  if (!loadingEdificios && error) {
    // Mostrar el error con opción de reintentar
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/unidades" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nueva Unidad</h1>
            <p className="text-gray-500">Agregar unidad manualmente</p>
          </div>
        </div>
        
        <div className="bg-white rounded-xl border p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error al cargar</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Loader2 className="w-5 h-5" />
            Reintentar
          </button>
        </div>
      </div>
    );
  }

// Si terminó de cargar y no hay edificios
  if (!loadingEdificios && edificios.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
        <Building2 className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No hay edificios</h2>
        <p className="text-gray-500 mb-6">
          Primero necesitás crear un consorcio y un edificio para poder agregar unidades.
        </p>
        <Link 
          href="/consorcios/nuevo"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Building2 className="w-5 h-5" />
          Crear Consorcio
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/unidades" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nueva Unidad</h1>
          <p className="text-gray-500">Agregar unidad manualmente</p>
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

      {/* Loading edificios */}
      {loadingEdificios && (
        <div className="bg-white rounded-xl border p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Cargando edificios...</p>
        </div>
      )}

      {/* Form */}
      {!loadingEdificios && (
        <form 
          onSubmit={handleSubmit} 
          className={`bg-white rounded-xl border shadow-sm p-6 space-y-6 ${isLoading ? 'opacity-70 pointer-events-none' : ''}`}
        >
          {/* Selector de Consorcio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Consorcio *
            </label>
            <select
              value={selectedConsorcioId}
              onChange={(e) => {
                setSelectedConsorcioId(e.target.value);
                setSelectedEdificioId('');
              }}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
            >
              <option value="">Seleccionar consorcio...</option>
              {Array.from(consorciosUnicos.values()).map(consorcio => (
                <option key={consorcio.id} value={consorcio.id}>
                  {consorcio.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Selector de Edificio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Edificio *
            </label>
            {!selectedConsorcioId ? (
              <p className="text-sm text-gray-500 py-3">Primero seleccioná un consorcio</p>
            ) : edificiosFiltrados.length === 0 ? (
              <p className="text-sm text-gray-500 py-3">No hay edificios en este consorcio</p>
            ) : (
              <select
                value={selectedEdificioId}
                onChange={(e) => setSelectedEdificioId(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
              >
                <option value="">Seleccionar edificio...</option>
                {edificiosFiltrados.map(edificio => (
                  <option key={edificio.id} value={edificio.id}>
                    {edificio.nombre || 'Edificio sin nombre'} 
                    {edificio.direccion ? ` - ${edificio.direccion}` : ''}
                    {' '}({edificio.pisos} pisos)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Info del edificio seleccionado */}
          {selectedEdificioId && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
              <Building2 className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">
                  {edificios.find(e => e.id === selectedEdificioId)?.nombre || 'Edificio'}
                </p>
                {edificios.find(e => e.id === selectedEdificioId)?.consortium && (
                  <p className="text-sm text-blue-700 flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3" />
                    {edificios.find(e => e.id === selectedEdificioId)?.consortium?.direccion}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Número */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Número de Unidad *
            </label>
            <input
              name="numero"
              required
              disabled={!selectedEdificioId}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
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
              disabled={!selectedEdificioId}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
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
              disabled={!selectedEdificioId}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
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
              disabled={!selectedEdificioId}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">
              Porcentaje de participación en gastos comunes
            </p>
          </div>

          {/* Checkboxes */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input type="checkbox" name="es_especial" id="es_especial" className="w-5 h-5" disabled={!selectedEdificioId} />
              <label htmlFor="es_especial" className={`text-sm ${!selectedEdificioId ? 'text-gray-400' : 'text-gray-700'}`}>
                Unidad especial (ej: local comercial, oficina)
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" name="habitada" id="habitada" className="w-5 h-5" disabled={!selectedEdificioId} />
              <label htmlFor="habitada" className={`text-sm ${!selectedEdificioId ? 'text-gray-400' : 'text-gray-700'}`}>
                Actualmente habitada
              </label>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading || !selectedEdificioId}
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
      )}
    </div>
  );
}
