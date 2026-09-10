// =============================================================================
// LIB: Admin secret + password temporal
// =============================================================================
// Utilidades compartidas por los endpoints de creación de usuarios.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Devuelve el secreto requerido para crear usuarios. SIN fallback:
 * si la variable no está (o es demasiado corta) tira error y el endpoint
 * responde 500 en vez de aceptar un default conocido.
 */
export function getAdminCreateSecret(): string {
  const secret = process.env.ADMIN_CREATE_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      'ADMIN_CREATE_SECRET no configurada o demasiado corta (mínimo 16 caracteres).'
    );
  }
  return secret;
}

/**
 * Comparación en tiempo constante. Se hashea cada lado antes de comparar
 * para que la longitud del input tampoco se filtre por timing.
 */
export function secretMatches(provided: unknown, expected: string): boolean {
  if (typeof provided !== 'string' || provided.length === 0) return false;
  const a = createHash('sha256').update(provided, 'utf8').digest();
  const b = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(a, b);
}

/**
 * Password temporal criptográficamente aleatorio.
 * 16 caracteres de un alfabeto sin ambigüedades + un símbolo final
 * (para cumplir políticas que exigen un carácter especial).
 */
export function generateTempPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(16);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out + '!';
}
