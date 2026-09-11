// =============================================================================
// LIB: IP del cliente, sólo confiando en el proxy de confianza
// =============================================================================
// `x-forwarded-for` lo puede mandar cualquiera: rotarlo saltea rate limit y
// blocklist si no hay un proxy delante que lo reescriba. La mitigación real es
// de infraestructura (que nginx SOBREESCRIBA el header, no lo agregue — ver
// SETUP.md), pero acá preferimos `x-real-ip` (que nginx setea con
// `proxy_set_header X-Real-IP $remote_addr` y no es controlable por el
// cliente) y sólo caemos a `x-forwarded-for` cuando no está, para no romper en
// desarrollo/sin proxy delante.

export function getTrustedClientIP(getHeader: (name: string) => string | null): string {
  const realIP = getHeader('x-real-ip');
  if (realIP) return realIP.trim();

  // Sin x-real-ip (dev local, o nginx mal configurado): el primer valor de
  // x-forwarded-for es mejor que nada, pero es spoofeable — no usarlo para
  // decisiones de alto impacto (ban permanente, etc.) sin nginx delante.
  const forwarded = getHeader('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  return 'unknown';
}
