'use client';

// =============================================================================
// ERROR BOUNDARY: Manejo de errores a nivel de layout
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
    // Loggear solo en producción
    if (process.env.NODE_ENV === 'production') {
      console.error('[Error]', error.message, error.digest);
    }
  }, [error]);

  return (
    <div className="min-h-[300px] flex items-center justify-center p-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          Error en la página
        </h2>
        <p className="text-gray-600 text-sm mb-4">
          {error.message}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => { router.refresh(); reset(); }}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Reintentar
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Inicio
          </button>
        </div>
      </div>
    </div>
  );
}