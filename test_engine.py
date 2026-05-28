"""Smoke test for engine layer with synthetic data."""
import pandas as pd
from engine import ejecutar_matching, diagnosticar, NivelConfianza, CategoriaDiagnostico

# ── Synthetic banco DataFrame ─────────────────────────────────────────────────
banco = pd.DataFrame([
    {
        'fecha': pd.Timestamp('2026-04-15'),
        'monto_signed': 1_000_000.0,
        'monto_abs': 1_000_000.0,
        'tipo': 'CR',
        'referencia': '890101692',
        'descripcion': 'PAGO FACTURA EMPRESA ABC',
        'banco': 'BOGOTA',
    },
    {
        'fecha': pd.Timestamp('2026-04-20'),
        'monto_signed': -45_000.0,
        'monto_abs': 45_000.0,
        'tipo': 'DB',
        'referencia': None,
        'descripcion': 'COMISION TRANSFERENCIA',
        'banco': 'BOGOTA',
    },
])

# ── Synthetic SAP DataFrame ───────────────────────────────────────────────────
sap = pd.DataFrame([
    {
        'fecha': pd.Timestamp('2026-04-16'),
        'monto_signed': 1_000_000.0,
        'monto_abs': 1_000_000.0,
        'tipo': 'CR',
        'referencia': '890101692',
        'descripcion': 'EMPRESA ABC SAS',
        'num_doc': 'PP12345',
        'banco': 'BOGOTA',
    },
    {
        'fecha': pd.Timestamp('2026-04-19'),
        'monto_signed': 500_000.0,
        'monto_abs': 500_000.0,
        'tipo': 'CR',
        'referencia': '811014994',
        'descripcion': 'FACTURA CLIENTE XYZ',
        'num_doc': 'PR99999',
        'banco': 'BOGOTA',
    },
])

# ── Matching ──────────────────────────────────────────────────────────────────
resultados = ejecutar_matching(banco, sap)
assert len(resultados) == 2, f"Esperados 2, obtenidos {len(resultados)}"

r0 = next(r for r in resultados if r.banco_idx == 0)
assert r0.nivel == NivelConfianza.EXACTO, f"r0 debe ser EXACTO, fue {r0.nivel}"
assert r0.delta_dias == 1

r1 = next(r for r in resultados if r.banco_idx == 1)
assert r1.nivel == NivelConfianza.ABIERTO, f"r1 debe ser ABIERTO, fue {r1.nivel}"

print(f"Match 0: {r0.nivel}  delta={r0.delta_dias}d  sap_doc={r0.sap_num_doc}")
print(f"Match 1: {r1.nivel}  desc={r1.banco_desc}")

# ── Diagnóstico ───────────────────────────────────────────────────────────────
diags = diagnosticar(resultados, banco, sap)
cats = [d.categoria for d in diags]
assert CategoriaDiagnostico.SAP_SIN_BANCO in cats, "Falta SAP_SIN_BANCO"

for d in diags:
    print(f"  [{d.categoria}] {d.motivo[:60]}")

print("\nTodos los assertions pasaron — engine OK")
