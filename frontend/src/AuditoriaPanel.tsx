import React, { useEffect, useState, useCallback } from 'react';
import { Shield, RefreshCw, AlertTriangle, LayoutGrid, List, ChevronLeft, ChevronRight } from 'lucide-react';

interface AuditRow {
  id: number;
  usuario_id: number;
  usuario_nombre: string;
  usuario_tipo: number;
  area_id: number | null;
  area_nombre: string;
  banco: string;
  total_banco: number;
  total_sap: number;
  tasa_conciliacion: number;
  fecha_ejecucion: string;
}

const TIPO_LABEL: Record<number, string> = { 0: 'VIP', 1: 'SA', 2: 'Admin', 3: 'Estándar' };
const BANCO_ACCENT: Record<string, string> = {
  BANCOLOMBIA: '#FFD100', BOGOTA: '#1565C0', DAVIVIENDA: '#C8102E',
};
const PAGE_SIZE = 10;

function fmt(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function tasaColor(t: number) {
  return t >= 0.9 ? 'var(--color-success)' : t >= 0.6 ? '#F5A623' : 'var(--color-error-light)';
}

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return mobile;
}

// ── Card ─────────────────────────────────────────────────────────────────────

const AuditCard: React.FC<{ r: AuditRow }> = ({ r }) => {
  const accent = BANCO_ACCENT[r.banco] ?? 'var(--color-accent-500)';
  const tasa   = (r.tasa_conciliacion * 100).toFixed(1);
  return (
    <div style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', boxShadow: 'var(--shadow-md)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ padding: '3px 10px', borderRadius: 'var(--radius-full)', background: `${accent}18`, border: `1px solid ${accent}35`, fontWeight: 700, fontSize: 'var(--text-xs)', color: accent }}>{r.banco}</span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{fmt(r.fecha_ejecucion)}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>{r.usuario_nombre || `#${r.usuario_id}`}</span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{r.area_nombre || '—'} · <span style={{ fontWeight: 700 }}>{TIPO_LABEL[r.usuario_tipo] ?? r.usuario_tipo}</span></span>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-3)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Banco</p>
          <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-secondary)' }}>{r.total_banco}</p>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>SAP</p>
          <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-secondary)' }}>{r.total_sap}</p>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tasa</p>
          <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontWeight: 800, color: tasaColor(r.tasa_conciliacion) }}>{tasa}%</p>
        </div>
      </div>
    </div>
  );
};

// ── Main ─────────────────────────────────────────────────────────────────────

const AuditoriaPanel: React.FC = () => {
  const isMobile                  = useIsMobile();
  const [rows, setRows]           = useState<AuditRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [view, setView]           = useState<'table' | 'cards'>('table');
  const [page, setPage]           = useState(1);

  const activeView = isMobile ? 'cards' : view;

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/conciliacion/auditoria/');
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setRows(await res.json());
      setPage(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const paged      = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div style={{ padding: 'var(--space-6)', width: '100%', boxSizing: 'border-box' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
        <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-lg)', background: 'rgba(245,197,24,0.12)', border: '1px solid rgba(245,197,24,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Shield size={18} style={{ color: 'var(--color-accent-500)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Trazabilidad</h2>
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Solo visible para Super Administrador</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          {!isMobile && (
            <div style={{ display: 'flex', background: 'var(--color-bg-muted)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', padding: 2 }}>
              {(['table', 'cards'] as const).map(v => (
                <button key={v} onClick={() => setView(v)} title={v === 'table' ? 'Tabla' : 'Tarjetas'} style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', background: view === v ? 'var(--color-accent-500)' : 'transparent', color: view === v ? 'var(--text-inverse)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', transition: 'all var(--duration-normal)' }}>
                  {v === 'table' ? <List size={14} /> : <LayoutGrid size={14} />}
                </button>
              ))}
            </div>
          )}
          <button onClick={load} style={{ padding: '6px 12px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-elevated)', border: '1px solid var(--border-default)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-secondary)' }}>
            <RefreshCw size={13} /> Actualizar
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: 'var(--color-error-bg)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 'var(--radius-xl)', marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-error-light)' }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} /> {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Cargando registros…</div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Sin registros aún.</div>
      ) : activeView === 'cards' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
          {paged.map(r => <AuditCard key={r.id} r={r} />)}
        </div>
      ) : (
        <div style={{ background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-default)', overflow: 'hidden', boxShadow: 'var(--shadow-md)', width: '100%' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)', textAlign: 'center' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                  {['#', 'Fecha', 'Usuario', 'Área', 'Rol', 'Banco', 'Mov. banco', 'Reg. SAP', 'Tasa'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', whiteSpace: 'nowrap', background: 'var(--color-bg-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((r, i) => {
                  const accent = BANCO_ACCENT[r.banco] ?? 'var(--color-accent-500)';
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border-subtle)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                      <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{r.id}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmt(r.fecha_ejecucion)}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-primary)', fontWeight: 600 }}>{r.usuario_nombre || `#${r.usuario_id}`}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{r.area_nombre || '—'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--color-bg-muted)', border: '1px solid var(--border-default)', fontWeight: 700, color: 'var(--text-muted)' }}>{TIPO_LABEL[r.usuario_tipo] ?? r.usuario_tipo}</span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-full)', background: `${accent}18`, border: `1px solid ${accent}35`, fontWeight: 700, color: accent }}>{r.banco}</span>
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{r.total_banco}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{r.total_sap}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: tasaColor(r.tasa_conciliacion) }}>{(r.tasa_conciliacion * 100).toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border-subtle)', fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', textAlign: 'right' }}>
            {rows.length} registro{rows.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Pagination */}
      {!loading && rows.length > PAGE_SIZE && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-5)' }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '5px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--color-bg-elevated)', cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? 'var(--text-muted)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
            <ChevronLeft size={14} />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
            <button key={n} onClick={() => setPage(n)} style={{ minWidth: 30, padding: '5px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 700, background: page === n ? 'var(--color-accent-500)' : 'var(--color-bg-elevated)', color: page === n ? 'var(--text-inverse)' : 'var(--text-secondary)' }}>
              {n}
            </button>
          ))}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '5px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--color-bg-elevated)', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: page === totalPages ? 'var(--text-muted)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default AuditoriaPanel;
