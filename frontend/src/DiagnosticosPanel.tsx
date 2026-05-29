import React, { useState, useMemo } from 'react';
import { AlertTriangle, Copy } from 'lucide-react';

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
    color: '#60a5fa', // blue-400
    bg: 'rgba(59, 130, 246, 0.12)',
    border: 'rgba(59, 130, 246, 0.3)',
    icon: <AlertTriangle size={14} />,
    acciones: ['Marcar en tránsito', 'Marcar anulada'],
  },
  DUPLICADO: {
    label: 'Duplicado',
    color: '#c084fc', // purple-400
    bg: 'rgba(168, 85, 247, 0.12)',
    border: 'rgba(168, 85, 247, 0.3)',
    icon: <Copy size={14} />,
    acciones: ['Marcar duplicado'],
  },
} as const;

type CatKey = keyof typeof CAT;
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
  const [pageSize, setPageSize] = useState(10);

  const items = grouped[tab];
  const pages = Math.ceil(items.length / pageSize);
  const slice = items.slice(page * pageSize, (page + 1) * pageSize);
  const cfg   = CAT[tab];

  const handleTab = (k: CatKey) => { setTab(k); setPage(0); };

  const pageButtons = useMemo(() => {
    const buttons: (number | 'ellipsis')[] = [];
    const safePage = Math.min(page, Math.max(0, pages - 1));
    if (pages <= 6) {
      for (let i = 0; i < pages; i++) {
        buttons.push(i);
      }
    } else {
      if (safePage < 4) {
        buttons.push(0, 1, 2, 3, 4, 'ellipsis', pages - 1);
      } else if (safePage >= pages - 4) {
        buttons.push(0, 'ellipsis', pages - 5, pages - 4, pages - 3, pages - 2, pages - 1);
      } else {
        buttons.push(0, 'ellipsis', safePage - 1, safePage, safePage + 1, 'ellipsis', pages - 1);
      }
    }
    return buttons;
  }, [pages, page]);

  if (diagnosticos.length === 0) return null;

  return (
    <div style={{ marginTop: 'var(--space-6)' }}>
      {/* Category cards */}
      <div className="diag-cat-grid" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
        {cats.map(k => {
          const c = CAT[k];
          const count = grouped[k].length;
          const active = tab === k;
          const disabled = count === 0;
          return (
            <button
              key={k}
              onClick={() => !disabled && handleTab(k)}
              style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-xl)', border: `1.5px solid ${active ? c.color : disabled ? 'var(--border-subtle)' : 'var(--border-default)'}`, background: active ? c.bg : 'var(--color-bg-elevated)', cursor: disabled ? 'default' : 'pointer', textAlign: 'left', transition: 'all var(--duration-normal)', opacity: disabled ? 0.45 : 1, boxShadow: active ? `0 0 0 3px ${c.color}20, 0 4px 16px ${c.color}15` : 'var(--shadow-sm)', width: '100%' }}
              onMouseEnter={e => { if (!active && !disabled) { e.currentTarget.style.borderColor = c.color; e.currentTarget.style.background = c.bg; } }}
              onMouseLeave={e => { if (!active && !disabled) { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.background = 'var(--color-bg-elevated)'; } }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                <span style={{ color: active ? c.color : 'var(--text-muted)', display: 'flex' }}>{c.icon}</span>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: active ? c.color : 'var(--text-muted)' }}>{c.label}</span>
              </div>
              <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 900, color: active ? c.color : 'var(--text-secondary)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{count}</div>
              <div style={{ fontSize: 'var(--text-2xs)', color: active ? c.color : 'var(--text-muted)', marginTop: 'var(--space-1)', fontWeight: 600 }}>{count === 1 ? 'registro' : 'registros'}</div>
            </button>
          );
        })}
      </div>

      {/* Controles de Paginación y Mostrar Registros en la Parte Superior */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', gap: 'var(--space-4)', flexWrap: 'wrap', background: 'var(--color-bg-elevated)', padding: '10px 16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
        {/* Selector de cantidad */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>Mostrar:</span>
          {([10, 25, 50] as const).map(sz => {
            const active = pageSize === sz;
            return (
              <button key={sz} onClick={() => { setPageSize(sz); setPage(0); }} style={{ padding: '4px 10px', borderRadius: 'var(--radius-md)', border: `1.5px solid ${active ? 'var(--color-accent-500)' : 'var(--border-default)'}`, background: active ? 'var(--color-accent-500)' : 'transparent', color: active ? 'var(--text-inverse)' : 'var(--text-muted)', fontSize: 'var(--text-xs)', fontWeight: 700, cursor: 'pointer', transition: 'all var(--duration-fast)' }}>
                {sz}
              </button>
            );
          })}
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginLeft: 4 }}>filas</span>
        </div>

        {/* Info y Botones de Página */}
        {pages > 1 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              {page * pageSize + 1}–{Math.min((page + 1) * pageSize, items.length)} de {items.length}
            </span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {pageButtons.map((btn, index) => {
                if (btn === 'ellipsis') {
                  return (
                    <span
                      key={`ellipsis-${index}`}
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-muted)',
                        alignSelf: 'center',
                        padding: '0 4px',
                        userSelect: 'none'
                      }}
                    >
                      …
                    </span>
                  );
                }
                const active = page === btn;
                return (
                  <button
                    key={btn}
                    onClick={() => setPage(btn)}
                    className={`page-btn ${active ? 'active' : ''}`}
                  >
                    {btn + 1}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
            {items.length} {items.length === 1 ? 'registro' : 'registros'}
          </span>
        )}
      </div>

      {/* ── Mobile: cards ── */}
      <div className="comparativa-mobile-cards" style={{ marginBottom: 'var(--space-4)' }}>
        {slice.length === 0 ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Sin items.</div>
        ) : slice.map((item, i) => (
          <div key={i} style={{ background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-xl)', border: `1.5px solid ${cfg.border}`, overflow: 'hidden', marginBottom: 'var(--space-3)' }}>
            {/* Header: categoría + monto */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: cfg.bg, borderBottom: `1px solid ${cfg.border}` }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: cfg.color, fontSize: 'var(--text-xs)', fontWeight: 700 }}>
                {cfg.icon} {cfg.label}
              </span>
              <span style={{ fontSize: 12, fontWeight: 800, color: cfg.color, fontFamily: 'var(--font-mono)' }}>{fmt(item.monto)}</span>
            </div>
            {/* Detalle */}
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${cfg.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{item.fecha ?? '—'}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--slate-300)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }} title={item.descripcion ?? ''}>{item.descripcion ?? '—'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{item.motivo}</div>
            </div>
            {/* Acciones */}
            <div style={{ padding: '8px 14px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {cfg.acciones.map(accion => (
                <button key={accion} style={{ fontSize: 10, padding: '4px 12px', borderRadius: 'var(--radius-full)', border: `1px solid ${cfg.color}30`, background: 'rgba(255,255,255,0.02)', color: cfg.color, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all var(--duration-fast)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${cfg.color}15`; e.currentTarget.style.borderColor = `${cfg.color}50`; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = `${cfg.color}30`; }}>
                  {accion}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Desktop: tabla ── */}
      <div className="comparativa-table-desktop scrollbar-custom" style={{ overflowX: 'auto', width: '100%', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ minWidth: '850px' }}>
          
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '100px 120px 1fr 2fr', gap: 'var(--space-3)', padding: '10px 16px', background: 'var(--color-bg-muted)', borderBottom: '2px solid var(--border-default)' }}>
            {['Fecha', 'Monto', 'Descripción', 'Diagnóstico / Acción'].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>{h}</span>
            ))}
          </div>

          {/* Filas */}
          {slice.length === 0 ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', background: 'var(--color-bg-elevated)' }}>Sin items.</div>
          ) : slice.map((item, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '100px 120px 1fr 2fr', gap: 'var(--space-3)', padding: '12px 16px', borderBottom: i < slice.length - 1 ? '1px solid var(--border-subtle)' : 'none', alignItems: 'start', background: i % 2 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', paddingTop: 2 }}>
                {item.fecha ?? '—'}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', paddingTop: 2 }}>
                {fmt(item.monto)}
              </span>
              <span style={{ fontSize: 11, color: 'var(--slate-300)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingTop: 2 }} title={item.descripcion ?? ''}>
                {item.descripcion ?? '—'}
              </span>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 8, lineHeight: 1.4 }}>
                  {item.motivo}
                </span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {cfg.acciones.map(accion => (
                    <button key={accion} style={{ fontSize: 10, padding: '4px 12px', borderRadius: 'var(--radius-full)', border: `1px solid ${cfg.color}30`, background: 'rgba(255, 255, 255, 0.02)', color: cfg.color, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all var(--duration-fast)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = `${cfg.color}15`; e.currentTarget.style.borderColor = `${cfg.color}50`; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'; e.currentTarget.style.borderColor = `${cfg.color}30`; }}>
                      {accion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
          
        </div>
      </div>
    </div>
  );
};

export default DiagnosticosPanel;
