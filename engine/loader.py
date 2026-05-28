"""
Carga y normalización de fuentes.
Seguridad: valida extensión + magic bytes, openpyxl sin macros.
Salida canónica: fecha | monto_signed | monto_abs | tipo | referencia | descripcion | banco
"""
import re
import unicodedata
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Literal
import pandas as pd

_XLSX_MAGIC = b'PK'
_XLS_MAGIC  = b'\xd0\xcf'
_ALLOWED    = {'.xlsx', '.xls', '.csv'}

# ── Utilidades internas ───────────────────────────────────────────────────────

def _validate(path: str) -> Path:
    p = Path(path)
    if p.suffix.lower() not in _ALLOWED:
        raise ValueError(f"Extensión no permitida: {p.suffix}")
    if p.suffix.lower() == '.xlsx':
        with open(p, 'rb') as f:
            if f.read(2) != _XLSX_MAGIC:
                raise ValueError("No es un archivo xlsx válido (magic bytes)")
    elif p.suffix.lower() == '.xls':
        with open(p, 'rb') as f:
            if f.read(2) != _XLS_MAGIC:
                raise ValueError("No es un archivo xls válido (magic bytes)")
    return p


def _ascii(s: str) -> str:
    """Elimina acentos y pasa a minúsculas: 'Débito' → 'debito'."""
    return unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode('ascii').lower().strip()


def _strip_defined_names(path: str) -> 'io.BytesIO':
    """
    Crea copia en memoria del xlsx sin el bloque <definedNames>.
    Workaround para bug openpyxl 3.1.x 'cannot assemble with duplicate keys'.
    """
    import io as _io
    buf = _io.BytesIO()
    with zipfile.ZipFile(path) as zin, zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename == 'xl/workbook.xml':
                data = re.sub(
                    rb'<definedNames\b[^/]*?>.*?</definedNames>|<definedNames\b[^/]*/?>',
                    b'',
                    data,
                    flags=re.DOTALL,
                )
            zout.writestr(item, data)
    buf.seek(0)
    return buf


def _read(path: str, **kw) -> pd.DataFrame:
    """Lee Excel sin ejecutar macros. Fallback automático si openpyxl falla por duplicate keys."""
    try:
        return pd.read_excel(path, engine='openpyxl', **kw)
    except ValueError as exc:
        if 'duplicate' not in str(exc).lower():
            raise
        return pd.read_excel(_strip_defined_names(path), engine='openpyxl', **kw)


def _nit_de_texto(text: str) -> str | None:
    m = re.search(r'\b(\d{7,12})\b', str(text))
    return m.group(1) if m else None


_CARGO_BANCARIO_RE = re.compile(
    r'comisi[oó]n|gmf|gravamen|\b4x1000\b|cuota\s+manejo|'
    r'\biva\b|cobro\s+iva|servicio\s+pago|'
    r'cuota\s+(?:fija|administraci[oó]n)|cargo\s+(?:fijo|bancario)',
    re.IGNORECASE,
)


def _cols_out(df: pd.DataFrame) -> pd.DataFrame:
    cols = ['fecha', 'monto_signed', 'monto_abs', 'tipo', 'referencia', 'descripcion', 'banco']
    df = df[cols].dropna(subset=['fecha', 'monto_abs'])
    cargos = df['descripcion'].str.contains(_CARGO_BANCARIO_RE, na=False)
    n = cargos.sum()
    if n:
        print(f"[LOADER] filtrados {n} cargos bancarios (IVA/comisiones)")
    return df[~cargos].reset_index(drop=True)


# ── Extracto DAVIVIENDA ───────────────────────────────────────────────────────

