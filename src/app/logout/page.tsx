// =============================================================================
// PAGE: Logout - Sign out and redirect
// =============================================================================
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseClient } from '@/lib/supabase';

export default function LogoutPage() {
  const router = useRouter();
  const supabase = createSupabaseClient();

  useEffect(() => {
    async function signOut() {
      await supabase.auth.signOut();
      router.push('/login');
      router.refresh();
    }
    signOut();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Cerrando sesión...</p>
    </div>
  );
}