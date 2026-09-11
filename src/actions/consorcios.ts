'use server';

// =============================================================================
// ACTIONS: Consorcios - Server Actions con Supabase
// =============================================================================
import { createClient } from '@/lib/supabase/server';
import { insertEdificio, insertUnidad, insertPago } from '@/lib/supabase/tenant-insert';
import { requireUsuario, ROLES_GESTION } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import type { ActionResponse, EstadoMora, MoraStats } from '@/types';
import type { Database } from '@/types/database.types';

type ConsorcioRow = Database['public']['Tables']['consorcios']['Row'];
type EdificioRow = Database['public']['Tables']['edificios']['Row'];
type UnidadRow = Database['public']['Tables']['unidades']['Row'];
type PagoRow = Database['public']['Tables']['pagos']['Row'];
type ArregloRow = Database['public']['Tables']['arreglos']['Row'];
type EstadoArreglo = Database['public']['Enums']['estado_arreglo'];

// =============================================================================
// CONSORCIOS
// =============================================================================

export async function getConsorcios(): Promise<ActionResponse<any[]>> {
  try {
    const supabase = await createClient();
    logger.debug('Fetching consorcios');
    
    const { data, error } = await supabase
      .from('consorcios')
      .select('*, edificios(*)')
      .order('nombre');
    
    if (error) {
      logger.error('Error getConsorcios', error);
      return { success: false, error: 'No se pudo completar la operación' };
    }
    
    return { success: true, data: data || [] };
  } catch (error) {
    logger.error('Error getConsorcios', error);
    return { success: false, error: 'Error interno' };
  }
}

export async function getConsorcio(id: string): Promise<ActionResponse<any>> {
  try {
    const supabase = await createClient();
    logger.debug('Fetching consorcio', { id });
    
    const { data, error } = await supabase
      .from('consorcios')
      .select('*, edificios(*)')
      .eq('id', id)
      .single();
    
    if (error) {
      logger.error('Error getConsorcio', error);
      return { success: false, error: 'No se pudo completar la operación' };
    }
    
    return { success: true, data };
  } catch (error) {
    logger.error('Error getConsorcio', error);
    return { success: false, error: 'Error interno' };
  }
}

export async function createConsorcio(formData: FormData): Promise<ActionResponse<ConsorcioRow>> {
  try {
    const auth = await requireUsuario(ROLES_GESTION);
    if (!auth.ok) return { success: false, error: 'Sin permiso' };

    const supabase = await createClient();

    const nombre = formData.get('nombre') as string;
    const direccion = formData.get('direccion') as string;
    const ciudad = (formData.get('ciudad') as string) || 'CABA';
    const email_admin = formData.get('email_admin') as string || null;
    const telefono = formData.get('telefono') as string || null;

    if (!nombre || !direccion) {
      return { success: false, error: 'Nombre y dirección son obligatorios' };
    }

    const { data, error } = await supabase
      .from('consorcios')
      .insert({
        nombre,
        direccion,
        ciudad,
        email_admin,
        telefono,
        administradora_id: auth.usuario.administradoraId,
      })
      .select()
      .single();

    if (error) {
      logger.error('Supabase error creating consorcio', error);
      return { success: false, error: 'No se pudo crear el consorcio' };
    }
    
    logger.info('Consorcio created', { id: data.id });
    revalidatePath('/consorcios');
    return { success: true, data };
  } catch (error) {
    logger.error('Exception in createConsorcio', error);
    return { success: false, error: 'Error interno' };
  }
}

// =============================================================================
// EDIFICIOS
// =============================================================================

export async function getEdificios(consorcioId: string): Promise<ActionResponse<any[]>> {
  try {
    const supabase = await createClient();
    logger.debug('Fetching edificios', { consortiumId: consorcioId });
    
    const { data, error } = await supabase
      .from('edificios')
      .select('*, unidades(*)')
      .eq('consortium_id', consorcioId);
    
    if (error) {
      logger.error('Error getEdificios', error);
      return { success: false, error: 'No se pudo completar la operación' };
    }
    
    return { success: true, data: data || [] };
  } catch (error) {
    logger.error('Error getEdificios', error);
    return { success: false, error: 'Error interno' };
  }
}

