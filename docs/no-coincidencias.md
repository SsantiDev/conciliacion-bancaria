# Dashboard de No Coincidencias

← [Volver al objetivo](../objetivo.md)

## Qué mostrar

Cuando el sistema no puede conciliar automáticamente, necesita:
1. Mostrar el ítem sin match
2. Diagnosticar el probable motivo
3. Ofrecer acción para resolverlo

---

## Categorías de no coincidencia

| Categoría | Descripción | Causa más común |
|-----------|-------------|-----------------|
| `BANCO_SIN_SAP` | Movimiento en banco, nada en contabilidad | Pago no registrado, comisión bancaria, error banco |
| `SAP_SIN_BANCO` | Factura en SAP, sin movimiento bancario | Cheque no cobrado, pago en tránsito, anulación |
| `MONTO_DIFERENTE` | Match por referencia pero monto distinto | Descuento, retención, error de digitación |
| `FECHA_DESFASADA` | Match por monto/ref pero fecha fuera de rango | Diferencia entre fecha valor y fecha contable |
| `DUPLICADO` | Mismo movimiento registrado dos veces | Error contable o doble carga de archivo |

---

## Diagnóstico automático

Para cada no-coincidencia el sistema intenta inferir el motivo:

```
Si BANCO_SIN_SAP:
  ¿La descripción dice "COMISION" o "GMF" o "4x1000"?
    → Motivo probable: Cargo bancario no contabilizado

  ¿El monto coincide con una factura de otro cliente?
    → Motivo probable: Pago mal identificado (cliente errado)

  ¿Hay un movimiento similar en los últimos 5 días?
    → Motivo probable: Pago en tránsito / desfase de fecha

Si SAP_SIN_BANCO:
  ¿La factura tiene fecha de vencimiento futura?
    → Motivo probable: No vencida aún

  ¿La factura fue anulada en SAP?
    → Motivo probable: Anulación no reflejada

  ¿Hay un crédito bancario similar sin match?
    → Motivo probable: Match fallido por referencia errónea
```

---

## Vista del dashboard

```
┌──────────────────────────────────────────────────────────────┐
│  NO COINCIDENCIAS — Período: Semana 22, 2026       [14 ítems] │
├───────────────┬────────────┬──────────────┬──────────────────┤
│ Categoría     │ Fecha      │ Monto        │ Diagnóstico      │
├───────────────┼────────────┼──────────────┼──────────────────┤
│ BANCO_SIN_SAP │ 2026-05-04 │   -$45.000   │ Cargo bancario   │
│ SAP_SIN_BANCO │ 2026-05-02 │ $12.000.000  │ Cheque no cobrado│
│ MONTO_DIFF    │ 2026-05-03 │ Dif: $200.000│ Posible retención│
└───────────────┴────────────┴──────────────┴──────────────────┘
                                     [Resolver manualmente →]
```

---

## Acciones disponibles por categoría

| Categoría | Acciones posibles |
|-----------|-------------------|
| `BANCO_SIN_SAP` | Crear registro en SAP, ignorar (marcar como cargo bancario), asignar a factura existente |
| `SAP_SIN_BANCO` | Marcar como pendiente, marcar como anulada, buscar pago en otro período |
| `MONTO_DIFERENTE` | Aceptar diferencia y crear nota de ajuste, rechazar match, asignar manualmente |
| `FECHA_DESFASADA` | Aceptar con nota de desfase, ampliar rango de búsqueda |
| `DUPLICADO` | Marcar uno como duplicado, eliminar del período |

Ver flujo de resolución manual en [correccion-manual.md](correccion-manual.md)
