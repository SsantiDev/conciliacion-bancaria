# Plan de Mejoras del Motor de Matching (Pendientes por Validar)
**Proyecto:** Conciliación Bancaria vs SAP
**Fecha:** 28 de Mayo de 2026

Este documento detalla las mejoras identificadas para optimizar la tasa de matching automático y resolver la diferencia acumulada de montos (como el caso de los mil millones en Bancolombia). Estas mejoras requieren **validación técnica y de negocio** conjunta con el cliente (Tesorería y Contabilidad) antes de su implementación en el MVP o Fase 2.

---

## 📌 Resumen de Mejoras y Estado de Validación

| # | Mejora Propuesta | Problema que Resuelve | Complejidad | Estado de Validación Requerido |
|---|---|---|:---:|---|
| **1** | **Matching 1-a-N / N-a-1 (Consolidación)** | Egresos masivos (ej: PSE de $140M) contra registros contables individuales en SAP. | Alta | **Crítico**. Confirmar cómo agrupa SAP las dispersiones de nómina y proveedores. |
| **2** | **Filtro de Traslados Espejo** | Transferencias internas entre cuentas propias que inflan artificialmente las diferencias. | Media | **Importante**. Validar palabras clave estándar de traslados en extractos bancarios. |
| **3** | **Uso de Cuentas de Compensación SAP** | Desfases temporales de registro (pagos emitidos vs. pagos efectivos). | Baja | **Importante**. Confirmar si SAP usa cuentas transitorias (puente) por banco. |
| **4** | **Ventana de Fechas en Días Hábiles** | Falsos positivos por transacciones de fin de semana (procesadas el lunes). | Baja | **Viable**. Integrar calendario de festivos de Colombia en el motor. |
| **5** | **Mapeo de Gastos Directos (Leasing/DIAN)** | Movimientos del banco que no corresponden a facturas comerciales de clientes o proveedores. | Media | **Pendiente**. Definir las cuentas de contrapartida en SAP para Leasing e Impuestos. |

---

## 🔍 Detalle de las Propuestas de Mejora

### 1. Matching 1-a-N / N-a-1 (Lógica de Sumatorias o Consolidación)
*   **Contexto:** El extracto bancario suele registrar un único egreso consolidado por dispersiones de nómina o pago masivo de proveedores (ej: un débito de $140.000.000). En SAP, estos pagos se contabilizan individualmente por tercero.
*   **Propuesta Técnica:** Implementar un algoritmo de suma de subconjuntos (Subset Sum) limitado:
    *   Para un movimiento no matcheado en el banco (ej: Egreso de $140M), buscar en SAP un grupo de registros abiertos del mismo día (y hasta ±2 días) cuya suma sea exactamente igual al movimiento bancario.
    *   Para evitar complejidad exponencial, la búsqueda se acota a transacciones con la misma clasificación de tipo de documento (ej: Serie `PP` - Pagos Proveedores).
*   **Validación Requerida con el Cliente:**
    *   ¿SAP genera algún identificador de lote o número de planilla de dispersión en el campo `Comentarios` o `Nº documento` al hacer pagos masivos?
    *   Si existe este identificador, el matching puede ser exacto 1-a-1 por referencia de lote en lugar de usar sumatorias ciegas en memoria.

---

### 2. Detección y Mapeo de Traslados de Fondos (Traslados Espejo)
*   **Contexto:** Las transferencias entre cuentas de la misma empresa (ej. transferir de Davivienda para fondear Bancolombia) generan un egreso en un banco y un ingreso en el otro. En SAP, esto pasa por cuentas puente de traslados (ej: cuenta contable 11100599).
*   **Propuesta Técnica:** Implementar una regla espejo automática en el loader:
    *   Si se detecta un egreso en Bancolombia con la palabra `TRASLADO` o `FONDEO` de valor $X, buscar en Davivienda y Banco de Bogotá un ingreso de valor $X en un rango de ±1 día.
    *   Si se encuentra la contrapartida espejo, pre-conciliar ambos movimientos bancarios contra el asiento de traslado contable en SAP.
*   **Validación Requerida con el Cliente:**
    *   Confirmar la lista completa de conceptos/descripciones con los que los 3 bancos registran las transferencias entre cuentas propias en los extractos.

---

### 3. Filtro Dinámico de Cuentas de Compensación SAP
*   **Contexto:** El Libro Mayor de SAP a veces reporta la cuenta definitiva del banco, la cual se ve afectada solo cuando la conciliación ya está registrada. Esto genera inconsistencias temporales durante el proceso de matching.
*   **Propuesta Técnica:** Ajustar las consultas y cargas de SAP para que apunten exclusivamente a las **cuentas transitorias de compensación bancaria** (ej: cuentas de pagos emitidos pendientes de cobro y recaudos en tránsito).
*   **Validación Requerida con el Cliente:**
    *   ¿El plan de cuentas contable de la empresa maneja cuentas transitorias (compensadoras) por cada banco, o se contabiliza directamente contra la cuenta real principal?

---

### 4. Parametrización de Ventana de Fechas en Días Hábiles
*   **Contexto:** Las operaciones de fin de semana (sábados y domingos) son registradas por los bancos con fecha del lunes siguiente, mientras que contabilidad (SAP) las registra el viernes. La regla estándar de ±5 días calendario puede generar falsos positivos con transacciones recurrentes del mismo monto de la semana anterior.
*   **Propuesta Técnica:** Sustituir la lógica de días calendario por días hábiles:
    *   Importar un calendario de días festivos en Colombia.
    *   Calcular el delta de fechas del motor de matching en días hábiles (ej: el desfase del viernes 15 al lunes 18 sería de 1 día hábil en lugar de 3 días calendario).
*   **Validación Requerida con el Cliente:**
    *   Validar si tesorería está de acuerdo con usar un máximo de 3 días hábiles de desfase para considerar un pre-match automático.

---

### 5. Desvío y Mapeo Especializado de Gastos Directos (Leasing, Impuestos y Nómina)
*   **Contexto:** Pagos recurrentes no comerciales como leasing financieros o impuestos (DIAN) no tienen facturas de proveedores asociadas en la tabla de partidas abiertas de SAP. El motor intenta cruzarlos infructuosamente contra facturas comerciales.
*   **Propuesta Técnica:** Implementar reglas de desvío basadas en la descripción del banco:
    *   Si la descripción del banco contiene `LEASING`, `DIAN`, `RETENCION`, desviar el registro para buscar correspondencia en el módulo de Asientos de Diario o Cuentas de Gasto en SAP en lugar del módulo de Proveedores/Clientes.
*   **Validación Requerida con el Cliente:**
    *   Confirmar bajo qué tipo de documento SAP y en qué cuentas específicas se registran los pagos de Leasing e Impuestos (ej: si usan documentos tipo `NBAN` o asientos manuales).
