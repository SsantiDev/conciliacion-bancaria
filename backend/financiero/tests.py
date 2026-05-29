"""Smoke tests for matching engine with synthetic data."""
import pandas as pd
from django.test import TestCase
from financiero.domain.matcher import ejecutar_matching, NivelConfianza
from financiero.domain.diagnostics import diagnosticar, CategoriaDiagnostico


_BANCO = pd.DataFrame([
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

_SAP = pd.DataFrame([
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


class MatchingEngineTest(TestCase):
    def setUp(self):
        self.resultados = ejecutar_matching(_BANCO, _SAP)

    def test_total_resultados(self):
        self.assertEqual(len(self.resultados), 2)

    def test_primer_match_exacto(self):
        r0 = next(r for r in self.resultados if r.banco_idx == 0)
        self.assertEqual(r0.nivel, NivelConfianza.EXACTO)
        self.assertEqual(r0.delta_dias, 1)

    def test_segundo_match_abierto(self):
        r1 = next(r for r in self.resultados if r.banco_idx == 1)
        self.assertEqual(r1.nivel, NivelConfianza.ABIERTO)

    def test_diagnostico_sap_sin_banco(self):
        diags = diagnosticar(self.resultados, _BANCO, _SAP)
        cats = [d.categoria for d in diags]
        self.assertIn(CategoriaDiagnostico.SAP_SIN_BANCO, cats)
