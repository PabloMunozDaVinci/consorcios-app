// =============================================================================
// TEST DE INTEGRACIÓN: aislamiento entre administradoras (RLS multi-tenant)
// =============================================================================
// El test más importante del proyecto (PROMPT-features.md §1.1): un usuario
// de la administradora A no puede leer ni escribir nada de la B. Automatiza
// exactamente el escenario ya verificado a mano contra Supabase real con
// `admin-a@example.invalid` (administradora 001) y `admin-b@example.invalid`
// (administradora 002) — ver PENDIENTES.md, sección "Verificación Bloque 1".
//
// Corre contra el proyecto Supabase real (no hay un segundo proyecto de
// test). Se salta con un mensaje claro si no están las credenciales
// (`.env.local` / `SUPABASE_SERVICE_ROLE_KEY`), en vez de fallar — así no
// rompe una corrida sin red ni CI hasta que ese secret esté configurado ahí.
//
// Reproducir localmente: `npm test -- multi-tenant.integration` con
// `.env.local` presente (tiene que traer NEXT_PUBLIC_SUPABASE_URL,
// NEXT_PUBLIC_SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY reales).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  hasIntegrationCreds,
  signInComoUsuarioDeTest,
  ADMINISTRADORA_A,
  ADMINISTRADORA_B,
  EMAIL_ADMIN_A,
  EMAIL_ADMIN_B,
} from './helpers';

const correCreds = hasIntegrationCreds();
if (!correCreds) {
  console.warn(
    '[multi-tenant.integration.test] SUPABASE_SERVICE_ROLE_KEY / .env.local ausentes: ' +
      'se saltea el test de aislamiento multi-tenant (no falla).'
  );
}

describe.skipIf(!correCreds)('Aislamiento entre administradoras (RLS, Supabase real)', () => {
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;
  let consorcioCreadoPorB: string | null = null;

  beforeAll(async () => {
    clientA = await signInComoUsuarioDeTest(EMAIL_ADMIN_A);
    clientB = await signInComoUsuarioDeTest(EMAIL_ADMIN_B);
  }, 30000);

  afterAll(async () => {
    // Limpieza: borra (con su dueño real, B) el consorcio que crea el test de
    // escritura cruzada, para no dejar basura en la DB real.
    if (consorcioCreadoPorB) {
      await clientB.from('consorcios').delete().eq('id', consorcioCreadoPorB);
    }
    await clientA.auth.signOut();
    await clientB.auth.signOut();
  });

  it('admin-a sólo ve consorcios de su propia administradora', async () => {
    const { data, error } = await clientA.from('consorcios').select('id, administradora_id');
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    for (const fila of data!) {
      expect(fila.administradora_id).toBe(ADMINISTRADORA_A);
    }
  });

  it('admin-b no ve ningún consorcio de la administradora A', async () => {
    const { data, error } = await clientB.from('consorcios').select('id, administradora_id');
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    for (const fila of data!) {
      expect(fila.administradora_id).not.toBe(ADMINISTRADORA_A);
    }
  });

  it('admin-b no puede crear un consorcio declarando la administradora_id de A', async () => {
    const { data, error } = await clientB
      .from('consorcios')
      .insert({
        nombre: 'Intento cross-tenant (test aislamiento)',
        direccion: 'No debería existir',
        administradora_id: ADMINISTRADORA_A,
      })
      .select();

    // La policy WITH CHECK de `consorcios_tenant` exige que administradora_id
    // sea la propia (o super_admin); RLS lo rechaza.
    expect(data ?? []).toHaveLength(0);
    expect(error).not.toBeNull();
  });

  it('admin-a no puede leer un consorcio creado por admin-b en su propio tenant', async () => {
    const { data: creado, error: errCrear } = await clientB
      .from('consorcios')
      .insert({
        nombre: 'Consorcio de B (test aislamiento)',
        direccion: 'Administradora B',
        administradora_id: ADMINISTRADORA_B,
      })
      .select()
      .single();
    expect(errCrear).toBeNull();
    expect(creado).not.toBeNull();
    consorcioCreadoPorB = creado!.id as string;

    // admin-a no debería poder verlo aunque tenga el id exacto: RLS filtra la
    // fila silenciosamente (0 resultados, no un error).
    const { data: vistoPorA, error: errA } = await clientA
      .from('consorcios')
      .select('id')
      .eq('id', consorcioCreadoPorB);
    expect(errA).toBeNull();
    expect(vistoPorA ?? []).toHaveLength(0);
  });

  it('admin-a no puede modificar ni borrar el consorcio de admin-b', async () => {
    expect(consorcioCreadoPorB).not.toBeNull();

    const { data: actualizado, error: errUpdate } = await clientA
      .from('consorcios')
      .update({ nombre: 'Hackeado por A' })
      .eq('id', consorcioCreadoPorB as string)
      .select();
    expect(errUpdate).toBeNull();
    expect(actualizado ?? []).toHaveLength(0); // RLS: 0 filas afectadas.

    const { data: borrado, error: errDelete } = await clientA
      .from('consorcios')
      .delete()
      .eq('id', consorcioCreadoPorB as string)
      .select();
    expect(errDelete).toBeNull();
    expect(borrado ?? []).toHaveLength(0); // RLS: 0 filas afectadas.

    // Confirmación: B sigue viendo su consorcio, intacto.
    const { data: siguExistiendo, error: errB } = await clientB
      .from('consorcios')
      .select('id, nombre')
      .eq('id', consorcioCreadoPorB as string)
      .single();
    expect(errB).toBeNull();
    expect(siguExistiendo?.nombre).toBe('Consorcio de B (test aislamiento)');
  });
});
