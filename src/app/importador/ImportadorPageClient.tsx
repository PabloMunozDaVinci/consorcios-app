// =============================================================================
// COMPONENT: Importador - subir padrón o liquidación (ROADMAP Fase 1.3)
// =============================================================================
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertCircle, CheckCircle, Loader2, Upload } from 'lucide-react';
import { CAMPOS_PADRON, CAMPOS_LIQUIDACION } from '@/lib/sanitize';

type Tipo = 'padron' | 'liquidacion';

const LABELS: Record<string, string> = {
  numero_unidad: 'Número de unidad',
  piso: 'Piso',
  propietario_nombre: 'Nombre del propietario',
  propietario_apellido: 'Apellido del propietario',
  dni: 'DNI',
  email: 'Email',
  telefono: 'Teléfono',
  importe: 'Importe',
  concepto: 'Concepto',
};

function getMesesOptions() {
  const meses: { value: string; label: string }[] = [];
  const now = new Date();
  const startDate = new Date(2025, 0, 1);
  const current = new Date(now.getFullYear(), now.getMonth(), 1);
  while (current >= startDate) {
    const value = current.toISOString().slice(0, 7);
    const label = current.toLocaleDateString('es-AR', { year: 'numeric', month: 'long' }).replace(/^\w/, (c) => c.toUpperCase());
    meses.unshift({ value, label });
    current.setMonth(current.getMonth() - 1);
  }
  return meses;
}

interface Edificio {
  id: string;
  nombre: string;
}
interface Consorcio {
  id: string;
  nombre: string;
  edificios: Edificio[];
}

interface MatchPreview {
  matcheadas: number;
  no_matcheadas: Record<string, string>[];
  no_matcheadas_total: number;
  total_importe: number | null;
  importacion_previa: { id: string; created_at: string } | null;
}

