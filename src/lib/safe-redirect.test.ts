import { describe, it, expect } from 'vitest';
import { safeRedirectPath } from './safe-redirect';

describe('safeRedirectPath (evita open redirects en el login)', () => {
  describe('paths internos válidos', () => {
    it('acepta un path simple', () => {
      expect(safeRedirectPath('/consorcios')).toBe('/consorcios');
    });

    it('acepta un path con segmentos', () => {
      expect(safeRedirectPath('/consorcios/123')).toBe('/consorcios/123');
    });

    it('conserva query string y hash', () => {
      expect(safeRedirectPath('/consorcios?tab=activos#top')).toBe('/consorcios?tab=activos#top');
    });

    it('acepta la raíz', () => {
      expect(safeRedirectPath('/')).toBe('/');
    });
  });

  describe('open redirects protocol-relative (//)', () => {
    it('rechaza "//evil.com" (protocol-relative)', () => {
      expect(safeRedirectPath('//evil.com', '/')).toBe('/');
    });

    it('rechaza "///evil.com"', () => {
      expect(safeRedirectPath('///evil.com', '/')).toBe('/');
    });
  });

  describe('open redirects vía backslash (los browsers lo normalizan a //)', () => {
    it('rechaza "/\\evil.com"', () => {
      expect(safeRedirectPath('/\\evil.com', '/')).toBe('/');
    });

    it('rechaza un path que contiene un backslash en cualquier posición', () => {
      expect(safeRedirectPath('/consorcios\\evil.com', '/')).toBe('/');
    });
  });

  describe('esquemas embebidos', () => {
    it('rechaza "javascript:alert(1)" (no empieza con "/")', () => {
      expect(safeRedirectPath('javascript:alert(1)', '/')).toBe('/');
    });

    it('rechaza "http://evil.com" (no empieza con "/")', () => {
      expect(safeRedirectPath('http://evil.com', '/')).toBe('/');
    });

    it('rechaza "https://evil.com"', () => {
      expect(safeRedirectPath('https://evil.com', '/')).toBe('/');
    });
  });

  describe('valores inválidos / ausentes', () => {
    it('usa el fallback si es null', () => {
      expect(safeRedirectPath(null, '/fallback')).toBe('/fallback');
    });

    it('usa el fallback si es undefined', () => {
      expect(safeRedirectPath(undefined, '/fallback')).toBe('/fallback');
    });

    it('usa el fallback si es string vacío', () => {
      expect(safeRedirectPath('', '/fallback')).toBe('/fallback');
    });

    it('usa "/" como fallback por defecto', () => {
      expect(safeRedirectPath(null)).toBe('/');
    });

    it('rechaza un path con caracteres de control (ej. %00 decodificado)', () => {
      expect(safeRedirectPath('/consorcios\x00/evil', '/')).toBe('/');
    });

    it('rechaza un valor que no empieza con "/"', () => {
      expect(safeRedirectPath('consorcios', '/')).toBe('/');
    });
  });
});
