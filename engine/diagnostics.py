"""
Diagnóstico de no coincidencias: SAP sin movimiento bancario y duplicados.
BANCO_SIN_SAP omitido por política: comisiones/IVA no se pre-contabilizan en SAP.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional

import pandas as pd


class CategoriaDiagnostico(str, Enum):
    SAP_SIN_BANCO = 'SAP_SIN_BANCO'
    DUPLICADO     = 'DUPLICADO'


@dataclass
class Diagnostico:
    categoria:   CategoriaDiagnostico
    motivo:      str
    fecha:       Optional[pd.Timestamp]
    monto:       Optional[float]
    descripcion: Optional[str]
    banco_idx:   Optional[int] = None
    sap_idx:     Optional[int] = None
    num_doc:     Optional[str] = None


def diagnosticar(resultados: list,
                 banco_df: pd.DataFrame,
                 sap_df: pd.DataFrame) -> list:
    diags = []

    matched_sap = {r.sap_idx for r in resultados if r.sap_idx is not None}

    # ── SAP_SIN_BANCO ─────────────────────────────────────────────────────────
    for si in sorted(set(sap_df.index) - matched_sap):
        row = sap_df.loc[si]
        diags.append(Diagnostico(
            categoria=CategoriaDiagnostico.SAP_SIN_BANCO,
            motivo='Registro SAP sin movimiento bancario — cheque no cobrado o pago en tránsito',
            fecha=row['fecha'],
            monto=float(row['monto_abs']),
            descripcion=row['descripcion'],
            sap_idx=int(si),
            num_doc=str(row.get('num_doc', '') or '').strip() or None,
        ))

    # ── DUPLICADO: mismo fecha + monto_abs + tipo en extracto banco ───────────
    dup_mask = banco_df.duplicated(subset=['fecha', 'monto_abs', 'tipo'], keep=False)
    seen: set = set()
    for idx, row in banco_df[dup_mask].iterrows():
        key = (row['fecha'], round(float(row['monto_abs']), 2), row['tipo'])
        if key in seen:
            continue
        seen.add(key)
        diags.append(Diagnostico(
            categoria=CategoriaDiagnostico.DUPLICADO,
            motivo='Movimiento duplicado en extracto: misma fecha, monto y tipo',
            fecha=row['fecha'],
            monto=float(row['monto_abs']),
            descripcion=row['descripcion'],
            banco_idx=int(idx),
        ))

    return diags
