# Sistema de Conciliación Bancaria

## Objetivo

Desarrollar una herramienta que permita comparar movimientos de extractos bancarios contra registros contables (SAP u otra fuente), identificar coincidencias totales, parciales y ausencias, y permitir que un humano valide, corrija y apruebe el resultado final antes de que sea definitivo.

---

## Casos de uso core

| # | Caso | Descripción |
|---|------|-------------|
| 1 | Pago total | Un pago bancario cubre exactamente una factura |
| 2 | Pago parcial multi-factura | Un pago cubre N de M facturas de un cliente |
| 3 | Sin coincidencia bancaria | Factura registrada pero sin movimiento en banco |
| 4 | Sin coincidencia contable | Movimiento en banco sin factura/registro en SAP |
| 5 | Diferencia de monto | Coincidencia de referencia pero monto distinto |
| 6 | Diferencia de fecha | Mismo monto/referencia pero fecha desfasada |

---

## Flujo general del sistema

```
[Cargar extracto bancario]
        ↓
[Cargar datos SAP / contabilidad]
        ↓
[Motor de matching automático]
        ↓
[Clasificación de resultados]
   ├── Conciliados automáticamente
   ├── Coincidencias parciales (requieren revisión)
   └── Sin coincidencia (requieren acción)
        ↓
[Preview para el humano]
        ↓
[Corrección manual si aplica]
        ↓
[Aprobación humana]
        ↓
[Resultado final / reporte]
```

---

## Módulos del sistema

| Módulo | Doc de referencia |
|--------|-------------------|
| Algoritmo de matching | [docs/algoritmo-matching.md](docs/algoritmo-matching.md) |
| Diferenciación de facturas y pagos parciales | [docs/facturas-pagos-parciales.md](docs/facturas-pagos-parciales.md) |
| Dashboard de no coincidencias y diagnóstico | [docs/no-coincidencias.md](docs/no-coincidencias.md) |
| Corrección manual | [docs/correccion-manual.md](docs/correccion-manual.md) |
| Flujo de aprobación humana | [docs/aprobacion-humana.md](docs/aprobacion-humana.md) |
| Arquitectura técnica y stack | [docs/arquitectura.md](docs/arquitectura.md) |
| **Seguridad de la información** | [docs/seguridad.md](docs/seguridad.md) |

---

## Restricciones funcionales

- Ninguna conciliación se marca como definitiva sin aprobación humana
- Los ajustes manuales deben quedar auditados (quién, cuándo, qué cambió)
- El sistema sugiere, el humano decide

## Restricciones de seguridad (no negociables)

- Todas las consultas a SAP usan campos explícitos — `SELECT *` prohibido
- Parámetros de query siempre vinculados — cero concatenación de strings
- Los archivos cargados no persisten en disco después del procesamiento
- Credenciales SAP nunca en código ni en repositorio git
- Ningún usuario puede aprobar una conciliación que él mismo corrigió (segregación de funciones)
- Logs de auditoría son append-only e inmutables — retención mínima 5 años
- Ver política completa en [docs/seguridad.md](docs/seguridad.md)
