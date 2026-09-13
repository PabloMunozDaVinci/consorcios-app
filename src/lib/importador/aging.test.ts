import { describe, it, expect } from 'vitest';
import { periodoMasAntiguoPendiente } from './aging';

describe('periodoMasAntiguoPendiente (aging FIFO en JS, espejo de get_saldo_deudor)', () => {
  it('sin débitos => null (no hay ningún período al que imputar)', () => {
    expect(periodoMasAntiguoPendiente([], 0)).toBeNull();
    expect(periodoMasAntiguoPendiente([], 100000)).toBeNull();
  });

  it('los créditos cubren todo => null (no queda ningún período pendiente)', () => {
    const debitos = [
      { periodo: '2025-01-01', importe: 50000 },
      { periodo: '2025-02-01', importe: 50000 },
    ];
    expect(periodoMasAntiguoPendiente(debitos, 100000)).toBeNull();
    // con más crédito del necesario también cubre todo.
    expect(periodoMasAntiguoPendiente(debitos, 999999)).toBeNull();
  });

  it('créditos parciales => devuelve el período más viejo con saldo pendiente', () => {
    const debitos = [
      { periodo: '2025-03-01', importe: 50000 },
      { periodo: '2025-01-01', importe: 50000 },
      { periodo: '2025-02-01', importe: 50000 },
    ];
    // 75000 cubre enero entero y deja 25000 de febrero: el más viejo
    // pendiente es febrero, no marzo, aunque el array no venga ordenado.
    expect(periodoMasAntiguoPendiente(debitos, 75000)).toBe('2025-02-01');
  });

  it('sin créditos => el primer período (el más viejo) queda pendiente', () => {
    const debitos = [
      { periodo: '2025-02-01', importe: 50000 },
      { periodo: '2025-01-01', importe: 50000 },
    ];
    expect(periodoMasAntiguoPendiente(debitos, 0)).toBe('2025-01-01');
  });
});
