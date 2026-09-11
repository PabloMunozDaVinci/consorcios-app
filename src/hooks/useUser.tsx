// =============================================================================
// CONTEXTO: usuario autenticado + rol (desde la tabla `usuarios`)
// =============================================================================
// Antes había DOS lecturas de sesión independientes en el árbol de componentes:
// ConditionalLayout hacía su propio getSession() (rápido, sólo local) para
// decidir si mostraba el Header, y el Header (vía este hook) hacía su propio
// getUser() (con round-trip real contra el servidor de Auth) para decidir qué
// mostrar dentro de él. Al ser dos llamadas independientes sobre el mismo
// cliente singleton, podían resolver en momentos distintos y con resultados
// distintos según la latencia real (network jitter, refresh de token
// concurrente) — eso es lo que producía la pantalla post-login mostrando
// "Iniciar sesión" aunque la sesión ya estuviera activa. Ahora hay una sola
// fuente de verdad (este Context + un único getUser()/onAuthStateChange) que
// todo el árbol comparte.
'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
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

const UserContext = createContext<UseUserReturn | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
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
      // Un evento de auth (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED...) es
      // siempre la señal definitiva de que ya sabemos el estado real.
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase, hydrate]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRol(null);
    setAdministradoraId(null);
    setPropietario(null);
  }, [supabase]);

  const value = useMemo<UseUserReturn>(
    () => ({
      user,
      rol,
      administradoraId,
      propietario,
      loading,
      isAdmin: rol !== null && ROLES_ADMIN.includes(rol),
      signOut,
    }),
    [user, rol, administradoraId, propietario, loading, signOut]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UseUserReturn {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error('useUser() debe usarse dentro de <UserProvider>');
  }
  return ctx;
}
