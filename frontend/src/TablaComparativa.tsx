import React, { useState, useMemo } from 'react';
import { Download, Search, ArrowRight } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Resultado {
  banco_idx: number;
  banco_fecha: string | null; banco_monto: number; banco_tipo: string;
  banco_ref: string | null;   banco_desc: string;
  sap_idx: number | null;
  sap_fecha: string | null;   sap_monto: number | null;
  sap_ref: string | null;     sap_desc: string | null; sap_num_doc: string | null;
  nivel: string; nivel_negocio: string;
  delta_dias: number | null;  delta_monto: number | null;
  estado: string;
}

export interface Totales {
  suma_banco: number; suma_sap: number; diferencia: number;
  conciliados: number; pendientes: number; abiertos: number;
}

interface Props { resultados: Resultado[]; totales: Totales; banco: string }

// ── Config ────────────────────────────────────────────────────────────────────

const NIVEL_CFG = {
  CONCILIADO: { label: '✅ Conciliado', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  PENDIENTE:  { label: '⚠️ Pendiente',  color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  ABIERTO:    { label: '❌ Abierto',    color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
} as const;

const PAGE = 30;

const cop = (n: number | null) =>
  n == null ? '—' : n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

// ── CSV Export ────────────────────────────────────────────────────────────────

function exportCSV(rows: Resultado[], banco: string) {
  const headers = [
    'nivel_negocio','banco_fecha','banco_monto','banco_tipo','banco_ref','banco_desc',
    'sap_fecha','sap_monto','sap_ref','sap_desc','sap_num_doc',
    'delta_monto','delta_dias','nivel','estado',
  ];
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(','), ...rows.map(r => headers.map(h => esc((r as any)[h])).join(','))];
  const blob  = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url   = URL.createObjectURL(blob);
  const a     = Object.assign(document.createElement('a'), { href: url, download: `conciliacion_${banco}_${new Date().toISOString().slice(0,10)}.csv` });
  a.click();
  URL.revokeObjectURL(url);
}

// ── Componente ────────────────────────────────────────────────────────────────

const TablaComparativa: React.FC<Props> = ({ resultados, totales, banco }) => {
  const [filtro, setFiltro]           = useState<'TODOS'|'CONCILIADO'|'PENDIENTE'|'ABIERTO'>('TODOS');
  const [busqueda, setBusqueda]       = useState('');
  const [pagina, setPagina]           = useState(0);
  const [ocultarAbiertos, setOcultar] = useState(false);

  const abiertosCount = useMemo(
    () => resultados.filter(x => x.nivel_negocio === 'ABIERTO').length,
    [resultados],
  );

  const filtered = useMemo(() => {
    let r = resultados;
    if (ocultarAbiertos) r = r.filter(x => x.nivel_negocio !== 'ABIERTO');
    if (filtro !== 'TODOS') r = r.filter(x => x.nivel_negocio === filtro);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      r = r.filter(x =>
        x.banco_desc.toLowerCase().includes(q) ||
        (x.sap_desc ?? '').toLowerCase().includes(q) ||
        (x.banco_ref ?? '').includes(q) ||
        (x.sap_num_doc ?? '').toLowerCase().includes(q)
      );
    }
    return r;
  }, [resultados, filtro, busqueda, ocultarAbiertos]);

  const pages = Math.ceil(filtered.length / PAGE);
  const slice = filtered.slice(pagina * PAGE, (pagina + 1) * PAGE);
  const cambiarFiltro = (f: typeof filtro) => { setFiltro(f); setPagina(0); };

  return (
    <div>
      {/* Totales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        {[
          { label: 'Total banco',  value: cop(totales.suma_banco), sub: `${totales.conciliados} conciliados` },
          { label: 'Diferencia',   value: cop(totales.diferencia), sub: `${totales.pendientes} pendientes`, color: totales.diferencia <= 2000 ? '#16a34a' : '#dc2626' },
          { label: 'Total SAP',    value: cop(totales.suma_sap),   sub: `${totales.abiertos} abiertos` },
        ].map(m => (
          <div key={m.label} style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-default)' }}>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: m.color ?? 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{m.value}</div>
            <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginTop: 2 }}>{m.label} · {m.sub}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
        {(['TODOS','CONCILIADO','PENDIENTE','ABIERTO'] as const).map(f => {
          const cnt = f === 'TODOS' ? resultados.length : totales[f.toLowerCase() as 'conciliados'|'pendientes'|'abiertos'];
          const active = filtro === f;
          return (
            <button key={f} onClick={() => cambiarFiltro(f)} style={{ padding: '4px 12px', borderRadius: 'var(--radius-full)', border: `1.5px solid ${active ? 'var(--color-accent-500)' : 'var(--border-default)'}`, background: active ? 'var(--color-accent-500)' : 'var(--color-bg-elevated)', color: active ? '#fff' : 'var(--text-muted)', fontSize: 'var(--text-xs)', fontWeight: 700, cursor: 'pointer' }}>
              {f === 'TODOS' ? `Todos (${cnt})` : `${NIVEL_CFG[f].label} (${cnt})`}
            </button>
          );
        })}
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', padding: '4px 10px', borderRadius: 'var(--radius-full)', border: `1.5px solid ${ocultarAbiertos ? '#dc2626' : 'var(--border-default)'}`, background: ocultarAbiertos ? '#fef2f2' : 'var(--color-bg-elevated)', fontSize: 'var(--text-xs)', fontWeight: 600, color: ocultarAbiertos ? '#dc2626' : 'var(--text-muted)', userSelect: 'none' }}>
          <input type="checkbox" checked={ocultarAbiertos} onChange={e => { setOcultar(e.target.checked); setPagina(0); }} style={{ accentColor: '#dc2626', cursor: 'pointer' }} />
          Ocultar sin match ({abiertosCount})
        </label>
        <div style={{ flex: 1, position: 'relative', minWidth: 180 }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input value={busqueda} onChange={e => { setBusqueda(e.target.value); setPagina(0); }} placeholder="Buscar descripción, ref, doc…" style={{ width: '100%', paddingLeft: 28, paddingRight: 8, height: 30, borderRadius: 'var(--radius-full)', border: '1px solid var(--border-default)', background: 'var(--color-bg-elevated)', fontSize: 'var(--text-xs)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
        </div>
        <button onClick={() => exportCSV(filtered, banco)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 14px', borderRadius: 'var(--radius-full)', border: '1.5px solid var(--color-accent-500)', background: 'transparent', color: 'var(--color-accent-500)', fontSize: 'var(--text-xs)', fontWeight: 700, cursor: 'pointer' }}>
          <Download size={13} /> Exportar CSV
        </button>
      </div>

      {/* Cabeceras de las dos tablas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 48px 1fr', gap: 0, marginBottom: 4 }}>
        <div style={{ padding: '6px 12px', background: '#1e40af', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', textAlign: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#fff' }}>Extracto bancario — {banco}</span>
        </div>
        <div />
        <div style={{ padding: '6px 12px', background: '#065f46', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', textAlign: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#fff' }}>SAP — Libro mayor</span>
        </div>
      </div>

      {/* Filas comparativas */}
      <div style={{ border: '1px solid var(--border-default)', borderRadius: '0 0 var(--radius-xl) var(--radius-xl)', overflow: 'hidden' }}>
        {/* Sub-cabeceras de columnas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 48px 1fr', background: 'var(--color-bg-muted)', borderBottom: '2px solid var(--border-default)' }}>
          {/* Banco cols */}
          <div style={{ display: 'grid', gridTemplateColumns: '90px 110px 1fr 80px', borderRight: '1px solid var(--border-default)' }}>
            {['Fecha', 'Monto', 'Descripción', 'Tipo'].map(h => (
              <div key={h} style={{ padding: '6px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>{h}</div>
            ))}
          </div>
          {/* Centro */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid var(--border-default)', fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', flexDirection: 'column', gap: 2 }}>
            <span>Δ</span>
          </div>
          {/* SAP cols */}
          <div style={{ display: 'grid', gridTemplateColumns: '90px 110px 1fr 80px' }}>
            {['Fecha', 'Monto', 'Descripción', 'Doc SAP'].map(h => (
              <div key={h} style={{ padding: '6px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>{h}</div>
            ))}
          </div>
        </div>

        {/* Filas de datos */}
        {slice.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Sin resultados para este filtro.</div>
        ) : slice.map((r, i) => {
          const cfg = NIVEL_CFG[r.nivel_negocio as keyof typeof NIVEL_CFG] ?? NIVEL_CFG.ABIERTO;
          const rowBg = i % 2 ? 'var(--color-bg-muted)' : 'transparent';
          const montoOk = r.delta_monto == null || r.delta_monto <= 2000;
          const diasOk  = r.delta_dias == null || r.delta_dias <= 1;

          return (
            <div key={r.banco_idx} style={{ display: 'grid', gridTemplateColumns: '1fr 48px 1fr', background: rowBg, borderBottom: '1px solid var(--border-default)' }}>
              {/* ── LADO BANCO ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '90px 110px 1fr 80px', borderRight: `2px solid ${cfg.border}`, alignItems: 'center' }}>
                <span style={{ padding: '7px 8px', fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{r.banco_fecha ?? '—'}</span>
                <span style={{ padding: '7px 8px', fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{cop(r.banco_monto)}</span>
                <span style={{ padding: '7px 8px', fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.banco_desc}>{r.banco_desc}</span>
                <span style={{ padding: '7px 8px', fontSize: 10, fontWeight: 700, color: r.banco_tipo === 'CR' ? '#16a34a' : '#dc2626' }}>{r.banco_tipo}</span>
              </div>

              {/* ── CENTRO: estado + deltas ── */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '4px 2px', borderRight: `2px solid ${cfg.border}` }}>
                <span style={{ padding: '2px 5px', borderRadius: 4, background: cfg.bg, color: cfg.color, fontSize: 9, fontWeight: 800, whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                  {r.nivel_negocio === 'CONCILIADO' ? '✅' : r.nivel_negocio === 'PENDIENTE' ? '⚠️' : '❌'}
                </span>
                {r.delta_monto != null && (
                  <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: montoOk ? '#16a34a' : '#dc2626', fontWeight: 700 }} title={`Δ monto: ${cop(r.delta_monto)}`}>
                    {montoOk ? '=$' : `Δ$`}
                  </span>
                )}
                {r.delta_dias != null && (
                  <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: diasOk ? '#16a34a' : '#d97706', fontWeight: 700 }} title={`Δ días: ${r.delta_dias}`}>
                    {diasOk ? '=d' : `${r.delta_dias}d`}
                  </span>
                )}
                {r.sap_idx == null && (
                  <ArrowRight size={10} color="#9ca3af" />
                )}
              </div>

              {/* ── LADO SAP ── */}
              {r.sap_idx != null ? (
                <div style={{ display: 'grid', gridTemplateColumns: '90px 110px 1fr 80px', alignItems: 'center' }}>
                  <span style={{ padding: '7px 8px', fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{r.sap_fecha ?? '—'}</span>
                  <span style={{ padding: '7px 8px', fontSize: 11, fontWeight: 700, color: montoOk ? 'var(--text-primary)' : '#dc2626', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{cop(r.sap_monto)}</span>
                  <span style={{ padding: '7px 8px', fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.sap_desc ?? ''}>{r.sap_desc ?? '—'}</span>
                  <span style={{ padding: '7px 8px', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{r.sap_num_doc ?? '—'}</span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', padding: '7px 12px' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin registro en SAP</span>
                </div>
              )}
            </div>
          );
        })}

        {/* Footer totales */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 48px 1fr', background: 'var(--color-bg-muted)', borderTop: '2px solid var(--border-default)', fontWeight: 700 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '90px 110px 1fr 80px', borderRight: '2px solid var(--border-default)' }}>
            <span style={{ padding: '8px 8px', fontSize: 11, color: 'var(--text-primary)' }}>TOTAL</span>
            <span style={{ padding: '8px 8px', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{cop(totales.suma_banco)}</span>
            <span style={{ padding: '8px 8px', fontSize: 11, color: 'var(--text-muted)' }} />
            <span />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '2px solid var(--border-default)' }}>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: totales.diferencia <= 2000 ? '#16a34a' : '#dc2626', fontWeight: 800 }}>Δ</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '90px 110px 1fr 80px' }}>
            <span style={{ padding: '8px 8px', fontSize: 11, color: 'var(--text-primary)' }}>TOTAL</span>
            <span style={{ padding: '8px 8px', fontSize: 11, fontFamily: 'var(--font-mono)', color: totales.diferencia <= 2000 ? '#16a34a' : '#dc2626' }}>{cop(totales.suma_sap)}</span>
            <span style={{ padding: '8px 8px', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Δ {cop(totales.diferencia)}</span>
            <span />
          </div>
        </div>
      </div>

      {/* Paginación */}
      {pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-3)' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{pagina * PAGE + 1}–{Math.min((pagina + 1) * PAGE, filtered.length)} de {filtered.length}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: Math.min(pages, 7) }, (_, i) => i).map(i => (
              <button key={i} onClick={() => setPagina(i)} style={{ width: 28, height: 28, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: pagina === i ? 'var(--color-accent-500)' : 'var(--color-bg-elevated)', color: pagina === i ? '#fff' : 'var(--text-secondary)', fontSize: 'var(--text-xs)', fontWeight: 700, cursor: 'pointer' }}>{i + 1}</button>
            ))}
            {pages > 7 && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', padding: '0 8px', alignSelf: 'center' }}>… {pages}</span>}
          </div>
        </div>
      )}
    </div>
  );
};

export default TablaComparativa;
