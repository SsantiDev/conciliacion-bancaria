import pandas as pd

pd.set_option('display.max_columns', 20)
pd.set_option('display.width', 200)
pd.set_option('display.max_colwidth', 40)

# ── DAVIVIENDA ────────────────────────────────────────────────
print('\n===== DAVIVIENDA — 40 registros =====')
df_dav = pd.read_excel(
    r'docs/Extracto/04-BANCO DAVIVIENDA 9858.xlsx',
    sheet_name=0, header=2, nrows=40
)
df_dav = df_dav[['Fecha', 'Tran', 'Desc Mot.', 'Valor Total', 'ID Origen/Destino', 'Referencia 1', 'Referencia 2']]
print(df_dav.to_string())

# ── BANCOLOMBIA ───────────────────────────────────────────────
print('\n\n===== BANCOLOMBIA — 40 registros (raw, sin header) =====')
df_bc = pd.read_excel(
    r'docs/Extracto/04-BANCOLOMBIA 0411.xlsx',
    sheet_name=0, header=None, nrows=42
)
print(df_bc.to_string())

# ── BOGOTA ────────────────────────────────────────────────────
print('\n\n===== BOGOTA — 40 registros =====')
df_bog = pd.read_excel(
    r'docs/Extracto/04-BOGOTA 8295.xlsx',
    sheet_name=0, header=0, nrows=40
)
print(df_bog.to_string())

# ── SAP — hoja BOGOTA ─────────────────────────────────────────
print('\n\n===== SAP BOGOTA — 20 registros =====')
df_sap_bog = pd.read_excel(
    r'docs/SAP/LIBRO MAYOR SAP.xlsx',
    sheet_name='11100507 -BOGOTA', header=0, nrows=20
)
print(df_sap_bog.to_string())

# ── SAP — hoja BANCOLOMBIA ────────────────────────────────────
print('\n\n===== SAP BANCOLOMBIA — 20 registros =====')
df_sap_bc = pd.read_excel(
    r'docs/SAP/LIBRO MAYOR SAP.xlsx',
    sheet_name='11100506 - BANCOLOMBIA', header=0, nrows=20
)
print(df_sap_bc.to_string())

# ── SAP — hoja DAVIVIENDA ─────────────────────────────────────
print('\n\n===== SAP DAVIVIENDA — 20 registros =====')
df_sap_dav = pd.read_excel(
    r'docs/SAP/LIBRO MAYOR SAP.xlsx',
    sheet_name='11100508 - DAVIVIENDA', header=0, nrows=20
)
print(df_sap_dav.to_string())

# ── Total rows per file ───────────────────────────────────────
print('\n\n===== CONTEO TOTAL DE REGISTROS =====')
for label, path, sheet, hdr in [
    ('DAVIVIENDA', r'docs/Extracto/04-BANCO DAVIVIENDA 9858.xlsx', 0, 2),
    ('BANCOLOMBIA', r'docs/Extracto/04-BANCOLOMBIA 0411.xlsx', 0, None),
    ('BOGOTA', r'docs/Extracto/04-BOGOTA 8295.xlsx', 0, 0),
    ('SAP-BOGOTA', r'docs/SAP/LIBRO MAYOR SAP.xlsx', '11100507 -BOGOTA', 0),
    ('SAP-BANCOLOMBIA', r'docs/SAP/LIBRO MAYOR SAP.xlsx', '11100506 - BANCOLOMBIA', 0),
    ('SAP-DAVIVIENDA', r'docs/SAP/LIBRO MAYOR SAP.xlsx', '11100508 - DAVIVIENDA', 0),
]:
    df = pd.read_excel(path, sheet_name=sheet, header=hdr)
    print(f'  {label}: {len(df)} filas')
