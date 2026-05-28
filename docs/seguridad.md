# Seguridad de la Información

← [Volver al objetivo](../objetivo.md)

## Principios base

Este sistema maneja **extractos bancarios reales** y **datos financieros de SAP** de una empresa.
Toda decisión de diseño debe asumir que una filtración tiene consecuencias legales, regulatorias y reputacionales graves.

Los tres pilares:
1. **Mínimo privilegio** — acceder solo a lo estrictamente necesario, nada más
2. **Trazabilidad total** — toda acción queda registrada, inmutablemente
3. **Defensa en profundidad** — no depender de una sola capa de seguridad

---

## 1. Consultas a SAP — Principio de campo mínimo

### Regla fundamental

> Nunca usar `SELECT *`. Nunca consultar tablas completas.
> Cada query extrae únicamente los campos que el algoritmo de matching necesita, nada más.

### Campos autorizados por consulta

**Consulta de partidas abiertas (facturas pendientes):**
```sql
SELECT
  BKPF.BELNR,    -- número de documento
  BKPF.BUDAT,    -- fecha de contabilización
  BKPF.BLDAT,    -- fecha de documento
  BSEG.WRBTR,    -- monto en moneda del documento
  BSEG.ZUONR,    -- referencia de asignación
  KNA1.KUNNR     -- número de cliente
FROM BKPF
INNER JOIN BSEG ON BKPF.MANDT = BSEG.MANDT AND BKPF.BELNR = BSEG.BELNR
WHERE
  BKPF.BUKRS  = :sociedad       -- parámetro vinculado, NUNCA concatenado
  AND BKPF.BUDAT BETWEEN :fecha_inicio AND :fecha_fin
  AND BSEG.AUGDT IS NULL        -- solo partidas sin compensar
  AND BKPF.MANDT = :mandante
```

**Tablas y campos explícitamente prohibidos:**
```
Información bancaria de terceros  (BSEC)
Datos de nómina                   (PA*)
Datos de costeo y controlling     (CO*, COPA*)
Configuración interna del sistema (T001, T001B, etc.)
Información fiscal interna        (tablas de Customizing)
Cualquier campo fuera de la lista de campos autorizados
```

### Parámetros siempre vinculados — nunca concatenación

```python
# CORRECTO — parámetro vinculado, inmune a inyección
query = """
    SELECT BELNR, BUDAT, WRBTR, ZUONR
    FROM BKPF
    WHERE BUKRS = :sociedad
      AND BUDAT BETWEEN :f_ini AND :f_fin
      AND MANDT = :mandante
"""
result = conn.execute(query, {
    "sociedad":  "1000",
    "f_ini":     "20260501",
    "f_fin":     "20260531",
    "mandante":  "100"
})

# INCORRECTO — vulnerable a SQL injection
query = f"SELECT * FROM BKPF WHERE BUKRS = '{sociedad}'"  # NUNCA HACER ESTO
```

### Usuario SAP de solo lectura

- Conectar con un usuario SAP que tenga **exclusivamente** autorización de lectura
- Sin acceso a transacciones de modificación (`SE16` restringido a display)
- Scope de autorización limitado al módulo FI y a las sociedades del proyecto
- El BASIS debe certificar el perfil antes del primer uso en producción
- Sin acceso directo a tablas de configuración del sistema

---

## 2. Manejo de archivos de entrada

### Validaciones obligatorias al cargar

```python
VALIDACIONES_ARCHIVO = {
    "extensiones_permitidas": [".csv", ".xlsx"],
    "tamano_maximo_mb": 50,
    "columnas_requeridas": {
        "banco": ["fecha_valor", "referencia", "monto", "tipo"],
        "sap":   ["fecha_doc", "num_factura", "nit_cliente", "monto", "estado"]
    }
}
```

Reglas adicionales:
- Verificar extensión **y** magic bytes — no confiar solo en la extensión del archivo
- Excel: cargar con `openpyxl(read_only=True)` — nunca ejecutar macros
- Sanitizar nombre de archivo antes de cualquier operación de disco
- Si falla cualquier validación: rechazar completamente, no procesar parcialmente

### No persistencia de datos crudos

```
Flujo correcto:
  Archivo subido → validar → cargar en DataFrame en memoria → eliminar del disco

Prohibido:
  - Almacenar el CSV/XLSX original en disco después de procesado
  - Datos de clientes en logs de aplicación
  - Montos o referencias en mensajes de error visibles al usuario
  - Caché de datos SAP en archivos temporales sin cifrar
```

---

## 3. Datos en reposo

| Elemento | Requisito |
|----------|-----------|
| Base de datos de auditoría | Cifrado AES-256 en disco |
| Exports / reportes generados | Protegidos con contraseña o cifrado |
| Logs de sistema | Sin PII — enmascarar NITs, nombres y montos |
| Credenciales SAP | Nunca en código ni archivos planos versionados |
| Archivos de sesión | En memoria únicamente, nunca escritos a disco sin cifrar |

---

## 4. Datos en tránsito

