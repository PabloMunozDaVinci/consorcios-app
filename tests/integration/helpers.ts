// =============================================================================
// Helpers de los tests de integración contra Supabase real
// =============================================================================
// No hay un segundo proyecto Supabase de "test": estos tests pegan contra el
// proyecto real (jbikxksdignshfgnbipi), usando las dos administradoras y los
// dos usuarios placeholder que ya existen ahí para justamente esto (ver
// PENDIENTES.md). Por eso van por la API REST/Auth normal de
// `@supabase/supabase-js` (nunca `psql`, nunca las variantes `@supabase/ssr`
// de Next) — el sandbox sólo tiene salida HTTPS (443).
//
// Si `.env.local` o las credenciales no están, `hasIntegrationCreds()` da
// `false` y los describe que dependen de esto se saltean (no fallan) vía
// `describe.skipIf`.
import fs from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// -----------------------------------------------------------------------------
// Carga manual de .env.local (sin agregar `dotenv`: vitest es la única
// dependencia nueva permitida en este bloque). Sólo completa las variables
// que no estén ya seteadas en el entorno (p. ej. por CI).
// -----------------------------------------------------------------------------
let envLoaded = false;
function loadEnvLocal() {
  if (envLoaded) return;
  envLoaded = true;
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

export function getEnv() {
  loadEnvLocal();
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

export function hasIntegrationCreds(): boolean {
  const { url, anonKey, serviceKey } = getEnv();
  return Boolean(url && anonKey && serviceKey);
}

export function serviceClient(): SupabaseClient {
  const { url, serviceKey } = getEnv();
  if (!url || !serviceKey) throw new Error('Faltan credenciales de Supabase (service_role)');
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function anonClient(): SupabaseClient {
  const { url, anonKey } = getEnv();
  if (!url || !anonKey) throw new Error('Faltan credenciales de Supabase (anon)');
  return createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Administradoras placeholder que ya existen en la DB real (ver PENDIENTES.md).
export const ADMINISTRADORA_A = '00000000-0000-0000-0000-000000000001';
export const ADMINISTRADORA_B = '00000000-0000-0000-0000-000000000002';

export const EMAIL_ADMIN_A = 'admin-a@example.invalid';
export const EMAIL_ADMIN_B = 'admin-b@example.invalid';

// Password fija sólo para esta corrida de tests: no confiamos en que la que
// haya quedado de una sesión manual anterior siga siendo válida. Se fija acá
// mismo con el cliente service_role antes de loguear.
const TEST_PASSWORD = 'Bloque4-Integration-Test-P4ss!';

/**
 * Fija una password conocida al usuario `email` (vía admin API, service_role)
 * y devuelve un cliente `anon` ya logueado como ese usuario (sesión real, con
 * el JWT que RLS evalúa). Nunca se usa el cliente service_role para las
 * aserciones de RLS en sí — eso bypasearía RLS y el test no probaría nada.
 */
export async function signInComoUsuarioDeTest(email: string): Promise<SupabaseClient> {
  const admin = serviceClient();

  const { data: listado, error: errListado } = await admin.auth.admin.listUsers();
  if (errListado) {
    throw new Error(`No se pudo listar usuarios de Supabase Auth: ${errListado.message}`);
  }
  const usuario = listado.users.find((u) => u.email === email);
  if (!usuario) {
    throw new Error(
      `No existe el usuario de test "${email}" en Supabase Auth. Ver PENDIENTES.md ` +
        '(sección "Usuarios/datos de prueba") para recrearlo.'
    );
  }

  const { error: errUpdate } = await admin.auth.admin.updateUserById(usuario.id, {
    password: TEST_PASSWORD,
  });
  if (errUpdate) {
    throw new Error(`No se pudo fijar la password de test para "${email}": ${errUpdate.message}`);
  }

  const client = anonClient();
  const { error: errSignIn } = await client.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });
  if (errSignIn) {
    throw new Error(`No se pudo loguear como "${email}": ${errSignIn.message}`);
  }

  return client;
}
