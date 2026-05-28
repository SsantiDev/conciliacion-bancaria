# Análisis de Estructuras y Encabezados de Archivos Excel
**Proyecto:** Conciliación Bancaria vs SAP
**Fecha de Análisis:** 28 de Mayo de 2026

Este documento detalla la estructura física, ubicación de cabeceras y nombres exactos de las columnas para cada uno de los archivos Excel de extractos bancarios y del Libro Mayor de SAP provistos como muestras.

---

## 1. Extractos Bancarios

### 1.1 Banco Davivienda
*   **Archivo:** `docs/Extracto/04-BANCO DAVIVIENDA 9858.xlsx`
*   **Hojas del libro:** `Movimientos0560039269999858 - 2`, `GASTOS`

#### Hoja 1: `Movimientos0560039269999858 - 2`
Esta hoja contiene la información de transacciones principales. La cabecera real se encuentra en la **Fila 2** (las filas 0 y 1 contienen celdas vacías y metadatos de título).

| Índice Columna | Nombre de Columna (Fila 2) | Descripción de Contenido / Formato |
|:---:|---|---|
| 0 | `Fecha` | Fecha de la operación (`YYYY-MM-DD`) |
| 1 | `Doc.` | Número de documento / soporte |
| 2 | `Tran` | Tipo de transacción (ej. `Notas Credito`, `Notas Debito`, `Deposito Especial`) |
| 3 | `Ofi.` | Sucursal u origen del canal (ej. `DAVIPLATA`, `PORTAL-EMPRESARIAL`) |
| 4 | `Jor.` | Tipo de jornada (ej. `Normal`) |
| 5 | `Hora` | Hora del movimiento (`HH:MM:SS`) |
| 6 | `Mot.` | Código numérico del motivo de transacción |
| 7 | `Desc Mot.` | Descripción de la transacción (ej. `Abono Por Pago a proveedores...`) |
| 8 | `Valor Total` | Monto del movimiento (número decimal) |
| 9 | `Valor Cheque` | Valor de cheques incluidos en la consignación |
| 10 | `ID Origen/Destino` | Identificación tributaria o cédula del tercero (si aplica) |
| 11 | `Referencia 1` | Primera referencia opcional provista por el canal |
| 12 | `Referencia 2` | Segunda referencia opcional provista por el canal |
| 13 | `Terminal` | Identificador de terminal física o virtual |
| 14 | `Fecha Movto.` | Fecha contable de procesamiento |
| 15 | `Ciudad` | Ciudad de origen del movimiento |
| 16 | `Valor Saldo` | Saldo acumulado de la cuenta tras la transacción |

#### Hoja 2: `GASTOS`
Esta hoja contiene registros de comisiones y cargos bancarios. La cabecera se encuentra en la **Fila 0**.

| Índice Columna | Nombre de Columna (Fila 0) |
|:---:|---|
| 0 | `Fecha` |
| 1 | `Doc.` |
| 2 | `Tran` |
| 3 | `Ofi.` |
| 4 | `Mot.` |
| 5 | `Desc Mot.` |
| 6 | `Valor Total` |

---

### 1.2 Banco Bancolombia
*   **Archivo:** `docs/Extracto/04-BANCOLOMBIA 0411.xlsx`
*   **Hojas del libro:** `E222750411_20260505_144230`

#### Hoja 1: `E222750411_20260505_144230`
**Este archivo no posee una fila de cabeceras.** Los datos se leen por posición fija de columna. La Fila 0 contiene valores nulos (`NaN`) y los datos operativos inician desde la Fila 1.

| Índice de Columna (Pandas) | Contenido de Muestra | Significado / Mapeo en el Motor |
|:---:|---|---|
| 0 | `1042026.0` | Fecha de la transacción en formato numérico `DDMMYYYY` |
| 1 | `222750411.0` | Cuenta bancaria asociada |
| 2 | `1.0` | Código de operación |
| 3 | `0.0` | Código de canal / sucursal |
| 4 | `SERVICIO PAGO A OTROS BANCOS` | Descripción del movimiento (utilizado para el matching) |
| 5 | `-5786.61` | Valor firmado del movimiento (negativo para egresos/débitos) |
| 6 | `6.0` | Comisión o saldo de la transacción |
| 7 | `D` | Tipo de movimiento (`C` = Crédito/Ingreso, `D` = Débito/Egreso) |
| 8 | `5786.61` | Valor absoluto del movimiento (siempre positivo) |

---

### 1.3 Banco de Bogotá
*   **Archivo:** `docs/Extracto/04-BOGOTA 8295.xlsx`
*   **Hojas del libro:** `CORP_01042026a3004202613169Movi`

#### Hoja 1: `CORP_01042026a3004202613169Movi`
La cabecera real se encuentra en la **Fila 0**. 

| Índice Columna | Nombre de Columna (Fila 0) | Descripción / Formato |
|:---:|---|---|
| 0 | `Fecha` | Fecha del movimiento (ej. `2026-04-01`) |
| 1 | `Transacción` | Descripción de la transacción (ej. `Abono dispersion pago a proveedores`) |
| 2 | `Oficina` | Sucursal u origen del canal (ej. `BANCA ELECTRONICA`) |
| 3 | `Documento` | Número de documento contable / NIT de contrapartida |
| 4 | `Débito` | Valor de egreso (vacío si es ingreso) |
| 5 | `Crédito` | Valor de ingreso (vacío si es egreso) |

---

## 2. Libro Mayor de SAP

*   **Archivo:** `docs/SAP/LIBRO MAYOR SAP.xlsx`
*   **Hojas del libro:** `11100507 -BOGOTA`, `11100506 - BANCOLOMBIA`, `11100508 - DAVIVIENDA`

Todas las hojas comparten exactamente la misma estructura de columnas. La cabecera real está ubicada en la **Fila 0**.

| Índice Columna | Nombre de Columna (Fila 0) | Descripción / Significado en el Sistema |
|:---:|---|---|
| 0 | `Fecha de contabilización` | Fecha en la que se registró contablemente la operación en SAP |
| 1 | `Fecha de vencimiento` | Fecha pactada de vencimiento de la partida |
| 2 | `Fecha de documento` | Fecha física del soporte / factura |
| 3 | `Serie` | Código de serie de transacción SAP (ej. `PNL`, `RCB`, `DEP`, `NBAN`) |
| 4 | `Nº documento` | Identificador de documento SAP (ej. `PP 71685`, `PR 291289`, `DP 46019`) |
| 5 | `Comentarios` | Comentarios del registro (incluye "anulado" o "Anular entrada para...") |
| 6 | `Cuenta de contrapartida` | Identificador del tercero o cuenta (NIT del cliente) |
| 7 | `Nombre de la cuenta de contrapartida` | Razón social o nombre del cliente / proveedor |
| 8 | `Cargo/Abono (ML)` | Monto contable en Moneda Local (positivo para ingresos, negativo para egresos) |
