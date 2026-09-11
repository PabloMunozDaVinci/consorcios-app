// =============================================================================
// PAGE: Recuperar Password — dos fases
//   1. "request": pedís el email, Supabase manda el link.
//   2. "reset":   volvés desde el link (?code=... o #type=recovery) y ponés
//                 la contraseña nueva con supabase.auth.updateUser({ password }).
// =============================================================================
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, Mail, Lock, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Fase = 'request' | 'sent' | 'reset' | 'done';

export default function RecuperarPasswordPage() {
  const supabase = createClient();

  const [fase, setFase] = useState<Fase>('request');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Al montar: detectar si venimos desde el link de recuperación.
  useEffect(() => {
    let cancelled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && !cancelled) setFase('reset');
    });

    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const esRecovery =
          !!code ||
          url.searchParams.get('type') === 'recovery' ||
          hashParams.get('type') === 'recovery';

        if (code) {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          window.history.replaceState({}, '', '/recuperar-password');
          if (!cancelled) {
            if (exErr) setError('El link expiró o ya se usó. Pedí uno nuevo.');
            else setFase('reset');
          }
          return;
        }

        if (esRecovery) {
          // Flujo por hash: detectSessionInUrl ya corrió.
          const { data } = await supabase.auth.getSession();
          if (!cancelled && data.session) setFase('reset');
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function pedirLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    // resetPasswordForEmail es no-enumerable: no revela si el email existe.
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/recuperar-password`,
    });
    setLoading(false);
    setFase('sent');
  }

  async function guardarPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== password2) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    const { error: updErr } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updErr) {
      setError('No se pudo cambiar la contraseña. Puede que el link haya expirado.');
      return;
    }
    await supabase.auth.signOut();
    setFase('done');
    setTimeout(() => {
      window.location.href = '/login';
    }, 2000);
  }

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );

  const Header = ({ icon, title, subtitle, verde }: {
    icon: React.ReactNode; title: string; subtitle: string; verde?: boolean;
  }) => (
    <div className="text-center mb-8">
      <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 ${verde ? 'bg-green-100' : 'bg-blue-600'}`}>
        {icon}
      </div>
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <p className="text-gray-500 mt-1">{subtitle}</p>
    </div>
  );

  const ErrorBox = () =>
    error ? (
      <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <p className="text-sm">{error}</p>
      </div>
    ) : null;

  if (checking) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-20 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando…
        </div>
      </Shell>
    );
  }

  if (fase === 'done') {
    return (
      <Shell>
        <Header verde icon={<CheckCircle className="w-8 h-8 text-green-600" />}
          title="Contraseña actualizada" subtitle="Te llevamos al login…" />
      </Shell>
    );
  }

  if (fase === 'sent') {
    return (
      <Shell>
        <Header verde icon={<CheckCircle className="w-8 h-8 text-green-600" />}
          title="Revisá tu email" subtitle="Te enviamos un link para recuperar tu contraseña" />
        <div className="bg-white rounded-2xl shadow-sm border p-6 text-center">
          <p className="text-gray-600 text-sm">
            Si <strong className="text-gray-900">{email}</strong> está registrado, vas a recibir un link para
            restablecer tu contraseña.
          </p>
          <p className="text-gray-500 text-xs mt-4">Revisá también la carpeta de spam.</p>
        </div>
        <p className="text-center mt-6 text-gray-500">
          <Link href="/login" className="text-blue-600 hover:underline font-medium">Volver al login</Link>
        </p>
      </Shell>
    );
  }

  if (fase === 'reset') {
    return (
      <Shell>
        <Header icon={<Lock className="w-8 h-8 text-white" />}
          title="Nueva contraseña" subtitle="Elegí una contraseña nueva para tu cuenta" />
        <ErrorBox />
        <form onSubmit={guardarPassword} className="bg-white rounded-2xl shadow-sm border p-6 space-y-5">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              required minLength={8} autoComplete="new-password"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Mínimo 8 caracteres" />
          </div>
          <div>
            <label htmlFor="password2" className="block text-sm font-medium text-gray-700 mb-1">Repetí la contraseña</label>
            <input id="password2" type="password" value={password2} onChange={(e) => setPassword2(e.target.value)}
              required autoComplete="new-password"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-400 flex items-center justify-center gap-2">
            {loading ? (<><Loader2 className="w-5 h-5 animate-spin" /> Guardando…</>) : 'Guardar contraseña'}
          </button>
        </form>
      </Shell>
    );
  }

  // fase === 'request'
  return (
    <Shell>
      <Header icon={<Building2 className="w-8 h-8 text-white" />}
        title="Recuperar contraseña" subtitle="Ingresá tu email para restaurar el acceso" />
      <ErrorBox />
      <form onSubmit={pedirLink} className="bg-white rounded-2xl shadow-sm border p-6 space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              required autoComplete="email"
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="tu@email.com" />
          </div>
        </div>
        <button type="submit" disabled={loading}
          className="w-full py-3.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-400 flex items-center justify-center gap-2">
          {loading ? (<><Loader2 className="w-5 h-5 animate-spin" /> Enviando…</>) : 'Enviar link de recuperación'}
        </button>
      </form>
      <p className="text-center mt-6 text-gray-500">
        ¿Recordaste tu contraseña?{' '}
        <Link href="/login" className="text-blue-600 hover:underline font-medium">Iniciá sesión</Link>
      </p>
    </Shell>
  );
}