def cargar_davivienda(path: str) -> pd.DataFrame:
    """
    Detecta automáticamente la fila de cabecera (busca entre filas 0–5).
    NIT desde ID Origen/Destino o extraído de Desc Mot.
    Tipo: Notas Credito/Deposito Especial → CR | Notas Debito → DB
    """
    _validate(path)
    req = {'Fecha', 'Tran', 'Desc Mot.', 'Valor Total'}
    df = None
    for header_row in [2, 1, 3, 0, 4, 5]:
        candidate = _read(path, sheet_name=0, header=header_row)
        candidate.columns = [str(c).strip() for c in candidate.columns]
        found = req.issubset(set(candidate.columns))
        print(f"[DAVIVIENDA] header={header_row} cols={list(candidate.columns[:12])} match={found}")
        if found:
            df = candidate
            break
    if df is None:
        raise ValueError(
            f"Davivienda: no se encontraron las columnas {req}. "
            f"Revisa la consola Django para ver las columnas encontradas por fila."
        )

    df = df.rename(columns={
        'Fecha': '_fecha', 'Tran': '_tran',
        'Desc Mot.': 'descripcion', 'Valor Total': '_monto',
        'ID Origen/Destino': '_nit',
    })

    def _ref(row) -> str | None:
        nit = row.get('_nit')
        if pd.notna(nit) and str(nit) not in ('', 'nan'):
            try:
                return str(int(float(nit)))
            except (ValueError, OverflowError):
                pass
        return _nit_de_texto(row['descripcion'])

    df['referencia']   = df.apply(_ref, axis=1)
    df['fecha']        = pd.to_datetime(df['_fecha'], errors='coerce').dt.normalize()
    df['tipo']         = df['_tran'].apply(lambda t: 'DB' if 'debito' in _ascii(str(t)) else 'CR')
    df['monto_abs']    = pd.to_numeric(df['_monto'], errors='coerce').abs()
    df['monto_signed'] = df.apply(lambda r: r['monto_abs'] if r['tipo'] == 'CR' else -r['monto_abs'], axis=1)
    df['banco']        = 'DAVIVIENDA'
    df['descripcion']  = df['descripcion'].astype(str)
    return _cols_out(df)


# ── Extracto BANCOLOMBIA ──────────────────────────────────────────────────────

def cargar_bancolombia(path: str) -> pd.DataFrame:
    """
    Sin header. Fecha en col[0] formato numérico DDMMYYYY (1042026 → 01/04/2026).
    No hay NIT → referencia=None. Matching solo por monto+fecha (MEDIO).
    """
    _validate(path)
    raw = _read(path, sheet_name=0, header=None)
    df  = raw.iloc[1:].reset_index(drop=True)

    def _fecha(val) -> pd.Timestamp:
        try:
            return pd.to_datetime(str(int(float(val))).zfill(8), format='%d%m%Y')
        except Exception:
            return pd.NaT

    df['fecha']        = df[0].apply(_fecha)
    df['monto_signed'] = pd.to_numeric(df[5], errors='coerce')
    df['monto_abs']    = pd.to_numeric(df[8], errors='coerce')
    df['tipo']         = df[7].apply(lambda v: 'CR' if str(v).strip().upper() == 'C' else 'DB')
    df['descripcion']  = df[4].astype(str).str.strip()
    df['referencia']   = None
    df['banco']        = 'BANCOLOMBIA'
    df = df[df[4] != 'SALDO INICIAL']
    return _cols_out(df)


# ── Extracto BOGOTÁ ───────────────────────────────────────────────────────────

def _fix_fecha_bogota(val) -> pd.Timestamp:
    """
    Banco de Bogotá: openpyxl codifica DD/MM/YYYY como Timestamp(20DD, MM, 1).
    El día real siempre está en year%100; day siempre es 1. Corrección universal.
    """
    if isinstance(val, pd.Timestamp):
        dia = val.year % 100
        if 1 <= dia <= 31:
            try:
                return pd.Timestamp(year=pd.Timestamp.now().year, month=val.month, day=dia)
            except ValueError:
                pass
        return pd.NaT
    for fmt in ('%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y'):
        try:
            return pd.to_datetime(str(val).strip(), format=fmt)
        except (ValueError, TypeError):
            pass
    return pd.NaT


