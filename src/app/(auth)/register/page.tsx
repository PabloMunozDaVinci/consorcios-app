// =============================================================================
// PAGE: Register (Server wrapper — fuerza render dinámico para el CSP con nonce)
// =============================================================================
export const dynamic = 'force-dynamic';

import RegisterPageClient from './RegisterPageClient';

export default function RegisterPage() {
  return <RegisterPageClient />;
}