- **TLS 1.2 mínimo** — rechazar todas las conexiones HTTP sin cifrar
- Cookies de sesión con flags: `HttpOnly`, `Secure`, `SameSite=Strict`
- Tokens de sesión con expiración máxima de 8 horas (jornada laboral)
- La conexión a SAP debe ser sobre red interna o VPN — nunca expuesta a internet público
- Headers de seguridad HTTP obligatorios: `HSTS`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`

---

## 5. Control de acceso y roles

### Definición de roles

| Rol | Ver datos | Corrección manual | Aprobar | Abrir/cerrar período |
|-----|-----------|-------------------|---------|----------------------|
| `VIEWER` | ✅ | ❌ | ❌ | ❌ |
| `ANALYST` | ✅ | ✅ | ❌ | ❌ |
| `APPROVER` | ✅ | ✅ | ✅ | ❌ |
| `ADMIN` | ✅ | ✅ | ✅ | ✅ |

### Reglas de autorización críticas

```
Segregación de funciones:
  Un usuario NO puede aprobar una conciliación que él mismo corrigió manualmente.
  (Principio de los cuatro ojos — two-man rule)

Autenticación fuerte:
  El rol APPROVER requiere 2FA para cerrar un período.
  Los roles ADMIN y APPROVER requieren 2FA en todo momento.

Bloqueo por intentos fallidos:
  Más de 5 intentos de login fallidos → cuenta bloqueada + notificación al ADMIN.

Expiración de sesión:
  Sesiones inactivas más de 30 minutos → invalidar automáticamente.
  Al retomar: re-autenticar, no solo refrescar token.
```

---

## 6. Enmascaramiento de datos en la UI

Datos que nunca se muestran completos en pantalla:

| Dato | Formato en pantalla | Completo solo en |
|------|---------------------|------------------|
| NIT / RUT cliente | `900***456` | Export firmado por APPROVER |
| Cuenta bancaria | `****1234` | Nunca en UI |
| Nombre completo cliente | Solo ANALYST+ | — |
| Montos > umbral configurable | Requieren confirmación visual | Pantalla de aprobación |

Los exports tienen nivel de detalle controlado por el rol del usuario que los genera.

---

## 7. Auditoría e inmutabilidad de logs

### Estructura del log

```
LogAuditoria {
  id:               uuid
  timestamp:        datetime    // UTC — nunca hora local
  usuario:          string
  ip_origen:        string
  accion:           enum        // CARGAR_ARCHIVO | MATCH_MANUAL | APROBAR | EXPORTAR | LOGIN | LOGOUT
  entidad_id:       string      // id del movimiento o factura afectada
  hash_antes:       string      // SHA-256 del estado previo — no el valor en texto plano
  hash_despues:     string      // SHA-256 del estado nuevo
  resultado:        EXITO | FALLO
  motivo_fallo:     string      // solo si resultado == FALLO, sin datos sensibles
}
```

### Reglas del log

- **Append-only**: ningún proceso del sistema puede modificar ni eliminar registros de log
- Los logs no contienen montos, NITs ni referencias en texto plano — solo hashes
- Retención mínima: **5 años** (requerimiento estándar de auditoría financiera)
- Alertas automáticas para: múltiples fallos de login, aprobaciones fuera de horario laboral, exportaciones masivas inusuales

---

## 8. Gestión de credenciales SAP

```bash
# Correcto — variables de entorno, inyectadas por el sistema
SAP_HOST=erp.empresa.internal
SAP_USER=USR_CONCIL_RO          # usuario de solo lectura, nombre descriptivo
SAP_PASSWORD=<inyectado por vault>
SAP_CLIENT=100
SAP_SYSNR=00

# Incorrecto — nunca en código
conn = SAPConnection(host="erp", user="admin", password="12345")  # NUNCA
```

- Usar gestor de secretos (HashiCorp Vault, o `.env` **excluido de git desde el primer commit**)
- `.env` debe estar en `.gitignore` antes de cualquier `git add`
- Rotación de contraseña del usuario SAP: mínimo cada 90 días
- El usuario SAP no debe compartirse con otros sistemas o procesos

---

## 9. Checklist de seguridad — antes de producción

```
[ ] Usuario SAP creado con perfil de solo lectura — certificado por BASIS
[ ] Queries auditadas campo por campo contra la lista de campos autorizados
[ ] Ningún SELECT * en todo el codebase
[ ] Parámetros vinculados en todas las queries (grep "f'" en archivos SQL/Python)
[ ] Archivos de entrada no persisten en disco tras procesamiento
[ ] TLS configurado — acceso HTTP deshabilitado
[ ] Roles implementados y probados con usuario de prueba por cada rol
[ ] Log de auditoría en base de datos append-only, cifrado
[ ] Credenciales fuera del código y fuera del repositorio git
[ ] Headers de seguridad HTTP verificados con herramienta externa
[ ] Prueba básica: intentar inyección SQL en campos de búsqueda manual
[ ] Prueba básica: intentar acceder a página de APPROVER con cuenta VIEWER
[ ] Exports verificados: no contienen más campos de los necesarios por rol
[ ] Política de retención de logs documentada y configurada
```
