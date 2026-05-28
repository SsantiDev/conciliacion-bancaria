import React, { useState, useRef } from 'react';
import { Building2, FileSpreadsheet, ArrowRight, X, Check, Loader2, BarChart2, RotateCcw, AlertTriangle, Download } from 'lucide-react';
import { exportarInformeExcel } from './exportExcel';
import DiagnosticosPanel from './DiagnosticosPanel';
import type { DiagItem } from './DiagnosticosPanel';
import TablaComparativa from './TablaComparativa';
import type { Resultado, Totales } from './TablaComparativa';

const API_BASE = '';

// ── Config ────────────────────────────────────────────────────────────────────

const BANKS = [
  { id: 'bancolombia', name: 'Bancolombia',     accent: '#FFD100', text: '#8a6900' },
  { id: 'davivienda',  name: 'Davivienda',      accent: '#C8102E', text: '#C8102E' },
  { id: 'bogota',      name: 'Banco de Bogotá', accent: '#003087', text: '#003087' },
];

const NIVEL_COLOR: Record<string, string> = {
  EXACTO: '#16a34a', ALTO: '#2563eb', MEDIO: '#d97706', BAJO: '#9333ea', ABIERTO: '#dc2626',
};

const PROCESSING_LABELS = [
  'Cargando archivos…', 'Normalizando datos…', 'Ejecutando matching…',
  'Clasificando resultados…', 'Generando reporte…',
];

type Stage = 'select' | 'upload' | 'processing' | 'done';
interface FileInfo { file: File; name: string }
interface Resumen { total_banco: number; total_sap: number; por_nivel: Record<string, number>; tasa_conciliacion: number }
interface ApiResult { banco: string; resumen: Resumen; totales: Totales; resultados: Resultado[]; diagnosticos: DiagItem[] }

// ── Steps ─────────────────────────────────────────────────────────────────────