export async function createEdificio(formData: FormData, consorcioId: string): Promise<ActionResponse<EdificioRow>> {
  try {
    const auth = await requireUsuario(ROLES_GESTION);
    if (!auth.ok) return { success: false, error: 'Sin permiso' };

    const supabase = await createClient();

    const nombre = formData.get('nombre') as string;
    const direccion = formData.get('direccion') as string || null;
    const pisos = parseInt(formData.get('pisos') as string) || 1;
    const unidades_por_piso = parseInt(formData.get('unidades_por_piso') as string) || 1;

    // administradora_id lo completa el trigger set_tenant_cols a partir de
    // consortium_id (ver src/lib/supabase/tenant-insert.ts).
    const { data, error } = await insertEdificio(supabase, {
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
      return { success: false, error: 'No se pudo completar la operación' };
    }
    
    logger.info('Edificio created', { id: data.id });
    revalidatePath(`/consorcios/${consorcioId}`);
    return { success: true, data };
  } catch (error) {
    logger.error('Error createEdificio', error);
    return { success: false, error: 'Error interno' };
  }
}

// =============================================================================
// UNIDADES
// =============================================================================

export async function getUnidades(edificioId: string): Promise<ActionResponse<any[]>> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('unidades')
      .select('*, propietario:propietarios(*)')
      .eq('building_id', edificioId);
    
    if (error) {
      logger.error('Error getUnidades:', error);
      return { success: false, error: 'No se pudo completar la operación' };
    }
    
    return { success: true, data: data || [] };
  } catch (error) {
    logger.error('Error getUnidades:', error);
    return { success: false, error: 'Error interno' };
  }
}

export async function getUnidad(id: string): Promise<ActionResponse<any>> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('unidades')
      .select('*, propietario:propietarios(*), edificio:edificios(*)')
      .eq('id', id)
      .single();
    
    if (error) {
      logger.error('Error getUnidad:', error);
      return { success: false, error: 'No se pudo completar la operación' };
    }
    
    return { success: true, data };
  } catch (error) {
    logger.error('Error getUnidad:', error);
    return { success: false, error: 'Error interno' };
  }
}

export async function getAllUnidades(): Promise<ActionResponse<any[]>> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('unidades')
      .select('*, propietario:propietarios(*), edificio:edificios(nombre, consortium_id)');
    
    if (error) {
      logger.error('Error getAllUnidades:', error);
      return { success: false, error: 'No se pudo completar la operación' };
    }
    
    return { success: true, data: data || [] };
  } catch (error) {
    logger.error('Error getAllUnidades:', error);
    return { success: false, error: 'Error interno' };
  }
}

