import sys, glob, traceback, json, math
sys.path.insert(0, '.')
from engine.loader import cargar_davivienda, cargar_bogota, cargar_sap
from engine.matcher import ejecutar_matching
from engine.diagnostics import diagnosticar

dav_files = glob.glob('docs/Extracto/*DAVIVIENDA*') or glob.glob('docs/Extracto/*avivienda*')
bog_files = glob.glob('docs/Extracto/*BOGOTA*') or glob.glob('docs/Extracto/*ogota*')
sap_files = glob.glob('docs/SAP/*.xlsx') + glob.glob('docs/SAP/*.xls')

def _f(v):
    if v is None: return None
    try:
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else f
    except: return None

def _ts(ts):
    if ts is None: return None
    try: return ts.date().isoformat()
    except: return str(ts)

def test_banco(label, loader, extracto_path, sap_path):
    print(f"\n{'='*60}\n[{label}] FULL PIPELINE TEST")
    try:
        banco_df = loader(extracto_path)
        print(f"  banco_df: {len(banco_df)} rows OK")
    except Exception as e:
        print(f"  ERROR loader: {e}"); traceback.print_exc(); return
    try:
        sap_df = cargar_sap(sap_path, label)
        print(f"  sap_df:   {len(sap_df)} rows OK")
    except Exception as e:
        print(f"  ERROR cargar_sap: {e}"); traceback.print_exc(); return
    try:
        resultados = ejecutar_matching(banco_df, sap_df)
        print(f"  matching: {len(resultados)} resultados OK")
    except Exception as e:
        print(f"  ERROR matching: {e}"); traceback.print_exc(); return
    try:
        diags = diagnosticar(resultados, banco_df, sap_df)
        print(f"  diags:    {len(diags)} OK")
    except Exception as e:
        print(f"  ERROR diagnosticar: {e}"); traceback.print_exc(); return

    print("  Probando JSON serialization (allow_nan=False como DRF)...")
    for i, r in enumerate(resultados):
        d = {
            'banco_idx': r.banco_idx, 'banco_fecha': _ts(r.banco_fecha),
            'banco_monto': _f(r.banco_monto), 'banco_tipo': r.banco_tipo,
            'banco_ref': r.banco_ref, 'banco_desc': r.banco_desc,
            'sap_idx': r.sap_idx, 'sap_fecha': _ts(r.sap_fecha),
            'sap_monto': _f(r.sap_monto), 'sap_tipo': r.sap_tipo,
            'sap_ref': r.sap_ref, 'sap_desc': r.sap_desc,
            'sap_num_doc': r.sap_num_doc, 'nivel': r.nivel.value,
            'delta_dias': r.delta_dias, 'similitud': _f(r.similitud),
            'estado': r.estado.value,
        }
        try:
            json.dumps(d, allow_nan=False)
        except Exception as e:
            print(f"  JSON ERROR en resultado[{i}]: {e}")
            for k, v in d.items():
                try:
                    json.dumps(v, allow_nan=False)
                except:
                    print(f"    CAMPO [{k}] = {repr(v)} type={type(v).__name__}")
            return
    print(f"  JSON: todos los {len(resultados)} resultados OK")
    print(f"[{label}] PIPELINE COMPLETO OK")

if dav_files and sap_files:
    test_banco('DAVIVIENDA', cargar_davivienda, dav_files[0], sap_files[0])
if bog_files and sap_files:
    test_banco('BOGOTA', cargar_bogota, bog_files[0], sap_files[0])
