// =============================================================================
// PAGE: Recuperar Password (Server wrapper — force-dynamic para el CSP con nonce)
// =============================================================================
export const dynamic = 'force-dynamic';

import RecuperarPasswordPageClient from './RecuperarPasswordPageClient';

export default function RecuperarPasswordPage() {
  return <RecuperarPasswordPageClient />;
}
