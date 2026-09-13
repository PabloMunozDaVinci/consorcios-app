// =============================================================================
// PAGE: Importador - elegir qué importar (ROADMAP Fase 1.3)
// =============================================================================
import Link from 'next/link';
import { Users, Receipt, ArrowRight } from 'lucide-react';

export default function ImportadorPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Importador</h1>
        <p className="text-gray-500">Subí lo que ya tenés, sin tener que recargar todo a mano.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/importador/padron"
          className="bg-white rounded-xl border shadow-sm p-6 hover:border-blue-400 hover:shadow-md transition-all group"
        >
          <Users className="w-8 h-8 text-blue-600 mb-3" />
          <h2 className="font-semibold text-lg flex items-center gap-2">
            Padrón
            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </h2>
          <p className="text-sm text-gray-500 mt-1">Unidades y propietarios de un edificio, desde Excel o CSV.</p>
        </Link>

        <Link
          href="/importador/liquidacion"
          className="bg-white rounded-xl border shadow-sm p-6 hover:border-blue-400 hover:shadow-md transition-all group"
        >
          <Receipt className="w-8 h-8 text-blue-600 mb-3" />
          <h2 className="font-semibold text-lg flex items-center gap-2">
            Liquidación mensual
            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </h2>
          <p className="text-sm text-gray-500 mt-1">La liquidación que ya emite la administradora, mes a mes.</p>
        </Link>
      </div>
    </div>
  );
}
