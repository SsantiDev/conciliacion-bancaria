import * as XLSX from 'xlsx';

export interface DiagItemExport {
  categoria: string; motivo: string;
  fecha: string | null; monto: number | null;
  descripcion: string | null; num_doc: string | null;
  banco_idx: number | null; sap_idx: number | null;
}

export interface ResultadoExport {
  banco_fecha: string | null; banco_monto: number; banco_tipo: string;
  banco_ref: string | null;   banco_desc: string;
  sap_fecha: string | null;   sap_monto: number | null;
  sap_ref: string | null;     sap_desc: string | null; sap_num_doc: string | null;
  nivel: string; nivel_negocio: string;
  delta_dias: number | null;  delta_monto: number | null;
}

export interface ApiResultExport {
  banco: string;
  resumen: { total_banco: number; total_sap: number; tasa_conciliacion: number };
  totales: { suma_banco: number; suma_sap: number; diferencia: number; conciliados: number; pendientes: number; abiertos: number };
  resultados: ResultadoExport[];
  diagnosticos: DiagItemExport[];
}

const n = (v: number | null | undefined) => v ?? 0;

function autoWidth(ws: XLSX.WorkSheet, widths: number[]) {
  ws['!cols'] = widths.map(w => ({ wch: w }));
}

export function exportarInformeExcel(r: ApiResultExport) {
  const wb    = XLSX.utils.book_new();
  const fecha = new Date().toLocaleDateString('es-CO');
  const sap   = r.diagnosticos.filter(d => d.categoria === 'SAP_SIN_BANCO');
  const dups  = r.diagnosticos.filter(d => d.categoria === 'DUPLICADO');
  const pend  = r.resultados.filter(x => x.nivel_negocio === 'PENDIENTE');

  // ── Hoja 1: Resumen ───────────────────────────────────────────────────────
  const ws1 = XLSX.utils.aoa_to_sheet([
    ['INFORME DE CONCILIACIÓN BANCARIA'],
    ['Banco', r.banco],
    ['Fecha exportación', fecha],
    [],
    ['MÉTRICAS'],
    ['Movimientos banco (sin IVA/comisiones)', r.resumen.total_banco],
    ['Registros SAP',                          r.resumen.total_sap],
    ['Tasa de conciliación',                   `${(r.resumen.tasa_conciliacion * 100).toFixed(1)}%`],
    [],
    ['ESTADO',      'Cantidad'],
    ['Conciliados', r.totales.conciliados],
    ['Pendientes',  r.totales.pendientes],
    ['Sin match',   r.totales.abiertos],
    [],
    ['TOTALES (COP)', ''],
    ['Suma banco',  n(r.totales.suma_banco)],
    ['Suma SAP',    n(r.totales.suma_sap)],
    ['Diferencia',  n(r.totales.diferencia)],
    [],
    ['ÍTEMS A RESOLVER', 'Cantidad'],
    ['SAP sin banco',    sap.length],
    ['Duplicados',       dups.length],
    ['Pendientes',       pend.length],
  ]);
  autoWidth(ws1, [44, 22]);
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumen');

  // ── Hoja 2: SAP sin banco ─────────────────────────────────────────────────
  const ws2 = XLSX.utils.aoa_to_sheet([
    ['Fecha SAP', 'Monto (COP)', 'Descripción / Razón social', 'Nº Documento SAP', 'Acción sugerida'],
    ...sap.map(d => [
      d.fecha ?? '—',
      n(d.monto),
      d.descripcion ?? '—',
      d.num_doc ?? '—',
      'Verificar cobro pendiente o pago en tránsito',
    ]),
  ]);
  autoWidth(ws2, [12, 16, 42, 18, 44]);
  XLSX.utils.book_append_sheet(wb, ws2, `SAP sin banco (${sap.length})`);

  // ── Hoja 3: Duplicados ────────────────────────────────────────────────────
  const ws3 = XLSX.utils.aoa_to_sheet([
    ['Fecha banco', 'Monto (COP)', 'Descripción banco', 'Acción sugerida'],
    ...dups.map(d => [
      d.fecha ?? '—',
      n(d.monto),
      d.descripcion ?? '—',
      'Confirmar si es doble registro o transacción legítima repetida',
    ]),
  ]);
  autoWidth(ws3, [12, 16, 44, 52]);
  XLSX.utils.book_append_sheet(wb, ws3, `Duplicados (${dups.length})`);

  // ── Hoja 4: Pendientes ────────────────────────────────────────────────────
  const ws4 = XLSX.utils.aoa_to_sheet([
    ['Fecha banco', 'Monto banco', 'Descripción banco', 'Ref banco',
     'Fecha SAP', 'Monto SAP', 'Descripción SAP', 'Doc SAP',
     'Δ Monto (COP)', 'Δ Días', 'Acción sugerida'],
    ...pend.map(x => [
      x.banco_fecha ?? '—',
      n(x.banco_monto),
      x.banco_desc,
      x.banco_ref ?? '—',
      x.sap_fecha ?? '—',
      n(x.sap_monto),
      x.sap_desc ?? '—',
      x.sap_num_doc ?? '—',
      n(x.delta_monto),
      x.delta_dias ?? '—',
      x.delta_monto != null && x.delta_monto > 2000
        ? 'Validar diferencia de monto con área contable'
        : 'Validar desfase de fecha con área contable',
    ]),
  ]);
  autoWidth(ws4, [12, 14, 34, 14, 12, 14, 34, 12, 14, 8, 46]);
  XLSX.utils.book_append_sheet(wb, ws4, `Pendientes (${pend.length})`);

  // ── Hoja 5: Comparativa completa banco ↔ SAP ─────────────────────────────
  const wsC = XLSX.utils.aoa_to_sheet([
    [
      // Banco (izquierda)
      'Fecha banco', 'Monto banco (COP)', 'Tipo', 'Descripción banco', 'NIT/Ref banco',
      // Estado (centro)
      'Estado', 'Δ Monto (COP)', 'Δ Días',
      // SAP (derecha)
      'Fecha SAP', 'Monto SAP (COP)', 'Descripción SAP / Razón social', 'Nº Doc SAP', 'NIT/Ref SAP',
    ],
    ...r.resultados.map(x => [
      x.banco_fecha ?? '—',
      n(x.banco_monto),
      x.banco_tipo,
      x.banco_desc,
      x.banco_ref ?? '—',
      x.nivel_negocio,
      x.delta_monto != null ? n(x.delta_monto) : '—',
      x.delta_dias  != null ? x.delta_dias      : '—',
      x.sap_fecha   ?? '—',
      x.sap_monto   != null ? n(x.sap_monto)    : '—',
      x.sap_desc    ?? '—',
      x.sap_num_doc ?? '—',
      x.sap_ref     ?? '—',
    ]),
  ]);
  autoWidth(wsC, [12, 16, 6, 38, 16, 14, 14, 8, 12, 16, 38, 14, 16]);
  XLSX.utils.book_append_sheet(wb, wsC, 'Comparativa completa');

  XLSX.writeFile(wb, `conciliacion_${r.banco}_${fecha.replace(/\//g, '-')}.xlsx`);
}
