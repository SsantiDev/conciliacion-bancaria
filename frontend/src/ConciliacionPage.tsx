import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import { Building2, FileSpreadsheet, ArrowRight, X, Check, BarChart2, RotateCcw, AlertTriangle, Shield } from 'lucide-react';
import { exportarInformeExcel } from './exportExcel';
import DiagnosticosPanel from './DiagnosticosPanel';
import type { DiagItem } from './DiagnosticosPanel';
import TablaComparativa from './TablaComparativa';
import type { Resultado, Totales } from './TablaComparativa';
import BankGuidePanel from './BankGuidePanel';
import { BANK_SCHEMAS } from './bankConfig';
import { getCurrentUser } from './userContext';
import AuditoriaPanel from './AuditoriaPanel';

const API_BASE = '';

// 🇨🇴 amarillo · azul · rojo
const BANKS = [
  { id: 'bancolombia', name: 'Bancolombia',     accent: '#FFD100', text: '#FFD100' },
  { id: 'bogota',      name: 'Banco de Bogotá', accent: '#1565C0', text: '#90CAF9' },
  { id: 'davivienda',  name: 'Davivienda',      accent: '#C8102E', text: '#FF8A80' },
];

const NIVEL_COLOR: Record<string, string> = {
  EXACTO: '#22c55e', ALTO: '#6B7FD4', MEDIO: '#F5A623', BAJO: '#a78bfa', ABIERTO: '#f87171',
};

const PROCESSING_LABELS = [
  'Cargando archivos…', 'Normalizando datos…', 'Ejecutando matching…',
  'Clasificando resultados…', 'Generando reporte…',
];

const STEP_INFO = [
  { key: 'select',     label: 'Selección de banco',  desc: 'Elige tu entidad bancaria' },
  { key: 'upload',     label: 'Carga de archivos',   desc: 'Extracto bancario y SAP' },
  { key: 'processing', label: 'Procesamiento',        desc: 'Matching automático' },
  { key: 'done',       label: 'Resultados',           desc: 'Informe de conciliación' },
] as const;

type Stage = 'select' | 'upload' | 'processing' | 'done';
interface FileInfo { file: File; name: string }
interface Resumen { total_banco: number; total_sap: number; por_nivel: Record<string, number>; tasa_conciliacion: number }
interface ApiResult { banco: string; resumen: Resumen; totales: Totales; resultados: Resultado[]; diagnosticos: DiagItem[] }

// ── Sidebar Steps ─────────────────────────────────────────────────────────────

const SidebarSteps: React.FC<{ stage: Stage }> = ({ stage }) => {
  const stages: Stage[] = ['select', 'upload', 'processing', 'done'];
  const idx = stages.indexOf(stage);
  return (
    <nav style={{ flex: 1, padding: 'var(--space-6) var(--space-5)', overflowY: 'auto' }}>
      {STEP_INFO.map(({ key, label, desc }, i) => {
        const done = i < idx, active = i === idx;
        return (
          <div key={key} style={{ display: 'flex', gap: 'var(--space-3)', position: 'relative' }}>
            {i < STEP_INFO.length - 1 && (
              <div style={{ position: 'absolute', left: 15, top: 34, width: 2, bottom: 0, background: done ? 'var(--color-success)' : 'var(--color-bg-muted)', transition: 'background var(--duration-slow)' }} />
            )}
            <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, background: done ? 'var(--color-success)' : active ? 'var(--color-accent-500)' : 'var(--color-bg-muted)', color: done ? '#fff' : active ? 'var(--text-inverse)' : 'var(--text-muted)', boxShadow: active ? '0 0 14px rgba(245,197,24,0.4)' : 'none', transition: 'all var(--duration-slow)' }}>
              {done ? <Check size={14} strokeWidth={3} /> : i + 1}
            </div>
            <div style={{ paddingBottom: i < STEP_INFO.length - 1 ? 'var(--space-7)' : 0 }}>
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 700, color: active ? 'var(--color-accent-500)' : done ? 'var(--text-primary)' : 'var(--text-muted)', transition: 'color var(--duration-normal)' }}>{label}</p>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>{desc}</p>
            </div>
          </div>
        );
      })}
    </nav>
  );
};

