// =============================================================================
// LIB: Sanitize - Input sanitization to prevent XSS and injection attacks
// =============================================================================

import { z } from 'zod';

/**
 * Sanitize a string to prevent XSS
 * Removes dangerous characters and patterns
 */
export function sanitizeString(input: string | unknown): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    // Remove HTML tags
    .replace(/</g, '')
    .replace(/>/g, '')
    // Remove javascript: URLs
    .replace(/javascript:/gi, '')
    // Remove event handlers
    .replace(/on\w+=/gi, '')
    // Remove data: URLs (potential XSS)
    .replace(/data:/gi, '')
    // Remove vbscript: URLs
    .replace(/vbscript:/gi, '')
    // Remove expression()
    .replace(/expression\s*\(/gi, '')
    // Trim whitespace
    .trim()
    // Limit length
    .slice(0, 10000);
}

/**
 * Sanitize an email
 */
export function sanitizeEmail(input: string | unknown): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Lowercase, trim, limit length
  return input
    .toLowerCase()
    .trim()
    .slice(0, 255);
}

/**
 * Validate and sanitize a UUID
 */
export function validateUUID(input: string | unknown): string | null {
  if (typeof input !== 'string') {
    return null;
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (!uuidRegex.test(input)) {
    return null;
  }
  
  return input.toLowerCase();
}

/**
 * Sanitize a phone number
 */
export function sanitizePhone(input: string | unknown): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Keep only digits, spaces, dashes, parentheses, plus
  return input
    .replace(/[^\d\s\-()+]/g, '')
    .trim()
    .slice(0, 20);
}

/**
 * Sanitize a number string
 */
export function sanitizeNumber(input: string | unknown): string {
  if (typeof input !== 'string') {
    return '0';
  }
  
  // Keep only digits and decimal point
  return input.replace(/[^\d.]/g, '').slice(0, 20);
}

/**
 * Validate a date string (YYYY-MM)
 */
export function validateMonth(input: string | unknown): boolean {
  if (typeof input !== 'string') {
    return false;
  }
  
  const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
  return monthRegex.test(input);
}

/**
 * Validate a date (YYYY-MM-DD)
 */
export function validateDate(input: string | unknown): boolean {
  if (typeof input !== 'string') {
    return false;
  }
  
  const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  if (!dateRegex.test(input)) {
    return false;
  }
  
  // Validar fecha real
  const date = new Date(input);
  return !isNaN(date.getTime());
}

/**
 * Check for SQL injection patterns
 */