def cargar_bogota(path: str) -> pd.DataFrame:
    """
    Header en fila 0. Columnas: Fecha, Transacción, Documento, Débito, Crédito.
    NIT desde columna Documento o texto de Transacción ("Nit8300001672").
    """
    _validate(path)
    df = _read(path, sheet_name=0, header=0)

    rename = {}
    for c in df.columns:
        cl = _ascii(str(c))                              # normaliza acentos: Débito→debito
        if 'fecha' in cl:                               rename[c] = '_fecha'
        elif 'transac' in cl or 'descripci' in cl:      rename[c] = 'descripcion'
        elif 'doc' in cl and 'fecha' not in cl:         rename[c] = '_doc'
        elif 'deb' in cl:                               rename[c] = '_deb'
        elif 'cr' in cl and 'ofi' not in cl:            rename[c] = '_cred'
    df = df.rename(columns=rename)

    print(f"[BOGOTA] columnas detectadas: {list(df.columns)}")

    if '_fecha' not in df.columns:
        raise ValueError(f"Bogotá: columna de fecha no encontrada. Columnas: {list(df.columns)}")

    df['fecha'] = df['_fecha'].apply(_fix_fecha_bogota)

    def _ref(row) -> str | None:
        doc = str(row.get('_doc', ''))
        try:
            v = int(float(doc))
            if v > 100_000:
                return str(v)
        except (ValueError, TypeError):
            pass
        m = re.search(r'[Nn]it(\d{7,12})', str(row.get('descripcion', '')))
        if m:
            return m.group(1)
        return _nit_de_texto(str(row.get('descripcion', '')))

    df['referencia'] = df.apply(_ref, axis=1)
    deb  = pd.to_numeric(df.get('_deb',  pd.Series(dtype=float)), errors='coerce').fillna(0)
    cred = pd.to_numeric(df.get('_cred', pd.Series(dtype=float)), errors='coerce').fillna(0)
    df['monto_abs']    = (deb + cred).abs()
    df['tipo']         = (cred > 0).map({True: 'CR', False: 'DB'})
    df['monto_signed'] = df.apply(lambda r: r['monto_abs'] if r['tipo'] == 'CR' else -r['monto_abs'], axis=1)
    df['banco']        = 'BOGOTA'
    df['descripcion']  = df.get('descripcion', pd.Series([''] * len(df))).astype(str)
    return _cols_out(df.query('monto_abs > 0'))


# ── SAP — Libro Mayor ─────────────────────────────────────────────────────────

def _xlsx_sheet_names(path: str) -> list:
    """
    Lee nombres de hojas via zipfile+XML, sin usar openpyxl.
    Evita bug openpyxl 3.1.x 'cannot assemble with duplicate keys'.
    """
    try:
        with zipfile.ZipFile(path) as zf:
            if 'xl/workbook.xml' in zf.namelist():
                with zf.open('xl/workbook.xml') as f:
                    tree = ET.parse(f)
                ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                return [s.get('name', '') for s in tree.findall('.//ns:sheet', ns)]
    except Exception:
        pass
    return []


def _resolver_hoja_sap(path: str, banco: str) -> str:
    """
    Busca la hoja del banco por coincidencia parcial sin acentos (case-insensitive).
    Fallback: openpyxl sheet_names, luego primera hoja si hay una sola.
    """
    nombres = _xlsx_sheet_names(path)
    if not nombres:
        try:
            xl = pd.ExcelFile(_strip_defined_names(path), engine='openpyxl')
            nombres = xl.sheet_names
            print(f"[SAP] fallback openpyxl sheet_names: {nombres}")
        except Exception as e:
            print(f"[SAP] fallback openpyxl falló: {e}")

    if not nombres:
        raise ValueError("No se pudieron leer las hojas del archivo SAP.")

    banco_ascii = _ascii(banco)
    for nombre in nombres:
        if banco_ascii in _ascii(nombre) or banco.upper() in nombre.upper():
            print(f"[SAP {banco}] hoja seleccionada: '{nombre}'")
            return nombre

    if len(nombres) == 1:
        print(f"[SAP {banco}] una sola hoja, usando: '{nombres[0]}'")
        return nombres[0]

    raise ValueError(
        f"No se encontró hoja para {banco} en el archivo SAP. "
        f"Hojas disponibles: {nombres}"
    )


