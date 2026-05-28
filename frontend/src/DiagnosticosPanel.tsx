import React, { useState } from 'react';
import { AlertTriangle, Copy, ChevronLeft, ChevronRight } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DiagItem {
  categoria: string;
  motivo: string;
  fecha: string | null;
  monto: number | null;
  descripcion: string | null;
  num_doc: string | null;
  banco_idx: number | null;
  sap_idx: number | null;
}

interface Props { diagnosticos: DiagItem[] }

// ── Config por categoría ──────────────────────────────────────────────────────

const CAT = {
  SAP_SIN_BANCO: {
    label: 'SAP sin banco',
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
    icon: <AlertTriangle size={14} />,
    acciones: ['Marcar en tránsito', 'Marcar anulada'],
  },
  DUPLICADO: {
    label: 'Duplicado',
    color: '#9333ea',
    bg: '#faf5ff',
    border: '#e9d5ff',
    icon: <Copy size={14} />,
    acciones: ['Marcar duplicado'],
  },
} as const;

type CatKey = keyof typeof CAT;
const PAGE_SIZE = 15;

function fmt(n: number | null) {
  if (n == null) return '—';
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
}

// ── Componente ────────────────────────────────────────────────────────────────

const DiagnosticosPanel: React.FC<Props> = ({ diagnosticos }) => {
  const cats = Object.keys(CAT) as CatKey[];
  const grouped = Object.fromEntries(
    cats.map(k => [k, diagnosticos.filter(d => d.categoria === k)])
  ) as Record<CatKey, DiagItem[]>;

  const [tab, setTab]   = useState<CatKey>(() => cats.find(k => grouped[k].length > 0) ?? 'SAP_SIN_BANCO');
  const [page, setPage] = useState(0);

  const items = grouped[tab];
  const pages = Math.ceil(items.length / PAGE_SIZE);
  const slice = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const cfg   = CAT[tab];

  const handleTab = (k: CatKey) => { setTab(k); setPage(0); };

  if (diagnosticos.length === 0) return null;

  return (
    <div style={{ marginTop: 'var(--space-6)' }}>
      <h4 style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
        Diagnóstico de no coincidencias
      </h4>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        {cats.filter(k => grouped[k].length > 0).map(k => {
          const c = CAT[k];
          const active = tab === k;
          return (
            <button key={k} onClick={() => handleTab(k)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--radius-full)', border: `1.5px solid ${active ? c.color : 'var(--border-default)'}`, background: active ? c.bg : 'var(--color-bg-elevated)', color: active ? c.color : 'var(--text-muted)', fontSize: 'var(--text-xs)', fontWeight: 700, cursor: 'pointer', transition: 'all var(--duration-normal)' }}>
              {c.icon}
              {c.label}
              <span style={{ background: active ? c.color : 'var(--color-bg-muted)', color: active ? '#fff' : 'var(--text-muted)', borderRadius: 'var(--radius-full)', padding: '1px 6px', fontSize: 10, fontFamily: 'var(--font-mono)' }}>
                {grouped[k].length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tabla */}
      <div style={{ border: `1px solid ${cfg.border}`, borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '100px 120px 1fr 2fr', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-4)', background: cfg.bg, borderBottom: `1px solid ${cfg.border}` }}>
          {['Fecha', 'Monto', 'Descripción', 'Diagnóstico / Acción'].map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: cfg.color }}>{h}</span>
          ))}
        </div>

        {/* Filas */}
        {slice.length === 0 ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Sin items.</div>
        ) : slice.map((item, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '100px 120px 1fr 2fr', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', borderBottom: i < slice.length - 1 ? '1px solid var(--border-default)' : 'none', alignItems: 'start' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', paddingTop: 2 }}>
              {item.fecha ?? '—'}
            </span>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', paddingTop: 2 }}>
              {fmt(item.monto)}
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingTop: 2 }} title={item.descripcion ?? ''}>
              {item.descripcion ?? '—'}
            </span>
            <div>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: 6, lineHeight: 1.4 }}>
                {item.motivo}
              </span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {cfg.acciones.map(accion => (
                  <button key={accion} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 'var(--radius-full)', border: `1px solid ${cfg.color}50`, background: `${cfg.color}08`, color: cfg.color, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all var(--duration-fast)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${cfg.color}18`; }}
                    onMouseLeave={e => { e.currentTarget.style.background = `${cfg.color}08`; }}>
                    {accion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Paginación */}
      {pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--space-3)' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, items.length)} de {items.length}
          </span>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              style={{ padding: '4px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--color-bg-elevated)', cursor: page === 0 ? 'not-allowed' : 'pointer', color: page === 0 ? 'var(--text-muted)' : 'var(--text-primary)', display: 'flex', opacity: page === 0 ? 0.4 : 1 }}>
              <ChevronLeft size={14} />
            </button>
            <button onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page === pages - 1}
              style={{ padding: '4px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--color-bg-elevated)', cursor: page === pages - 1 ? 'not-allowed' : 'pointer', color: page === pages - 1 ? 'var(--text-muted)' : 'var(--text-primary)', display: 'flex', opacity: page === pages - 1 ? 0.4 : 1 }}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiagnosticosPanel;
