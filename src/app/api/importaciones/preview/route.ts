// =============================================================================
// API: Importaciones - Previsualización (ROADMAP Fase 1.3)
// =============================================================================
// No escribe nada: parsea el archivo y, si ya hay un mapeo elegido, informa
// cuántas filas matchean contra unidades reales del edificio, cuáles no, y el
// total. "Nada se escribe hasta que el usuario confirma" — confirmar/route.ts
// es la única ruta que inserta.
import { createClient } from '@/lib/supabase/server';
import { requireUsuario, ROLES_GESTION } from '@/lib/auth';
import { previsualizarImportacionSchema, validateInput, badRequest } from '@/lib/sanitize';
import { parsearArchivoTabular, ArchivoInvalidoError } from '@/lib/importador/parse';
import { parsearImporteAR } from '@/lib/importador/formato-ar';
import { indexarUnidadesPorNumero, matchearFilasPorUnidad } from '@/lib/importador/match';
import { logger } from '@/lib/logger';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(request: Request) {
  try {
    const auth = await requireUsuario(ROLES_GESTION);
    if (!auth.ok) return auth.response;

    const formData = await request.formData();
    const archivo = formData.get('archivo');
    if (!(archivo instanceof File)) {
      return Response.json({ success: false, error: 'Falta el archivo' }, { status: 400 });
    }
    if (archivo.size > MAX_BYTES) {
      return Response.json({ success: false, error: 'El archivo supera los 5 MB' }, { status: 400 });
    }

    const parsedFields = validateInput(previsualizarImportacionSchema, {
      edificio_id: formData.get('edificio_id'),
      tipo: formData.get('tipo'),
      periodo: formData.get('periodo'),
    });
    if (!parsedFields.ok) return badRequest(parsedFields.errors);
    const { edificio_id, tipo, periodo } = parsedFields.data;

    const mapeoRaw = formData.get('mapeo');
    let mapeo: Record<string, string> | null = null;
    if (typeof mapeoRaw === 'string' && mapeoRaw.length > 0) {
      try {
        mapeo = JSON.parse(mapeoRaw);
      } catch {
        return Response.json({ success: false, error: 'El mapeo de columnas no es un JSON válido' }, { status: 400 });
      }
    }

    let parseado;
    try {
      const buffer = Buffer.from(await archivo.arrayBuffer());
      parseado = await parsearArchivoTabular(buffer, archivo.name);
    } catch (err) {
      if (err instanceof ArchivoInvalidoError) {
        return Response.json({ success: false, error: err.message }, { status: 400 });
      }
      throw err;
    }

    const supabase = await createClient();

    // Mapeo sugerido: el de la última importación confirmada del mismo tipo
    // para este edificio (RLS ya scopea por tenant).
    const { data: ultimaImportacion } = await supabase
      .from('importaciones')
      .select('mapeo_columnas')
      .eq('edificio_id', edificio_id)
      .eq('tipo', tipo)
      .eq('estado', 'confirmada')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const mapeoSugerido = (ultimaImportacion?.mapeo_columnas as Record<string, string> | null) ?? null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const responseData: Record<string, any> = {
      headers: parseado.headers,
      rows: parseado.rows,
      filas_totales: parseado.rows.length,
      mapeo_sugerido: mapeoSugerido,
      archivo_nombre: archivo.name,
    };

    if (mapeo) {
      const columnaNumero = mapeo.numero_unidad;
      const { data: unidades, error: errorUnidades } = await supabase
        .from('unidades')
        .select('id, numero')
        .eq('building_id', edificio_id);

      if (errorUnidades) {
        logger.error('Error preview importación (unidades):', errorUnidades);
        return Response.json({ success: false, error: 'No se pudieron leer las unidades del edificio' }, { status: 500 });
      }

      const indice = indexarUnidadesPorNumero(unidades || []);
      const { matcheadas, noMatcheadas } = matchearFilasPorUnidad(parseado.rows, columnaNumero, indice);

      let totalImporte: number | null = null;
      if (tipo === 'liquidacion' && mapeo.importe) {
        totalImporte = matcheadas.reduce((acc, m) => acc + (parsearImporteAR(m.fila[mapeo.importe]) ?? 0), 0);
      }

      let importacionPrevia: { id: string; created_at: string } | null = null;
      if (tipo === 'liquidacion' && periodo) {
        const { data: previa } = await supabase
          .from('importaciones')
          .select('id, created_at')
          .eq('edificio_id', edificio_id)
          .eq('tipo', 'liquidacion')
          .eq('periodo', `${periodo}-01`)
          .eq('estado', 'confirmada')
          .maybeSingle();
        importacionPrevia = previa ?? null;
      }

      responseData.match = {
        matcheadas: matcheadas.length,
        no_matcheadas: noMatcheadas.slice(0, 50),
        no_matcheadas_total: noMatcheadas.length,
        total_importe: totalImporte,
        importacion_previa: importacionPrevia,
      };
    }

    return Response.json({ success: true, data: responseData });
  } catch (err: unknown) {
    logger.error('Exception preview importación', err);
    return Response.json({ success: false, error: err instanceof Error ? err.message : 'Error interno' }, { status: 500 });
  }
}
