// =============================================================================
// LIB: Formateo de fechas DATE (sin hora) en es-AR, sin el corrimiento de UTC
// =============================================================================
// Postgres devuelve las columnas DATE como "YYYY-MM-DD". `new Date("YYYY-MM-DD")`
// las parsea como medianoche UTC; en un huso horario negativo (Argentina,
// UTC-3) `toLocaleDateString` las muestra como el día/mes anterior. Construir
// con el constructor local (year, monthIndex, day) evita el corrimiento
// porque nunca pasa por UTC. No usar estas funciones con TIMESTAMPTZ (esas sí
// tienen hora real y `new Date(iso)` + toLocaleDateString es lo correcto).

function partesDeFechaISO(fechaISO: string): [number, number, number] {
  const [year, month, day] = fechaISO.split('-').map(Number);
  return [year, month, day];
}

/** "2026-01-15" -> "enero de 2026" */
export function formatearMesAnio(fechaISO: string): string {
  const [year, month] = partesDeFechaISO(fechaISO);
  return new Date(year, month - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
}

/** "2026-01-05" -> "5/1/2026" */
export function formatearFechaAR(fechaISO: string): string {
  const [year, month, day] = partesDeFechaISO(fechaISO);
  return new Date(year, month - 1, day).toLocaleDateString('es-AR');
}
