// =============================================================================
// HOOK: useUser - Get current authenticated user
// =============================================================================
'use client';

import { useEffect, useState } from 'react';
import { createSupabaseClient } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  email: string;
  email_confirmed_at?: string;
}

export interface PropietarioWithUnidad {
  id: string;
  unidad_id: string;
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  telefono?: string;
  unidad?: {
    id: string;
    numero: string;
    piso: number;
    edificio?: {
      id: string;
      nombre: string;
    };
  };
}

export interface UseUserReturn {
  user: AuthUser | null;
  propietario: PropietarioWithUnidad | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const supabase = createSupabaseClient();

export function useUser(): UseUserReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [propietario, setPropietario] = useState<PropietarioWithUnidad | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchPropietario = async (userId: string) => {
    const { data: prop } = await supabase
      .from('propietarios')
      .select(`
        id,
        unidad_id,
        nombre,
        apellido,
        dni,
        email,
        telefono,
        unidades:id
      `)
      .eq('auth_user_id', userId)
      .single();

    if (prop) {
      // Get unidad details
      const { data: unidad } = await supabase
        .from('unidades')
        .select(`
          id,
          numero,
          piso,
          edificios:edificios (
            id,
            nombre
          )
        `)
        .eq('id', prop.unidad_id)
        .single();

      setPropietario({
        ...prop,
        // @ts-ignore - Supabase relation typing
        unidad: unidad,
      } as PropietarioWithUnidad);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const {
          data: { user: sbUser },
        } = await supabase.auth.getUser();

        if (sbUser) {
          setUser({
            id: sbUser.id,
            email: sbUser.email || '',
            email_confirmed_at: sbUser.email_confirmed_at || undefined,
          });

          // Check if admin (no auth_user_id linked = admin)
          const { data: prop } = await supabase
            .from('propietarios')
            .select('auth_user_id')
            .eq('auth_user_id', sbUser.id)
            .single();

          setIsAdmin(!prop);

          // Fetch propietario data if exists
          await fetchPropietario(sbUser.id);
        }
      } catch (error) {
        console.error('Auth error:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || '',
          email_confirmed_at: session.user.email_confirmed_at || undefined,
        });
        await fetchPropietario(session.user.id);
      } else {
        setUser(null);
        setPropietario(null);
        setIsAdmin(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setPropietario(null);
    setIsAdmin(false);
  };

  return { user, propietario, loading, isAdmin, signOut };
}