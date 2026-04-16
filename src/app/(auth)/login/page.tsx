// =============================================================================
// PAGE: Login - Authentication
// =============================================================================
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Building2, Mail, Lock, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { createSupabaseClient } from '@/lib/supabase';
import { logLoginSuccess, logLoginFailed, logIPBlocked } from '@/lib/security/logger';
import { getGeoFromIP as getClientIP } from '@/lib/geolocation';
import { isIPBlocked, blockIP } from '@/lib/security/blocklist';

const supabase = createSupabaseClient();

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Get client IP for logging
      const ip = await getClientIPAsync();
      
      // Check if IP is blocked before attempting login
      const blocked = await isIPBlocked(ip);
      if (blocked) {
        setError('Tu IP está bloqueada. Intenta más tarde.');
        setLoading(false);
        return;
      }

      const { error: authError, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        // Log failed login
        await logLoginFailed(email, ip, authError.message);
        
        // Check if it's a "invalid login credentials" error
        if (authError.message.toLowerCase().includes('invalid login credentials')) {
          setError('Email o contraseña incorrectos');
        } else {
          setError(authError.message);
        }
        
        setLoading(false);
        return;
      }

      // Log successful login
      if (data?.session) {
        await logLoginSuccess(email, ip);
      }

      // Login successful - redirect
      router.push(redirect);
      router.refresh();
    } catch (err) {
      setError('Error de conexión');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Consorcios App</h1>
          <p className="text-gray-500 mt-1">Ingresá a tu cuenta</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border p-6 space-y-5">
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="tu@email.com"
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-400 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Ingresando...
              </>
            ) : (
              'Ingresar'
            )}
          </button>

          {/* Forgot password */}
          <div className="text-center">
            <Link href="/recuperar-password" className="text-sm text-gray-500 hover:text-gray-700">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </form>

        {/* Register info */}
        <div className="mt-6 p-4 bg-gray-50 rounded-xl text-center">
          <p className="text-sm text-gray-600">
            El registro está gestionado por el administrador. Contactalo para crear tu cuenta.
          </p>
          <Link href="/register" className="text-sm text-blue-600 hover:underline mt-2 block">
            Más información
          </Link>
        </div>
      </div>
    </div>
  );
}

// Helper to get IP from client side
async function getClientIPAsync(): Promise<string> {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch {
    return 'unknown';
  }
}