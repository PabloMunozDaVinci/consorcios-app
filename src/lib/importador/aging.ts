// =============================================================================
// LIB: Aging FIFO en JS - sólo para elegir el período por defecto de un pago
// =============================================================================
// La fuente de verdad del saldo es get_saldo_deudor() (SQL, 007_fase1_cuenta_corriente.sql).
// Esta función replica la misma lógica FIFO en JS para un único uso puntual:
// cuando el usuario pide "imputar al saldo más antiguo" al registrar un pago
// (ROADMAP Fase 1.4), hay que decidir a qué `periodo` de cuenta_corriente se
// le asigna el crédito nuevo. Si se llega a desincronizar de la función SQL,
// el peor caso es que el pago quede imputado a un período distinto del
// "correcto" — el monto y el saldo total siguen siendo exactos, porque ambos
// salen de sumar/restar los mismos movimientos reales.
export function periodoMasAntiguoPendiente(
  debitosPorPeriodo: { periodo: string; importe: number }[],
  totalCreditos: number
): string | null {
  const ordenados = [...debitosPorPeriodo].sort((a, b) => a.periodo.localeCompare(b.periodo));
  let acumuladoDebito = 0;
  for (const { periodo, importe } of ordenados) {
    const deudaAntes = acumuladoDebito;
    acumuladoDebito += importe;
    const creditosDisponibles = Math.max(0, totalCreditos - deudaAntes);
    const saldoPendiente = Math.max(0, importe - creditosDisponibles);
    if (saldoPendiente > 0) return periodo;
  }
  return null;
}
