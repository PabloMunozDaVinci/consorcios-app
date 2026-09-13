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

// =============================================================================
// Aislamiento multi-tenant de las tablas nuevas de Fase 1 (cuenta_corriente,
// importaciones), migración 007_fase1_cuenta_corriente.sql. Mismo escenario
// que arriba (admin-a / admin-b), aplicado a las tablas nuevas: confirma el
// aislamiento básico (lectura y escritura cruzada), no cada policy en detalle
// — el análisis fino de RLS lo hace el subagente `auditor-rls` por separado.
// =============================================================================
describe.skipIf(!correCreds)('Aislamiento entre administradoras: cuenta_corriente / importaciones (RLS, Supabase real)', () => {
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;
  let consorcioId: string | null = null;
  let consorcioIdB: string | null = null;
  let edificioId: string | null = null;
  let unidadId: string | null = null;
  let movimientoId: string | null = null;
  let importacionId: string | null = null;

  beforeAll(async () => {
    clientA = await signInComoUsuarioDeTest(EMAIL_ADMIN_A);
    clientB = await signInComoUsuarioDeTest(EMAIL_ADMIN_B);

    // Fixture de A: consorcio → edificio → unidad, con un movimiento de
    // cuenta_corriente y una importación, todo creado por admin-a.
    const sufijo = `${Date.now()}`;

    const { data: consorcio, error: errConsorcio } = await clientA
      .from('consorcios')
      .insert({
        nombre: `Test multi-tenant cuenta_corriente ${sufijo}`,
        direccion: 'Dirección de test',
        administradora_id: ADMINISTRADORA_A,
      })
      .select()
      .single();
    if (errConsorcio) throw errConsorcio;
    consorcioId = consorcio!.id as string;

    const { data: edificio, error: errEdificio } = await clientA
      .from('edificios')
      .insert({ consortium_id: consorcioId, nombre: 'Edificio de test' })
      .select()
      .single();
    if (errEdificio) throw errEdificio;

    edificioId = edificio!.id as string;

    const { data: unidad, error: errUnidad } = await clientA
      .from('unidades')
      .insert({ building_id: edificioId, numero: `T-${sufijo}` })
      .select()
      .single();
    if (errUnidad) throw errUnidad;
    unidadId = unidad!.id as string;

    // Consorcio de B, sólo para el test de PATCH cross-tenant de abajo.
    const { data: consorcioB, error: errConsorcioB } = await clientB
      .from('consorcios')
      .insert({
        nombre: `Test multi-tenant cuenta_corriente (B) ${sufijo}`,
        direccion: 'Dirección de test',
        administradora_id: ADMINISTRADORA_B,
      })
      .select()
      .single();
    if (errConsorcioB) throw errConsorcioB;
    consorcioIdB = consorcioB!.id as string;

    const { data: movimiento, error: errMovimiento } = await clientA
      .from('cuenta_corriente')
      .insert({
        unidad_id: unidadId,
        administradora_id: ADMINISTRADORA_A,
        consorcio_id: consorcioId,
        tipo: 'debito',
        concepto: 'Expensas',
        importe: 50000,
        periodo: '2025-01-01',
        origen: 'importacion',
      })
      .select()
      .single();
    if (errMovimiento) throw errMovimiento;
    movimientoId = movimiento!.id as string;

    // administradora_id/consorcio_id los deriva el trigger set_tenant_cols()
    // de edificio_id (008_fase1_fixes_auditoria.sql) — no se mandan acá.
    const { data: importacion, error: errImportacion } = await clientA
      .from('importaciones')
      .insert({
        edificio_id: edificioId,
        tipo: 'padron',
        archivo_nombre: 'test-multi-tenant.csv',
        mapeo_columnas: {},
      })
      .select()
      .single();
    if (errImportacion) throw errImportacion;
    importacionId = importacion!.id as string;
  }, 30000);

  afterAll(async () => {
    // Borrar el consorcio (con A, su dueño real) cascadea edificio → unidad →
    // cuenta_corriente, y edificio → importaciones (edificio_id, ON DELETE
    // CASCADE, ver migración 008).
    if (consorcioId) {
      await clientA.from('consorcios').delete().eq('id', consorcioId);
    }
    if (consorcioIdB) {
      await clientB.from('consorcios').delete().eq('id', consorcioIdB);
    }
    await clientA.auth.signOut();
    await clientB.auth.signOut();
  });

  it('admin-b no puede leer el movimiento de cuenta_corriente de una unidad de A', async () => {
    const { data, error } = await clientB.from('cuenta_corriente').select('id').eq('id', movimientoId as string);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it('admin-b no puede leer ningún movimiento de cuenta_corriente de A por unidad_id', async () => {
    const { data, error } = await clientB.from('cuenta_corriente').select('id').eq('unidad_id', unidadId as string);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it('admin-b no puede leer la importación del consorcio de A', async () => {
    const { data, error } = await clientB.from('importaciones').select('id').eq('id', importacionId as string);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it('admin-b no puede insertar un movimiento de cuenta_corriente apuntando a una unidad de A', async () => {
    const { data, error } = await clientB
      .from('cuenta_corriente')
      .insert({
        unidad_id: unidadId as string,
        administradora_id: ADMINISTRADORA_B, // intento: declarar la propia, pero el trigger deriva la real de A.
        consorcio_id: consorcioId as string,
        tipo: 'credito',
        concepto: 'Intento cross-tenant (test aislamiento)',
        importe: 1000,
        periodo: '2025-01-01',
        origen: 'ajuste',
      })
      .select();

    // El trigger set_tenant_cols() pisa administradora_id/consorcio_id con
    // los reales de la unidad (de A); el WITH CHECK de la policy de INSERT
    // evalúa puede_consorcio() contra esos valores reales y con la sesión de
    // B no da true, así que RLS rechaza el insert.
    expect(data ?? []).toHaveLength(0);
    expect(error).not.toBeNull();

    // Confirmación: A sigue viendo sólo su movimiento original, no quedó
    // ninguna fila fantasma de B.
    const { data: movimientosDeA, error: errLecturaA } = await clientA
      .from('cuenta_corriente')
      .select('id')
      .eq('unidad_id', unidadId as string);
    expect(errLecturaA).toBeNull();
    expect(movimientosDeA ?? []).toHaveLength(1);
  });

  // Hallazgo de la auditoría (primera pasada) sobre 007: la policy de UPDATE
  // de `importaciones` no tenía el mismo chequeo que la de INSERT, así que un
  // admin podía re-apuntar el consorcio_id de una importación propia al
  // consorcio de otro tenant. El fix (008) no parchea esa policy — le da a
  // `importaciones` un trigger BEFORE INSERT OR UPDATE (sin "OF columna", a
  // propósito) que recalcula administradora_id/consorcio_id desde
  // edificio_id en cada UPDATE. Este test no busca sólo que el PATCH falle
  // "de alguna forma": si el trigger estuviera mal armado con "OF
  // edificio_id" (como edificios/unidades, donde sí alcanza), este mismo
  // PATCH pasaría el WITH CHECK igual — por eso el assert importante es que
  // la fila quede *sin cambios*, no sólo que haya o no error.
  it('admin-a no puede re-apuntar el consorcio_id de su importación al consorcio de B (PATCH)', async () => {
    await clientA
      .from('importaciones')
      .update({ consorcio_id: consorcioIdB as string })
      .eq('id', importacionId as string);

    const { data, error } = await clientA
      .from('importaciones')
      .select('consorcio_id, edificio_id')
      .eq('id', importacionId as string)
      .single();

    expect(error).toBeNull();
    expect(data!.consorcio_id).toBe(consorcioId);
    expect(data!.consorcio_id).not.toBe(consorcioIdB);
    expect(data!.edificio_id).toBe(edificioId);
  });

  // Hallazgo de la segunda pasada de auditoría (sobre esta misma migración
  // 008): un UNIQUE de Postgres bypassea RLS, así que sin esta validación de
  // negocio en el trigger, un admin de cualquier tenant podría "gastarle" el
  // valor único de contraasiento_de a otra unidad con sólo conocer el UUID
  // de su débito — bloqueando para siempre que esa unidad se revierta. La
  // validación exige que contraasiento_de referencie un movimiento de la
  // MISMA unidad; acá se prueba con dos unidades del mismo tenant (alcanza
  // para probar el mecanismo, no hace falta el escenario cross-tenant).
  it('cuenta_corriente rechaza un contraasiento_de que no es de la misma unidad', async () => {
    const sufijoOtra = `${Date.now()}-b`;
    const { data: otraUnidad, error: errOtraUnidad } = await clientA
      .from('unidades')
      .insert({ building_id: edificioId as string, numero: `T-${sufijoOtra}` })
      .select()
      .single();
    expect(errOtraUnidad).toBeNull();

    const { data, error } = await clientA
      .from('cuenta_corriente')
      .insert({
        unidad_id: otraUnidad!.id as string,
        tipo: 'credito',
        concepto: 'Intento de contraasiento cruzado (test)',
        importe: 50000,
        periodo: '2025-01-01',
        origen: 'ajuste',
        contraasiento_de: movimientoId as string, // es de `unidadId`, no de `otraUnidad`
      })
      .select();

    expect(data ?? []).toHaveLength(0);
    expect(error).not.toBeNull();

    await clientA.from('unidades').delete().eq('id', otraUnidad!.id as string);
  });
});
