// =============================================================================
// LIB: safe-redirect
// =============================================================================
// Evita open redirects: sólo se aceptan paths internos.

/**
 * Devuelve `value` si es un path interno seguro, si no `fallback`.
 * Interno seguro = empieza con un único '/', no con '//' ni '/\' ni con un
 * esquema (`javascript:`, `http:`...). Se conserva el query string y el hash.
 */
export function safeRedirectPath(
  value: string | null | undefined,
  fallback = '/'
): string {
  if (typeof value !== 'string' || value.length === 0) return fallback;
  // Debe empezar con "/" pero no con "//" (protocol-relative) ni "/\".
  if (value[0] !== '/' || value[1] === '/' || value[1] === '\\') return fallback;
  // Sin caracteres de control ni backslashes.
  if (/[\x00-\x1f\\]/.test(value)) return fallback;
  return value;
}
