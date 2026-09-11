// =============================================================================
// PAGE: Register - Disabled (Admin creates users)
// =============================================================================
'use client';


import { Building2, Mail, Lock, User, Phone, Loader2, AlertCircle, Eye, EyeOff, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-300 rounded-2xl mb-4">
            <User className="w-8 h-8 text-gray-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Registro Deshabilitado</h1>
          <p className="text-gray-500 mt-1">Contactá al administrador del consorcio</p>
        </div>

        {/* Info */}
        <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-4">
          <div className="flex items-start gap-3 text-gray-600">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-gray-900 mb-1">¿Cómo crear una cuenta?</p>
              <p>El registro público está deshabilitado por seguridad. 
              comunicate con el administrador de tu consorcio para que te cree una cuenta 
              y asocie tu unidad.</p>
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <div className="flex items-start gap-3 text-gray-600">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-gray-900 mb-1">¿Ya tenés cuenta?</p>
                <p>Si yafuiste dado de alta por el admin, podés 
                <Link href="/login" className="text-blue-600 hover:underline font-medium"> iniciar sesión</Link>.</p>
              </div>
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <div className="flex items-start gap-3 text-gray-600">
              <Lock className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-gray-900 mb-1">¿Olvidaste tu contraseña?</p>
                <p>Podés 
                <Link href="/recuperar-password" className="text-blue-600 hover:underline font-medium"> recuperar tu contraseña</Link> 
                desde el panel de login.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Login link */}
        <p className="text-center mt-6 text-gray-500">
          ¿Ya tenés cuenta?{' '}
          <Link href="/login" className="text-blue-600 hover:underline font-medium">
            Iniciá sesión
          </Link>
        </p>
      </div>
    </div>
  );
}