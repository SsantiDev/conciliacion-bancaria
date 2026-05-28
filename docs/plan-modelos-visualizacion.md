# Plan: Modelos, Validación y Visualización de Conciliación

← [Volver al objetivo](../objetivo.md)

---

## 1. Qué se quiere lograr

| # | Necesidad | Descripción |
|---|-----------|-------------|
| 1 | **Trazabilidad de cargas** | Guardar quién subió cada Excel, cuándo, desde dónde y qué contenía |
| 2 | **Validación de estructura** | Detectar si el Excel no tiene las columnas esperadas y notificar con precisión |
| 3 | **Estructura recomendada exportable** | Mostrar al usuario exactamente qué columnas debe tener cada archivo |
| 4 | **Razón de conciliación** | Para cada match, explicar por qué coincidió (referencia, monto, fecha, combinación) |
| 5 | **Visualización de tabla en React** | Tabla interactiva que muestre las filas del Excel con estado de conciliación por fila |

---

## 2. Modelos Django (SQLite)

Todos viven en `financiero/infrastructure/models.py`.

### 2.1 `CargaArchivo` — trazabilidad de cada upload

```python
class CargaArchivo(models.Model):
    TIPO_CHOICES = [('BANCO', 'Extracto Bancario'), ('SAP', 'Registros SAP')]
    ESTADO_CHOICES = [
        ('PENDIENTE', 'Pendiente validación'),
        ('VALIDO', 'Estructura válida'),
        ('INVALIDO', 'Estructura inválida'),
        ('PROCESADO', 'Conciliación completada'),
    ]

    tipo               = CharField(choices=TIPO_CHOICES)
    nombre_archivo     = CharField()          # nombre original del archivo
    hash_sha256        = CharField(unique=True)  # integridad: evita duplicados
    subido_por         = ForeignKey(User)     # quién lo subió
    subido_en          = DateTimeField(auto_now_add=True)
    ip_origen          = GenericIPAddressField()
    estado             = CharField(choices=ESTADO_CHOICES, default='PENDIENTE')
    total_filas        = IntegerField(null=True)
    errores_validacion = JSONField(default=list)  # lista de {columna, mensaje, severidad}
```

### 2.2 `MovimientoBancario` — filas del extracto banco

```python
class MovimientoBancario(models.Model):
    carga          = ForeignKey(CargaArchivo, on_delete=CASCADE)
    fila_excel     = IntegerField()       # número de fila original para referencia
    fecha_valor    = DateField()
    fecha_contable = DateField()
    referencia     = CharField(max_length=100)
    descripcion    = CharField(max_length=255)
    monto          = DecimalField(max_digits=18, decimal_places=2)
    tipo           = CharField(max_length=2)  # CR / DB
```

### 2.3 `RegistroContable` — filas del SAP / contabilidad

```python
class RegistroContable(models.Model):
    carga          = ForeignKey(CargaArchivo, on_delete=CASCADE)
    fila_excel     = IntegerField()
    fecha_doc      = DateField()
    fecha_contab   = DateField()
    num_factura    = CharField(max_length=50)
    nit_cliente    = CharField(max_length=20)
    nombre_cliente = CharField(max_length=255)
    referencia     = CharField(max_length=100)
    monto          = DecimalField(max_digits=18, decimal_places=2)
    estado         = CharField(max_length=10)  # ABIERTA / CERRADA
```

### 2.4 `Conciliacion` — sesión de conciliación (banco + SAP)