const Steps: React.FC<{ stage: Stage }> = ({ stage }) => {
  const stages: Stage[] = ['select', 'upload', 'processing', 'done'];
  const labels = ['Banco', 'Archivos', 'Proceso', 'Listo'];
  const idx = stages.indexOf(stage);
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-10)' }}>
      {labels.map((label, i) => (
        <React.Fragment key={label}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 64 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 'var(--text-xs)', background: i < idx ? 'var(--color-success)' : i === idx ? 'var(--color-accent-500)' : 'var(--color-bg-muted)', color: i <= idx ? '#fff' : 'var(--text-muted)', transition: 'all var(--duration-normal)' }}>
              {i < idx ? <Check size={14} /> : i + 1}
            </div>
            <span style={{ fontSize: 'var(--text-2xs)', fontWeight: 600, letterSpacing: '0.04em', color: i === idx ? 'var(--color-accent-500)' : 'var(--text-muted)' }}>{label}</span>
          </div>
          {i < labels.length - 1 && (
            <div style={{ flex: 1, height: 2, margin: '0 4px', marginBottom: 24, background: i < idx ? 'var(--color-success)' : 'var(--color-bg-muted)', transition: 'background var(--duration-slow)' }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

// ── BankCard ──────────────────────────────────────────────────────────────────

const BankCard: React.FC<{ bank: typeof BANKS[0]; selected: boolean; onClick: () => void }> = ({ bank, selected, onClick }) => (
  <button onClick={onClick} style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-xl)', textAlign: 'left', cursor: 'pointer', border: `2px solid ${selected ? bank.accent : 'var(--border-default)'}`, background: selected ? `${bank.accent}10` : 'var(--color-bg-elevated)', boxShadow: selected ? `0 0 0 3px ${bank.accent}22` : 'var(--shadow-sm)', transition: 'all var(--duration-normal) var(--ease-default)', position: 'relative', overflow: 'hidden' }}>
    {selected && <div style={{ position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: '50%', background: bank.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={12} color="#fff" /></div>}
    <div style={{ width: 42, height: 42, borderRadius: 'var(--radius-lg)', background: `${bank.accent}20`, border: `1px solid ${bank.accent}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-3)' }}>
      <Building2 size={20} style={{ color: bank.text }} />
    </div>
    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)', display: 'block', lineHeight: 1.3 }}>{bank.name}</span>
  </button>
);

// ── DropZone ──────────────────────────────────────────────────────────────────

const DropZone: React.FC<{ label: string; hint: string; file: FileInfo | null; inputRef: React.RefObject<HTMLInputElement>; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; onClear: () => void }> = ({ label, hint, file, inputRef, onChange, onClear }) => (
  <div>
    <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>{label}</label>
    <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={onChange} />
    {file ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4)', background: 'var(--color-success-bg)', border: '1.5px solid rgba(22,163,74,0.2)', borderRadius: 'var(--radius-xl)' }}>
        <FileSpreadsheet size={20} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
        <button onClick={onClear} style={{ padding: 4, borderRadius: 'var(--radius-md)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={16} /></button>
      </div>
    ) : (
      <button onClick={() => inputRef.current?.click()} style={{ width: '100%', padding: 'var(--space-6)', background: 'var(--color-bg-elevated)', border: '2px dashed var(--border-default)', borderRadius: 'var(--radius-xl)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)', transition: 'border-color var(--duration-normal)' }} onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-accent-500)')} onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}>
        <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileSpreadsheet size={20} style={{ color: 'var(--text-muted)' }} /></div>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>Seleccionar archivo</span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{hint}</span>
      </button>
    )}
  </div>
);

// ── Main ──────────────────────────────────────────────────────────────────────

const ConciliacionPage: React.FC = () => {
  const [stage, setStage]         = useState<Stage>('select');
  const [bankId, setBankId]       = useState<string | null>(null);
  const [extracto, setExtracto]   = useState<FileInfo | null>(null);
  const [sapFile, setSapFile]     = useState<FileInfo | null>(null);
  const [progress, setProgress]   = useState(0);
  const [procLabel, setProcLabel] = useState(PROCESSING_LABELS[0]);
  const [resultado, setResultado] = useState<ApiResult | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [tab, setTab]             = useState<'resumen'|'comparativa'|'diagnosticos'>('resumen');
  const extractoRef = useRef<HTMLInputElement>(null!);
  const sapRef      = useRef<HTMLInputElement>(null!);

  const bank = BANKS.find(b => b.id === bankId);

  const handleFile = (type: 'extracto' | 'sap') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    type === 'extracto' ? setExtracto({ file, name: file.name }) : setSapFile({ file, name: file.name });
  };

  const handleProcess = async () => {
    if (!extracto || !sapFile || !bankId) return;
    setStage('processing');
    setProgress(0);
    setError(null);

    let p = 0, step = 0;
    const iv = setInterval(() => {
      p = Math.min(p + Math.random() * 8 + 2, 85);
      setProgress(Math.round(p));
      setProcLabel(PROCESSING_LABELS[Math.min(step++, PROCESSING_LABELS.length - 1)]);
    }, 400);

    try {
      const form = new FormData();
      form.append('banco', bankId.toUpperCase());
      form.append('extracto', extracto.file);
      form.append('sap', sapFile.file);

      const res = await fetch(`${API_BASE}/api/conciliacion/ejecutar/`, { method: 'POST', body: form });
      clearInterval(iv);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('[API 400/500]', err);
        const parts = [
          (err as any).error,
          (err as any).detalle,
          typeof err === 'object' && !(err as any).error
            ? JSON.stringify(err)
            : null,
        ].filter(Boolean);
        throw new Error(parts.join(' — ') || `Error ${res.status}`);
      }

      const data: ApiResult = await res.json();
      setResultado(data);
      setProgress(100);
      setProcLabel('Conciliación completada');
      setTimeout(() => setStage('done'), 500);
    } catch (err) {
      clearInterval(iv);
      setError(err instanceof Error ? err.message : 'Error al procesar');
      setStage('upload');
    }
  };

  const reset = () => {
    setStage('select'); setBankId(null); setExtracto(null);
    setSapFile(null); setProgress(0); setResultado(null); setError(null); setTab('resumen');
  };

  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: tab === 'comparativa' ? '100%' : 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: 4 }}>Conciliación Bancaria</h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Selecciona el banco, carga los archivos y ejecuta el proceso de matching automático.</p>
      </div>

      <Steps stage={stage} />

      {/* ── Banco ── */}
      {stage === 'select' && (
        <div className="animate-fade-in">
          <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>Selecciona el banco</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            {BANKS.map(b => <BankCard key={b.id} bank={b} selected={bankId === b.id} onClick={() => setBankId(b.id)} />)}
          </div>
          <button className="btn-primary" style={{ width: '100%' }} disabled={!bankId} onClick={() => setStage('upload')}>
            Continuar <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* ── Archivos ── */}
      {stage === 'upload' && (
        <div className="animate-fade-in">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Banco:</span>
            <span style={{ padding: '4px 12px', borderRadius: 'var(--radius-full)', background: `${bank?.accent}15`, border: `1px solid ${bank?.accent}40`, fontSize: 'var(--text-xs)', fontWeight: 700, color: bank?.text }}>{bank?.name}</span>
          </div>
          {error && (
            <div style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-3) var(--space-4)', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-xl)', marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)', color: '#dc2626' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} /> {error}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            <DropZone label="Extracto bancario" hint=".xlsx / .csv exportado del banco" file={extracto} inputRef={extractoRef} onChange={handleFile('extracto')} onClear={() => setExtracto(null)} />
            <DropZone label="Registros SAP" hint=".xlsx / .csv exportado de SAP" file={sapFile} inputRef={sapRef} onChange={handleFile('sap')} onClear={() => setSapFile(null)} />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button className="btn-secondary" onClick={() => setStage('select')}>Atrás</button>
            <button className="btn-primary" style={{ flex: 1 }} disabled={!extracto || !sapFile} onClick={handleProcess}>
              Procesar <BarChart2 size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Procesando ── */}
      {stage === 'processing' && (
        <div className="animate-fade-in" style={{ padding: 'var(--space-12) 0', textAlign: 'center' }}>
          <Loader2 size={44} className="animate-spin" style={{ margin: '0 auto var(--space-5)', color: 'var(--color-accent-500)' }} />
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Procesando conciliación</h3>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-8)' }}>{procLabel}</p>
          <div style={{ background: 'var(--color-bg-muted)', borderRadius: 'var(--radius-full)', height: 8, overflow: 'hidden', marginBottom: 'var(--space-3)' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, var(--color-accent-500), #8b5cf6)', borderRadius: 'var(--radius-full)', transition: 'width 0.38s var(--ease-out)' }} />
          </div>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-accent-500)', fontFamily: 'var(--font-mono)' }}>{progress}%</span>
        </div>
      )}

      {/* ── Resultados ── */}
      {stage === 'done' && resultado && (
        <div className="animate-fade-in">
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-success-bg)', border: '1px solid rgba(22,163,74,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Check size={20} style={{ color: 'var(--color-success)' }} />
            </div>
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Conciliación lista — {resultado.banco}</h3>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
                {resultado.resumen.total_banco} mov. banco · {resultado.resumen.total_sap} reg. SAP · tasa {(resultado.resumen.tasa_conciliacion * 100).toFixed(1)}%
              </p>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
              <button onClick={() => exportarInformeExcel(resultado!)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 'var(--radius-full)', border: '1.5px solid #16a34a', background: '#f0fdf4', color: '#16a34a', fontSize: 'var(--text-xs)', fontWeight: 700, cursor: 'pointer' }}>
                <Download size={14} /> Exportar Excel
              </button>
              <button className="btn-ghost" onClick={reset} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <RotateCcw size={14} /> Nueva
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border-default)', marginBottom: 'var(--space-5)' }}>
            {([
              { key: 'resumen',      label: 'Resumen' },
              { key: 'comparativa',  label: `Comparativa (${resultado.resumen.total_banco})` },
              { key: 'diagnosticos', label: `Diagnósticos (${resultado.diagnosticos.length})` },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '8px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 700, color: tab === t.key ? 'var(--color-accent-500)' : 'var(--text-muted)', borderBottom: tab === t.key ? '2px solid var(--color-accent-500)' : '2px solid transparent', marginBottom: -2, transition: 'all var(--duration-normal)' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab: Resumen */}
          {tab === 'resumen' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
                {[
                  { label: 'Tasa conciliación', value: `${(resultado.resumen.tasa_conciliacion * 100).toFixed(1)}%`, color: 'var(--color-success)' },
                  { label: 'Movimientos banco', value: String(resultado.resumen.total_banco) },
                  { label: 'Registros SAP',     value: String(resultado.resumen.total_sap) },
                ].map(m => (
                  <div key={m.label} style={{ padding: 'var(--space-4)', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-default)', textAlign: 'center' }}>
                    <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: m.color ?? 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{m.value}</div>
                    <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>{m.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-default)', overflow: 'hidden' }}>
                {Object.entries(resultado.resumen.por_nivel).map(([nivel, count]) => {
                  const pct = resultado.resumen.total_banco > 0 ? (count / resultado.resumen.total_banco) * 100 : 0;
                  return (
                    <div key={nivel} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-default)' }}>
                      <span style={{ width: 72, fontSize: 'var(--text-xs)', fontWeight: 700, color: NIVEL_COLOR[nivel] ?? 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{nivel}</span>
                      <div style={{ flex: 1, height: 6, background: 'var(--color-bg-muted)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: NIVEL_COLOR[nivel] ?? 'var(--color-accent-500)', borderRadius: 'var(--radius-full)' }} />
                      </div>
                      <span style={{ width: 36, textAlign: 'right', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab: Comparativa */}
          {tab === 'comparativa' && (
            <TablaComparativa resultados={resultado.resultados} totales={resultado.totales} banco={resultado.banco} />
          )}

          {/* Tab: Diagnósticos */}
          {tab === 'diagnosticos' && (
            <DiagnosticosPanel diagnosticos={resultado.diagnosticos} />
          )}
        </div>
      )}
    </div>
  );
};

export default ConciliacionPage;
