# Flujo de Aprobación Humana

← [Volver al objetivo](../objetivo.md) | [Corrección manual](correccion-manual.md)

## Por qué el humano debe aprobar

- Errores del algoritmo pueden generar matches incorrectos
- Las correcciones manuales deben ser validadas antes de volverse definitivas
- El cierre contable requiere una firma de responsabilidad
- Auditoría: queda registro de quién aprobó qué y cuándo

---

## Estados de una conciliación

```
PROPUESTO     → el sistema hizo un match automático (aún no aprobado)
EN_REVISION   → el humano está revisando / corrigiendo
APROBADO      → el humano confirmó
RECHAZADO     → el humano rechazó (vuelve a PROPUESTO o queda ABIERTO)
DEFINITIVO    → aprobado + período cerrado (inmutable)
```

Diagrama de flujo:

```
[Motor automático]
       ↓
   PROPUESTO
       ↓
[Humano revisa en preview]
       ├── Aprueba → APROBADO
       ├── Corrige → EN_REVISION → PROPUESTO (nuevo match sugerido)
       └── Rechaza → ABIERTO (va a no-coincidencias)
       ↓
[Cierre de período]
       ↓
   DEFINITIVO (inmutable)
```

---

## Pantalla de preview (antes de aprobar)

```
┌──────────────────────────────────────────────────────────────┐
│  PREVIEW CONCILIACIÓN — Semana 22, 2026                       │
├───────────────────────────┬──────────────────────────────────┤
│  RESUMEN                  │  DETALLE                         │
│  ✅ Conciliados: 142      │  [Ver lista completa →]          │
│  ⚠️  Parciales: 8         │  [Ver parciales →]               │
│  ❌ Sin match: 5          │  [Ver sin match →]               │
│  ✏️  Manuales: 3          │  [Ver ajustes manuales →]        │
├───────────────────────────┴──────────────────────────────────┤
│  Saldo banco:      $124.500.000                              │
│  Saldo SAP:        $124.320.000                              │
│  Diferencia:           $180.000  ← debe justificarse         │
├──────────────────────────────────────────────────────────────┤
│  [ ] Diferencia justificada: Cargo bancario GMF $180.000     │
├──────────────────────────────────────────────────────────────┤
│  Aprobado por: [______________]   Cargo: [________________]  │
│  Observaciones: [_____________________________________________]│
│                                                              │
│           [Volver a revisar]       [APROBAR Y CERRAR ✓]     │
└──────────────────────────────────────────────────────────────┘
```

---

## Aprobación por niveles (opcional)

Si el monto sin justificar supera un umbral, escalar:

| Diferencia sin justificar | Quién aprueba |
|---------------------------|---------------|
| < $500.000 | Analista contable |
| $500.000 – $5.000.000 | Jefe de contabilidad |
| > $5.000.000 | Dirección financiera |

---

## Qué queda grabado al aprobar

```
AprobacionFinal {
  id_aprobacion: uuid
  periodo: string             // formato semanal: YYYY-Www (ej. 2026-W22)
  fecha_aprobacion: timestamp // formato: YYYY-MM-DD HH:MM:SS
  usuario_aprobador: string
  cargo: string
  observaciones: string
  total_conciliados: int
  total_sin_match: int
  diferencia_final: decimal
  hash_snapshot: string       // hash del estado al momento de aprobar
}
```

---

## Restricciones post-aprobación

- Un período DEFINITIVO no puede modificarse desde la UI
- Cualquier corrección posterior requiere reapertura con justificación explícita
- El snapshot del estado queda almacenado para auditoría futura

---

## Restricciones de seguridad en la aprobación

### Autenticación reforzada

```
El acto de "APROBAR Y CERRAR" requiere:
  1. Sesión activa válida (no expirada)
  2. Re-autenticación del usuario en el momento del cierre (confirmar contraseña o 2FA)
     → Evita que una sesión abandonada sea usada para aprobar

La re-autenticación no debe ser bypass-able desde el frontend.
El backend debe validar independientemente antes de escribir el estado DEFINITIVO.
```

### Validación de integridad antes de aprobar

```python
# Antes de marcar como DEFINITIVO, el backend debe:
# 1. Recalcular el hash del estado actual
# 2. Compararlo con el hash que el frontend envía como "estado revisado"
# 3. Si difieren → alguien modificó datos entre que el humano abrió el preview
#    y cuando hizo clic en Aprobar → rechazar y pedir nueva revisión

def validar_integridad_antes_de_aprobar(periodo_id, hash_enviado_por_frontend):
    hash_actual = calcular_hash_estado(periodo_id)
    if hash_actual != hash_enviado_por_frontend:
        raise IntegridadVioladaError("Estado modificado durante la revisión")
```

### Protección del endpoint de aprobación

```
POST /api/conciliacion/{periodo}/aprobar

Controles obligatorios:
  - Autenticación: sesión válida + re-autenticación
  - Autorización: rol APPROVER o ADMIN
  - CSRF token válido
  - Rate limiting: máximo 3 intentos por minuto (evitar fuerza bruta de tokens)
  - Idempotencia: si el período ya es DEFINITIVO, retornar 409 Conflict
```

### Qué se registra en el log al aprobar

Además del modelo `AprobacionFinal`, registrar en el log de auditoría:
```
accion:        APROBAR_PERIODO
ip_origen:     string
session_id:    string
hash_snapshot: string   // SHA-256 del estado completo al momento de aprobar
2fa_usado:     boolean
```

### Post-aprobación — inmutabilidad técnica

```
Una vez DEFINITIVO:
  - El endpoint de corrección manual retorna 423 Locked para ese período
  - El endpoint de matching retorna 423 Locked para ese período
  - Cualquier intento de modificación queda registrado en el log como INTENTO_MODIFICACION_PERIODO_CERRADO
  - Reapertura requiere: justificación escrita + rol ADMIN + notificación automática al APPROVER original
```
