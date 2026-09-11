// =============================================================================
// PAGE: Mantenimiento Nuevo (Server wrapper — force-dynamic para el CSP con nonce)
// =============================================================================
export const dynamic = 'force-dynamic';

import NuevoArregloPageClient from './NuevoArregloPageClient';

export default function NuevoArregloPage() {
  return <NuevoArregloPageClient />;
}