export default function ImportadorPageClient({ tipo }: { tipo: Tipo }) {
  const campos = tipo === 'padron' ? CAMPOS_PADRON : CAMPOS_LIQUIDACION;
  const titulo = tipo === 'padron' ? 'Importar padrón' : 'Importar liquidación';

  const [consorcios, setConsorcios] = useState<Consorcio[]>([]);
  const [loadingConsorcios, setLoadingConsorcios] = useState(true);
  const [consorcioId, setConsorcioId] = useState('');
  const [edificioId, setEdificioId] = useState('');
  const [periodo, setPeriodo] = useState('');

  const [archivo, setArchivo] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapeo, setMapeo] = useState<Record<string, string>>({});
  const [match, setMatch] = useState<MatchPreview | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ importadas: number; errores: number } | null>(null);

  useEffect(() => {
    async function fetchConsorcios() {
      try {
        const res = await fetch('/api/consorcios-with-edificios');
        const result = await res.json();
        if (result.success) setConsorcios(result.data || []);
      } catch {
        setError('No se pudieron cargar los consorcios');
      } finally {
        setLoadingConsorcios(false);
      }
    }
    fetchConsorcios();
  }, []);

  const edificios = useMemo(
    () => consorcios.find((c) => c.id === consorcioId)?.edificios || [],
    [consorcios, consorcioId]
  );

  const listo = consorcioId && edificioId && (tipo === 'padron' || periodo);

  async function subirArchivo(file: File) {
    setLoading(true);
    setError(null);
    setResultado(null);
    setMatch(null);
    try {
      const formData = new FormData();
      formData.append('archivo', file);
      formData.append('edificio_id', edificioId);
      formData.append('tipo', tipo);
      if (periodo) formData.append('periodo', periodo);

      const res = await fetch('/api/importaciones/preview', { method: 'POST', body: formData });
      const result = await res.json();
      if (!result.success) {
        setError(result.error || 'No se pudo leer el archivo');
        return;
      }
      setArchivo(file);
      setHeaders(result.data.headers);
      setRows(result.data.rows);
      setMapeo(result.data.mapeo_sugerido || {});
    } catch {
      setError('Error de conexión al subir el archivo');
    } finally {
      setLoading(false);
    }
  }

  async function previsualizarMapeo() {
    if (!archivo) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('archivo', archivo);
      formData.append('edificio_id', edificioId);
      formData.append('tipo', tipo);
      if (periodo) formData.append('periodo', periodo);
      formData.append('mapeo', JSON.stringify(mapeo));

      const res = await fetch('/api/importaciones/preview', { method: 'POST', body: formData });
      const result = await res.json();
      if (!result.success) {
        setError(result.error || 'No se pudo previsualizar');
        return;
      }
      setMatch(result.data.match);
    } catch {
      setError('Error de conexión al previsualizar');
    } finally {
      setLoading(false);
    }
  }

  async function confirmar() {
    if (!archivo) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/importaciones/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          edificio_id: edificioId,
          tipo,
          periodo: periodo || undefined,
          archivo_nombre: archivo.name,
          mapeo,
          filas: rows,
        }),
      });
      const result = await res.json();
      if (!result.success) {
        setError(result.error || 'No se pudo confirmar la importación');
        return;
      }
      setResultado({ importadas: result.data.importadas, errores: result.data.errores });
    } catch {
      setError('Error de conexión al confirmar');
    } finally {
      setLoading(false);
    }
  }

  async function revertirAnterior() {
    if (!match?.importacion_previa) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/importaciones/${match.importacion_previa.id}/revertir`, { method: 'POST' });
      const result = await res.json();
      if (!result.success) {
        setError(result.error || 'No se pudo revertir la importación anterior');
        return;
      }
      setMatch({ ...match, importacion_previa: null });
    } catch {
      setError('Error de conexión al revertir');
    } finally {
      setLoading(false);
    }
  }

  function reiniciar() {
    setArchivo(null);
    setHeaders([]);
    setRows([]);
    setMapeo({});
    setMatch(null);
    setResultado(null);
    setError(null);
  }

  const obligatorios = tipo === 'padron'
    ? ['numero_unidad', 'propietario_nombre', 'propietario_apellido', 'dni', 'email']
    : ['numero_unidad', 'importe'];
  const mapeoCompleto = obligatorios.every((c) => !!mapeo[c]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/importador" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{titulo}</h1>
          <p className="text-gray-500">
            {tipo === 'padron'
              ? 'Subí el Excel/CSV con las unidades y propietarios de un edificio'
              : 'Subí la liquidación mensual que ya emite la administradora'}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border-2 border-red-300 rounded-xl text-red-800 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm">{error}</p>
            <button onClick={() => setError(null)} className="text-sm underline mt-1">Cerrar</button>
          </div>
        </div>
      )}

      {resultado ? (
        <div className="p-6 bg-green-50 border-2 border-green-300 rounded-xl text-green-800 flex items-start gap-4">
          <CheckCircle className="w-8 h-8 flex-shrink-0" />
          <div>
            <p className="font-bold text-lg">Importación confirmada</p>
            <p className="text-sm mt-1">{resultado.importadas} filas importadas{resultado.errores > 0 ? `, ${resultado.errores} con error (ver detalle en la importación)` : ''}.</p>
            <button onClick={reiniciar} className="text-sm underline mt-2">Importar otro archivo</button>
          </div>
        </div>
      ) : (
        <>
          {/* Paso 1: selección */}
          <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
            <h2 className="font-semibold">1. Elegí el destino</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Consorcio *</label>
                {loadingConsorcios ? (
                  <div className="w-full px-3 py-2 border rounded-lg bg-gray-50 animate-pulse">Cargando...</div>
                ) : (
                  <select
                    value={consorcioId}
                    onChange={(e) => { setConsorcioId(e.target.value); setEdificioId(''); reiniciar(); }}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar...</option>
                    {consorcios.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Edificio *</label>
                <select
                  value={edificioId}
                  onChange={(e) => { setEdificioId(e.target.value); reiniciar(); }}
                  disabled={!consorcioId}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                >
                  <option value="">Seleccionar...</option>
                  {edificios.map((e) => (
                    <option key={e.id} value={e.id}>{e.nombre}</option>
                  ))}
                </select>
              </div>
              {tipo === 'liquidacion' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Período *</label>
                  <select
                    value={periodo}
                    onChange={(e) => { setPeriodo(e.target.value); reiniciar(); }}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar...</option>
                    {getMesesOptions().map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Paso 2: archivo */}
          {listo && (
            <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
              <h2 className="font-semibold">2. Subí el archivo (.csv o .xlsx)</h2>
              <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-8 cursor-pointer hover:bg-gray-50">
                <Upload className="w-5 h-5 text-gray-400" />
                <span className="text-gray-500">{archivo ? archivo.name : 'Elegir archivo...'}</span>
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) { reiniciar(); subirArchivo(file); }
                  }}
                />
              </label>
            </div>
          )}

          {/* Paso 3: mapeo */}
          {headers.length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
              <h2 className="font-semibold">3. Mapeá las columnas</h2>
              <p className="text-sm text-gray-500">{rows.length} filas encontradas en el archivo.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {campos.map((campo) => (
                  <div key={campo}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {LABELS[campo]} {obligatorios.includes(campo) ? '*' : ''}
                    </label>
                    <select
                      value={mapeo[campo] || ''}
                      onChange={(e) => setMapeo({ ...mapeo, [campo]: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Sin mapear</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <button
                onClick={previsualizarMapeo}
                disabled={!mapeoCompleto || loading}
                className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:bg-gray-300 flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Previsualizar
              </button>
            </div>
          )}

          {/* Paso 4: preview + confirmar */}
          {match && (
            <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
              <h2 className="font-semibold">4. Revisá antes de confirmar</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-gray-500">Matchean con una unidad</p>
                  <p className="text-xl font-bold text-green-700">{match.matcheadas}</p>
                </div>
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <p className="text-gray-500">No matchean</p>
                  <p className="text-xl font-bold text-yellow-700">{match.no_matcheadas_total}</p>
                </div>
                {match.total_importe != null && (
                  <div className="p-3 bg-blue-50 rounded-lg col-span-2">
                    <p className="text-gray-500">Total a debitar</p>
                    <p className="text-xl font-bold text-blue-700">${match.total_importe.toLocaleString('es-AR')}</p>
                  </div>
                )}
              </div>

              {match.no_matcheadas_total > 0 && (
                <p className="text-sm text-gray-500">
                  No matchean (no hay una unidad con ese número en el edificio elegido):{' '}
                  {match.no_matcheadas.slice(0, 10).map((f) => f[mapeo.numero_unidad]).join(', ')}
                  {match.no_matcheadas_total > 10 ? `, y ${match.no_matcheadas_total - 10} más` : ''}.
                </p>
              )}

              {match.importacion_previa ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-2">
                  <p className="text-sm text-red-800">
                    Ya existe una importación confirmada para este período. Revertila si querés reemplazarla.
                  </p>
                  <button
                    onClick={revertirAnterior}
                    disabled={loading}
                    className="text-sm px-3 py-1.5 border border-red-300 text-red-700 rounded-lg hover:bg-red-100"
                  >
                    Revertir importación anterior
                  </button>
                </div>
              ) : (
                <button
                  onClick={confirmar}
                  disabled={loading || match.matcheadas === 0}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 flex items-center justify-center gap-2 font-medium"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirmar importación ({match.matcheadas} filas)
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
