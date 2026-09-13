import { describe, it, expect } from 'vitest';
import { parsearImporteAR } from './formato-ar';

describe('parsearImporteAR (parseo de importes en formato argentino)', () => {
  it('un entero simple sin separadores', () => {
    expect(parsearImporteAR('150000')).toBe(150000);
  });

  it('decimal con punto (formato "de sistema")', () => {
    expect(parsearImporteAR('150000.50')).toBe(150000.5);
  });

  it('decimal con coma (sólo separador decimal, sin miles)', () => {
    expect(parsearImporteAR('150000,50')).toBe(150000.5);
  });

  it('formato AR real: punto de miles + coma decimal', () => {
    expect(parsearImporteAR('150.000,50')).toBe(150000.5);
  });

  it('con símbolo de moneda, sólo punto de miles (importe redondo, sin decimales)', () => {
    expect(parsearImporteAR('$ 150.000')).toBe(150000);
  });

  it('sólo punto con más de un grupo de miles', () => {
    expect(parsearImporteAR('1.500.000')).toBe(1500000);
  });

  it('sólo punto con 1 o 2 dígitos después: se interpreta como decimal, no como miles', () => {
    expect(parsearImporteAR('150.5')).toBe(150.5);
    expect(parsearImporteAR('150.50')).toBe(150.5);
  });

  it('cadena vacía => null', () => {
    expect(parsearImporteAR('')).toBeNull();
  });

  it('texto no numérico => null', () => {
    expect(parsearImporteAR('abc')).toBeNull();
  });
});
