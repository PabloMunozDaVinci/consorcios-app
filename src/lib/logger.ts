// =============================================================================
// LOGGING: Helper para producción
// =============================================================================
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

// Configuración por entorno
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

// =============================================================================
// LOGGING: Solo loggea en dev o si hay verbose config
// =============================================================================
function shouldLog(level: LogLevel): boolean {
  if (isDevelopment) return true;
  
  // En producción solo warn y error por defecto
  if (isProduction) {
    return level === 'warn' || level === 'error';
  }
  
  return true;
}

export const logger = {
  debug(message: string, context?: LogContext) {
    if (shouldLog('debug')) {
      console.debug(formatMessage('DEBUG', message, context));
    }
  },

  info(message: string, context?: LogContext) {
    if (shouldLog('info')) {
      console.info(formatMessage('INFO', message, context));
    }
  },

  warn(message: string, context?: LogContext) {
    if (shouldLog('warn')) {
      console.warn(formatMessage('WARN', message, context));
    }
  },

  // Acepta unknown para catch blocks
  error(message: string, error?: unknown, context?: LogContext) {
    if (shouldLog('error')) {
      const errorObj = error instanceof Error 
        ? { error: error.message, stack: error.stack }
        : error 
          ? { error: String(error) }
          : undefined;
      console.error(formatMessage('ERROR', message, { ...errorObj, ...context }));
    }
  },
};

// Helper para formatear mensajes
function formatMessage(level: string, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : '';
  return `[${timestamp}] [${level}] ${message}${contextStr}`;
}

// =============================================================================
// LOG DE ERRORES: Helper para API routes
// =============================================================================
export function logApiError(endpoint: string, error: unknown, requestData?: unknown) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  logger.error(`API Error: ${endpoint}`, undefined, {
    message: errorMessage,
    stack: errorStack,
    requestData: requestData ? sanitizeData(requestData) : undefined,
    timestamp: new Date().toISOString(),
  });
}

// =============================================================================
// SANITIZE: Limpia datos sensibles de logs
// =============================================================================
function sanitizeData(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  
  if (typeof data === 'string') {
    // Ocultar passwords, tokens, etc
    return data.replace(/(password|token|key|secret|auth)[=:]?\s*\S+/gi, '[REDACTED]');
  }
  
  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('password') || lowerKey.includes('token') || lowerKey.includes('secret') || lowerKey.includes('key')) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeData(value);
      }
    }
    return sanitized;
  }
  
  return data;
}