```python
class Conciliacion(models.Model):
    ESTADO_CHOICES = [
        ('EN_PROCESO', 'En proceso'),
        ('PENDIENTE_APROBACION', 'Pendiente aprobación'),
        ('APROBADA', 'Aprobada'),
        ('RECHAZADA', 'Rechazada'),
    ]

    carga_banco   = ForeignKey(CargaArchivo, related_name='conciliaciones_banco')
    carga_sap     = ForeignKey(CargaArchivo, related_name='conciliaciones_sap')
    creada_por    = ForeignKey(User, related_name='conciliaciones_creadas')
    aprobada_por  = ForeignKey(User, null=True, related_name='conciliaciones_aprobadas')
    creada_en     = DateTimeField(auto_now_add=True)
    aprobada_en   = DateTimeField(null=True)
    periodo       = CharField(max_length=8)  # formato semanal: YYYY-Www (ej. 2026-W22)
    estado        = CharField(choices=ESTADO_CHOICES, default='EN_PROCESO')
    resumen       = JSONField(default=dict)
    # resumen shape:
    # { "total": 247, "coinciden_total": 190, "coinciden_parcial": 30,
    #   "sin_match_banco": 15, "sin_match_sap": 12 }
```

### 2.5 `DetalleConciliacion` — resultado por fila + razón del match

```python
class DetalleConciliacion(models.Model):
    RESULTADO_CHOICES = [
        ('COINCIDE_TOTAL',   'Coincidencia total'),
        ('COINCIDE_PARCIAL', 'Coincidencia parcial'),
        ('SIN_MATCH_BANCO',  'Sin match en banco'),
        ('SIN_MATCH_SAP',    'Sin match en SAP'),
        ('DIFERENCIA_MONTO', 'Diferencia de monto'),
        ('DIFERENCIA_FECHA', 'Diferencia de fecha'),
        ('CORRECCION_MANUAL','Ajustado manualmente'),
    ]

    conciliacion      = ForeignKey(Conciliacion, on_delete=CASCADE)
    movimiento        = ForeignKey(MovimientoBancario, null=True)
    registro_contable = ForeignKey(RegistroContable, null=True)
    resultado         = CharField(choices=RESULTADO_CHOICES)
    confianza         = DecimalField(max_digits=5, decimal_places=2)  # 0.00 – 1.00
    razon_match       = JSONField(default=dict)   # ver sección 2.6
    ajustado_por      = ForeignKey(User, null=True)
    ajustado_en       = DateTimeField(null=True)
    notas_ajuste      = TextField(blank=True)
```

### 2.6 Estructura de `razon_match` (JSONField)

Esto alimenta directamente el panel "¿Por qué coincidió?" en el frontend:

```json
{
  "criterios_usados": ["referencia_exacta", "monto_exacto"],
  "criterios_fallidos": ["fecha_valor"],
  "detalle": {
    "referencia": { "banco": "TRF-00123", "sap": "TRF-00123", "match": true },
    "monto":      { "banco": 5000000, "sap": 5000000, "match": true },
    "fecha":      { "banco": "2026-05-01", "sap": "2026-05-03", "match": false, "delta_dias": 2 }
  },
  "paso_algoritmo": 1,
  "descripcion_legible": "Coincidencia por referencia exacta y monto idéntico. Fecha difiere 2 días (dentro del umbral)."
}
```

---

## 3. Validación de estructura del Excel (Dinámica por Fuente)

Debido a que cada banco y SAP exportan archivos con estructuras, cabeceras y formatos de columnas completamente diferentes, la validación estructural no se realiza contra una plantilla genérica unificada. En su lugar, el sistema detecta o requiere el tipo de fuente (Bancolombia, Davivienda, Bogotá, SAP) y valida la estructura específica de cada uno.

### 3.1 Columnas requeridas por banco / fuente

**1. Extracto Bancolombia (Sin cabecera):**
*   Se validan posiciones de columnas fijas.
*   Posición 0: Fecha en formato numérico (DDMMYYYY).
*   Posición 4: Descripción de la transacción (requerido).
*   Posición 5: Monto con signo.
*   Posición 8: Monto absoluto.
*   Posición 7: Tipo de movimiento ('C' para crédito, 'D' para débito).

**2. Extracto Davivienda:**
*   Se requiere detectar las columnas: `Fecha`, `Tran`, `Desc Mot.`, `Valor Total`, `ID Origen/Destino`.
*   Soporta detección de cabecera automática en las primeras 5 filas.

