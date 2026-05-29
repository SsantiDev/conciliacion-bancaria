import * as XLSX from 'xlsx';

function ascii(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

async function parseRows(file: File, maxRows = 8): Promise<(string | number)[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target!.result as ArrayBuffer, { type: 'array' });
        const rows = XLSX.utils.sheet_to_json<(string | number)[]>(
          wb.Sheets[wb.SheetNames[0]],
          { header: 1, defval: '' },
        );
        resolve(rows.slice(0, maxRows));
      } catch {
        reject(new Error('No se pudo leer el archivo'));
      }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsArrayBuffer(file);
  });
}

export interface ColumnSpec { name: string; example: string; required: boolean }
export interface FileGuide  { description: string; columns: ColumnSpec[]; notes: string[] }
export interface BankConfig {
  extractoGuide: FileGuide;
  sapGuide:      FileGuide;
  validateExtracto(file: File): Promise<{ valid: boolean; error?: string }>;
}

// ── BANCOLOMBIA ───────────────────────────────────────────────────────────────

const BANCOLOMBIA: BankConfig = {
  extractoGuide: {
    description: 'Sin fila de encabezado. Los datos comienzan en la primera fila.',
    columns: [
      { name: 'Col A — Fecha',           example: '1042026 (= 01/04/2026)',      required: true  },
      { name: 'Col E — Descripción',     example: 'TRANSFERENCIA RECIBIDA',      required: true  },
      { name: 'Col F — Monto con signo', example: '1500000 · -320000',           required: true  },
      { name: 'Col H — Tipo',            example: '"C" crédito · "D" débito',    required: true  },
      { name: 'Col I — Monto absoluto',  example: '1500000',                     required: true  },
    ],
    notes: [
      'Sin fila de encabezados — primera fila contiene datos',
      'Mínimo 9 columnas (A–I)',
      'Fecha en formato numérico DDMMYYYY (ej: 1042026)',
      'Columna H solo puede contener "C" o "D"',
    ],
  },
  sapGuide: {
    description: 'Hoja del libro mayor SAP con nombre "BANCOLOMBIA".',
    columns: [
      { name: 'Fecha de Contabilización', example: '01/04/2026',  required: true  },
      { name: 'Número de Documento',      example: 'PP123456',    required: false },
      { name: 'Nombre (contrapartida)',   example: 'EMPRESA XYZ', required: false },
      { name: 'Cuenta de Contrapartida', example: '8300001672',   required: false },
      { name: 'Cargo',                   example: '320000',       required: true  },
      { name: 'Abono',                   example: '1500000',      required: true  },
    ],
    notes: ['La hoja debe llamarse "BANCOLOMBIA" (mayúsculas o minúsculas)'],
  },
  async validateExtracto(file) {
    try {
      const rows = await parseRows(file, 6);
      if (rows.length < 2) return { valid: false, error: 'El archivo tiene menos de 2 filas.' };
      const dataRows = rows.slice(1);
      const colCount = Math.max(...dataRows.map(r => r.length));
      if (colCount < 9) {
        return { valid: false, error: `Bancolombia requiere ≥9 columnas — se encontraron ${colCount}. Verifica la estructura del extracto.` };
      }
      const tipoVals = dataRows.map(r => String(r[7] ?? '').trim().toUpperCase()).filter(Boolean);
      if (tipoVals.length && !tipoVals.every(v => v === 'C' || v === 'D')) {
        return { valid: false, error: 'Col H (tipo) debe contener solo "C" o "D". Este no parece ser un extracto de Bancolombia.' };
      }
      const fechaVals = dataRows.map(r => String(r[0] ?? '').trim()).filter(Boolean);
      if (fechaVals.length && !fechaVals.every(v => /^\d{7,8}$/.test(v))) {
        return { valid: false, error: 'Col A (fecha) debe ser numérico DDMMYYYY (ej: 1042026). Verifica el formato de fecha.' };
      }
      return { valid: true };
    } catch {
      return { valid: false, error: 'No se pudo leer el archivo. Verifica que sea .xlsx o .csv válido.' };
    }
  },
};

// ── BOGOTÁ ────────────────────────────────────────────────────────────────────

