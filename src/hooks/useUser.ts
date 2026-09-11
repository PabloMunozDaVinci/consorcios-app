// =============================================================================
// HOOK: useUser - usuario autenticado + rol (desde la tabla `usuarios`)
// =============================================================================
'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export type Rol = 'super_admin' | 'admin' | 'operador' | 'propietario';

export interface AuthUser {
  id: string;
  email: string;
}

export interface PropietarioWithUnidad {
  id: string;
  unidad_id: string | null;
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  telefono?: string;
  unidad?: {
    id: string;
    numero: string;
    piso: number;
    edificio?: { id: string; nombre: string };
  };
}

export interface UseUserReturn {
  user: AuthUser | null;
  rol: Rol | null;
  administradoraId: string | null;
  propietario: PropietarioWithUnidad | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const ROLES_ADMIN: Rol[] = ['super_admin', 'admin'];

export function useUser(): UseUserReturn {
  const supabase = createClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [rol, setRol] = useState<Rol | null>(null);
  const [administradoraId, setAdministradoraId] = useState<string | null>(null);
  const [propietario, setPropietario] = useState<PropietarioWithUnidad | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrate = useCallback(
    async (userId: string) => {
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('rol, administradora_id, propietario_id')
        .eq('auth_user_id', userId)
        .eq('activo', true)
        .maybeSingle();

      setRol((usuario?.rol as Rol) ?? null);
      setAdministradoraId(usuario?.administradora_id ?? null);

      if (usuario?.propietario_id) {
        const { data: prop } = await supabase
          .from('propietarios')
          .select('id, unidad_id, nombre, apellido, dni, email, telefono')
          .eq('id', usuario.propietario_id)
          .maybeSingle();
        setPropietario((prop as PropietarioWithUnidad) ?? null);
      } else {
        setPropietario(null);
      }
    },
    [supabase]
  );

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const { data: { user: sbUser } } = await supabase.auth.getUser();
        if (!active) return;
        if (sbUser) {
          setUser({ id: sbUser.id, email: sbUser.email ?? '' });
          await hydrate(sbUser.id);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? '' });
        await hydrate(session.user.id);
      } else {
        setUser(null);
        setRol(null);
        setAdministradoraId(null);
        setPropietario(null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase, hydrate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRol(null);
    setAdministradoraId(null);
    setPropietario(null);
  };

  return {
    user,
    rol,
    administradoraId,
    propietario,
    loading,
    isAdmin: rol !== null && ROLES_ADMIN.includes(rol),
    signOut,
  };
}
