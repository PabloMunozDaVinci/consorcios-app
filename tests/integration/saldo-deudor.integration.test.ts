// =============================================================================
// TEST DE INTEGRACIÓN: get_saldo_deudor — cálculo de meses de deuda
// =============================================================================
// Caso de regresión conocido (supabase/migrations/001_bloque0_arranque.sql):
// `EXTRACT(MONTH FROM AGE(...))` sin sumar los años sólo toma el componente
// de meses del intervalo, así que una deuda de 14 meses se calculaba como 2.
// La función vive enteramente en plpgsql (`get_saldo_deudor`, SECURITY
// DEFINER) — no hay una versión espejo de la fórmula en TS, así que en vez de
// simular el cálculo en JS (lo que no probaría nada sobre el SQL real) este
// test crea un fixture mínimo (consorcio → edificio → unidad → propietario →
// pago con mes_pagado = hoy - 14 meses) y llama la función real vía RPC.
//
// Corre contra el proyecto Supabase real, igual que multi-tenant.integration.
// Reproducir localmente: `npm test -- saldo-deudor.integration` con
// `.env.local` presente. Se salta (no falla) si faltan credenciales.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hasIntegrationCreds, signInComoUsuarioDeTest, ADMINISTRADORA_A, EMAIL_ADMIN_A } from './helpers';

const correCreds = hasIntegrationCreds();
if (!correCreds) {
  console.warn(
    '[saldo-deudor.integration.test] SUPABASE_SERVICE_ROLE_KEY / .env.local ausentes: ' +
      'se saltea el test de get_saldo_deudor (no falla).'
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

describe.skipIf(!correCreds)('get_saldo_deudor: cálculo de meses de deuda (RPC, Supabase real)', () => {
  let client: SupabaseClient;
  let consorcioId: string | null = null;

  beforeAll(async () => {
    client = await signInComoUsuarioDeTest(EMAIL_ADMIN_A);
  }, 30000);

  afterAll(async () => {
    // Borrar el consorcio cascadea edificio → unidad → propietario → pago
    // (todas las FK tienen ON DELETE CASCADE, ver supabase/schema.sql).
    if (consorcioId) {
      await client.from('consorcios').delete().eq('id', consorcioId);
    }
    await client.auth.signOut();
  });

  it('una deuda de 14 meses da meses_atrasados = 14, no 2 (regresión del bug original)', async () => {
    const sufijo = `${Date.now()}`;

    const { data: consorcio, error: errConsorcio } = await client
      .from('consorcios')
      .insert({
        nombre: `Test Bloque4 saldo-deudor ${sufijo}`,
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

    const { data: propietario, error: errPropietario } = await client
      .from('propietarios')
      .insert({
        unidad_id: unidad!.id as string,
        nombre: 'Deudor',
        apellido: 'De Prueba',
        dni: sufijo.slice(-8),
        email: `deudor-test-${sufijo}@example.invalid`,
      })
      .select()
      .single();
    expect(errPropietario).toBeNull();

    // Último pago confirmado: hace 14 meses. get_saldo_deudor cuenta desde ahí.
    const mesPagado = primerDiaHaceNMeses(14);
    const { error: errPago } = await client.from('pagos').insert({
      unidad_id: unidad!.id as string,
      propietario_id: propietario!.id as string,
      monto: 1000,
      mes_pagado: mesPagado,
      estado: 'confirmado',
    });
    expect(errPago).toBeNull();

    const { data: saldo, error: errRpc } = await client.rpc('get_saldo_deudor', {
      p_unidad_id: unidad!.id as string,
    });
    expect(errRpc).toBeNull();
    expect(saldo).not.toBeNull();
    expect(saldo!.length).toBe(1);

    const fila = saldo![0] as { meses_atrasados: number; es_mora: boolean };
    expect(fila.meses_atrasados).toBe(14);
    expect(fila.meses_atrasados).not.toBe(2); // el bug original daba esto
    expect(fila.es_mora).toBe(true);
  });
});
