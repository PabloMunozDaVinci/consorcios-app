// =============================================================================
// PAGE: Nuevo Consorcio (Server wrapper — force-dynamic para el CSP con nonce)
// =============================================================================
export const dynamic = 'force-dynamic';

import NuevoConsorcioPageClient from './NuevoConsorcioPageClient';

export default function NuevoConsorcioPage() {
  return <NuevoConsorcioPageClient />;
}
