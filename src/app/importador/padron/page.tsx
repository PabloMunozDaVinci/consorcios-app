// =============================================================================
// PAGE: Importador de Padrón (Server wrapper — force-dynamic para el CSP con nonce)
// =============================================================================
export const dynamic = 'force-dynamic';

import ImportadorPageClient from '../ImportadorPageClient';

export default function ImportadorPadronPage() {
  return <ImportadorPageClient tipo="padron" />;
}
