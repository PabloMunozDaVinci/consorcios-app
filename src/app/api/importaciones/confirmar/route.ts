// =============================================================================
// API: Importaciones - Confirmar (ROADMAP Fase 1.3)
// =============================================================================
// Única ruta que escribe. Recibe las filas ya parseadas en /preview (no se
// vuelve a subir el archivo) + el mapeo elegido por el usuario, y genera los
// movimientos reales en cuenta_corriente (liquidación) o las
// unidades/propietarios (padrón). Reimportar el mismo período de liquidación
// ya confirmado se bloquea (hay que revertir el anterior primero, ver
// [id]/revertir/route.ts) — así "reimportar no duplica".
import { createClient } from '@/lib/supabase/server';
import { insertUnidad, insertCuentaCorriente, insertImportacion, upsertPropietario } from '@/lib/supabase/tenant-insert';
import { requireUsuario, ROLES_GESTION } from '@/lib/auth';
import { confirmarImportacionSchema, validateInput, badRequest } from '@/lib/sanitize';
import { parsearImporteAR } from '@/lib/importador/formato-ar';
import { indexarUnidadesPorNumero, matchearFilasPorUnidad, type UnidadParaMatch } from '@/lib/importador/match';
import { logger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';

const CODIGO_VIOLACION_UNICA = '23505';

export async function POST(request: Request) {
  try {
    const auth = await requireUsuario(ROLES_GESTION);
    if (!auth.ok) return auth.response;

    const parsed = validateInput(confirmarImportacionSchema, await request.json());
    if (!parsed.ok) return badRequest(parsed.errors);
    const { edificio_id, tipo, periodo, archivo_nombre, mapeo, filas } = parsed.data;

    const supabase = await createClient();
    const periodoDate = periodo ? `${periodo}-01` : null;

    if (tipo === 'liquidacion') {
      const { data: previa } = await supabase
        .from('importaciones')
        .select('id')
        .eq('edificio_id', edificio_id)
        .eq('tipo', 'liquidacion')
        .eq('periodo', periodoDate as string)
        .eq('estado', 'confirmada')
        .maybeSingle();

      if (previa) {
        return Response.json(
          { success: false, error: 'Ya existe una importación confirmada para este período. Revertila primero si querés reemplazarla.' },
          { status: 409 }
        );
      }
    }

    // Se inserta YA con estado='confirmada' (no 'pendiente' → luego update):
    // el índice único parcial (edificio_id, periodo) sólo protege filas con
    // estado='confirmada', así que si se reservara el lugar recién al final
    // (después de escribir los débitos) dos confirmaciones en carrera
    // pasarían ambas el chequeo de arriba, escribirían débitos DOBLES, y
    // sólo la segunda `estado='confirmada'` fallaría — quedando la plata
    // duplicada igual. Insertando confirmada de entrada, la segunda
    // request pierde la carrera ACÁ, antes de tocar cuenta_corriente.
    //
    // Costo aceptado: si el insert de débitos de abajo tira una excepción a
    // mitad de camino (fallo de red, etc.), esta fila queda 'confirmada' con
    // filas_importadas en 0 y sin respaldo real — no duplica nada, pero
    // bloquea reimportar el período hasta que se la revierta a mano
    // (POST /api/importaciones/:id/revertir, que no le exige tener débitos
    // para poder revertirla). Es el trade-off correcto: preferible un
    // período que hay que destrabar a mano a uno con la deuda duplicada.
    //
    // administradora_id/consorcio_id los deriva el trigger set_tenant_cols()
    // de edificio_id (008_fase1_fixes_auditoria.sql) — no se mandan acá.
    const { data: importacion, error: errorImportacion } = await insertImportacion(supabase, {
      edificio_id,
      tipo,
      archivo_nombre,
      mapeo_columnas: mapeo,
      periodo: periodoDate,
      estado: 'confirmada',
      confirmada_at: new Date().toISOString(),
      filas_totales: filas.length,
    })
      .select('id')
      .single();

    if (errorImportacion || !importacion) {
      // El índice único parcial (edificio_id, periodo) sólo se puede violar
      // acá si otra confirmación ganó la carrera entre el chequeo de arriba y
      // este insert — es el mismo caso que el 409 de arriba, sólo que
      // detectado por la DB en vez de por el SELECT previo.
      if (errorImportacion?.code === CODIGO_VIOLACION_UNICA) {
        return Response.json(
          { success: false, error: 'Ya existe una importación confirmada para este período. Revertila primero si querés reemplazarla.' },
          { status: 409 }
        );
      }
      logger.error('Error creando importación', errorImportacion);
      return Response.json({ success: false, error: 'No se pudo registrar la importación' }, { status: 500 });
    }

    const { data: unidadesDb, error: errorUnidades } = await supabase
      .from('unidades')
      .select('id, numero')
      .eq('building_id', edificio_id);

    if (errorUnidades) {
      logger.error('Error leyendo unidades para importación', errorUnidades);
      return Response.json({ success: false, error: 'No se pudieron leer las unidades del edificio' }, { status: 500 });
    }

    const resultado =
      tipo === 'liquidacion'
        ? await confirmarLiquidacion(supabase, {
            importacionId: importacion.id,
            edificioId: edificio_id,
            periodoDate: periodoDate as string,
            mapeo,
            filas,
            unidades: unidadesDb || [],
          })
        : await confirmarPadron(supabase, {
            edificioId: edificio_id,
            mapeo,
            filas,
            unidades: unidadesDb || [],
          });

    // estado ya quedó en 'confirmada' desde el insert de arriba — acá sólo
    // se completan las estadísticas reales una vez terminado el proceso.
    await supabase
      .from('importaciones')
      .update({
        filas_importadas: resultado.importadas,
        filas_error: resultado.errores,
        log: resultado.log,
      })
      .eq('id', importacion.id);

    revalidatePath('/unidades');
    revalidatePath('/admin/mora');
    revalidatePath('/importador');

    return Response.json({
      success: true,
      data: { importacion_id: importacion.id, importadas: resultado.importadas, errores: resultado.errores, detalle: resultado.log },
    });
  } catch (err: unknown) {
    logger.error('Exception confirmando importación', err);
    return Response.json({ success: false, error: err instanceof Error ? err.message : 'Error interno' }, { status: 500 });
  }
}

type SupabaseAny = Awaited<ReturnType<typeof createClient>>;

async function confirmarLiquidacion(
  supabase: SupabaseAny,
  opts: {
    importacionId: string;
    edificioId: string;
    periodoDate: string;
    mapeo: Record<string, string>;
    filas: Record<string, string>[];
    unidades: UnidadParaMatch[];
  }
) {
  const { importacionId, periodoDate, mapeo, filas, unidades } = opts;
  const indice = indexarUnidadesPorNumero(unidades);
  const { matcheadas, noMatcheadas } = matchearFilasPorUnidad(filas, mapeo.numero_unidad, indice);

  const movimientos: Array<{
    unidad_id: string;
    fecha: string;
    tipo: 'debito';
    concepto: string;
    importe: number;
    periodo: string;
    origen: 'importacion';
    importacion_id: string;
  }> = [];
  const filasInvalidas: Record<string, string>[] = [];

  for (const { fila, unidad } of matcheadas) {
    const importe = parsearImporteAR(fila[mapeo.importe]);
    if (importe == null || importe <= 0) {
      filasInvalidas.push(fila);
      continue;
    }
    movimientos.push({
      unidad_id: unidad.id,
      fecha: new Date().toISOString().slice(0, 10),
      tipo: 'debito',
      concepto: (mapeo.concepto && fila[mapeo.concepto]) || 'Expensas',
      importe,
      periodo: periodoDate,
      origen: 'importacion',
      importacion_id: importacionId,
    });
  }

  if (movimientos.length > 0) {
    const { error } = await insertCuentaCorriente(supabase, movimientos);
    if (error) {
      logger.error('Error insertando movimientos de cuenta_corriente', error);
      throw new Error('No se pudieron generar los movimientos de cuenta corriente');
    }
  }

  return {
    importadas: movimientos.length,
    errores: noMatcheadas.length + filasInvalidas.length,
    log: {
      no_matcheadas: noMatcheadas.slice(0, 100).map((f) => f[mapeo.numero_unidad]),
      importes_invalidos: filasInvalidas.slice(0, 100).map((f) => f[mapeo.numero_unidad]),
    },
  };
}

async function confirmarPadron(
  supabase: SupabaseAny,
  opts: {
    edificioId: string;
    mapeo: Record<string, string>;
    filas: Record<string, string>[];
    unidades: UnidadParaMatch[];
  }
) {
  const { edificioId, mapeo, filas } = opts;
  let unidadesConocidas = [...opts.unidades];
  let importadas = 0;
  const errores: string[] = [];

  for (const fila of filas) {
    const numero = fila[mapeo.numero_unidad]?.trim();
    const nombre = fila[mapeo.propietario_nombre]?.trim();
    const apellido = fila[mapeo.propietario_apellido]?.trim();
    const dni = fila[mapeo.dni]?.trim();
    const email = fila[mapeo.email]?.trim();
    if (!numero || !nombre || !apellido || !dni || !email) {
      errores.push(numero || '(sin número)');
      continue;
    }

    let unidad = unidadesConocidas.find((u) => u.numero.trim().toLowerCase() === numero.toLowerCase());
    if (!unidad) {
      const piso = mapeo.piso ? parseInt(fila[mapeo.piso], 10) : 0;
      const { data: nuevaUnidad, error: errorUnidad } = await insertUnidad(supabase, {
        building_id: edificioId,
        numero,
        piso: Number.isFinite(piso) ? piso : 0,
      })
        .select('id, numero')
        .single();

      if (errorUnidad || !nuevaUnidad) {
        logger.error('Error creando unidad desde padrón', errorUnidad);
        errores.push(numero);
        continue;
      }
      unidad = nuevaUnidad;
      unidadesConocidas = [...unidadesConocidas, unidad];
    }

    const { error: errorPropietario } = await upsertPropietario(supabase, {
      unidad_id: unidad.id,
      nombre,
      apellido,
      dni,
      email,
      telefono: mapeo.telefono ? fila[mapeo.telefono] || null : null,
    });

    if (errorPropietario) {
      logger.error('Error creando/actualizando propietario desde padrón', errorPropietario);
      errores.push(numero);
      continue;
    }

    importadas++;
  }

  return {
    importadas,
    errores: errores.length,
    log: { filas_con_error: errores.slice(0, 100) },
  };
}
