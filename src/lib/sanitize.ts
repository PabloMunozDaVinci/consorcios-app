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
  secret: z.string(),
});

// Schema for creating propietario
export const createPropietarioSchema = z.object({
  email: z.string().email(),
  nombre: z.string().min(1).max(100),
  apellido: z.string().min(1).max(100),
  dni: z.string().min(1).max(20),
  telefono: z.string().max(20).optional(),
  unidad_id: z.string().uuid(),
  sendInvitation: z.boolean().optional(),
  secret: z.string(),
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

// Schema for create pago
export const createPagoSchema = z.object({
  unidad_id: z.string().uuid(),
  monto: z.string().transform(Number).pipe(z.number().positive()),
  mes_pagado: z.string().regex(/^\d{4}-\d{2}$/),
  medio_pago: z.enum(['transferencia', 'rapipago', 'boca', 'tarjeta']).optional(),
  nro_comprobante: z.string().max(100).optional(),
});

// Schema for create consorcio
export const createConsorcioSchema = z.object({
  nombre: z.string().min(1).max(255),
  direccion: z.string().min(1).max(500),
  ciudad: z.string().max(100).optional(),
  email_admin: z.string().email().optional(),
  telefono: z.string().max(20).optional(),
});

// Schema for create edificio
export const createEdificioSchema = z.object({
  nombre: z.string().min(1).max(255),
  direccion: z.string().max(500).optional(),
  pisos: z.number().int().positive().max(100).optional(),
  unidades_por_piso: z.number().int().positive().max(20).optional(),
  consortium_id: z.string().uuid(),
});

// Schema for create unidad
export const createUnidadSchema = z.object({
  building_id: z.string().uuid(),
  numero: z.string().min(1).max(20),
  piso: z.number().int().min(0).max(100).optional(),
  tipo: z.enum(['depto', 'cochera', 'baulera']).optional(),
  coeficiente: z.number().positive().max(10).optional(),
  es_especial: z.boolean().optional(),
  habitada: z.boolean().optional(),
});

// Schema for create arreglo
export const createArregloSchema = z.object({
  titulo: z.string().min(1).max(255),
  descripcion: z.string().max(2000).optional(),
  unidad_id: z.string().uuid().optional(),
  prioridad: z.enum(['baja', 'media', 'alta']).optional(),
  presupuesto: z.number().positive().optional(),
  es_area_comun: z.boolean().optional(),
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

/**
 * Validate input with a schema
 */
export function validateInput<T>(schema: z.ZodSchema<T>, input: unknown): T | null {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.issues);
    }
    return null;
  }
}