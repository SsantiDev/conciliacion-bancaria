import React, { useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import { BANK_SCHEMAS } from './bankConfig';

interface Props {
  bankId:     string;
  bankAccent: string;
}

const BankGuidePanel: React.FC<Props> = ({ bankId, bankAccent }) => {
  const [open, setOpen] = useState(false);
  const [tab,  setTab]  = useState<'extracto' | 'sap'>('extracto');
  const config = BANK_SCHEMAS[bankId];
  if (!config) return null;
  const guide = tab === 'extracto' ? config.extractoGuide : config.sapGuide;

  return (
    <div style={{ borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-default)', overflow: 'hidden', marginTop: 'var(--space-2)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', background: 'var(--color-bg-elevated)', border: 'none', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'left' }}
      >
        <Info size={13} style={{ color: bankAccent, flexShrink: 0 }} />
        <span style={{ flex: 1 }}>Estructura esperada de archivos</span>
        <ChevronDown size={14} style={{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {open && (
        <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)', background: 'var(--color-bg-muted)' }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 'var(--space-3)' }}>
            {(['extracto', 'sap'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ padding: '4px 12px', borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 700, background: tab === t ? bankAccent : 'var(--color-bg-elevated)', color: tab === t ? '#000' : 'var(--text-muted)', transition: 'all 0.15s' }}>
                {t === 'extracto' ? 'Extracto bancario' : 'SAP'}
              </button>
            ))}
          </div>

          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>{guide.description}</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-3)', padding: '4px 0', borderBottom: '1px solid var(--border-default)' }}>
              <span style={{ minWidth: 180, fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Columna</span>
              <span style={{ flex: 1, fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ejemplo</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Req.</span>
            </div>
            {guide.columns.map(col => (
              <div key={col.name} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'baseline', padding: '5px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ minWidth: 180, fontSize: 'var(--text-xs)', fontWeight: 700, color: col.required ? 'var(--text-primary)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{col.name}</span>
                <span style={{ flex: 1, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{col.example}</span>
                <span style={{ fontSize: 10, color: col.required ? 'var(--color-success)' : 'var(--text-muted)', fontWeight: 700 }}>{col.required ? '✓' : '—'}</span>
              </div>
            ))}
          </div>

          {guide.notes.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 'var(--space-4)', listStyle: 'disc' }}>
              {guide.notes.map(n => (
                <li key={n} style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2, lineHeight: 1.5 }}>{n}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default BankGuidePanel;