def cargar_sap(path: str, banco: Literal['DAVIVIENDA', 'BANCOLOMBIA', 'BOGOTA']) -> pd.DataFrame:
    """
    Una hoja por banco. NIT en 'Cuenta de contrapartida' con prefijo P/C/E eliminado.
    num_doc (PP/PR/DP) preservado para trazabilidad de auditoría.
    Soporta SAP multi-hoja (un Excel con todas) o archivo individual por banco.
    """
    _validate(path)
    banco = banco.upper()
    if banco not in ('DAVIVIENDA', 'BANCOLOMBIA', 'BOGOTA'):
        raise ValueError(f"Banco no reconocido: {banco}")

    sheet = _resolver_hoja_sap(path, banco)
    df = _read(path, sheet_name=sheet, header=0)

    print(f"[SAP {banco}] hoja='{sheet}' columnas={list(df.columns)}")

    rename: dict = {}
    cargo_col: str | None = None
    abono_col: str | None = None
    for c in df.columns:
        cl = _ascii(str(c))
        if 'contabiliz' in cl:                              rename[c] = '_fecha'
        elif cl == 'serie':                                 rename[c] = 'serie'
        elif 'doc' in cl and 'fecha' not in cl:            rename[c] = 'num_doc'
        elif 'comentario' in cl:                           rename[c] = 'comentarios'
        elif 'contrapartida' in cl and 'nombre' not in cl: rename[c] = '_nit'
        elif 'nombre' in cl:                               rename[c] = 'descripcion'
        elif 'cargo' in cl and 'abono' in cl:              rename[c] = '_monto'
        elif 'cargo' in cl:                                cargo_col = c
        elif 'abono' in cl:                                abono_col = c
    df = df.rename(columns=rename)
    df = df.loc[:, ~df.columns.duplicated()]

    if '_fecha' not in df.columns:
        raise ValueError(
            f"SAP ({banco}, hoja '{sheet}'): no se encontró columna de fecha. "
            f"Columnas disponibles: {list(df.columns)}"
        )

    # Cargo = débito (salida), Abono = crédito (entrada)
    if cargo_col and abono_col:
        cargo = pd.to_numeric(df[cargo_col], errors='coerce').fillna(0)
        abono = pd.to_numeric(df[abono_col], errors='coerce').fillna(0)
        df['monto_signed'] = abono - cargo
    elif cargo_col:
        df['monto_signed'] = -pd.to_numeric(df[cargo_col], errors='coerce').fillna(0)
    elif abono_col:
        df['monto_signed'] = pd.to_numeric(df[abono_col], errors='coerce').fillna(0)
    elif '_monto' in df.columns:
        df['monto_signed'] = pd.to_numeric(df['_monto'], errors='coerce')
    else:
        raise ValueError(
            f"SAP ({banco}, hoja '{sheet}'): columna de monto no encontrada (Cargo/Abono). "
            f"Columnas disponibles: {list(df.columns)}"
        )

    df['fecha']     = pd.to_datetime(df['_fecha'], errors='coerce').dt.normalize()
    df['monto_abs'] = df['monto_signed'].abs()
    df['tipo']      = df['monto_signed'].apply(lambda v: 'CR' if float(v or 0) >= 0 else 'DB')
    nit_col = df['_nit'] if '_nit' in df.columns else pd.Series([''] * len(df))
    df['referencia']   = (nit_col.astype(str).str.strip()
                                 .str.replace(r'^[PCEpce]', '', regex=True)
                                 .str.strip())
    df['descripcion']  = df.get('descripcion', pd.Series([''] * len(df))).astype(str)
    df['num_doc']      = df.get('num_doc', pd.Series([''] * len(df))).astype(str).str.strip()
    df['banco']        = banco.upper()

    out = ['fecha', 'monto_signed', 'monto_abs', 'tipo', 'referencia', 'descripcion', 'num_doc', 'banco']
    return df[out].dropna(subset=['fecha', 'monto_abs']).reset_index(drop=True)
