"""
Motor de matching 5 pasos: EXACTO → ALTO → MEDIO → BAJO → ABIERTO.
Opera únicamente sobre DataFrames en memoria — no escribe a disco, no consulta SAP.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum
from typing import Optional

import pandas as pd


class NivelConfianza(str, Enum):
    EXACTO  = 'EXACTO'
    ALTO    = 'ALTO'
    MEDIO   = 'MEDIO'
    BAJO    = 'BAJO'
    ABIERTO = 'ABIERTO'


class EstadoConciliacion(str, Enum):
    PROPUESTO   = 'PROPUESTO'
    EN_REVISION = 'EN_REVISION'
    APROBADO    = 'APROBADO'
    RECHAZADO   = 'RECHAZADO'
    DEFINITIVO  = 'DEFINITIVO'


@dataclass
class ResultadoMatch:
    # Lado extracto bancario
    banco_idx:   int
    banco_fecha: pd.Timestamp
    banco_monto: float
    banco_tipo:  str
    banco_ref:   Optional[str]
    banco_desc:  str
    banco:       str

    # Lado SAP (None si ABIERTO)
    sap_idx:     Optional[int]
    sap_fecha:   Optional[pd.Timestamp]
    sap_monto:   Optional[float]
    sap_tipo:    Optional[str]
    sap_ref:     Optional[str]
    sap_desc:    Optional[str]
    sap_num_doc: Optional[str]

    # Calidad del match
    nivel:      NivelConfianza
    delta_dias: Optional[int]    # diferencia absoluta de fechas
    similitud:  Optional[float]  # [0,1] — solo para BAJO (Jaccard)

    estado: EstadoConciliacion = EstadoConciliacion.PROPUESTO


# ── Utilidades internas ───────────────────────────────────────────────────────

def _jaccard(a: str, b: str) -> float:
    """Jaccard sobre conjuntos de palabras (≥3 chars), case-insensitive."""
    wa = {w for w in re.split(r'\W+', a.lower()) if len(w) >= 3}
    wb = {w for w in re.split(r'\W+', b.lower()) if len(w) >= 3}
    if not wa and not wb:
        return 0.0
    return len(wa & wb) / len(wa | wb)


def _nn(v):
    """pandas convierte None→NaN al leer filas; revierte para JSON compliance."""
    if v is None:
        return None
    try:
        return None if pd.isna(v) else v
    except (TypeError, ValueError):
        return v


def _build(b_row: pd.Series, s_row: Optional[pd.Series],
           nivel: NivelConfianza, delta: Optional[int],
           sim: Optional[float]) -> ResultadoMatch:
    kwargs_sap = dict(
        sap_idx=None, sap_fecha=None, sap_monto=None, sap_tipo=None,
        sap_ref=None, sap_desc=None, sap_num_doc=None,
    ) if s_row is None else dict(
        sap_idx=int(s_row.name),
        sap_fecha=s_row['fecha'],
        sap_monto=float(s_row['monto_abs']),
        sap_tipo=s_row['tipo'],
        sap_ref=_nn(s_row.get('referencia')),
        sap_desc=_nn(s_row['descripcion']),
        sap_num_doc=_nn(s_row.get('num_doc')),
    )
    return ResultadoMatch(
        banco_idx=int(b_row.name),
        banco_fecha=b_row['fecha'],
        banco_monto=float(b_row['monto_abs']),
        banco_tipo=b_row['tipo'],
        banco_ref=_nn(b_row.get('referencia')),
        banco_desc=b_row['descripcion'],
        banco=b_row['banco'],
        nivel=nivel, delta_dias=delta, similitud=sim,
        **kwargs_sap,
    )


def _ref_valida(series: pd.Series) -> pd.Series:
    """Máscara: referencia presente, no vacía, no literal 'None'/'nan'."""
    return series.notna() & ~series.astype(str).str.strip().isin(['', 'None', 'nan'])


# ── Pasos 1–3: merge por claves escalares ─────────────────────────────────────

def _step_merge(banco_df: pd.DataFrame, sap_df: pd.DataFrame,
                b_pending: set, s_pending: set,
                use_ref: bool, max_dias: int,
                nivel: NivelConfianza) -> list:
    """Merge greedy por (referencia?) + monto_key + tipo, dentro de ventana de fechas."""
    results = []
    if not b_pending or not s_pending:
        return results

    b = banco_df.loc[sorted(b_pending)].copy()
    s = sap_df.loc[sorted(s_pending)].copy()

    if use_ref:
        b = b[_ref_valida(b['referencia'])]
        s = s[_ref_valida(s['referencia'])]

    if b.empty or s.empty:
        return results

    b = b.assign(_mk=b['monto_abs'].round(2)).reset_index(names='b_idx')
    s = s.assign(_mk=s['monto_abs'].round(2)).reset_index(names='s_idx')

    keys = (['referencia', '_mk', 'tipo'] if use_ref else ['_mk', 'tipo'])
    merged = b.merge(s, on=keys, suffixes=('_b', '_s'))
    if merged.empty:
        return results

    merged['_delta'] = (merged['fecha_b'] - merged['fecha_s']).abs().dt.days
    merged = (merged[merged['_delta'] <= max_dias]
              .sort_values('_delta')
              .reset_index(drop=True))

    used_s: set = set()
    for _, row in merged.iterrows():
        bi, si = int(row['b_idx']), int(row['s_idx'])
        if bi not in b_pending or si not in s_pending or si in used_s:
            continue
        results.append(_build(banco_df.loc[bi], sap_df.loc[si],
                               nivel, int(row['_delta']), None))
        b_pending.discard(bi)
        s_pending.discard(si)
        used_s.add(si)

    return results


# ── Paso 4: fuzzy Jaccard sobre descripción ───────────────────────────────────

_FUZZY_THRESHOLD = 0.75


def _paso4_bajo(banco_df: pd.DataFrame, sap_df: pd.DataFrame,
                b_pending: set, s_pending: set) -> list:
    results = []
    if not b_pending or not s_pending:
        return results

    b = banco_df.loc[sorted(b_pending)]
    s = sap_df.loc[sorted(s_pending)]

    candidates: list = []
    for bi, b_row in b.iterrows():
        best_sim, best_si = 0.0, -1
        for si, s_row in s.iterrows():
            sim = _jaccard(str(b_row['descripcion']), str(s_row['descripcion']))
            if sim > best_sim:
                best_sim, best_si = sim, int(si)
        if best_sim >= _FUZZY_THRESHOLD:
            candidates.append((best_sim, int(bi), best_si))

    candidates.sort(reverse=True)
    used_s: set = set()
    for sim, bi, si in candidates:
        if bi not in b_pending or si not in s_pending or si in used_s:
            continue
        results.append(_build(banco_df.loc[bi], sap_df.loc[si],
                               NivelConfianza.BAJO, None, round(sim, 4)))
        b_pending.discard(bi)
        s_pending.discard(si)
        used_s.add(si)

    return results


# ── Pre-proceso: eliminar anulados SAP ───────────────────────────────────────

def _eliminar_anulados(sap_df: pd.DataFrame) -> pd.DataFrame:
    """
    Pares SAP donde el mismo num_doc aparece con débito y crédito opuestos
    (suma ≈ $0) representan asientos anulados. Se eliminan antes del matching.
    """
    if 'num_doc' not in sap_df.columns:
        return sap_df
    doc_col = sap_df['num_doc'].astype(str).str.strip()
    real_docs = doc_col[doc_col.str.match(r'^(PP|PR|DP|RCB|RCM|RCFB)\d+')]
    grouped = sap_df.loc[real_docs.index].groupby(doc_col[real_docs.index])
    anulados_idx: list = []
    for _, grp in grouped:
        if len(grp) >= 2 and abs(grp['monto_signed'].sum()) < 1:
            anulados_idx.extend(grp.index.tolist())
    return sap_df.drop(index=anulados_idx).reset_index(drop=True)


# ── Paso 3b: tolerancia ±2000 en monto ───────────────────────────────────────

_MONTO_TOL_STEP = 2_000   # COP — tolerancia por movimiento individual


def _step_merge_tol(banco_df: pd.DataFrame, sap_df: pd.DataFrame,
                    b_pending: set, s_pending: set,
                    max_dias: int, nivel: NivelConfianza) -> list:
    """Como _step_merge MEDIO pero acepta diferencia de monto ≤ _MONTO_TOL_STEP."""
    results = []
    if not b_pending or not s_pending:
        return results

    b = banco_df.loc[sorted(b_pending)].copy()
    s = sap_df.loc[sorted(s_pending)].copy()
    if b.empty or s.empty:
        return results

    b = b.assign(_monto=b['monto_abs'].round(2)).reset_index(names='b_idx')
    s = s.assign(_monto=s['monto_abs'].round(2)).reset_index(names='s_idx')

    merged = b.merge(s, on='tipo', suffixes=('_b', '_s'))
    if merged.empty:
        return results

    merged['_delta_m'] = (merged['_monto_b'] - merged['_monto_s']).abs()
    merged['_delta_d'] = (merged['fecha_b'] - merged['fecha_s']).abs().dt.days
    merged = (merged[(merged['_delta_m'] <= _MONTO_TOL_STEP) & (merged['_delta_d'] <= max_dias)]
              .sort_values(['_delta_m', '_delta_d'])
              .reset_index(drop=True))

    used_s: set = set()
    for _, row in merged.iterrows():
        bi, si = int(row['b_idx']), int(row['s_idx'])
        if bi not in b_pending or si not in s_pending or si in used_s:
            continue
        delta = int(row['_delta_d'])
        results.append(_build(banco_df.loc[bi], sap_df.loc[si], nivel, delta, None))
        b_pending.discard(bi)
        s_pending.discard(si)
        used_s.add(si)

    return results


# ── Orquestador principal ─────────────────────────────────────────────────────

def ejecutar_matching(banco_df: pd.DataFrame,
                      sap_df: pd.DataFrame) -> list:
    """
    Ejecuta los 5 pasos sobre los DataFrames canónicos de loader.py.
    Devuelve lista de ResultadoMatch, uno por movimiento bancario.
    Registros SAP sin pareja quedan en s_pending — ver diagnostics.py.
    """
    sap_df = _eliminar_anulados(sap_df)

    b_pending: set = set(banco_df.index.tolist())
    s_pending: set = set(sap_df.index.tolist())
    results = []

    # PASO 1 — EXACTO: referencia + monto + fecha ±1 día
    results += _step_merge(banco_df, sap_df, b_pending, s_pending,
                           use_ref=True, max_dias=1, nivel=NivelConfianza.EXACTO)

    # PASO 2 — ALTO: referencia + monto + fecha ±3 días
    results += _step_merge(banco_df, sap_df, b_pending, s_pending,
                           use_ref=True, max_dias=3, nivel=NivelConfianza.ALTO)

    # PASO 3 — MEDIO: monto exacto + tipo + fecha ±5 días
    results += _step_merge(banco_df, sap_df, b_pending, s_pending,
                           use_ref=False, max_dias=5, nivel=NivelConfianza.MEDIO)

    # PASO 3b — MEDIO con tolerancia ±1000 COP en monto + fecha ±5 días
    results += _step_merge_tol(banco_df, sap_df, b_pending, s_pending,
                                max_dias=5, nivel=NivelConfianza.MEDIO)

    # PASO 4 — BAJO: similitud Jaccard de descripción >= 0.75
    results += _paso4_bajo(banco_df, sap_df, b_pending, s_pending)

    # PASO 5 — ABIERTO: movimientos sin ningún match
    for bi in b_pending:
        results.append(_build(banco_df.loc[bi], None,
                               NivelConfianza.ABIERTO, None, None))

    return results