**3. Extracto Banco de Bogotá:**
*   Se requiere detectar las columnas: `Fecha`, `Transacción` o `Descripción`, `Documento`, `Débito`, `Crédito`.
*   Formato de fecha flexible, corrigiendo desfases de año.

**4. Reporte SAP (Libro Mayor):**
*   Se lee el archivo multi-hoja, asociando la hoja que coincida con el nombre del banco (ej: `11100507 -BOGOTA`).
*   Se validan y mapean las columnas: `Fecha de contabilización` (o contable), `Nº documento`, `Comentarios`, `Cuenta de contrapartida` (NIT), `Nombre de la cuenta de contrapartida` (descripción), y las columnas de montos `Cargo` y/o `Abono` (o columna única de monto).

### 3.2 Tipos de error de validación

| Código | Descripción | Severidad |
|--------|-------------|-----------|
| `HOJA_NO_ENCONTRADA` | No se encuentra la hoja correspondiente al banco | BLOQUEANTE |
| `COLUMNA_FALTANTE` | Columna requerida por el cargador específico no existe | BLOQUEANTE |
| `TIPO_INCORRECTO` | Valor no es del tipo esperado (ej. fecha mal formateada) | BLOQUEANTE |
| `VALOR_VACIO` | Celda requerida vacía | BLOQUEANTE |
| `VALOR_FUERA_RANGO` | Monto negativo en campo absoluto, fecha futura >30d | ADVERTENCIA |
| `ENCODING` | Problema de codificación en caracteres especiales | ADVERTENCIA |

### 3.3 Respuesta de validación (API → frontend)

```json
{
  "valido": false,
  "banco_detectado": "DAVIVIENDA",
  "total_filas": 206,
  "filas_con_error": 1,
  "errores": [
    {
      "codigo": "COLUMNA_FALTANTE",
      "columna": "Valor Total",
      "severidad": "BLOQUEANTE",
      "mensaje": "La columna 'Valor Total' es obligatoria para Davivienda y no fue encontrada.",
      "sugerencia": "Verifica que el encabezado esté en las primeras filas y se llame exactamente 'Valor Total'."
    }
  ]
}
```

---

## 4. Visualización en React/TypeScript

### 4.1 Árbol de componentes

```
src/presentation/conciliacion/
├── CargaArchivosPage.tsx        ← drag & drop + feedback de validación
├── TablaMovimientosBanco.tsx     ← tabla del extracto bancario (solo lectura)
├── TablaRegistrosSAP.tsx         ← tabla del SAP (solo lectura)
├── TablaConciliacion.tsx         ← tabla unificada con resultado por fila
├── DetalleConciliacionPanel.tsx  ← panel lateral: razón del match
├── AlertaValidacion.tsx          ← notificación de errores de estructura
└── EstructuraRecomendada.tsx     ← modal con template descargable
```

### 4.2 Tabla de conciliación — columnas

| Columna | Fuente | Notas de renderizado |
|---------|--------|----------------------|
| Referencia | banco | texto |
| Fecha banco | banco | formato `DD/MM/YYYY` |
| Monto banco | banco | `$` + separadores de miles |
| Fecha SAP | SAP | formato `DD/MM/YYYY` |
| N° Factura | SAP | texto |
| Monto SAP | SAP | `$` + separadores de miles |
| Delta | calculado | banco − SAP; rojo si ≠ 0 |
| Estado | `DetalleConciliacion.resultado` | badge de color (ver paleta) |
| Confianza | `DetalleConciliacion.confianza` | barra de progreso 0–100% |
| ¿Por qué? | `razon_match` | botón → abre panel lateral |

**Paleta de estados:**

| Estado | Color | Hex |
|--------|-------|-----|
| `COINCIDE_TOTAL` | verde | `#22c55e` |
| `COINCIDE_PARCIAL` | amarillo | `#eab308` |
| `SIN_MATCH_BANCO` / `SIN_MATCH_SAP` | rojo | `#ef4444` |
| `DIFERENCIA_MONTO` | naranja | `#f97316` |
| `CORRECCION_MANUAL` | azul | `#3b82f6` |

