import { describe, it, expect } from 'vitest';
import { estadoPorMesesAtrasados, UMBRALES_MORA_DEFAULT, type UmbralesMora } from './mora-estado';

describe('estadoPorMesesAtrasados (máquina de estados de mora)', () => {
  describe('con los umbrales por defecto (3 / 6 / 12 meses)', () => {
    it('menos del umbral de apto_carta => deudor', () => {
      expect(estadoPorMesesAtrasados(0)).toBe('deudor');
      expect(estadoPorMesesAtrasados(1)).toBe('deudor');
      expect(estadoPorMesesAtrasados(2)).toBe('deudor');
    });

    it('en el umbral de apto_carta (3) o por encima, hasta antes de inicio_juicio => apto_carta', () => {
      expect(estadoPorMesesAtrasados(3)).toBe('apto_carta');
      expect(estadoPorMesesAtrasados(4)).toBe('apto_carta');
      expect(estadoPorMesesAtrasados(5)).toBe('apto_carta');
    });

    it('en el umbral de inicio_juicio (6) o por encima, hasta antes de juicio_en_curso => inicio_juicio', () => {
      expect(estadoPorMesesAtrasados(6)).toBe('inicio_juicio');
      expect(estadoPorMesesAtrasados(11)).toBe('inicio_juicio');
    });

    it('en el umbral de juicio_en_curso (12) o por encima => juicio_en_curso', () => {
      expect(estadoPorMesesAtrasados(12)).toBe('juicio_en_curso');
      expect(estadoPorMesesAtrasados(14)).toBe('juicio_en_curso');
      expect(estadoPorMesesAtrasados(100)).toBe('juicio_en_curso');
    });

    it('nunca devuelve al_dia (fuera del dominio de esta función: la filtra get_saldo_deudor.es_mora antes)', () => {
      for (let meses = 0; meses <= 24; meses++) {
        expect(estadoPorMesesAtrasados(meses)).not.toBe('al_dia');
      }
    });
  });

  describe('parametrizada por umbral (Fase 3: van a ser configurables por consorcio)', () => {
    const umbralesCustom: UmbralesMora = {
      apto_carta: 2,
      inicio_juicio: 5,
      juicio_en_curso: 8,
    };

    it('respeta los umbrales pasados por parámetro, no los valores por defecto', () => {
      expect(estadoPorMesesAtrasados(1, umbralesCustom)).toBe('deudor');
      expect(estadoPorMesesAtrasados(2, umbralesCustom)).toBe('apto_carta');
      expect(estadoPorMesesAtrasados(5, umbralesCustom)).toBe('inicio_juicio');
      expect(estadoPorMesesAtrasados(8, umbralesCustom)).toBe('juicio_en_curso');
    });

    it('con un umbral distinto, un valor que hoy da apto_carta puede dar otro estado', () => {
      // 3 meses con los umbrales por defecto es apto_carta...
      expect(estadoPorMesesAtrasados(3, UMBRALES_MORA_DEFAULT)).toBe('apto_carta');
      // ...pero con un umbral de apto_carta más alto, todavía es deudor.
      expect(estadoPorMesesAtrasados(3, { apto_carta: 4, inicio_juicio: 7, juicio_en_curso: 13 })).toBe('deudor');
    });

    it.each([
      { umbral: 1, casoLimite: 1, esperado: 'apto_carta' },
      { umbral: 6, casoLimite: 6, esperado: 'apto_carta' },
      { umbral: 10, casoLimite: 10, esperado: 'apto_carta' },
    ] as const)(
      'el umbral de apto_carta=$umbral se cruza justo en $casoLimite meses',
      ({ umbral, casoLimite, esperado }) => {
        const umbrales: UmbralesMora = { apto_carta: umbral, inicio_juicio: umbral + 5, juicio_en_curso: umbral + 10 };
        expect(estadoPorMesesAtrasados(casoLimite - 1, umbrales)).toBe('deudor');
        expect(estadoPorMesesAtrasados(casoLimite, umbrales)).toBe(esperado);
      }
    );
  });
});