export function containsSQLInjection(input: string | unknown): boolean {
  if (typeof input !== 'string') {
    return false;
  }
  
  const sqlPatterns = [
    /(\bunion\b.*\bselect\b)/i,
    /(\bselect\b.*\bfrom\b)/i,
    /(\binsert\b.*\binto\b)/i,
    /(\bdelete\b.*\bfrom\b)/i,
    /(\bupdate\b.*\bset\b)/i,
    /(\bdrop\b.*\btable\b)/i,
    /(\bdrop\b.*\bdatabase\b)/i,
    /(\bexec\b|\bexecute\b)/i,
    /(\bsp_\w+)/i,
    /(\bxp_\w+)/i,
    /('--|\/\*|\*\/|@@)/i,
  ];
  
  return sqlPatterns.some(pattern => pattern.test(input));
}

/**
 * Check for XSS patterns
 */
export function containsXSS(input: string | unknown): boolean {
  if (typeof input !== 'string') {
    return false;
  }
  
  const xssPatterns = [
    /<script/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /eval\s*\(/i,
    /expression\s*\(/i,
  ];
  
  return xssPatterns.some(pattern => pattern.test(input));
}

/**
 * Sanitize an object recursively
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  fieldsToSanitize: (keyof T)[]
): T {
  const sanitized = { ...obj };
  
  for (const field of fieldsToSanitize) {
    if (field in sanitized && typeof sanitized[field] === 'string') {
      sanitized[field] = sanitizeString(sanitized[field]) as T[keyof T];
    }
  }
  
  return sanitized;
}

// =============================================================================
// ZOD SCHEMAS - Validación de entrada
// =============================================================================

// Schema for creating admin
export const createAdminSchema = z.object({
  email: z.string().email(),
  nombre: z.string().min(1).max(100),
  sendInvitation: z.boolean().optional(),
  secret: z.string().min(1),
  administradora_id: z.string().uuid().optional(),
  rol: z.enum(['admin', 'super_admin']).optional(),
});

// Schema for creating propietario
export const createPropietarioSchema = z.object({
  email: z.string().email(),
  nombre: z.string().min(1).max(100),
  apellido: z.string().min(1).max(100),
  dni: z.string().min(1).max(20),
  telefono: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.string().max(20).optional()),
  unidad_id: z.string().uuid(),
  sendInvitation: z.boolean().optional(),
  secret: z.string().min(1),
});

// Schema for reset password
export const resetPasswordSchema = z.object({
  email: z.string().email(),
});

// Schema for login
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Los formularios mandan strings (y "" para los vacíos). Estos helpers los
// normalizan antes de validar.
const optionalText = (max: number) =>
  z.preprocess((v) => (v === '' || v == null ? undefined : v), z.string().max(max).optional());
// `schema` tipado como `ZodTypeAny` acá perdía el tipo de salida concreto
// (`number`) — TS lo ensanchaba a `{}`/`unknown` al pasar por `.optional()`,
// invisible mientras los inserts de Supabase no estaban tipados. Con `T
// extends z.ZodNumber` se preserva el tipo real.
const optionalNumber = <T extends z.ZodNumber>(schema: T) =>
  z.preprocess((v) => (v === '' || v == null ? undefined : Number(v)), schema.optional());
const requiredNumber = <T extends z.ZodNumber>(schema: T) =>
  z.preprocess((v) => (v === '' || v == null ? NaN : Number(v)), schema);
const optionalBool = z.preprocess(
  (v) => (v === 'true' || v === true ? true : v === 'false' || v === false ? false : undefined),
  z.boolean().optional()
);

// Schema for create pago
export const createPagoSchema = z.object({
  unidad_id: z.string().uuid(),
  monto: requiredNumber(z.number().positive()),
  mes_pagado: z.string().regex(/^\d{4}-\d{2}$/),
  medio_pago: z.enum(['transferencia', 'rapipago', 'boca', 'tarjeta']).optional(),
  nro_comprobante: optionalText(100),
});

// Schema for create consorcio
export const createConsorcioSchema = z.object({
  nombre: z.string().min(1).max(255),
  direccion: z.string().min(1).max(500),
  ciudad: optionalText(100),
  email_admin: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.string().email().optional()
  ),
  telefono: optionalText(20),
});

// Schema for create edificio
export const createEdificioSchema = z.object({
  nombre: z.string().min(1).max(255),
  direccion: optionalText(500),
  pisos: optionalNumber(z.number().int().positive().max(100)),
  unidades_por_piso: optionalNumber(z.number().int().positive().max(20)),
  consortium_id: z.string().uuid(),
});

// Schema for create unidad
export const createUnidadSchema = z.object({
  building_id: z.string().uuid(),
  numero: z.string().min(1).max(20),
  piso: optionalNumber(z.number().int().min(0).max(100)),
  tipo: z.enum(['depto', 'cochera', 'baulera']).optional(),
  coeficiente: optionalNumber(z.number().positive().max(10)),
  es_especial: optionalBool,
  habitada: optionalBool,
});

// Schema for create arreglo
export const createArregloSchema = z.object({
  titulo: z.string().min(1).max(255),
  descripcion: optionalText(2000),
  unidad_id: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.string().uuid().optional()
  ),
  prioridad: z.enum(['baja', 'media', 'alta']).optional(),
  presupuesto: optionalNumber(z.number().positive()),
  es_area_comun: optionalBool,
});

// Type exports
export type CreateAdminInput = z.infer<typeof createAdminSchema>;
export type CreatePropietarioInput = z.infer<typeof createPropietarioSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreatePagoInput = z.infer<typeof createPagoSchema>;
export type CreateConsorcioInput = z.infer<typeof createConsorcioSchema>;
export type CreateEdificioInput = z.infer<typeof createEdificioSchema>;
export type CreateUnidadInput = z.infer<typeof createUnidadSchema>;
export type CreateArregloInput = z.infer<typeof createArregloSchema>;

export type FieldErrors = Record<string, string>;

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: FieldErrors };

/**
 * Valida `input` contra `schema`. En caso de error devuelve un mapa
 * campo -> mensaje, sin filtrar nada del backend.
 */
export function validateInput<T>(
  schema: z.ZodType<T>,
  input: unknown
): ValidationResult<T> {
  const parsed = schema.safeParse(input);
  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }
  const errors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_';
    if (!errors[key]) errors[key] = issue.message;
  }
  return { ok: false, errors };
}

/** Response 400 estándar con errores de campo. */
export function badRequest(errors: FieldErrors): Response {
  return Response.json({ success: false, error: 'Datos inválidos', errores: errors }, { status: 400 });
}