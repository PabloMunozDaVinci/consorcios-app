'use client';

// =============================================================================
// ERROR BOUNDARY: Manejo global de errores
// =============================================================================
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  const router = useRouter();

  useEffect(() => {
    // Loggear el error solo en producción (en dev ya sale en consola)
    if (process.env.NODE_ENV === 'production') {
      console.error('[Error Boundary]', error.message, error.digest);
    }
  }, [error]);

  const handleReload = () => {
    router.refresh();
    reset();
  };

  return (
    <div className="min-h-[400px] flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="text-red-500 text-6xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Algo salió mal
        </h2>
        <p className="text-gray-600 mb-6">
          {error.message || 'Ocurrió un error inesperado'}
        </p>
        <div className="space-x-3">
          <button
            onClick={handleReload}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Reintentar
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Ir al inicio
          </button>
        </div>
        {error.digest && (
          <p className="text-xs text-gray-400 mt-4">
            ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}