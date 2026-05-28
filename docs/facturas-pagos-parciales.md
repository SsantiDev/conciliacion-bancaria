# Facturas y Pagos Parciales

← [Volver al objetivo](../objetivo.md) | [Algoritmo de matching](algoritmo-matching.md)

## El problema

Un cliente puede pagar una suma que no corresponde a una sola factura, sino a varias.
El sistema debe poder deducir cuáles facturas quedaron cubiertas y cuáles no.

---

## Tipos de relación pago-factura

```
1 pago → 1 factura              (caso simple)
1 pago → N facturas             (pago multi-factura)
1 pago → fracción de 1 factura  (abono parcial)
N pagos → 1 factura             (factura pagada en cuotas)
```

---

## Cómo identificar qué facturas cubre un pago

### Estrategia 1: Suma exacta por cliente

```
Dado: pago de $8.500.000 del cliente ABC
Facturas abiertas de ABC: [3.000.000, 2.500.000, 3.000.000, 1.200.000]

Buscar subconjuntos que sumen exactamente $8.500.000:
  → [3.000.000 + 2.500.000 + 3.000.000] = 8.500.000 ✓

Si hay una sola combinación → proponer automáticamente
Si hay varias combinaciones → mostrar opciones al humano
Si no hay combinación exacta → marcar como abono parcial
```

### Estrategia 2: Referencia en descripción bancaria

El banco a veces incluye número de factura en la descripción:
```
Descripción banco: "PAGO FAC-001 FAC-002 FAC-003 EMPRESA ABC"
→ Extraer con regex: FAC-\d+
→ Match directo con facturas en SAP
```

### Estrategia 3: Orden cronológico (FIFO)

Si no hay información suficiente, aplicar la factura más antigua primero:
```
Pago: $5.000.000
FAC-001 (más antigua): $3.000.000 → cubre completa, restante $2.000.000
FAC-002: $2.500.000 → cubre $2.000.000, quedan $500.000 pendientes
FAC-003: no alcanza
```

---

## Estructura de datos sugerida

```
Conciliacion {
  id_movimiento_banco: string
  monto_banco: decimal
  fecha_banco: date       // formato: YYYY-MM-DD

  facturas_cubiertas: [
    {
      num_factura: string
      monto_original: decimal
      monto_aplicado: decimal
      cubierta_total: boolean
    }
  ]

  monto_sin_aplicar: decimal   // 0 si todo quedó cubierto
  tipo_match: EXACTO | PARCIAL | FIFO | MANUAL
  estado: PROPUESTO | APROBADO | RECHAZADO
}
```

---

## Visualización para el humano

```
┌──────────────────────────────────────────────────────┐
│ Movimiento banco: $8.500.000  —  Cliente: EMPRESA ABC │
│ Fecha: 2026-05-01  Ref: TRF-00123                    │
├──────────────────────────────────────────────────────┤
│ Facturas propuestas:                                  │
│  ✓ FAC-001  $3.000.000  → cubierta al 100%           │
│  ✓ FAC-002  $2.500.000  → cubierta al 100%           │
│  ✓ FAC-003  $3.000.000  → cubierta al 100%           │
│  ✗ FAC-004  $1.200.000  → PENDIENTE                  │
├──────────────────────────────────────────────────────┤
│ Total aplicado: $8.500.000  Sin aplicar: $0           │
│ Confianza: ALTO                                       │
│                               [Aprobar] [Modificar]   │
└──────────────────────────────────────────────────────┘
```

---

## Límite del algoritmo de combinaciones

Con muchas facturas el cálculo de subconjuntos es exponencial (2^n).
Solución: limitar a facturas del mismo cliente en rango de ±30 días,
máximo 15 facturas por búsqueda de combinación.
Si supera ese límite → mostrar al humano las N facturas candidatas ordenadas por fecha.
