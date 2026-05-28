import pandas as pd

files = {
    'DAVIVIENDA': r'docs/Extracto/04-BANCO DAVIVIENDA 9858.xlsx',
    'BANCOLOMBIA': r'docs/Extracto/04-BANCOLOMBIA 0411.xlsx',
    'BOGOTA': r'docs/Extracto/04-BOGOTA 8295.xlsx',
    'SAP': r'docs/SAP/LIBRO MAYOR SAP.xlsx',
}

for name, path in files.items():
    print(f'\n{"="*60}')
    print(f'  {name}')
    print(f'{"="*60}')
    try:
        xl = pd.ExcelFile(path)
        print(f'  Hojas: {xl.sheet_names}')
        for sheet in xl.sheet_names[:2]:
            df_raw = pd.read_excel(path, sheet_name=sheet, header=None, nrows=12)
            print(f'\n  [Hoja: {sheet}] primeras 12 filas raw:')
            print(df_raw.to_string())
            print()
    except Exception as e:
        print(f'  ERROR: {e}')