### 4.3 Panel "¿Por qué coincidió?" — wireframe

```
┌─────────────────────────────────────────────────┐
│  Razón de conciliación                  [ ✕ ]  │
│─────────────────────────────────────────────────│
│  Coincidencia por referencia exacta y monto     │
│  idéntico. Fecha difiere 2 días (dentro del     │
│  umbral permitido de 5 días).                   │
│                                                 │
│  Criterio      Banco         SAP        Match   │
│  ────────────────────────────────────────────   │
│  Referencia    TRF-00123     TRF-00123    ✓     │
│  Monto         $5.000.000    $5.000.000   ✓     │
│  Fecha valor   01/05/2026    03/05/2026   ~     │
│                                                 │
│  Paso del algoritmo: 1 (referencia exacta)      │
└─────────────────────────────────────────────────┘
```

### 4.4 Alerta de validación — wireframe

```
┌──────────────────────────────────────────────────────┐
│  ⚠  El archivo no sigue la estructura recomendada   │
│──────────────────────────────────────────────────────│
│  2 errores bloqueantes — no se puede procesar        │
│                                                      │
│  ✗  Columna 'fecha_contable' no encontrada           │
│     → Agrega esta columna en la fila 1 del Excel     │
│                                                      │
│  ✗  Fila 15, columna 'monto': formato incorrecto     │
│     Recibido: "1.200.000"   Esperado: "1200000.00"   │
│                                                      │
│  [ Ver estructura recomendada ]     [ Cancelar ]     │
└──────────────────────────────────────────────────────┘
```

---

## 5. API endpoints necesarios (DRF — ya instalado en settings)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/cargas/banco/` | Subir extracto bancario → valida + guarda |
| `POST` | `/api/cargas/sap/` | Subir archivo SAP → valida + guarda |
| `GET` | `/api/cargas/{id}/validacion/` | Resultado de validación |
| `GET` | `/api/cargas/{id}/estructura-recomendada/` | Template de columnas descargable |
| `POST` | `/api/conciliaciones/` | Iniciar conciliación (carga_banco_id + carga_sap_id) |
| `GET` | `/api/conciliaciones/{id}/detalles/` | Tabla con resultado por fila |
| `PATCH` | `/api/conciliaciones/{id}/detalles/{det_id}/` | Corrección manual |
| `POST` | `/api/conciliaciones/{id}/aprobar/` | Aprobar (≠ usuario que corrigió) |

---

## 6. Orden de implementación recomendado

```
Fase 1 — Base (sin UI)
  [1] models.py: CargaArchivo + MovimientoBancario + RegistroContable
  [2] python manage.py makemigrations && migrate
  [3] Servicio validación: application/validacion.py
  [4] Parser Excel → modelos: infrastructure/parsers.py
  [5] API: POST /api/cargas/banco/ con validación integrada

Fase 2 — Motor de matching
  [6] models.py: Conciliacion + DetalleConciliacion
  [7] Motor de matching: application/matching.py
  [8] API: POST /api/conciliaciones/ + GET /detalles/

Fase 3 — Frontend
  [9]  CargaArchivosPage + AlertaValidacion
  [10] TablaConciliacion con paleta de colores
  [11] DetalleConciliacionPanel (razón del match)
  [12] Flujo aprobación (segregación: aprobador ≠ corrector)
```

---

## 7. Reglas no negociables

- Ningún Excel persiste en disco — parsear en memoria, eliminar inmediatamente
- `CargaArchivo.hash_sha256` con `unique=True` previene cargar el mismo archivo dos veces
- `Conciliacion.aprobada_por` ≠ ningún `DetalleConciliacion.ajustado_por` de esa conciliación
- Campos de auditoría (`subido_en`, `ajustado_en`, `aprobada_en`) son `auto_now_add` o asignados una sola vez — nunca sobreescritos
- `razon_match` como JSON desacopla el frontend del algoritmo interno
- Todos los endpoints de escritura requieren autenticación (agregar cuando se implemente auth)
