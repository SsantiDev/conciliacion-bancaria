# Arquitectura Técnica

← [Volver al objetivo](../objetivo.md)

## Opciones de stack (4 días de desarrollo)

### Opción A — Python + Streamlit (recomendada para prototipo rápido)

```
Ventajas:
  - Streamlit levanta UI interactiva con muy poco código
  - pandas maneja Excel/CSV del banco y SAP sin esfuerzo
  - Todo en Python, sin separar frontend y backend
  - Listo en 2 días, 2 días para pulir

Desventajas:
  - No escala bien a producción (un usuario a la vez)
  - UX limitado comparado con web app real
```

### Opción B — FastAPI (backend) + React (frontend)

```
Ventajas:
  - UI rica, flujo de aprobación con estados visuales claros
  - Escala a producción
  - Separación limpia backend/frontend

Desventajas:
  - 4 días es justo para tener algo funcional
  - Requiere más boilerplate inicial
```

### Opción C — Excel + Python script (mínimo viable)

```
Ventajas:
  - Lo más rápido de hacer
  - Los contadores ya saben usar Excel

Desventajas:
  - Sin flujo de aprobación real
  - Sin UI para corrección manual
  - No escalable
```

---

## Arquitectura recomendada (Opción A — Python + Streamlit)

```
conciliacion-bancaria/
├── data/
│   ├── extracto_banco.csv       ← sube el usuario
│   └── registros_sap.xlsx       ← sube el usuario
│
├── engine/
│   ├── loader.py                ← carga y normaliza ambas fuentes
│   ├── matcher.py               ← algoritmo de matching por pasos
│   ├── invoice_resolver.py      ← lógica multi-factura / combinaciones
│   └── diagnostics.py          ← clasifica no-coincidencias
│
├── state/
│   └── session.py               ← estado en memoria de la sesión activa
│
├── ui/
│   ├── pages/
│   │   ├── 01_cargar_datos.py
│   │   ├── 02_resultado_matching.py
│   │   ├── 03_no_coincidencias.py
│   │   ├── 04_correccion_manual.py
│   │   └── 05_aprobacion_preview.py
│   └── components/
│       ├── tabla_conciliaciones.py
│       └── panel_facturas.py
│
├── reports/
│   └── exporter.py              ← genera Excel de resultado final
│
└── app.py                       ← entry point Streamlit
```

---

## Flujo de datos

```
[CSV banco] ──→ loader.py ──→ DataFrame normalizado
[XLSX SAP]  ──→ loader.py ──→ DataFrame normalizado
                                        ↓
                               matcher.py (pasos 1-5)
                                        ↓
                  ┌─────────────────────────────────┐
                  │  resultado: lista de matches    │
                  │  cada ítem tiene:               │
                  │    - nivel_confianza            │
                  │    - facturas_propuestas[]      │
                  │    - estado (PROPUESTO/ABIERTO) │
                  └─────────────────────────────────┘
                                        ↓
                              UI Streamlit (páginas)
                                        ↓
                              [Correcciones manuales]
                                        ↓
                              [Aprobación → export]
```

---

## Formato de entrada esperado

**Extracto bancario (CSV):**
```
fecha_valor,fecha_contable,referencia,descripcion,monto,tipo
2026-05-01,2026-05-01,TRF-00123,TRANSFERENCIA CLIENTE ABC,5000000,CR
2026-05-02,2026-05-02,CHQ-00456,CHEQUE 456,-1200000,DB
```

**SAP (Excel / CSV exportado):**
```
fecha_doc,fecha_contab,num_factura,nit_cliente,nombre_cliente,referencia,monto,estado
2026-05-01,2026-05-01,FAC-001,900123456,EMPRESA ABC,TRF-00123,5000000,ABIERTA
```

---

## Plan de 4 días

| Día | Tarea |
|-----|-------|
| 1 | Loader + normalización + matcher pasos 1 y 2 |
| 2 | Matcher pasos 3-5 + lógica multi-factura + diagnóstico |
| 3 | UI: cargar datos, resultado matching, no-coincidencias |
| 4 | UI: corrección manual + preview + aprobación + export |

---

## Consideraciones de seguridad por capa

### `engine/loader.py` — capa de ingesta

```python
# Responsabilidades de seguridad:
# 1. Validar extensión + magic bytes del archivo
# 2. Cargar en DataFrame y eliminar el archivo del disco inmediatamente
# 3. Validar que las columnas requeridas existen antes de procesar
# 4. No loggear contenido de filas — solo métricas (cantidad de filas, columnas)

def cargar_extracto_banco(ruta_archivo: str) -> pd.DataFrame:
    validar_archivo(ruta_archivo)                   # extensión + magic bytes
    df = pd.read_csv(ruta_archivo, dtype=str)       # leer como string primero
    os.remove(ruta_archivo)                          # eliminar de disco
    return normalizar_y_validar(df)
```

### `engine/matcher.py` — capa de matching

```
- Opera únicamente sobre DataFrames en memoria
- No realiza consultas directas a SAP ni a ninguna base de datos
- No escribe resultados intermedios a disco
- No loggea valores de montos ni datos de clientes
```

### `state/session.py` — estado de sesión

```
- El estado vive en memoria del proceso, no en disco
- Incluir timestamp de creación y de última actividad
- Invalidar automáticamente si inactividad > 30 minutos
- Al invalidar: limpiar el DataFrame de memoria (del gc, no solo la referencia)
```

### Estructura de carpeta `data/` en producción

```
data/
  └── .gitignore   ← ignorar TODO — esta carpeta nunca debe llegar al repositorio

El directorio data/ existe solo en el servidor de ejecución.
Nunca comitear archivos de extractos ni de SAP al repositorio git.
```

### Variables de entorno requeridas

```bash
# .env (excluido de git desde el primer commit)
SAP_HOST=erp.empresa.internal
SAP_USER=USR_CONCIL_RO
SAP_PASSWORD=<secret>
SAP_CLIENT=100
SECRET_KEY=<clave para signing de tokens de sesión>
ALLOWED_HOSTS=localhost,conciliacion.empresa.internal
MAX_UPLOAD_MB=50
SESSION_TIMEOUT_MIN=30
```

### `.gitignore` mínimo obligatorio

```
.env
data/
*.csv
*.xlsx
__pycache__/
*.pyc
logs/
reports/output/
```
