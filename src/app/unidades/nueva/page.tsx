// =============================================================================
// PAGE: Nueva Unidad (Server wrapper — force-dynamic para el CSP con nonce)
// =============================================================================
export const dynamic = 'force-dynamic';

import NuevaUnidadPageClient from './NuevaUnidadPageClient';

export default function NuevaUnidadPage() {
  return <NuevaUnidadPageClient />;
}