const BOGOTA: BankConfig = {
  extractoGuide: {
    description: 'Extracto con encabezados en la primera fila.',
    columns: [
      { name: 'Fecha',       example: '01/04/2026',             required: true  },
      { name: 'Transacción', example: 'TRANSFERENCIA RECIBIDA', required: true  },
      { name: 'Documento',   example: '8300001672 (NIT)',        required: false },
      { name: 'Débito',      example: '320000',                 required: true  },
      { name: 'Crédito',     example: '1500000',                required: true  },
    ],
    notes: [
      'Encabezados en fila 1',
      'Columnas "Débito" y "Crédito" separadas (no combinadas)',
    ],
  },
  sapGuide: {
    description: 'Hoja del libro mayor SAP con nombre "BOGOTA".',
    columns: [
      { name: 'Fecha de Contabilización', example: '01/04/2026',  required: true  },
      { name: 'Número de Documento',      example: 'PP123456',    required: false },
      { name: 'Nombre (contrapartida)',   example: 'EMPRESA XYZ', required: false },
      { name: 'Cuenta de Contrapartida', example: '8300001672',   required: false },
      { name: 'Cargo',                   example: '320000',       required: true  },
      { name: 'Abono',                   example: '1500000',      required: true  },
    ],
    notes: ['La hoja debe llamarse "BOGOTA" (mayúsculas o minúsculas)'],
  },
  async validateExtracto(file) {
    try {
      const rows = await parseRows(file, 3);
      if (!rows.length) return { valid: false, error: 'Archivo vacío.' };
      const headers = rows[0].map(h => ascii(String(h)));
      const missing: string[] = [];
      if (!headers.some(h => h.includes('fecha')))                              missing.push('Fecha');
      if (!headers.some(h => h.includes('transac') || h.includes('descripci'))) missing.push('Transacción/Descripción');
      if (!headers.some(h => h.includes('deb')))                               missing.push('Débito');
      if (!headers.some(h => h.includes('cr') && !h.includes('ofi')))          missing.push('Crédito');
      if (missing.length) {
        return { valid: false, error: `Banco de Bogotá: faltan columnas: ${missing.join(', ')}. Encontradas: ${rows[0].join(' | ')}` };
      }
      return { valid: true };
    } catch {
      return { valid: false, error: 'No se pudo leer el archivo.' };
    }
  },
};

// ── DAVIVIENDA ────────────────────────────────────────────────────────────────

const DAVIVIENDA: BankConfig = {
  extractoGuide: {
    description: 'Encabezados en fila 3 aprox. (puede variar entre filas 1–6). Filas superiores pueden tener metadatos del banco.',
    columns: [
      { name: 'Fecha',             example: '01/04/2026',             required: true  },
      { name: 'Tran',              example: 'Notas Credito',           required: true  },
      { name: 'Desc Mot.',         example: 'TRANSFERENCIA RECIBIDA',  required: true  },
      { name: 'Valor Total',       example: '1500000',                 required: true  },
      { name: 'ID Origen/Destino', example: '8300001672 (NIT)',        required: false },
    ],
    notes: [
      'Encabezados usualmente en la fila 3',
      'Filas superiores pueden tener información de cuenta/banco',
      '"Tran": "Notas Credito" → crédito  ·  "Notas Debito" → débito',
    ],
  },
  sapGuide: {
    description: 'Hoja del libro mayor SAP con nombre "DAVIVIENDA".',
    columns: [
      { name: 'Fecha de Contabilización', example: '01/04/2026',  required: true  },
      { name: 'Número de Documento',      example: 'PP123456',    required: false },
      { name: 'Nombre (contrapartida)',   example: 'EMPRESA XYZ', required: false },
      { name: 'Cuenta de Contrapartida', example: '8300001672',   required: false },
      { name: 'Cargo',                   example: '320000',       required: true  },
      { name: 'Abono',                   example: '1500000',      required: true  },
    ],
    notes: ['La hoja debe llamarse "DAVIVIENDA" (mayúsculas o minúsculas)'],
  },
  async validateExtracto(file) {
    try {
      const rows = await parseRows(file, 8);
      const required = ['Fecha', 'Tran', 'Desc Mot.', 'Valor Total'];
      for (const row of rows) {
        const cells = row.map(c => String(c).trim());
        if (required.every(r => cells.some(c => c.toLowerCase().includes(r.toLowerCase())))) {
          return { valid: true };
        }
      }
      return {
        valid: false,
        error: `Davivienda: no se encontraron las columnas (${required.join(', ')}) en las primeras ${rows.length} filas.`,
      };
    } catch {
      return { valid: false, error: 'No se pudo leer el archivo.' };
    }
  },
};

export const BANK_SCHEMAS: Record<string, BankConfig> = {
  bancolombia: BANCOLOMBIA,
  bogota:      BOGOTA,
  davivienda:  DAVIVIENDA,
};
