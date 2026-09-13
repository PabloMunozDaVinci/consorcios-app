// =============================================================================
// LIB: Importador - matchear filas del archivo contra unidades reales
// =============================================================================
// Compartido entre preview (sólo informa cuántas matchean) y confirmar (usa
// el mismo resultado para decidir qué fila genera qué movimiento). El
// número de unidad es único por edificio (constraint unique_unidad_por_edificio),
// así que matchear requiere saber a qué edificio corresponde el archivo —
// lo elige el usuario antes de subirlo, no se intenta adivinar.

export interface UnidadParaMatch {
  id: string;
  numero: string;
}

function normalizarNumero(v: string): string {
  return v.trim().toLowerCase();
}

export function indexarUnidadesPorNumero(unidades: UnidadParaMatch[]): Map<string, UnidadParaMatch> {
  const map = new Map<string, UnidadParaMatch>();
  for (const u of unidades) map.set(normalizarNumero(u.numero), u);
  return map;
}

export interface FilaMatcheada {
  fila: Record<string, string>;
  unidad: UnidadParaMatch;
}

export interface ResultadoMatch {
  matcheadas: FilaMatcheada[];
  noMatcheadas: Record<string, string>[];
}

/** Matchea cada fila contra una unidad real por su número, vía la columna mapeada. */
export function matchearFilasPorUnidad(
  filas: Record<string, string>[],
  columnaNumeroUnidad: string,
  unidadesPorNumero: Map<string, UnidadParaMatch>
): ResultadoMatch {
  const matcheadas: FilaMatcheada[] = [];
  const noMatcheadas: Record<string, string>[] = [];

  for (const fila of filas) {
    const numero = fila[columnaNumeroUnidad];
    const unidad = numero ? unidadesPorNumero.get(normalizarNumero(numero)) : undefined;
    if (unidad) {
      matcheadas.push({ fila, unidad });
    } else {
      noMatcheadas.push(fila);
    }
  }

  return { matcheadas, noMatcheadas };
}