export async function createUnidad(formData: FormData, edificioId: string): Promise<ActionResponse<UnidadRow>> {
  try {
    const auth = await requireUsuario(ROLES_GESTION);
    if (!auth.ok) return { success: false, error: 'Sin permiso' };

    const supabase = await createClient();

    const numero = formData.get('numero') as string;
    const piso = parseInt(formData.get('piso') as string) || 0;
    const tipo = ((formData.get('tipo') as string) || 'depto') as Database['public']['Enums']['tipo_unidad'];
    const coeficiente = parseFloat(formData.get('coeficiente') as string) || 1.0;

    // administradora_id/consorcio_id los completa el trigger set_tenant_cols
    // a partir de building_id (ver src/lib/supabase/tenant-insert.ts).
    const { data, error } = await insertUnidad(supabase, {
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
      return { success: false, error: 'No se pudo completar la operación' };
    }
    
    revalidatePath(`/edificios/${edificioId}`);
    return { success: true, data };
  } catch (error) {
    logger.error('Error createUnidad:', error);
    return { success: false, error: 'Error interno' };
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
    const supabase = await createClient();
    
    // Count consorcios
    const { count: countConsorcios, error: errorConsorcios } = await supabase
      .from('consorcios')
      .select('*', { count: 'exact', head: true });
    
    // Count unidades
    const { count: countUnidades, error: errorUnidades } = await supabase
      .from('unidades')
      .select('*', { count: 'exact', head: true });
    
    // Count mora - from mora_logs table (estado_nuevo != 'al_dia')
    const { count: countMora, error: errorMora } = await supabase
      .from('mora_logs')
      .select('*', { count: 'exact', head: true })
      .neq('estado_nuevo', 'al_dia');
    
    // Count arreglos pendientes
    const { count: countArreglos, error: errorArreglos } = await supabase
      .from('arreglos')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'pendiente');
    
    if (errorConsorcios || errorUnidades || errorMora || errorArreglos) {
      logger.error('Error getAllCounts', { 
        errorConsorcios: errorConsorcios?.message,
        errorUnidades: errorUnidades?.message, 
        errorMora: errorMora?.message,
        errorArreglos: errorArreglos?.message 
      });
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
    return { success: false, error: 'Error interno' };
  }
}

// =============================================================================
// La búsqueda vive en src/actions/search.ts (buscaba consorcios/unidades/
// propietarios en dos lugares con lógicas distintas; SearchBox.tsx sólo
// importaba la de search.ts, así que esta copia estaba muerta).

// =============================================================================
// PAGOS
// =============================================================================

export async function getPagos(unidadId: string): Promise<ActionResponse<any[]>> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('pagos')
      .select('*, propietario:propietarios(nombre, apellido)')
      .eq('unidad_id', unidadId)
      .order('mes_pagado', { ascending: false });
    
    if (error) {
      logger.error('Error getPagos:', error);
      return { success: false, error: 'No se pudo completar la operación' };
    }
    
    return { success: true, data: data || [] };
  } catch (error) {
    logger.error('Error getPagos:', error);
    return { success: false, error: 'Error interno' };
  }
}

export async function getAllPagos(): Promise<ActionResponse<any[]>> {
  try {
    const supabase = await createClient();
    
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
      return { success: false, error: 'No se pudo completar la operación' };
    }
    
    return { success: true, data: data || [] };
  } catch (error) {
    logger.error('Error getAllPagos:', error);
    return { success: false, error: 'Error interno' };
  }
}

export async function createPago(formData: FormData, _usuarioId?: string): Promise<ActionResponse<PagoRow>> {
  try {
    const auth = await requireUsuario(ROLES_GESTION);
    if (!auth.ok) return { success: false, error: 'Sin permiso' };

    const supabase = await createClient();

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
    if (!propietario_id) {
      return { success: false, error: 'La unidad no tiene propietario asignado.' };
    }

    // administradora_id lo completa el trigger set_tenant_cols a partir de
    // unidad_id (ver src/lib/supabase/tenant-insert.ts).
    const { data, error } = await insertPago(supabase, {
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
      return { success: false, error: 'No se pudo completar la operación' };
    }
    
    revalidatePath(`/unidades/${unidad_id}`);
    revalidatePath('/pagos');
    return { success: true, data };
  } catch (error) {
    logger.error('Error createPago:', error);
    return { success: false, error: 'Error interno' };
  }
}

// =============================================================================
// ARREGLOS
// =============================================================================

export async function getArreglos(filtros?: { unidad_id?: string; estado?: EstadoArreglo }): Promise<ActionResponse<any[]>> {
  try {
    const supabase = await createClient();
    
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
      return { success: false, error: 'No se pudo completar la operación' };
    }
    
    return { success: true, data: data || [] };
  } catch (error) {
    logger.error('Error getArreglos:', error);
    return { success: false, error: 'Error interno' };
  }
}

