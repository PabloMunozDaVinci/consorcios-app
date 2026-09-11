// =============================================================================
// PAGE: Logout - Sign out and redirect
// =============================================================================
'use client';


import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LogoutPage() {
  const router = useRouter();
  const supabase = createClient();

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