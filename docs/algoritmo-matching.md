# Algoritmo de Matching

← [Volver al objetivo](../objetivo.md)

## El problema

Dado un movimiento bancario, encontrar el o los registros contables que lo generaron.

---

## Niveles de confianza

El motor clasifica cada match con un nivel. Nota: Todos los matches se crean con estado `PROPUESTO` y requieren validación y aprobación final del analista de tesorería para ser definitivos (conforme a la segregación de funciones).

| Nivel | Criterio | Acción |
|-------|----------|--------|
| **EXACTO** | Referencia + monto exacto + fecha (±1 día) | Proponer pre-conciliado automático |
| **ALTO** | Referencia + monto exacto + fecha (±3 días) | Proponer pre-conciliado con flag |
| **MEDIO** | Monto exacto + fecha (±5 días) [Sin Ref.] | Sugerir match, humano valida |
| **TOLERANCIA**| Monto (diferencia ≤ ±$2.000 COP) + fecha (±5 días) | Sugerir con diferencia, requiere ajuste manual del humano |
| **BAJO** | Similitud de texto en descripción > 0.75 | Mostrar como candidato sugerido |
| **NINGUNO** | Sin coincidencias | Marcar como ABIERTO (No conciliado) |

---

## Algoritmo por pasos

```
PASO 1 — Match exacto
  Para cada movimiento bancario B:
    Buscar en registros SAP donde:
      referencia == B.referencia AND
      monto == B.monto AND
      abs(fecha_SAP - fecha_banco) <= 1 día
    → Si encuentra: EXACTO

PASO 2 — Match por referencia + monto
  Para los que no matchearon en paso 1:
    Buscar donde referencia == B.referencia AND monto == B.monto
    → Si encuentra con desfase de fecha (hasta ±3 días): ALTO

PASO 3 — Match por monto + rango de fecha (sin referencia)
  Para los restantes:
    Buscar donde monto == B.monto AND fecha dentro de ±5 días
    → Si encuentra uno solo: MEDIO
    → Si encuentra varios: CANDIDATOS (mostrar al humano)

PASO 3b — Match con tolerancia de monto (±$2.000 COP)
  Para los restantes:
    Buscar donde abs(monto_SAP - B.monto) <= 2.000 COP AND fecha dentro de ±5 días
    → Si encuentra: TOLERANCIA (sugerido con diferencia a justificar)

PASO 4 — Match difuso (fuzzy)
  Comparar descripción bancaria con descripción SAP usando similitud de texto
  Umbral: similitud > 0.75 → BAJO (sugerencia)

PASO 5 — Sin match
  Todo lo que no pasó ningún paso → ABIERTO
```

---

## Caso especial: pago multi-factura

```
Movimiento banco: $8.500.000 — Cliente: EMPRESA ABC

Facturas abiertas de EMPRESA ABC:
  FAC-001: $3.000.000
  FAC-002: $2.500.000
  FAC-003: $3.000.000
  FAC-004: $1.200.000

Combinaciones que suman $8.500.000:
  → FAC-001 + FAC-002 + FAC-003 = $8.500.000 ✓

Resultado: el sistema propone que el pago cubre FAC-001, FAC-002, FAC-003
           y deja FAC-004 como pendiente
```

Ver detalles en [facturas-pagos-parciales.md](facturas-pagos-parciales.md)

---

## Campos necesarios por fuente

Estos son los **únicos** campos que el motor de matching necesita. Las queries a SAP deben limitarse exactamente a esta lista — ningún campo adicional.

**Extracto bancario:**
```
id_movimiento | fecha_valor | fecha_contable | monto | referencia | descripcion | tipo (CR/DB)
```

**Registros SAP (campos autorizados para queries):**
```
id_documento | fecha_doc | fecha_contab | monto | referencia | nit_cliente | num_factura | estado
```

Campos prohibidos en queries SAP para este módulo:
- Información de costeo, centros de costo, órdenes internas
- Datos del empleado o usuario SAP que creó el documento
- Campos de configuración o customizing
- Cualquier campo no listado arriba

Ver especificación completa de queries en [seguridad.md](seguridad.md#1-consultas-a-sap--principio-de-campo-mínimo)

---

## Limpieza y preprocesamiento de datos (Anulados)

Para garantizar la integridad y evitar falsos positivos de conciliación, el motor realiza una limpieza automática en el paso de preprocesamiento:
*   **Asientos anulados en SAP:** Si el sistema detecta que un número de documento (`num_doc`) tiene un registro original de crédito/débito y un registro correspondiente de reverso (indicado en comentarios como "Anular entrada para..." o "anulado") que anula el saldo a $0, **se descartan ambos registros**.
*   *Justificación de diseño:* Conservar el registro original (pago anulado) en el conjunto contable causaría que el motor intente conciliarlo contra movimientos del banco que ya no corresponden, dejando transacciones "fantasmas" marcadas permanentemente como pendientes en el reporte.

---

## Restricciones de seguridad en el motor

- El motor trabaja **únicamente** sobre los DataFrames en memoria cargados por `loader.py`
- El motor no realiza consultas directas a SAP — esa responsabilidad es de `loader.py`
- Ningún resultado intermedio del matching se escribe a disco
- El fuzzy matching (paso 4) opera sobre descripciones — no sobre datos de clientes o montos en texto

---

## Posibles implementaciones del motor

| Opción | Ventaja | Desventaja |
|--------|---------|------------|
| SQL puro (JOIN + WHERE) | Simple, rápido para exactos | No maneja fuzzy ni combinaciones |
| Python + pandas | Flexible, fácil de iterar | Requiere más código |
| Python + itertools (combinaciones) | Resuelve multi-factura | Costoso con muchas facturas |
| Algoritmo húngaro (assignment problem) | Óptimo matemáticamente | Complejidad de implementación |