export async function createArreglo(formData: FormData): Promise<ActionResponse<ArregloRow>> {
  try {
    const auth = await requireUsuario(ROLES_GESTION);
    if (!auth.ok) return { success: false, error: 'Sin permiso' };

    const supabase = await createClient();

    const titulo = formData.get('titulo') as string;
    const unidad_id = formData.get('unidad_id') as string || null;
    const descripcion = formData.get('descripcion') as string || null;
    const prioridad = (formData.get('prioridad') as string) || 'media';
    const presupuesto = parseFloat(formData.get('presupuesto') as string) || null;
    const es_area_comun = formData.get('es_area_comun') === 'true';

    // A diferencia de las otras tablas, acá SÍ mandamos administradora_id
    // siempre: si hay unidad_id el trigger set_tenant_cols lo pisa con el
    // valor derivado de la unidad (ver migración 002), pero si es un
    // arreglo de área común (unidad_id null) el trigger no tiene de dónde
    // derivarlo — ahí este valor es el que queda.
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
        administradora_id: auth.usuario.administradoraId,
      })
      .select()
      .single();
    
    if (error) {
      logger.error('Error createArreglo:', error);
      return { success: false, error: 'No se pudo completar la operación' };
    }
    
    revalidatePath('/mantenimiento');
    return { success: true, data };
  } catch (error) {
    logger.error('Error createArreglo:', error);
    return { success: false, error: 'Error interno' };
  }
}

export async function updateArregloEstado(
  arregloId: string,
  nuevoEstado: EstadoArreglo
): Promise<ActionResponse<ArregloRow>> {
  try {
    const auth = await requireUsuario(ROLES_GESTION);
    if (!auth.ok) return { success: false, error: 'Sin permiso' };

    const supabase = await createClient();

    const updateData: Database['public']['Tables']['arreglos']['Update'] = { estado: nuevoEstado };

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
      return { success: false, error: 'No se pudo completar la operación' };
    }
    
    revalidatePath('/mantenimiento');
    return { success: true, data };
  } catch (error) {
    logger.error('Error updateArregloEstado:', error);
    return { success: false, error: 'Error interno' };
  }
}

// =============================================================================
// MORA
// =============================================================================

export async function getMoraStats(): Promise<ActionResponse<MoraStats>> {
  try {
    const supabase = await createClient();

    // Total de unidades.
    const { count: totalUnidades, error: errorUnidades } = await supabase
      .from('unidades')
      .select('*', { count: 'exact', head: true });

    if (errorUnidades) {
      logger.error('Error getMoraStats (unidades):', errorUnidades);
      return { success: false, error: errorUnidades.message };
    }

    // El estado de mora de una unidad es el estado_nuevo de su último mora_logs.
    // La columna unidades.estado_mora no existe en el schema.
    const { data: logs, error: errorLogs } = await supabase
      .from('mora_logs')
      .select('unidad_id, estado_nuevo, created_at')
      .order('created_at', { ascending: false });

    if (errorLogs) {
      logger.error('Error getMoraStats (mora_logs):', errorLogs);
      return { success: false, error: errorLogs.message };
    }

    const ultimoEstado = new Map<string, EstadoMora>();
    for (const log of logs ?? []) {
      if (!ultimoEstado.has(log.unidad_id)) {
        ultimoEstado.set(log.unidad_id, log.estado_nuevo as EstadoMora);
      }
    }

    const estados = [...ultimoEstado.values()];
    const total = totalUnidades ?? 0;
    const contar = (estado: EstadoMora) => estados.filter((e) => e === estado).length;

    // Unidades sin ningún registro de mora se consideran al día.
    const sinRegistro = Math.max(0, total - estados.length);

    const stats: MoraStats = {
      total,
      al_dia: contar('al_dia') + sinRegistro,
      deudor: contar('deudor'),
      apto_carta: contar('apto_carta'),
      inicio_juicio: contar('inicio_juicio'),
      juicio_en_curso: contar('juicio_en_curso'),
    };

    return { success: true, data: stats };
  } catch (error) {
    logger.error('Error getMoraStats:', error);
    return { success: false, error: 'Error interno' };
  }
}
