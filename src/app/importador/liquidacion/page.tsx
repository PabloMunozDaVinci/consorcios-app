// =============================================================================
// PAGE: Importador de Liquidación (Server wrapper — force-dynamic para el CSP con nonce)
// =============================================================================
export const dynamic = 'force-dynamic';

import ImportadorPageClient from '../ImportadorPageClient';

export default function ImportadorLiquidacionPage() {
  return <ImportadorPageClient tipo="liquidacion" />;
}
