'use server';

// =============================================================================
// ACTIONS: Consorcios - Server Actions con Supabase
// =============================================================================
import { createSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import type { ActionResponse } from '@/types';

// =============================================================================
// CONSORCIOS
// =============================================================================

export async function getConsorcios(): Promise<ActionResponse<any[]>> {
  try {
    const supabase = createSupabaseAdmin();
    logger.debug('Fetching consorcios');
    
    const { data, error } = await supabase
      .from('consorcios')
      .select('*, edificios(*)')
      .order('nombre');
    
    if (error) {
      logger.error('Error getConsorcios', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, data: data || [] };
  } catch (error) {
    logger.error('Error getConsorcios', error);
    return { success: false, error: String(error) };
  }
}

export async function getConsorcio(id: string): Promise<ActionResponse<any>> {
  try {
    const supabase = createSupabaseAdmin();
    logger.debug('Fetching consorcio', { id });
    
    const { data, error } = await supabase
      .from('consorcios')
      .select('*, edificios(*)')
      .eq('id', id)
      .single();
    
    if (error) {
      logger.error('Error getConsorcio', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, data };
  } catch (error) {
    logger.error('Error getConsorcio', error);
    return { success: false, error: String(error) };
  }
}

export async function createConsorcio(formData: FormData): Promise<ActionResponse> {
  logger.debug('createConsencio called', { 
    entries: Array.from(formData.entries()).map(([k, v]) => `${k}: ${v}`).join(', ')
  });
  
  try {
    const supabase = createSupabaseAdmin();
    logger.debug('Supabase client created');
    
    const nombre = formData.get('nombre') as string;
    const direccion = formData.get('direccion') as string;
    const ciudad = (formData.get('ciudad') as string) || 'CABA';
    const email_admin = formData.get('email_admin') as string || null;
    const telefono = formData.get('telefono') as string || null;
    
    logger.debug('Parsed values', { nombre, direccion, ciudad, email_admin: !!email_admin, telefono: !!telefono });
    
    if (!nombre || !direccion) {
      logger.warn('Validation failed: missing nombre or direccion');
      return { success: false, error: 'Nombre y dirección son obligatorios' };
    }
    
    logger.debug('Inserting into consorcios');
    
    const { data, error } = await supabase
      .from('consorcios')
      .insert({
        nombre,
        direccion,
        ciudad,
        email_admin,
        telefono,
      })
      .select()
      .single();
    
    if (error) {
      logger.error('Supabase error creating consorcio', error);
      return { success: false, error: error.message };
    }
    
    logger.info('Consorcio created', { id: data.id });
    revalidatePath('/consorcios');
    return { success: true, data };
  } catch (error) {
    logger.error('Exception in createConsorcio', error);
    return { success: false, error: String(error) };
  }
}

// =============================================================================
// EDIFICIOS
// =============================================================================

export async function getEdificios(consorcioId: string): Promise<ActionResponse<any[]>> {
  try {
    const supabase = createSupabaseAdmin();
    logger.debug('Fetching edificios', { consortiumId: consorcioId });
    
    const { data, error } = await supabase
      .from('edificios')
      .select('*, unidades(*)')
      .eq('consortium_id', consorcioId);
    
    if (error) {
      logger.error('Error getEdificios', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, data: data || [] };
  } catch (error) {
    logger.error('Error getEdificios', error);
    return { success: false, error: String(error) };
  }
}

export async function createEdificio(formData: FormData, consorcioId: string): Promise<ActionResponse> {
  try {
    const supabase = createSupabaseAdmin();
    logger.debug('Creating edificio', { consorcioId });
    
    const nombre = formData.get('nombre') as string;
    const direccion = formData.get('direccion') as string || null;
    const pisos = parseInt(formData.get('pisos') as string) || 1;
    const unidades_por_piso = parseInt(formData.get('unidades_por_piso') as string) || 1;
    
    const { data, error } = await supabase
      .from('edificios')
      .insert({
        consortium_id: consorcioId,
        nombre,
        direccion,
        pisos,
        unidades_por_piso,
      })
      .select()
      .single();
    
    if (error) {
      logger.error('Error createEdificio', error);
      return { success: false, error: error.message };
    }
    
    logger.info('Edificio created', { id: data.id });
    revalidatePath(`/consorcios/${consorcioId}`);
    return { success: true, data };
  } catch (error) {
    logger.error('Error createEdificio', error);
    return { success: false, error: String(error) };
  }
}

// =============================================================================
// UNIDADES
// =============================================================================

export async function getUnidades(edificioId: string): Promise<ActionResponse<any[]>> {
  try {
    const supabase = createSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('unidades')
      .select('*, propietario:propietarios(*)')
      .eq('building_id', edificioId);
    
    if (error) {
      logger.error('Error getUnidades:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, data: data || [] };
  } catch (error) {
    logger.error('Error getUnidades:', error);
    return { success: false, error: String(error) };
  }
}

export async function getUnidad(id: string): Promise<ActionResponse<any>> {
  try {
    const supabase = createSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('unidades')
      .select('*, propietario:propietarios(*), edificio:edificios(*)')
      .eq('id', id)
      .single();
    
    if (error) {
      logger.error('Error getUnidad:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, data };
  } catch (error) {
    logger.error('Error getUnidad:', error);
    return { success: false, error: String(error) };
  }
}

export async function getAllUnidades(): Promise<ActionResponse<any[]>> {
  try {
    const supabase = createSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('unidades')
      .select('*, propietario:propietarios(*), edificio:edificios(nombre, consortium_id)');
    
    if (error) {
      logger.error('Error getAllUnidades:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, data: data || [] };
  } catch (error) {
    logger.error('Error getAllUnidades:', error);
    return { success: false, error: String(error) };
  }
}

export async function createUnidad(formData: FormData, edificioId: string): Promise<ActionResponse> {
  try {
    const supabase = createSupabaseAdmin();
    
    const numero = formData.get('numero') as string;
    const piso = parseInt(formData.get('piso') as string) || 0;
    const tipo = (formData.get('tipo') as string) || 'depto';
    const coeficiente = parseFloat(formData.get('coeficiente') as string) || 1.0;
    
    const { data, error } = await supabase
      .from('unidades')
      .insert({
        building_id: edificioId,
        numero,
        piso,
        tipo,
        coeficiente,
        es_especial: false,
        habitada: false,
      })
      .select()
      .single();
    
    if (error) {
      logger.error('Error createUnidad:', error);
      return { success: false, error: error.message };
    }
    
    revalidatePath(`/edificios/${edificioId}`);
    return { success: true, data };
  } catch (error) {
    logger.error('Error createUnidad:', error);
    return { success: false, error: String(error) };
  }
}

// =============================================================================
// GET COUNTS - Para el dashboard
// =============================================================================

export async function getAllCounts(): Promise<ActionResponse<{
  consorcios: number;
  unidades: number;
  mora: number;
  arreglos: number;
}>> {
  try {
    const supabase = createSupabaseAdmin();
    
    // Count consorcios
    const { count: countConsorcios, error: errorConsorcios } = await supabase
      .from('consorcios')
      .select('*', { count: 'exact', head: true });
    
    // Count unidades
    const { count: countUnidades, error: errorUnidades } = await supabase
      .from('unidades')
      .select('*', { count: 'exact', head: true });
    
    // Count mora (estado != 'al_dia')
    const { count: countMora, error: errorMora } = await supabase
      .from('unidades')
      .select('*', { count: 'exact', head: true })
      .neq('estado_mora', 'al_dia');
    
    // Count arreglos pendientes
    const { count: countArreglos, error: errorArreglos } = await supabase
      .from('arreglos')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'pendiente');
    
    if (errorConsorcios || errorUnidades || errorMora || errorArreglos) {
      logger.error('Error getAllCounts', { errorConsorcios, errorUnidades, errorMora, errorArreglos });
      return { success: false, error: 'Error obteniendo counts' };
    }
    
    return { 
      success: true, 
      data: {
        consorcios: countConsorcios || 0,
        unidades: countUnidades || 0,
        mora: countMora || 0,
        arreglos: countArreglos || 0,
      }
    };
  } catch (error) {
    logger.error('Error getAllCounts', error);
    return { success: false, error: String(error) };
  }
}

// =============================================================================
// SEARCH
// =============================================================================

export async function search(query: string): Promise<ActionResponse<any[]>> {
  try {
    const supabase = createSupabaseAdmin();
    
    const searchTerm = `%${query}%`;
    
    // Buscar propietarios
    const { data: propietarios, error: propietariosError } = await supabase
      .from('propietarios')
      .select('id, nombre, apellido, dni, unidad_id')
      .or(`nombre.ilike.${searchTerm},apellido.ilike.${searchTerm},dni.ilike.${searchTerm}`)
      .limit(10);
    
    if (propietariosError) {
      logger.error('Error search:', propietariosError);
      return { success: false, error: propietariosError.message };
    }
    
    const results = (propietarios || []).map((p: any) => ({
      type: 'propietario',
      id: p.id,
      title: `${p.apellido}, ${p.nombre}`,
      subtitle: `Unidad ${p.unidad_id}`,
      url: `/unidades/${p.unidad_id}`,
    }));
    
    return { success: true, data: results };
  } catch (error) {
    logger.error('Error search:', error);
    return { success: false, error: String(error) };
  }
}

// =============================================================================
// PAGOS
// =============================================================================

export async function getPagos(unidadId: string): Promise<ActionResponse<any[]>> {
  try {
    const supabase = createSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('pagos')
      .select('*, propietario:propietarios(nombre, apellido)')
      .eq('unidad_id', unidadId)
      .order('mes_pagado', { ascending: false });
    
    if (error) {
      logger.error('Error getPagos:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, data: data || [] };
  } catch (error) {
    logger.error('Error getPagos:', error);
    return { success: false, error: String(error) };
  }
}

export async function getAllPagos(): Promise<ActionResponse<any[]>> {
  try {
    const supabase = createSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('pagos')
      .select(`
        *,
        propietario:propietarios(nombre, apellido),
        unidad:unidades(numero)
      `)
      .order('fecha_pago', { ascending: false });
    
    if (error) {
      logger.error('Error getAllPagos:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, data: data || [] };
  } catch (error) {
    logger.error('Error getAllPagos:', error);
    return { success: false, error: String(error) };
  }
}

export async function createPago(formData: FormData, usuarioId: string): Promise<ActionResponse> {
  try {
    const supabase = createSupabaseAdmin();
    
    const unidad_id = formData.get('unidad_id') as string;
    const monto = parseFloat(formData.get('monto') as string);
    const mes_pagado = formData.get('mes_pagado') as string;
    const medio_pago = formData.get('medio_pago') as string || 'transferencia';
    
    // Buscar el propietario de la unidad
    const { data: propietarios } = await supabase
      .from('propietarios')
      .select('id')
      .eq('unidad_id', unidad_id)
      .limit(1);
    
    const propietario_id = propietarios?.[0]?.id;
    
    const { data, error } = await supabase
      .from('pagos')
      .insert({
        unidad_id,
        propietario_id,
        monto,
        mes_pagado,
        fecha_pago: new Date().toISOString().split('T')[0],
        medio_pago,
        estado: 'confirmado',
      })
      .select()
      .single();
    
    if (error) {
      logger.error('Error createPago:', error);
      return { success: false, error: error.message };
    }
    
    revalidatePath(`/unidades/${unidad_id}`);
    revalidatePath('/pagos');
    return { success: true, data };
  } catch (error) {
    logger.error('Error createPago:', error);
    return { success: false, error: String(error) };
  }
}

// =============================================================================
// ARREGLOS
// =============================================================================

export async function getArreglos(filtros?: { unidad_id?: string; estado?: string }): Promise<ActionResponse<any[]>> {
  try {
    const supabase = createSupabaseAdmin();
    
    let query = supabase
      .from('arreglos')
      .select('*, unidad:unidades(numero)')
      .order('fecha_solicitud', { ascending: false });
    
    if (filtros?.estado) {
      query = query.eq('estado', filtros.estado);
    }
    
    const { data, error } = await query;
    
    if (error) {
      logger.error('Error getArreglos:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, data: data || [] };
  } catch (error) {
    logger.error('Error getArreglos:', error);
    return { success: false, error: String(error) };
  }
}

export async function createArreglo(formData: FormData): Promise<ActionResponse> {
  try {
    const supabase = createSupabaseAdmin();
    
    const titulo = formData.get('titulo') as string;
    const unidad_id = formData.get('unidad_id') as string || null;
    const descripcion = formData.get('descripcion') as string || null;
    const prioridad = (formData.get('prioridad') as string) || 'media';
    const presupuesto = parseFloat(formData.get('presupuesto') as string) || null;
    const es_area_comun = formData.get('es_area_comun') === 'true';
    
    const { data, error } = await supabase
      .from('arreglos')
      .insert({
        titulo,
        unidad_id,
        descripcion,
        prioridad,
        presupuesto,
        es_area_comun,
        estado: 'pendiente',
        fecha_solicitud: new Date().toISOString().split('T')[0],
      })
      .select()
      .single();
    
    if (error) {
      logger.error('Error createArreglo:', error);
      return { success: false, error: error.message };
    }
    
    revalidatePath('/mantenimiento');
    return { success: true, data };
  } catch (error) {
    logger.error('Error createArreglo:', error);
    return { success: false, error: String(error) };
  }
}

export async function updateArregloEstado(
  arregloId: string,
  nuevoEstado: string
): Promise<ActionResponse> {
  try {
    const supabase = createSupabaseAdmin();
    
    const updateData: any = { estado: nuevoEstado };
    
    if (nuevoEstado === 'completado') {
      updateData.fecha_completado = new Date().toISOString().split('T')[0];
    }
    
    const { data, error } = await supabase
      .from('arreglos')
      .update(updateData)
      .eq('id', arregloId)
      .select()
      .single();
    
    if (error) {
      logger.error('Error updateArregloEstado:', error);
      return { success: false, error: error.message };
    }
    
    revalidatePath('/mantenimiento');
    return { success: true, data };
  } catch (error) {
    logger.error('Error updateArregloEstado:', error);
    return { success: false, error: String(error) };
  }
}

// =============================================================================
// MORA
// =============================================================================

export async function getMoraStats(): Promise<ActionResponse<any>> {
  try {
    const supabase = createSupabaseAdmin();
    
    // Contar unidades por estado de mora
    const { data, error } = await supabase
      .from('unidades')
      .select('estado_mora');
    
    if (error) {
      logger.error('Error getMoraStats:', error);
      return { success: false, error: error.message };
    }
    
    const stats = {
      total: data?.length || 0,
      al_dia: data?.filter(u => u.estado_mora === 'al_dia').length || 0,
      deudor: data?.filter(u => u.estado_mora === 'deudor').length || 0,
      apta_carta: data?.filter(u => u.estado_mora === 'apto_carta').length || 0,
      inicio_juicio: data?.filter(u => u.estado_mora === 'inicio_juicio').length || 0,
      juicio_en_curso: data?.filter(u => u.estado_mora === 'juicio_en_curso').length || 0,
    };
    
    return { success: true, data: stats };
  } catch (error) {
    logger.error('Error getMoraStats:', error);
    return { success: false, error: String(error) };
  }
}
