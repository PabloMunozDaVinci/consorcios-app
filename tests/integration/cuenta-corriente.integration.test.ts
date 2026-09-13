// =============================================================================
// TEST DE INTEGRACIÓN: get_saldo_deudor — aging FIFO con pago parcial
// =============================================================================
// Cubre el caso central de la migración 007 (Fase 1, cuenta_corriente): un
// crédito (pago) que no alcanza para cubrir toda la deuda se aplica en orden
// FIFO, el período más viejo primero. Fixture: 3 períodos de débito
// consecutivos de $50000 cada uno ($150000 en total) y un crédito único de
// $75000 (un pago y medio).
//
// Aritmética esperada (ver supabase/migrations/007_fase1_cuenta_corriente.sql,
// sección 6, CTE `aging`): el crédito de 75000 cubre el período 1 entero
// (50000) y deja 25000 disponibles para el período 2, que cuesta 50000 → le
// quedan 25000 de saldo pendiente (>0, así que cuenta como atrasado aunque
// esté parcialmente pago). El período 3 no recibe nada: 50000 pendientes.
// Total: meses_atrasados = 2 (períodos 2 y 3), monto_total = 25000 + 50000 =
// 75000.
//
// Corre contra el proyecto Supabase real, igual que multi-tenant.integration
// y saldo-deudor.integration. Reproducir localmente: `npm test --
// cuenta-corriente.integration` con `.env.local` presente. Se salta (no
// falla) si faltan credenciales.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hasIntegrationCreds, signInComoUsuarioDeTest, ADMINISTRADORA_A, EMAIL_ADMIN_A } from './helpers';

const correCreds = hasIntegrationCreds();
if (!correCreds) {
  console.warn(
    '[cuenta-corriente.integration.test] SUPABASE_SERVICE_ROLE_KEY / .env.local ausentes: ' +
      'se saltea el test de aging FIFO (no falla).'
  );
}

/** Primer día del mes, `n` meses antes de hoy, como "YYYY-MM-DD". */
function primerDiaHaceNMeses(n: number): string {
  const hoy = new Date();
  const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - n, 1);
  const yyyy = fecha.getFullYear();
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}-01`;
}

describe.skipIf(!correCreds)('get_saldo_deudor: aging FIFO con pago parcial (RPC, Supabase real)', () => {
  let client: SupabaseClient;
  let consorcioId: string | null = null;

  beforeAll(async () => {
    client = await signInComoUsuarioDeTest(EMAIL_ADMIN_A);
  }, 30000);

  afterAll(async () => {
    // Borrar el consorcio cascadea edificio → unidad → propietario →
    // cuenta_corriente (ON DELETE CASCADE, ver migración 007).
    if (consorcioId) {
      await client.from('consorcios').delete().eq('id', consorcioId);
    }
    await client.auth.signOut();
  });

  it('un crédito que cubre 1.5 períodos deja meses_atrasados = 2 y monto_total = 75000', async () => {
    const sufijo = `${Date.now()}`;

    const { data: consorcio, error: errConsorcio } = await client
      .from('consorcios')
      .insert({
        nombre: `Test cuenta-corriente FIFO ${sufijo}`,
        direccion: 'Dirección de test',
        administradora_id: ADMINISTRADORA_A,
      })
      .select()
      .single();
    expect(errConsorcio).toBeNull();
    consorcioId = consorcio!.id as string;

    const { data: edificio, error: errEdificio } = await client
      .from('edificios')
      .insert({ consortium_id: consorcioId, nombre: 'Edificio de test' })
      .select()
      .single();
    expect(errEdificio).toBeNull();

    const { data: unidad, error: errUnidad } = await client
      .from('unidades')
      .insert({ building_id: edificio!.id as string, numero: `T-${sufijo}` })
      .select()
      .single();
    expect(errUnidad).toBeNull();

    const { data: _propietario, error: errPropietario } = await client
      .from('propietarios')
      .insert({
        unidad_id: unidad!.id as string,
        nombre: 'Deudor',
        apellido: 'Parcial',
        dni: sufijo.slice(-8),
        email: `deudor-parcial-test-${sufijo}@example.invalid`,
      })
      .select()
      .single();
    expect(errPropietario).toBeNull();

    const IMPORTE_MENSUAL = 50000;
    const debitos = [2, 1, 0].map((n) => ({
      unidad_id: unidad!.id as string,
      administradora_id: ADMINISTRADORA_A,
      consorcio_id: consorcioId as string,
      tipo: 'debito' as const,
      concepto: 'Expensas',
      importe: IMPORTE_MENSUAL,
      periodo: primerDiaHaceNMeses(n),
      origen: 'importacion' as const,
    }));
    const { error: errDebitos } = await client.from('cuenta_corriente').insert(debitos);
    expect(errDebitos).toBeNull();

    // Un pago y medio: cubre el período más viejo entero y deja 25000 del
    // segundo. El tercero (el más nuevo) queda sin tocar.
    const { error: errCredito } = await client.from('cuenta_corriente').insert({
      unidad_id: unidad!.id as string,
      administradora_id: ADMINISTRADORA_A,
      consorcio_id: consorcioId as string,
      tipo: 'credito',
      concepto: 'Pago parcial',
      importe: 75000,
      periodo: primerDiaHaceNMeses(2),
      origen: 'pago',
    });
    expect(errCredito).toBeNull();

    const { data: saldo, error: errRpc } = await client.rpc('get_saldo_deudor', {
      p_unidad_id: unidad!.id as string,
    });
    expect(errRpc).toBeNull();
    expect(saldo).not.toBeNull();
    expect(saldo!.length).toBe(1);

    const fila = saldo![0] as { meses_atrasados: number; monto_total: number; es_mora: boolean };
    expect(fila.meses_atrasados).toBe(2);
    expect(fila.monto_total).toBe(25000 + IMPORTE_MENSUAL);
    expect(fila.es_mora).toBe(false); // umbral de es_mora es >= 3 meses atrasados
  });
});
