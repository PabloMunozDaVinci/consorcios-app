// =============================================================================
// PAGE: Login (Server wrapper — fuerza render dinámico para el CSP con nonce)
// =============================================================================
export const dynamic = 'force-dynamic';

import LoginPageClient from './LoginPageClient';

export default function LoginPage() {
  return <LoginPageClient />;
}
