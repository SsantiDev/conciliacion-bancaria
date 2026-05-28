# Corrección Manual

← [Volver al objetivo](../objetivo.md) | [No coincidencias](no-coincidencias.md) | [Aprobación humana](aprobacion-humana.md)

## Por qué existe

El motor automático no puede resolver todo. El humano necesita poder:
- Forzar un match que el sistema no detectó
- Dividir un pago entre facturas específicas
- Ignorar un movimiento (cargo bancario, error, etc.)
- Registrar el motivo de cada ajuste (auditoría)

---

## Operaciones disponibles

### 1. Forzar match manual

```
El usuario selecciona:
  [Movimiento banco]   +   [Factura(s) SAP]
  $5.000.000               FAC-101: $5.000.000

Acciones posibles:
  → Conciliar exacto        (monto cuadra)
  → Conciliar con diferencia (aceptar y registrar delta como ajuste)
  → Conciliar parcial       (el pago cubre solo parte de la factura)
```

### 2. Ignorar movimiento

```
Movimiento: -$45.000 "COMISION BANCARIA"

Opciones:
  → Ignorar: Cargo bancario (no requiere documento SAP)
  → Ignorar: Duplicado (ya procesado)
  → Ignorar: Fuera de período
  → Ignorar: Otro (campo libre de motivo)
```

### 3. Dividir pago entre facturas

```
Pago: $7.000.000

El usuario selecciona facturas del cliente:
  FAC-201: $4.000.000  → aplicar $4.000.000  (cubierta total)
  FAC-202: $5.000.000  → aplicar $3.000.000  (parcial, queda $2.000.000 pendiente)

Sistema muestra:
  Aplicado: $7.000.000 / Sin aplicar: $0
  FAC-202 queda con saldo abierto de $2.000.000
```

### 4. Marcar como pendiente de período siguiente

```
SAP_SIN_BANCO → humano indica que el pago llegará en el próximo período
Sistema: marca la factura como "en tránsito" y la excluye del cierre actual
```

---

## Registro de auditoría (obligatorio)

Cada corrección manual genera un log:

```
AjusteManual {
  id_ajuste: uuid
  fecha_hora: timestamp      // formato: YYYY-MM-DD HH:MM:SS
  usuario: string
  tipo_ajuste: FORZAR_MATCH | IGNORAR | DIVIDIR | PENDIENTE
  id_movimiento_banco: string
  facturas_afectadas: string[]
  motivo: string             // campo libre, obligatorio
  estado_anterior: string
  estado_nuevo: string
}
```

---

## UX recomendado para la pantalla de corrección

```
┌──────────────────────────────────────────────────────────────┐
│  CORRECCIÓN MANUAL                                            │
├─────────────────────────┬────────────────────────────────────┤
│  BANCO                  │  SAP / FACTURAS                    │
│  Ref: TRF-00789         │  [ Buscar factura o cliente... ]  │
│  Monto: $9.800.000      │                                    │
│  Fecha: 2026-05-03      │  Resultados:                       │
│  Desc: PAGO EMP XYZ     │  ○ FAC-301  $10.000.000  EMP XYZ  │
│                         │  ○ FAC-302  $9.800.000   EMP XYZ  │
│                         │  ○ FAC-303  $4.900.000   EMP XYZ  │
├─────────────────────────┴────────────────────────────────────┤
│  Motivo del ajuste: [______________________________________]  │
│  (campo obligatorio)                                         │
├──────────────────────────────────────────────────────────────┤
│              [Cancelar]  [Ignorar movimiento]  [Aplicar →]   │
└──────────────────────────────────────────────────────────────┘
```

---

## Reglas de negocio

- Motivo **obligatorio** — sin texto no se puede guardar
- Toda corrección manual pasa por aprobación antes de ser definitiva
- Se puede corregir una corrección, pero el log de ambas versiones se conserva
- Un movimiento ignorado puede des-ignorarse antes de la aprobación final

---

## Restricciones de seguridad

### Control de acceso a la corrección manual

```
Solo los roles ANALYST, APPROVER y ADMIN pueden acceder a esta pantalla.
El rol VIEWER recibe HTTP 403 si intenta acceder a cualquier endpoint de corrección.
```

### Segregación de funciones — regla crítica

```
Un usuario que realizó una corrección manual sobre un ítem
NO puede ser el mismo que aprueba ese ítem.

El sistema debe:
  1. Registrar qué usuario realizó cada corrección (user_id en AjusteManual)
  2. En la pantalla de aprobación, bloquear automáticamente los ítems
     modificados por el usuario actual (mostrarlos como "requiere otro aprobador")
```

### Validación de entradas en corrección manual

```python
# El campo "motivo" debe validarse en backend, no solo en UI
VALIDACIONES_MOTIVO = {
    "min_caracteres": 10,
    "max_caracteres": 500,
    "no_html": True,          # sanitizar para prevenir XSS si se renderiza
    "no_scripts": True
}

# El id_movimiento y num_factura recibidos del frontend
# deben verificarse contra la base de datos antes de aplicar el ajuste
# (no confiar en los IDs que envía el cliente)
```

### Registro de auditoría extendido

Al modelo `AjusteManual` definido arriba, agregar:
```
ip_origen: string         // IP desde donde se realizó el ajuste
user_agent: string        // navegador/cliente (para detección de anomalías)
session_id: string        // id de sesión activa al momento del ajuste
```