// ── BankCard ──────────────────────────────────────────────────────────────────

const BankCard: React.FC<{ bank: typeof BANKS[0]; selected: boolean; onClick: () => void }> = ({ bank, selected, onClick }) => (
  <button onClick={onClick} style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-xl)', textAlign: 'left', cursor: 'pointer', width: '100%', border: `1.5px solid ${selected ? bank.accent : 'var(--border-default)'}`, background: selected ? `${bank.accent}14` : 'var(--color-bg-muted)', boxShadow: selected ? `0 0 0 3px ${bank.accent}28, 0 4px 20px ${bank.accent}22` : 'none', transition: 'all var(--duration-normal) var(--ease-default)', position: 'relative' }}>
    {selected && <div style={{ position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: '50%', background: bank.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={13} color="#000" strokeWidth={3} /></div>}
    <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-lg)', background: `${bank.accent}18`, border: `1px solid ${bank.accent}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-3)' }}>
      <Building2 size={20} style={{ color: bank.text }} />
    </div>
    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>{bank.name}</span>
    <span style={{ fontSize: 'var(--text-xs)', color: bank.text, fontWeight: 600, marginTop: 2, display: 'block' }}>●</span>
  </button>
);

// ── DropZone ──────────────────────────────────────────────────────────────────

const DropZone: React.FC<{
  label: string; hint: string; file: FileInfo | null;
  inputRef: React.RefObject<HTMLInputElement>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  onFileDrop: (file: File) => void;
}> = ({ label, hint, file, inputRef, onChange, onClear, onFileDrop }) => {
  const [dragging, setDragging] = useState(false);
  const dragCount = useRef(0);

  const onDragEnter = () => { dragCount.current++; setDragging(true); };
  const onDragLeave = () => { if (--dragCount.current === 0) setDragging(false); };
  const onDragOver  = (e: React.DragEvent) => e.preventDefault();
  const onDrop      = (e: React.DragEvent) => {
    e.preventDefault();
    dragCount.current = 0; setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFileDrop(f);
  };

  return (
    <div>
      <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>{label}</label>
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={onChange} />
      {file ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4)', background: 'rgba(34,197,94,0.08)', border: '1.5px solid rgba(34,197,94,0.25)', borderRadius: 'var(--radius-xl)' }}>
          <FileSpreadsheet size={18} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
          <button onClick={onClear} style={{ padding: 4, borderRadius: 'var(--radius-md)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={15} /></button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDragOver={onDragOver} onDrop={onDrop}
          style={{ width: '100%', padding: 'var(--space-8)', background: dragging ? 'rgba(245,197,24,0.06)' : 'var(--color-bg-muted)', border: `1.5px dashed ${dragging ? 'var(--color-accent-500)' : 'var(--border-strong)'}`, borderRadius: 'var(--radius-xl)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)', transition: 'all var(--duration-normal)' }}
          onMouseEnter={e => { if (!dragging) { e.currentTarget.style.borderColor = 'var(--color-accent-500)'; e.currentTarget.style.background = 'rgba(245,197,24,0.04)'; }}}
          onMouseLeave={e => { if (!dragging) { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.background = 'var(--color-bg-muted)'; }}}>
          <div style={{ width: 42, height: 42, borderRadius: 'var(--radius-lg)', background: dragging ? 'rgba(245,197,24,0.12)' : 'var(--color-bg-elevated)', border: `1px solid ${dragging ? 'rgba(245,197,24,0.3)' : 'var(--border-default)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all var(--duration-normal)' }}>
            <FileSpreadsheet size={20} style={{ color: dragging ? 'var(--color-accent-500)' : 'var(--text-muted)' }} />
          </div>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: dragging ? 'var(--color-accent-500)' : 'var(--text-secondary)' }}>
            {dragging ? 'Suelta para cargar' : 'Arrastra o selecciona archivo'}
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{hint}</span>
        </button>
      )}
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────

interface ConciliacionPageProps {
  isSA?: boolean;
  activeTab?: 'conciliacion' | 'auditoria';
  onTabChange?: (t: 'conciliacion' | 'auditoria') => void;
}

const ConciliacionPage: React.FC<ConciliacionPageProps> = ({
  isSA = false,
  activeTab = 'conciliacion',
  onTabChange,
}) => {
  const [stage, setStage]         = useState<Stage>('select');
  const [bankId, setBankId]       = useState<string | null>(null);
  const [extracto, setExtracto]   = useState<FileInfo | null>(null);
  const [sapFile, setSapFile]     = useState<FileInfo | null>(null);
  const [progress, setProgress]   = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [procLabel, setProcLabel] = useState(PROCESSING_LABELS[0]);
  const [resultado, setResultado] = useState<ApiResult | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [tab, setTab]             = useState<'resumen'|'comparativa'|'diagnosticos'>('resumen');
  const extractoRef = useRef<HTMLInputElement>(null!);
  const sapRef      = useRef<HTMLInputElement>(null!);
  const bank = BANKS.find(b => b.id === bankId);

  // Interpolación suave del porcentaje en pantalla a 60fps
  React.useEffect(() => {
    if (stage !== 'processing') {
      setDisplayProgress(0);
      return;
    }
    let animId: number;
    const update = () => {
      setDisplayProgress(prev => {
        if (prev < progress) {
          const diff = progress - prev;
          const step = Math.max(0.15, diff * 0.08);
          const next = prev + step;
          return next >= progress ? progress : next;
        }
        return prev;
      });
      animId = requestAnimationFrame(update);
    };
    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, [progress, stage]);

  // Transición diferida cuando el porcentaje display alcanza el 100% real
  React.useEffect(() => {
    if (stage === 'processing' && progress === 100 && displayProgress === 100) {
      const t = setTimeout(() => {
        setStage('done');
      }, 500);
      return () => clearTimeout(t);
    }
  }, [progress, displayProgress, stage]);

  const validateAndSet = async (f: File, type: 'extracto' | 'sap', inputEl?: HTMLInputElement) => {
    if (type === 'extracto' && bankId) {
      const schema = BANK_SCHEMAS[bankId];
      if (schema) {
        const { valid, error: err } = await schema.validateExtracto(f);
        if (!valid) {
          toast.error(`Estructura incorrecta para ${bank?.name}`, { description: err, duration: 8000 });
          if (inputEl) inputEl.value = '';
          return;
        }
      }
    }
    type === 'extracto' ? setExtracto({ file: f, name: f.name }) : setSapFile({ file: f, name: f.name });
  };

  const handleFile = (type: 'extracto' | 'sap') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    validateAndSet(f, type, e.target);
  };

  const handleDrop = (type: 'extracto' | 'sap') => (f: File) => {
    validateAndSet(f, type);
  };

  const handleProcess = async () => {
    if (!extracto || !sapFile || !bankId) return;
    setStage('processing'); setProgress(0); setError(null);
    let p = 0, step = 0;
    const iv = setInterval(() => {
      p = Math.min(p + Math.random() * 8 + 2, 85);
      setProgress(Math.round(p));
      setProcLabel(PROCESSING_LABELS[Math.min(step++, PROCESSING_LABELS.length - 1)]);
    }, 400);
    try {
      const user = getCurrentUser();
      const form = new FormData();
      form.append('banco', bankId.toUpperCase());
      form.append('extracto', extracto.file);
      form.append('sap', sapFile.file);
      form.append('usuario_id',     String(user.id));
      form.append('usuario_nombre', `${user.first_name} ${user.last_name}`.trim() || user.username);
      form.append('usuario_tipo',   String(user.tipo));
      form.append('area_id',        String(user.area_id ?? ''));
      form.append('area_nombre',    user.area_nombre);
      const res = await fetch(`${API_BASE}/api/conciliacion/ejecutar/`, { method: 'POST', body: form });
      clearInterval(iv);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const parts = [(err as any).error, (err as any).detalle, typeof err === 'object' && !(err as any).error ? JSON.stringify(err) : null].filter(Boolean);
        throw new Error(parts.join(' — ') || `Error ${res.status}`);
      }
      const data: ApiResult = await res.json();
      setResultado(data); setProgress(100); setProcLabel('Conciliación completada');
    } catch (err) {
      clearInterval(iv);
      setError(err instanceof Error ? err.message : 'Error al procesar');
      setStage('upload');
    }
  };

  const reset = () => { setStage('select'); setBankId(null); setExtracto(null); setSapFile(null); setProgress(0); setResultado(null); setError(null); setTab('resumen'); };

  return (
    <div className="concilia-layout">

      {/* ── Sidebar ── */}
      <aside className="concilia-sidebar" style={{ background: 'var(--color-bg-elevated)', borderRight: '1px solid var(--border-default)' }}>
        <div style={{ padding: 'var(--space-6)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 4 }}>
            <BarChart2 size={18} style={{ color: 'var(--color-accent-500)' }} />
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>Concilia</span>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>Conciliación bancaria automática extracto vs SAP</p>
        </div>
        {activeTab !== 'auditoria' && <SidebarSteps stage={stage} />}
        {activeTab !== 'auditoria' && (
          <div style={{ padding: 'var(--space-4) var(--space-5)', borderTop: '1px solid var(--border-subtle)' }}>
            {stage === 'done' ? (
              <button className="btn-ghost" onClick={reset} style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 'var(--text-xs)' }}>
                <RotateCcw size={13} /> Nueva conciliación
              </button>
            ) : (
              <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: 0, letterSpacing: '0.03em' }}>3 bancos · Excel export · Diagnósticos</p>
            )}
          </div>
        )}
      </aside>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {isSA && onTabChange && (
          <nav style={{ display: 'flex', gap: 'var(--space-1)', padding: '6px 16px', background: 'var(--color-bg-elevated)', borderBottom: '1px solid var(--border-default)', flexShrink: 0 }}>
            {([
              { key: 'conciliacion' as const, label: 'Conciliación', Icon: BarChart2 },
              { key: 'auditoria'   as const, label: 'Trazabilidad',  Icon: Shield    },
            ]).map(({ key, label, Icon }) => {
              const active = activeTab === key;
              return (
                <button key={key} onClick={() => onTabChange(key)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 700, background: active ? 'var(--color-accent-500)' : 'transparent', color: active ? 'var(--text-inverse)' : 'var(--text-muted)', transition: 'all var(--duration-normal)' }}>
                  <Icon size={13} /> {label}
                </button>
              );
            })}
          </nav>
        )}
        <main className="concilia-main" style={{ justifyContent: activeTab === 'auditoria' || stage === 'done' ? 'flex-start' : 'center' }}>
          {activeTab === 'auditoria' ? <AuditoriaPanel /> : (
          <div className="concilia-content" style={{ maxWidth: stage === 'done' ? '100%' : 640 }}>

          {/* Paso 1: Banco */}
          {stage === 'select' && (
            <div className="animate-fade-in">
              <div className="concilia-banks-grid">
                {BANKS.map(b => <BankCard key={b.id} bank={b} selected={bankId === b.id} onClick={() => setBankId(b.id)} />)}
              </div>
              <button className="btn-primary" style={{ width: '100%', padding: 'var(--space-4)' }} disabled={!bankId} onClick={() => setStage('upload')}>
                Continuar <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* Paso 2: Archivos */}
          {stage === 'upload' && (
            <div className="animate-fade-in">
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 'var(--space-2)' }}>Carga de archivos</h2>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-6)', padding: '4px 12px', borderRadius: 'var(--radius-full)', background: `${bank?.accent}14`, border: `1px solid ${bank?.accent}35` }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: bank?.accent, display: 'block' }} />
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: bank?.text }}>{bank?.name}</span>
              </div>
              {error && (
                <div style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-3) var(--space-4)', background: 'var(--color-error-bg)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 'var(--radius-xl)', marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-error-light)' }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} /> {error}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                <DropZone label="Extracto bancario" hint=".xlsx / .csv exportado del banco" file={extracto} inputRef={extractoRef} onChange={handleFile('extracto')} onClear={() => setExtracto(null)} onFileDrop={handleDrop('extracto')} />
                <DropZone label="Registros SAP" hint=".xlsx / .csv exportado de SAP" file={sapFile} inputRef={sapRef} onChange={handleFile('sap')} onClear={() => setSapFile(null)} onFileDrop={handleDrop('sap')} />
              </div>
              {bankId && <BankGuidePanel bankId={bankId} bankAccent={bank?.accent ?? '#FFD100'} />}
              <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                <button className="btn-secondary" onClick={() => setStage('select')}>Atrás</button>
                <button className="btn-primary" style={{ flex: 1 }} disabled={!extracto || !sapFile} onClick={handleProcess}>Procesar <BarChart2 size={16} /></button>
              </div>
            </div>
          )}

          {/* Paso 3: Procesando */}
          {stage === 'processing' && (() => {
            const displayPct = Math.min(100, Math.max(0, displayProgress));
            const radius = 90;
            const stroke = 6;
            const normalizedRadius = radius - stroke * 2;
            const circumference = normalizedRadius * 2 * Math.PI;
            const strokeDashoffset = circumference - (displayPct / 100) * circumference;

            return (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
                {/* Circular Progress Container */}
                <div style={{ position: 'relative', width: radius * 2, height: radius * 2, marginBottom: 'var(--space-6)' }}>
                  {/* Glowing background aura */}
                  <div style={{ position: 'absolute', width: normalizedRadius * 2, height: normalizedRadius * 2, borderRadius: '50%', background: `radial-gradient(circle, ${bank?.accent || 'var(--color-accent-500)'}18 0%, transparent 70%)`, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', filter: 'blur(4px)' }} />
                  
                  <svg height={radius * 2} width={radius * 2} style={{ transform: 'rotate(-90deg)', filter: `drop-shadow(0 0 6px ${(bank?.accent || 'var(--color-accent-500)')}15)` }}>
                    <defs>
                      <linearGradient id="circleProgressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={bank?.accent || 'var(--color-accent-500)'} />
                        <stop offset="100%" stopColor="#FFFFFF" />
                      </linearGradient>
                    </defs>
                    {/* Background Circle */}
                    <circle
                      stroke="rgba(255, 255, 255, 0.04)"
                      fill="transparent"
                      strokeWidth={stroke}
                      r={normalizedRadius}
                      cx={radius}
                      cy={radius}
                    />
                    {/* Progress Circle */}
                    <circle
                      stroke="url(#circleProgressGradient)"
                      fill="transparent"
                      strokeWidth={stroke}
                      strokeDasharray={circumference + ' ' + circumference}
                      style={{ strokeDashoffset, strokeLinecap: 'round', transition: 'none' }}
                      r={normalizedRadius}
                      cx={radius}
                      cy={radius}
                    />
                    {/* Slower rotating dashed outer ring */}
                    <circle
                      stroke={bank?.accent || 'var(--color-accent-500)'}
                      fill="transparent"
                      strokeWidth={1}
                      strokeDasharray="4, 12"
                      opacity="0.25"
                      r={normalizedRadius + 12}
                      cx={radius}
                      cy={radius}
                      style={{ animation: 'spin 8s linear infinite', transformOrigin: 'center' }}
                    />
                  </svg>

                  {/* Percentage in the Center */}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <span style={{ fontSize: '2.5rem', fontWeight: 900, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.03em' }}>
                      {Math.round(displayPct)}%
                    </span>
                    <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>
                      Conciliando
                    </span>
                  </div>
                </div>

                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12, letterSpacing: '-0.01em' }}>
                  Procesando conciliación
                </h2>
                
                {/* Active Status Pill */}
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 'var(--radius-full)', background: 'var(--color-bg-elevated)', border: '1px solid var(--border-default)', fontWeight: 600, margin: 0 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: bank?.accent || 'var(--color-accent-500)', display: 'block' }} className="animate-pulse" />
                  {procLabel}
                </p>
              </div>
            );
          })()}

          {/* Paso 4: Resultados */}
          {stage === 'done' && resultado && (
            <div className="animate-fade-in">
              {/* Tabs pill */}
              <div className="concilia-tabs-bar" style={{ display: 'flex', gap: 'var(--space-1)', padding: 'var(--space-1)', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-5)', border: '1px solid var(--border-default)' }}>
                {([
                  { key: 'resumen', label: 'Resumen' },
                  { key: 'comparativa', label: `Comparativa (${resultado.resumen.total_banco})` },
                  { key: 'diagnosticos', label: `Diagnósticos (${resultado.diagnosticos.length})` },
                ] as const).map(t => {
                  const active = tab === t.key;
                  return (
                    <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, padding: '8px 12px', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 700, background: active ? 'var(--color-accent-500)' : 'transparent', color: active ? 'var(--text-inverse)' : 'var(--text-muted)', boxShadow: active ? '0 2px 10px rgba(245, 197, 24, 0.2)' : 'none', transition: 'all var(--duration-normal)' }} onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }} onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {tab === 'resumen' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                  <div className="kpi-grid" style={{ gap: 'var(--space-4)' }}>
                    {[
                      { label: 'Tasa conciliación', value: `${(resultado.resumen.tasa_conciliacion * 100).toFixed(1)}%`, accent: 'var(--color-success)', icon: <Check size={16} style={{ color: 'var(--color-success)' }} /> },
                      { label: 'Mov. banco',         value: String(resultado.resumen.total_banco),                       accent: 'var(--color-accent-500)', icon: <Building2 size={16} style={{ color: 'var(--color-accent-500)' }} /> },
                      { label: 'Reg. SAP',           value: String(resultado.resumen.total_sap),                         accent: 'var(--color-info)', icon: <BarChart2 size={16} style={{ color: 'var(--color-info)' }} /> },
                    ].map(m => (
                      <div key={m.label} style={{ padding: 'var(--space-6)', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-default)', borderTop: `4px solid ${m.accent}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)', boxShadow: 'var(--shadow-md)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          {m.icon}
                          <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{m.label}</span>
                        </div>
                        <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 900, color: m.accent, fontFamily: 'var(--font-mono)', marginTop: 4 }}>{m.value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-default)', padding: 'var(--space-5)', boxShadow: 'var(--shadow-md)' }}>
                    <h4 style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-2)' }}>
                      Distribución por Nivel de Coincidencia
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                      {Object.entries(resultado.resumen.por_nivel).map(([nivel, count]) => {
                        const pct = resultado.resumen.total_banco > 0 ? (count / resultado.resumen.total_banco) * 100 : 0;
                        return (
                          <div key={nivel} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-2)' }}>
                            <span style={{ width: 80, fontSize: 'var(--text-xs)', fontWeight: 800, color: NIVEL_COLOR[nivel] ?? 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{nivel}</span>
                            <div style={{ flex: 1, height: 6, background: 'var(--color-bg-muted)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: NIVEL_COLOR[nivel] ?? 'var(--color-accent-500)', borderRadius: 'var(--radius-full)', transition: 'width 0.4s ease-out' }} />
                            </div>
                            <span style={{ width: 44, textAlign: 'right', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              {tab === 'comparativa'  && <TablaComparativa resultados={resultado.resultados} totales={resultado.totales} banco={resultado.banco} onExportCompleto={() => exportarInformeExcel(resultado!)} />}
              {tab === 'diagnosticos' && <DiagnosticosPanel diagnosticos={resultado.diagnosticos} />}
            </div>
          )}
          </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ConciliacionPage;
