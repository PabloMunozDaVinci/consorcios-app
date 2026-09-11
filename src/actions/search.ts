'use server';

// =============================================================================
// ACTIONS: Search - Búsqueda con Supabase
// =============================================================================
import { createClient } from '@/lib/supabase/server';
import { requireUsuario, ROLES_GESTION } from '@/lib/auth';
import { logger } from '@/lib/logger';
import type { SearchResult } from '@/types';

export async function search(query: string): Promise<{ success: boolean; data?: SearchResult[]; error?: string }> {
  if (!query || query.length < 2) {
    return { success: true, data: [] };
  }

  try {
    const auth = await requireUsuario(ROLES_GESTION);
    if (!auth.ok) return { success: false, error: 'Sin permiso' };

    // Cliente por request: RLS acota la búsqueda a la administradora del usuario.
    const supabase = await createClient();
    const searchTerm = `%${query}%`;
    
    const results: SearchResult[] = [];
    
    // Buscar propietarios
    const { data: propietarios } = await supabase
      .from('propietarios')
      .select('id, nombre, apellido, dni, unidad_id')
      .or(`nombre.ilike.${searchTerm},apellido.ilike.${searchTerm},dni.ilike.${searchTerm}`)
      .limit(5);
    
    for (const p of propietarios || []) {
      results.push({
        type: 'propietario',
        id: p.id,
        title: `${p.apellido}, ${p.nombre}`,
        subtitle: `Unidad ${p.unidad_id}`,
        url: `/unidades/${p.unidad_id}`,
      });
    }
    
    // Buscar unidades por número
    const { data: unidades } = await supabase
      .from('unidades')
      .select('id, numero, piso, tipo')
      .ilike('numero', `%${query}%`)
      .limit(5);
    
    for (const u of unidades || []) {
      results.push({
        type: 'unidad',
        id: u.id,
        title: `Unidad ${u.numero}`,
        subtitle: `${u.tipo} - Piso ${u.piso}`,
        url: `/unidades/${u.id}`,
      });
    }
    
    // Buscar consorcios
    const { data: consorcios } = await supabase
      .from('consorcios')
      .select('id, nombre, direccion')
      .ilike('nombre', `%${query}%`)
      .limit(3);
    
    for (const c of consorcios || []) {
      results.push({
        type: 'consorcio',
        id: c.id,
        title: c.nombre,
        subtitle: c.direccion,
        url: `/consorcios/${c.id}`,
      });
    }
    
    return { success: true, data: results.slice(0, 10) };
  } catch (error) {
    logger.error('Error search', error);
    return { success: false, error: 'Error en la búsqueda' };
  }
}
