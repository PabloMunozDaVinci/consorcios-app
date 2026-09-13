// =============================================================================
// LIB: Importador - parseo de CSV/Excel a filas genéricas
// =============================================================================
// Convierte el archivo subido (la administradora exporta con encabezados
// distintos cada vez) en { headers, rows } planos. El mapeo de esas columnas
// a los campos reales (numero_unidad, importe, etc.) lo hace quien llama,
// no este módulo — acá sólo hay parseo, cero conocimiento del dominio.
import ExcelJS from 'exceljs';
import { parse as parseCsvSync } from 'csv-parse/sync';

export interface ArchivoParseado {
  headers: string[];
  rows: Record<string, string>[];
}

const MAX_FILAS = 5000;

export class ArchivoInvalidoError extends Error {}

function esCSV(nombre: string): boolean {
  return /\.csv$/i.test(nombre);
}

function esExcel(nombre: string): boolean {
  return /\.xlsx?$/i.test(nombre);
}

function filasDesdeMatriz(matriz: string[][]): ArchivoParseado {
  const filasNoVacias = matriz.filter((fila) => fila.some((celda) => celda.trim() !== ''));
  if (filasNoVacias.length === 0) {
    throw new ArchivoInvalidoError('El archivo no tiene filas con datos.');
  }
  if (filasNoVacias.length - 1 > MAX_FILAS) {
    throw new ArchivoInvalidoError(`El archivo tiene más de ${MAX_FILAS} filas. Dividilo en partes más chicas.`);
  }

  const headersCrudos = filasNoVacias[0];
  // Encabezados vacíos o repetidos -> columna_N, para que el resto del
  // sistema (mapeo, preview) siempre tenga una clave estable por columna.
  const vistos = new Map<string, number>();
  const headers = headersCrudos.map((h, i) => {
    const base = h.trim() || `columna_${i + 1}`;
    const n = vistos.get(base) ?? 0;
    vistos.set(base, n + 1);
    return n === 0 ? base : `${base}_${n + 1}`;
  });

  const rows = filasNoVacias.slice(1).map((fila) => {
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (fila[i] ?? '').trim();
    });
    return row;
  });

  return { headers, rows };
}

function parsearCSV(buffer: Buffer): ArchivoParseado {
  let registros: string[][];
  try {
    registros = parseCsvSync(buffer, {
      bom: true,
      delimiter: [',', ';'],
      relax_column_count: true,
      skip_empty_lines: true,
    }) as string[][];
  } catch {
    throw new ArchivoInvalidoError('No se pudo leer el CSV. Verificá que esté bien formado.');
  }
  return filasDesdeMatriz(registros);
}

async function parsearExcel(buffer: Buffer): Promise<ArchivoParseado> {
  const workbook = new ExcelJS.Workbook();
  try {
    // exceljs declara `load(buffer: Buffer)` resuelto contra el @types/node@14
    // que le trae su propia dependencia fast-csv (no usada acá): es un
    // Buffer distinto, no genérico, del Buffer real que estamos pasando — de
    // ahí el `as any`, un `as unknown as Buffer` no alcanza porque "Buffer"
    // en este archivo resuelve al mismo tipo que ya tiene `buffer`.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);
  } catch {
    throw new ArchivoInvalidoError('No se pudo leer el archivo de Excel. Verificá que no esté dañado.');
  }
  const hoja = workbook.worksheets[0];
  if (!hoja) {
    throw new ArchivoInvalidoError('El archivo de Excel no tiene ninguna hoja.');
  }

  const matriz: string[][] = [];
  hoja.eachRow({ includeEmpty: false }, (fila) => {
    const valores: string[] = [];
    fila.eachCell({ includeEmpty: true }, (celda) => {
      const v = celda.value;
      if (v == null) {
        valores.push('');
      } else if (typeof v === 'object' && 'text' in v) {
        valores.push(String((v as { text: unknown }).text ?? ''));
      } else if (typeof v === 'object' && 'result' in v) {
        valores.push(String((v as { result: unknown }).result ?? ''));
      } else if (v instanceof Date) {
        valores.push(v.toISOString().slice(0, 10));
      } else {
        valores.push(String(v));
      }
    });
    matriz.push(valores);
  });

  return filasDesdeMatriz(matriz);
}

/** Parsea un CSV o Excel (.xlsx) subido a { headers, rows }. La primera fila no vacía es el encabezado. */
export async function parsearArchivoTabular(buffer: Buffer, nombreArchivo: string): Promise<ArchivoParseado> {
  if (esCSV(nombreArchivo)) {
    return parsearCSV(buffer);
  }
  if (esExcel(nombreArchivo)) {
    return parsearExcel(buffer);
  }
  throw new ArchivoInvalidoError('Formato no soportado. Subí un archivo .csv o .xlsx.');
}
