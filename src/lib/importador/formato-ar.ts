// =============================================================================
// LIB: Importador - parseo de importes en formato argentino
// =============================================================================
// Las planillas que exportan las administradoras mezclan "150000.50" (punto
// decimal), "150.000,50" (punto de miles + coma decimal, el formato AR/es-AR
// completo) y "150.000" (punto de miles SIN decimales — un importe redondo
// en pesos, el caso más común de todos). Heurística: si hay coma Y punto, el
// punto es separador de miles. Si sólo hay coma, es el separador decimal. Si
// sólo hay punto, se mira cuántos dígitos quedan después del ÚLTIMO punto:
// 1 o 2 dígitos (y un solo punto) es un decimal plausible ("150.5", "150.50");
// cualquier otro caso (3 dígitos, o más de un punto, como "150.000" o
// "1.500.000") es agrupamiento de miles y se descarta.
export function parsearImporteAR(valor: string): number | null {
  const limpio = valor.trim().replace(/\$/g, '').replace(/\s/g, '');
  if (limpio === '') return null;

  let normalizado = limpio;
  const tieneComa = limpio.includes(',');
  const tienePunto = limpio.includes('.');

  if (tieneComa && tienePunto) {
    normalizado = limpio.replace(/\./g, '').replace(',', '.');
  } else if (tieneComa) {
    normalizado = limpio.replace(',', '.');
  } else if (tienePunto) {
    const partes = limpio.split('.');
    const ultimaParte = partes[partes.length - 1];
    const esDecimalPlausible = partes.length === 2 && ultimaParte.length <= 2;
    normalizado = esDecimalPlausible ? limpio : limpio.replace(/\./g, '');
  }

  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}
