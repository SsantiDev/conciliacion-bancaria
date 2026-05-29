import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Download, Search, Check, AlertTriangle, X, ChevronDown } from 'lucide-react';
import { exportarInformeExcelFiltrado } from './exportExcel';

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

interface Props { resultados: Resultado[]; totales: Totales; banco: string; onExportCompleto: () => void }

// ── Config ────────────────────────────────────────────────────────────────────

const NIVEL_CFG = {
  CONCILIADO: { label: 'Conciliado', color: '#4ade80', bg: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.25)' },
  PENDIENTE:  { label: 'Pendiente',  color: '#facc15', bg: 'rgba(245, 166, 35, 0.12)', border: 'rgba(245, 166, 35, 0.25)' },
  ABIERTO:    { label: 'Abierto',    color: '#f87171', bg: 'rgba(248, 113, 113, 0.12)', border: 'rgba(248, 113, 113, 0.25)' },
} as const;

const cop = (n: number | null) =>
  n == null ? '—' : n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

// ── Componente ────────────────────────────────────────────────────────────────

const TablaComparativa: React.FC<Props> = ({ resultados, totales, banco, onExportCompleto }) => {
  const [filtro, setFiltro]           = useState<'TODOS'|'CONCILIADO'|'PENDIENTE'|'ABIERTO'>('TODOS');
  const [busqueda, setBusqueda]       = useState('');
  const [pagina, setPagina]           = useState(0);
  const [pageSize, setPageSize]       = useState(10);
  const [ocultarAbiertos, setOcultar] = useState(false);
  const [menuOpen, setMenuOpen]       = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

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

  const pages = Math.ceil(filtered.length / pageSize);
  const slice = filtered.slice(pagina * pageSize, (pagina + 1) * pageSize);
  const cambiarFiltro = (f: typeof filtro) => { setFiltro(f); setPagina(0); };

  const esExportCompleto = filtro === 'TODOS' && !busqueda.trim() && !ocultarAbiertos;

  const filtroNombre = useMemo(() => {
    if (busqueda.trim()) return `Búsqueda "${busqueda.trim()}"`;
    if (filtro !== 'TODOS') return NIVEL_CFG[filtro].label;
    if (ocultarAbiertos) return 'Sin abiertos';
    return 'Todos';
  }, [filtro, busqueda, ocultarAbiertos]);

  const pageButtons = useMemo(() => {
    const buttons: (number | 'ellipsis')[] = [];
    const safePagina = Math.min(pagina, Math.max(0, pages - 1));
    if (pages <= 6) {
      for (let i = 0; i < pages; i++) {
        buttons.push(i);
      }
    } else {
      if (safePagina < 4) {
        buttons.push(0, 1, 2, 3, 4, 'ellipsis', pages - 1);
      } else if (safePagina >= pages - 4) {
        buttons.push(0, 'ellipsis', pages - 5, pages - 4, pages - 3, pages - 2, pages - 1);
      } else {
        buttons.push(0, 'ellipsis', safePagina - 1, safePagina, safePagina + 1, 'ellipsis', pages - 1);
      }
    }
    return buttons;
  }, [pages, pagina]);

  return (
    <div>
      {/* Totales */}
      <div className="kpi-grid" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
        {[
          { label: 'Total banco',  value: cop(totales.suma_banco), sub: `${totales.conciliados} conciliados` },
          { label: 'Diferencia',   value: cop(totales.diferencia), sub: `${totales.pendientes} pendientes`, color: totales.diferencia <= 2000 ? 'var(--color-success)' : 'var(--color-error-light)' },
          { label: 'Total SAP',    value: cop(totales.suma_sap),   sub: `${totales.abiertos} abiertos` },
        ].map(m => (
          <div key={m.label} style={{ padding: 'var(--space-4)', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: m.color ?? 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{m.value}</div>
            <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>{m.label} · <span style={{ color: 'var(--text-secondary)' }}>{m.sub}</span></div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
        {(['TODOS','CONCILIADO','PENDIENTE','ABIERTO'] as const).map(f => {
          const cnt = f === 'TODOS' ? resultados.length : totales[`${f.toLowerCase()}s` as 'conciliados'|'pendientes'|'abiertos'];
          const active = filtro === f;
          return (
            <button key={f} onClick={() => cambiarFiltro(f)} style={{ padding: '6px 14px', borderRadius: 'var(--radius-full)', border: `1.5px solid ${active ? 'var(--color-accent-500)' : 'var(--border-default)'}`, background: active ? 'var(--color-accent-500)' : 'var(--color-bg-elevated)', color: active ? 'var(--text-inverse)' : 'var(--text-muted)', fontSize: 'var(--text-xs)', fontWeight: 700, cursor: 'pointer', transition: 'all var(--duration-fast)', boxShadow: active ? '0 2px 8px rgba(245, 197, 24, 0.15)' : 'none' }} onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = 'var(--border-strong)'; }} onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = 'var(--border-default)'; }}>
              {f === 'TODOS' ? `Todos (${cnt})` : `${NIVEL_CFG[f].label} (${cnt})`}
            </button>
          );
        })}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '5px 12px', borderRadius: 'var(--radius-full)', border: `1.5px solid ${ocultarAbiertos ? 'var(--color-error)' : 'var(--border-default)'}`, background: ocultarAbiertos ? 'var(--color-error-bg)' : 'var(--color-bg-elevated)', fontSize: 'var(--text-xs)', fontWeight: 600, color: ocultarAbiertos ? 'var(--color-error-light)' : 'var(--text-muted)', userSelect: 'none', transition: 'all var(--duration-fast)' }}>
          <input type="checkbox" checked={ocultarAbiertos} onChange={e => { setOcultar(e.target.checked); setPagina(0); }} style={{ accentColor: 'var(--color-error)', cursor: 'pointer' }} />
          Ocultar sin match ({abiertosCount})
        </label>
        <div style={{ flex: 1, position: 'relative', minWidth: 180 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input value={busqueda} onChange={e => { setBusqueda(e.target.value); setPagina(0); }} placeholder="Buscar descripción, ref, doc…" style={{ width: '100%', paddingLeft: 30, paddingRight: 10, height: 32, borderRadius: 'var(--radius-full)', border: '1px solid var(--border-default)', background: 'var(--color-bg-elevated)', fontSize: 'var(--text-xs)', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none', transition: 'all var(--duration-fast)' }} onFocus={e => e.currentTarget.style.borderColor = 'var(--color-accent-500)'} onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'} />
        </div>
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 'var(--radius-full)', border: '1.5px solid var(--color-accent-500)', background: menuOpen ? 'rgba(245,197,24,0.12)' : 'transparent', color: 'var(--color-accent-500)', fontSize: 'var(--text-xs)', fontWeight: 700, cursor: 'pointer', transition: 'all var(--duration-fast)' }}
            onMouseEnter={e => { if (!menuOpen) e.currentTarget.style.background = 'rgba(245,197,24,0.08)'; }}
            onMouseLeave={e => { if (!menuOpen) e.currentTarget.style.background = 'transparent'; }}
          >
            <Download size={13} /> Exportar Excel <ChevronDown size={12} style={{ transition: 'transform var(--duration-fast)', transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
          </button>
          {menuOpen && (
            <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 50, background: 'var(--color-bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', minWidth: 220, overflow: 'hidden' }}>
              <button
                onClick={() => { onExportCompleto(); setMenuOpen(false); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'left' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <Download size={12} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                <span>Reporte completo</span>
              </button>
              {!esExportCompleto && (
                <button
                  onClick={() => { exportarInformeExcelFiltrado(filtered, filtroNombre, banco); setMenuOpen(false); }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'transparent', border: 'none', borderTop: '1px solid var(--border-subtle)', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'left' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <Download size={12} style={{ color: 'var(--color-accent-500)', flexShrink: 0 }} />
                  <span>Vista actual — {filtered.length} reg.</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Controles de Paginación y Mostrar Registros en la Parte Superior */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', gap: 'var(--space-4)', flexWrap: 'wrap', background: 'var(--color-bg-elevated)', padding: '10px 16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
        {/* Selector de cantidad */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>Mostrar:</span>
          {([10, 25, 50] as const).map(sz => {
            const active = pageSize === sz;
            return (
              <button key={sz} onClick={() => { setPageSize(sz); setPagina(0); }} style={{ padding: '4px 10px', borderRadius: 'var(--radius-md)', border: `1.5px solid ${active ? 'var(--color-accent-500)' : 'var(--border-default)'}`, background: active ? 'var(--color-accent-500)' : 'transparent', color: active ? 'var(--text-inverse)' : 'var(--text-muted)', fontSize: 'var(--text-xs)', fontWeight: 700, cursor: 'pointer', transition: 'all var(--duration-fast)' }}>
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
              {pagina * pageSize + 1}–{Math.min((pagina + 1) * pageSize, filtered.length)} de {filtered.length}
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
                const active = pagina === btn;
                return (
                  <button
                    key={btn}
                    onClick={() => setPagina(btn)}
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
            {filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}
          </span>
        )}
      </div>

      {/* ── Mobile: cards por fila ── */}
      <div className="comparativa-mobile-cards" style={{ marginBottom: 'var(--space-4)' }}>
        {slice.length === 0 ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Sin resultados para este filtro.</div>
        ) : slice.map((r) => {
          const cfg     = NIVEL_CFG[r.nivel_negocio as keyof typeof NIVEL_CFG] ?? NIVEL_CFG.ABIERTO;
          const montoOk = r.delta_monto == null || r.delta_monto <= 2000;
          const diasOk  = r.delta_dias  == null || r.delta_dias  <= 1;
          return (
            <div key={r.banco_idx} style={{ background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-xl)', border: `1.5px solid ${cfg.border}`, overflow: 'hidden', marginBottom: 'var(--space-3)' }}>
              {/* Estado header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: cfg.bg, borderBottom: `1px solid ${cfg.border}` }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 'var(--radius-full)', border: `1px solid ${cfg.border}`, color: cfg.color, fontSize: 'var(--text-xs)', fontWeight: 700 }}>
                  {r.nivel_negocio === 'CONCILIADO' ? <Check size={11} strokeWidth={3} /> : r.nivel_negocio === 'PENDIENTE' ? <AlertTriangle size={11} strokeWidth={2.5} /> : <X size={11} strokeWidth={3} />}
                  {cfg.label}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {r.delta_monto != null && r.delta_monto !== 0 && (
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: montoOk ? 'var(--color-success-bg)' : 'var(--color-error-bg)', color: montoOk ? 'var(--color-success)' : 'var(--color-error-light)', fontWeight: 700 }}>Dif. $</span>
                  )}
                  {r.delta_dias != null && r.delta_dias !== 0 && (
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: diasOk ? 'var(--color-success-bg)' : 'var(--color-warning-bg)', color: diasOk ? 'var(--color-success)' : 'var(--color-warning)', fontWeight: 700 }}>{r.delta_dias}d</span>
                  )}
                </div>
              </div>
              {/* Banco */}
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${cfg.border}` }}>
                <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-info)', marginBottom: 4 }}>Banco</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{cop(r.banco_monto)}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, color: r.banco_tipo === 'CR' ? 'var(--color-success)' : 'var(--color-error)', fontFamily: 'var(--font-mono)' }}>{r.banco_tipo}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{r.banco_fecha ?? '—'}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--slate-300)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.banco_desc}>{r.banco_desc}</div>
              </div>
              {/* SAP */}
              <div style={{ padding: '10px 14px' }}>
                <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-success)', marginBottom: 4 }}>SAP</div>
                {r.sap_idx != null ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: montoOk ? 'var(--text-primary)' : 'var(--color-error-light)', fontFamily: 'var(--font-mono)' }}>{cop(r.sap_monto)}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{r.sap_fecha ?? '—'}</span>
                      {r.sap_num_doc && <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>Doc: {r.sap_num_doc}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--slate-300)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.sap_desc ?? '—'}</div>
                  </>
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin registro en SAP</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Desktop: tabla completa ── */}
      <div className="comparativa-table-desktop scrollbar-custom" style={{ overflowX: 'auto', width: '100%', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-md)', marginBottom: 'var(--space-4)' }}>
        <div style={{ minWidth: '1120px' }}>
          
          {/* Cabeceras de las dos tablas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr', gap: 0, borderBottom: '1px solid var(--border-default)' }}>
            <div style={{ padding: '10px 14px', background: 'rgba(107, 127, 212, 0.15)', borderRight: '1px solid var(--border-default)', textAlign: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-primary)' }}>Extracto bancario — {banco}</span>
            </div>
            <div style={{ background: 'var(--color-bg-elevated)', borderRight: '1px solid var(--border-default)' }} />
            <div style={{ padding: '10px 14px', background: 'rgba(34, 197, 94, 0.15)', textAlign: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-primary)' }}>SAP — Libro mayor</span>
            </div>
          </div>

          {/* Sub-cabeceras de columnas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr', background: 'var(--color-bg-secondary)', borderBottom: '2px solid var(--border-default)' }}>
            {/* Banco cols */}
            <div style={{ display: 'grid', gridTemplateColumns: '90px 110px 1fr 85px', borderRight: '1px solid var(--border-default)' }}>
              {['Fecha', 'Monto', 'Descripción', 'Tipo'].map(h => (
                <div key={h} style={{ padding: '8px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', textAlign: 'center' }}>{h}</div>
              ))}
            </div>
            {/* Centro */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid var(--border-default)', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '8px 10px' }}>
              <span>Estado / Dif.</span>
            </div>
            {/* SAP cols */}
            <div style={{ display: 'grid', gridTemplateColumns: '90px 110px 1fr 85px' }}>
              {['Fecha', 'Monto', 'Descripción', 'Doc SAP'].map(h => (
                <div key={h} style={{ padding: '8px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', textAlign: 'center' }}>{h}</div>
              ))}
            </div>
          </div>

          {/* Filas de datos */}
          {slice.length === 0 ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', background: 'var(--color-bg-elevated)' }}>Sin resultados para este filtro.</div>
          ) : slice.map((r, i) => {
            const cfg = NIVEL_CFG[r.nivel_negocio as keyof typeof NIVEL_CFG] ?? NIVEL_CFG.ABIERTO;
            const rowBg = i % 2 ? 'rgba(255,255,255,0.015)' : 'transparent';
            const montoOk = r.delta_monto == null || r.delta_monto <= 2000;
            const diasOk  = r.delta_dias == null || r.delta_dias <= 1;

            return (
              <div key={r.banco_idx} className="comparativa-row" style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr', background: rowBg, borderBottom: '1px solid var(--border-subtle)' }}>
                
                {/* ── LADO BANCO ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '90px 110px 1fr 85px', borderRight: `2px solid ${cfg.border}`, alignItems: 'center' }}>
                  <span style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', textAlign: 'center' }}>{r.banco_fecha ?? '—'}</span>
                  <span style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', textAlign: 'center' }}>{cop(r.banco_monto)}</span>
                  <span style={{ padding: '8px 10px', fontSize: 11, color: 'var(--slate-300)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }} title={r.banco_desc}>{r.banco_desc}</span>
                  <span style={{ padding: '8px 10px', fontSize: 10, fontWeight: 800, color: r.banco_tipo === 'CR' ? 'var(--color-success)' : 'var(--color-error)', textAlign: 'center' }}>{r.banco_tipo}</span>
                </div>

                {/* ── CENTRO: estado + deltas ── */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px 4px', borderRight: `2px solid ${cfg.border}`, background: 'rgba(255,255,255,0.005)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, fontSize: 9, fontWeight: 700 }}>
                    {r.nivel_negocio === 'CONCILIADO' ? <Check size={9} strokeWidth={3} /> : r.nivel_negocio === 'PENDIENTE' ? <AlertTriangle size={9} strokeWidth={2.5} /> : <X size={9} strokeWidth={3} />}
                    {cfg.label}
                  </span>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {r.delta_monto != null && r.delta_monto !== 0 && (
                      <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: montoOk ? 'var(--color-success-bg)' : 'var(--color-error-bg)', color: montoOk ? 'var(--color-success)' : 'var(--color-error-light)', fontWeight: 700, fontFamily: 'var(--font-mono)' }} title={`Diferencia monto: ${cop(r.delta_monto)}`}>
                        Dif. $
                      </span>
                    )}
                    {r.delta_dias != null && r.delta_dias !== 0 && (
                      <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: diasOk ? 'var(--color-success-bg)' : 'var(--color-warning-bg)', color: diasOk ? 'var(--color-success)' : 'var(--color-warning)', fontWeight: 700, fontFamily: 'var(--font-mono)' }} title={`Diferencia días: ${r.delta_dias}d`}>
                        {r.delta_dias}d
                      </span>
                    )}
                  </div>
                </div>

                {/* ── LADO SAP ── */}
                {r.sap_idx != null ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '90px 110px 1fr 85px', alignItems: 'center' }}>
                    <span style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', textAlign: 'center' }}>{r.sap_fecha ?? '—'}</span>
                    <span style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, color: montoOk ? 'var(--text-primary)' : 'var(--color-error-light)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', textAlign: 'center' }}>{cop(r.sap_monto)}</span>
                    <span style={{ padding: '8px 10px', fontSize: 11, color: 'var(--slate-300)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }} title={r.sap_desc ?? ''}>{r.sap_desc ?? '—'}</span>
                    <span style={{ padding: '8px 10px', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>{r.sap_num_doc ?? '—'}</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '8px' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center' }}>Sin registro en SAP</span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Footer totales */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr', background: 'var(--color-bg-secondary)', borderTop: '2px solid var(--border-default)', fontWeight: 700 }}>
            {/* Banco totals */}
            <div style={{ display: 'grid', gridTemplateColumns: '90px 110px 1fr 85px', borderRight: '2px solid var(--border-default)', alignItems: 'center' }}>
              <span style={{ padding: '10px 10px', fontSize: 11, color: 'var(--text-primary)', fontWeight: 800, textAlign: 'center' }}>TOTAL</span>
              <span style={{ padding: '10px 10px', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', textAlign: 'center' }}>{cop(totales.suma_banco)}</span>
              <span style={{ padding: '10px 10px', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }} />
              <span />
            </div>
            {/* Middle cell */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '2px solid var(--border-default)', background: 'rgba(255,255,255,0.005)' }}>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: totales.diferencia <= 2000 ? 'var(--color-success)' : 'var(--color-error-light)', fontWeight: 800 }}>Dif.</span>
            </div>
            {/* SAP totals */}
            <div style={{ display: 'grid', gridTemplateColumns: '90px 110px 1fr 85px', alignItems: 'center' }}>
              <span style={{ padding: '10px 10px', fontSize: 11, color: 'var(--text-primary)', fontWeight: 800, textAlign: 'center' }}>TOTAL</span>
              <span style={{ padding: '10px 10px', fontSize: 11, fontFamily: 'var(--font-mono)', color: totales.diferencia <= 2000 ? 'var(--color-success)' : 'var(--color-error-light)', textAlign: 'center' }}>{cop(totales.suma_sap)}</span>
              <span style={{ padding: '10px 10px', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>Dif. {cop(totales.diferencia)}</span>
              <span />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default TablaComparativa;
