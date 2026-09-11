'use server';

// =============================================================================
// ACTIONS: Mora Workflow - Flujo de Mora Automatizado
// =============================================================================
import { createClient } from '@/lib/supabase/server';
import { insertMoraLog } from '@/lib/supabase/tenant-insert';
import { requireUsuario, ROLES_GESTION } from '@/lib/auth';
import { estadoPorMesesAtrasados } from '@/lib/mora-estado';
import { revalidatePath } from 'next/cache';

// NOTA: Descomenta cuando tengas Resend configurado
// import { Resend } from 'resend';

// =============================================================================
// EMAIL TEMPLATES
// =============================================================================

function getEmailTemplate(
  propietario: { nombre: string; email: string },
  unidad: { numero: string; edificio: string },
  estado: string,
  meses: number,
  monto: number
) {
  const templates: Record<string, string> = {
    deudor: `
      <h2>📢 Notificación de Deuda - Expensas</h2>
      <p>Hola <strong>${propietario.nombre}</strong>,</p>
      <p>Tu unidad <strong>${unidad.numero}</strong> tiene expensas pendientes.</p>
      <ul><li>Meses: <strong>${meses}</strong></li><li>Monto: <strong>$${monto.toLocaleString('es-AR')}</strong></li></ul>
    `,
    apto_carta: `
      <h2>⚠️ Carta Documento - Expensas Vencidas</h2>
      <p>Hola <strong>${propietario.nombre}</strong>,</p>
      <p>Tu unidad acumula <strong>${meses} meses</strong> de deuda.</p>
      <p>Se ha iniciado el proceso de Carta Documento.</p>
    `,
    inicio_juicio: `
      <h2>⚖️ Inicio de Acción Judicial</h2>
      <p>Hola <strong>${propietario.nombre}</strong>,</p>
      <p>Se ha iniciado el juicio por expensas.</p>
    `,
  };
  return templates[estado] || templates.deudor;
}

// =============================================================================
// MAIN: Evaluar y Enviar Emails de Mora
// =============================================================================

export async function evaluarYEnviarMora(): Promise<{
  success: boolean;
  procesadas: number;
  emails_enviados: number;
  errores: string[];
}> {
  const errores: string[] = [];
  // Resend está deshabilitado (bloque comentado más abajo): no se manda ningún
  // email, así que el contador queda en 0. Al habilitar Resend, volver a `let`
  // e incrementarlo dentro de ese bloque.
  const emailsEnviados = 0;
  let procesadas = 0;

  try {
    // Control de acceso DENTRO del action: sólo gestión (no propietarios).
    const auth = await requireUsuario(ROLES_GESTION);
    if (!auth.ok) {
      return { success: false, procesadas: 0, emails_enviados: 0, errores: ['Sin permiso'] };
    }

    // Cliente por request: RLS acota `unidades` / `mora_logs` a la administradora.
    const supabase = await createClient();

    const { data: unidades } = await supabase
      .from('unidades')
      .select('id, numero, building_id')
      .order('id');

    for (const unidad of unidades || []) {
      try {
        const { data: saldo } = await supabase.rpc('get_saldo_deudor', {
          p_unidad_id: unidad.id,
        });

        if (!saldo || saldo.length === 0 || !saldo[0].es_mora) {
          continue;
        }

        const { meses_atrasados, monto_total } = saldo[0];

        const { data: prop } = await supabase
          .from('propietarios')
          .select('id, nombre, email')
          .eq('unidad_id', unidad.id)
          .single();

        if (!prop) continue;

        const nuevoEstado = estadoPorMesesAtrasados(meses_atrasados);

        const { data: ultimoLog } = await supabase
          .from('mora_logs')
          .select('estado_nuevo')
          .eq('unidad_id', unidad.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (ultimoLog?.estado_nuevo === nuevoEstado) {
          continue;
        }

        const { error: errorLog } = await insertMoraLog(supabase, {
          unidad_id: unidad.id,
          propietario_id: prop.id,
          estado_nuevo: nuevoEstado,
          meses_deuda: meses_atrasados,
          monto_deuda: monto_total,
          motivo: `Evaluación automática: ${meses_atrasados} meses de deuda`,
        });

        if (errorLog) {
          errores.push(`Error insertando log para unidad ${unidad.numero}`);
          continue;
        }

        // Email (descomentar cuando tengas Resend)
        /*
        if (['deudor', 'apto_carta', 'inicio_juicio'].includes(nuevoEstado)) {
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.emails.send({
            from: 'Administración <admin@consorcio.com>',
            to: prop.email,
            subject: `Notificación de Deuda - Unidad ${unidad.numero}`,
            html: getEmailTemplate({ nombre: prop.nombre, email: prop.email }, { numero: unidad.numero, edificio: '' }, nuevoEstado, meses_atrasados, Number(monto_total)),
          });
          emailsEnviados++;
        }
        */
        // emailsEnviados sólo se incrementa dentro del bloque Resend de arriba.
        procesadas++;
      } catch (innerError) {
        errores.push(`Error procesando unidad ${unidad.id}: ${innerError}`);
      }
    }

    revalidatePath('/admin/mora');
    
    return {
      success: errores.length === 0,
      procesadas,
      emails_enviados: emailsEnviados,
      errores,
    };
  } catch (error) {
    return {
      success: false,
      procesadas: 0,
      emails_enviados: 0,
      errores: [String(error)],
    };
  }
}

// =============================================================================
// UTIL: Historial de Mora
// =============================================================================

export async function getHistorialMora(unidadId: string) {
  try {
    const auth = await requireUsuario(ROLES_GESTION);
    if (!auth.ok) return { success: false, error: 'Sin permiso' };

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('mora_logs')
      .select('*, propietario:propietarios(nombre, apellido)')
      .eq('unidad_id', unidadId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { success: true, data };
  } catch {
    return { success: false, error: 'No se pudo obtener el historial' };
  }
}