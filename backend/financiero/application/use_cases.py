"""
Caso de uso: ejecutar conciliación bancaria.
Orquesta loader → matcher → diagnostics. No toca la BD.
Los archivos temporales se eliminan inmediatamente tras procesar.
"""
from __future__ import annotations

import math
import os
import tempfile
from collections import Counter
from typing import Any

from engine.loader import cargar_davivienda, cargar_bancolombia, cargar_bogota, cargar_sap
from engine.matcher import ejecutar_matching
from engine.diagnostics import diagnosticar

_BANCO_LOADERS = {
    'DAVIVIENDA':  cargar_davivienda,
    'BANCOLOMBIA': cargar_bancolombia,
    'BOGOTA':      cargar_bogota,
}

_ALLOWED_EXT = {'.xlsx', '.xls', '.csv'}


def _guardar_temp(uploaded_file, suffix: str) -> str:
    """Escribe el upload a un NamedTemporaryFile y retorna la ruta. Caller debe borrar."""
    fd, path = tempfile.mkstemp(suffix=suffix)
    try:
        with os.fdopen(fd, 'wb') as f:
            for chunk in uploaded_file.chunks():
                f.write(chunk)
    except Exception:
        os.unlink(path)
        raise
    return path


def _ts(ts) -> str | None:
    if ts is None:
        return None
    try:
        return ts.date().isoformat()
    except Exception:
        return str(ts)


_MONTO_TOL = 2_000   # COP — tolerancia máxima por movimiento


def _f(v) -> float | None:
    """Convierte nan/inf → None para que JSON lo acepte como null."""
    if v is None:
        return None
    try:
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else f
    except (TypeError, ValueError):
        return None


def _nivel_negocio(r) -> str:
    if r.sap_idx is None:
        return 'ABIERTO'
    nivel = r.nivel.value if hasattr(r.nivel, 'value') else str(r.nivel)
    if nivel in ('EXACTO', 'ALTO', 'MEDIO'):
        return 'CONCILIADO'
    if nivel == 'BAJO':
        return 'PENDIENTE'
    return 'ABIERTO'


def _resultado_dict(r) -> dict:
    delta_monto = (
        round(abs((r.banco_monto or 0) - (r.sap_monto or 0)), 2)
        if r.sap_monto is not None else None
    )
    return {
        'banco_idx':     r.banco_idx,
        'banco_fecha':   _ts(r.banco_fecha),
        'banco_monto':   _f(r.banco_monto),
        'banco_tipo':    r.banco_tipo,
        'banco_ref':     r.banco_ref,
        'banco_desc':    r.banco_desc,
        'sap_idx':       r.sap_idx,
        'sap_fecha':     _ts(r.sap_fecha),
        'sap_monto':     _f(r.sap_monto),
        'sap_tipo':      r.sap_tipo,
        'sap_ref':       r.sap_ref,
        'sap_desc':      r.sap_desc,
        'sap_num_doc':   r.sap_num_doc,
        'nivel':         r.nivel.value,
        'nivel_negocio': _nivel_negocio(r),
        'delta_dias':    r.delta_dias,
        'delta_monto':   _f(delta_monto),
        'similitud':     _f(r.similitud),
        'estado':        r.estado.value,
    }


def _diagnostico_dict(d) -> dict:
    return {
        'categoria':   d.categoria.value,
        'motivo':      d.motivo,
        'fecha':       _ts(d.fecha),
        'monto':       _f(d.monto),
        'descripcion': d.descripcion,
        'banco_idx':   d.banco_idx,
        'sap_idx':     d.sap_idx,
        'num_doc':     d.num_doc,
    }


def ejecutar_conciliacion(banco: str, extracto_file, sap_file) -> dict[str, Any]:
    """
    banco: 'DAVIVIENDA' | 'BANCOLOMBIA' | 'BOGOTA'
    extracto_file, sap_file: Django InMemoryUploadedFile (o cualquier objeto con .chunks())
    """
    banco = banco.upper()
    loader = _BANCO_LOADERS.get(banco)
    if not loader:
        raise ValueError(f"Banco no reconocido: {banco}")

    ext_extracto = os.path.splitext(extracto_file.name)[1].lower()
    ext_sap      = os.path.splitext(sap_file.name)[1].lower()
    if ext_extracto not in _ALLOWED_EXT or ext_sap not in _ALLOWED_EXT:
        raise ValueError("Solo se permiten archivos .xlsx, .xls o .csv")

    path_extracto = _guardar_temp(extracto_file, suffix=ext_extracto)
    path_sap      = _guardar_temp(sap_file,      suffix=ext_sap)
    try:
        banco_df = loader(path_extracto)
        sap_df   = cargar_sap(path_sap, banco)
    finally:
        os.unlink(path_extracto)
        os.unlink(path_sap)

    resultados   = ejecutar_matching(banco_df, sap_df)
    diagnosticos = diagnosticar(resultados, banco_df, sap_df)

    conteo        = Counter(r.nivel.value for r in resultados)
    negocio_count = Counter(_nivel_negocio(r) for r in resultados)
    total         = len(resultados)
    suma_banco    = _f(sum(_f(r.banco_monto) or 0 for r in resultados))
    suma_sap      = _f(sum(_f(r.sap_monto)  or 0 for r in resultados if r.sap_monto is not None))

    return {
        'banco': banco,
        'resumen': {
            'total_banco':        total,
            'total_sap':          len(sap_df),
            'por_nivel':          dict(conteo),
            'tasa_conciliacion':  round(
                (total - conteo.get('ABIERTO', 0)) / total, 4
            ) if total else 0,
        },
        'totales': {
            'suma_banco':   suma_banco,
            'suma_sap':     suma_sap,
            'diferencia':   _f(abs((suma_banco or 0) - (suma_sap or 0))),
            'conciliados':  negocio_count.get('CONCILIADO', 0),
            'pendientes':   negocio_count.get('PENDIENTE',  0),
            'abiertos':     negocio_count.get('ABIERTO',    0),
        },
        'resultados':   [_resultado_dict(r) for r in resultados],
        'diagnosticos': [_diagnostico_dict(d) for d in diagnosticos],
    }
