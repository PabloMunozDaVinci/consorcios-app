// =============================================================================
// PAGE: Pagos Nuevo (Server wrapper — force-dynamic para el CSP con nonce)
// =============================================================================
export const dynamic = 'force-dynamic';

import NuevoPagoPageClient from './NuevoPagoPageClient';

export default function NuevoPagoPage() {
  return <NuevoPagoPageClient />;
}
