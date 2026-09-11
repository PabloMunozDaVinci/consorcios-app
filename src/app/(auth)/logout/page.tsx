// =============================================================================
// PAGE: Logout (Server wrapper — fuerza render dinámico para el CSP con nonce)
// =============================================================================
export const dynamic = 'force-dynamic';

import LogoutPageClient from './LogoutPageClient';

export default function LogoutPage() {
  return <LogoutPageClient />;
}
