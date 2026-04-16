require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function test() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false }
    }
  );

  console.log('Testing RLS policies...');
  
  // 1. Probar insert simple
  const { data: d1, error: e1 } = await supabase
    .from('consorcios')
    .insert({ nombre: 'RLS Test', direccion: 'Test', ciudad: 'CABA' })
    .select()
    .single();
  
  console.log('Insert result:', e1 ? `ERROR: ${e1.message}` : `OK: ${d1.id}`);
  
  if (d1) {
    // 2. Probar delete
    const { error: e2 } = await supabase.from('consorcios').delete().eq('id', d1.id);
    console.log('Delete result:', e2 ? `ERROR: ${e2.message}` : 'OK');
  }
}

test().catch(console.error);
