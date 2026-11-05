"""Uso: python scripts/audit_migrations.py  →  genera supabase/auditoria_migraciones.sql

Recorre supabase/migrations en orden y arma un SQL que lista tablas, columnas y funciones
que las migraciones crean y que no están en la base."""
import glob, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIG = os.path.join(ROOT, 'supabase', 'migrations')
ID = r'"?([A-Za-z_][A-Za-z0-9_]*)"?'
TBL = r'(?:(?:public|"public")\.)?' + ID

tables = {}      # tabla -> (migración)
dropped = set()
columns = {}     # (tabla, columna) -> migración
functions = {}   # función -> migración
CONSTRAINT_WORDS = {'constraint', 'primary', 'unique', 'foreign', 'check', 'exclude', 'like'}


def split_top(body: str):
    out, depth, cur = [], 0, ''
    for ch in body:
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
        if ch == ',' and depth == 0:
            out.append(cur)
            cur = ''
        else:
            cur += ch
    if cur.strip():
        out.append(cur)
    return out


for path in sorted(glob.glob(os.path.join(MIG, '*.sql'))):
    name = os.path.basename(path)
    sql = open(path, encoding='utf-8').read()
    sql = re.sub(r'--[^\n]*', '', sql)
    # funciones: capturar nombre y sacar el cuerpo $$...$$ (tiene ';' adentro)
    for m in re.finditer(r'create\s+(?:or\s+replace\s+)?function\s+' + TBL, sql, re.I):
        functions[m.group(1).lower()] = name
    sql = re.sub(r'\$([A-Za-z_]*)\$.*?\$\1\$', "''", sql, flags=re.S)
    for stmt in sql.split(';'):
        st = ' '.join(stmt.split())
        low = st.lower()
        m = re.match(r'create\s+table\s+(?:if\s+not\s+exists\s+)?' + TBL + r'\s*\((.*)\)\s*$', st, re.I | re.S)
        if m:
            t = m.group(1).lower()
            tables.setdefault(t, name)
            dropped.discard(t)
            for part in split_top(m.group(2)):
                w = part.strip().split()
                if not w:
                    continue
                col = w[0].strip('"').lower()
                if col in CONSTRAINT_WORDS:
                    continue
                columns.setdefault((t, col), name)
            continue
        m = re.match(r'alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?' + TBL + r'\s+(.*)$', st, re.I | re.S)
        if m:
            t = m.group(1).lower()
            rest = m.group(2)
            rm = re.match(r'rename\s+to\s+' + ID, rest, re.I)
            if rm:
                new = rm.group(1).lower()
                if t in tables:
                    tables[new] = tables.pop(t)
                for (tt, c) in list(columns):
                    if tt == t:
                        columns[(new, c)] = columns.pop((tt, c))
                continue
            rc = re.match(r'rename\s+(?:column\s+)?' + ID + r'\s+to\s+' + ID, rest, re.I)
            if rc:
                a, b = rc.group(1).lower(), rc.group(2).lower()
                if (t, a) in columns:
                    columns[(t, b)] = columns.pop((t, a))
                continue
            for part in split_top(rest):
                p = part.strip()
                am = re.match(r'add\s+(?:column\s+)?(?:if\s+not\s+exists\s+)?' + ID, p, re.I)
                if am and am.group(1).lower() not in CONSTRAINT_WORDS:
                    columns.setdefault((t, am.group(1).lower()), name)
                dm = re.match(r'drop\s+(?:column\s+)?(?:if\s+exists\s+)?' + ID, p, re.I)
                if dm and dm.group(1).lower() not in CONSTRAINT_WORDS | {'constraint', 'default', 'not'}:
                    columns.pop((t, dm.group(1).lower()), None)
            continue
        m = re.match(r'drop\s+table\s+(?:if\s+exists\s+)?' + TBL, st, re.I)
        if m:
            t = m.group(1).lower()
            tables.pop(t, None)
            dropped.add(t)
            for k in [k for k in columns if k[0] == t]:
                columns.pop(k)
            continue
        m = re.match(r'drop\s+function\s+(?:if\s+exists\s+)?' + TBL, st, re.I)
        if m:
            functions.pop(m.group(1).lower(), None)

# Las columnas de tablas borradas no se reportan; las de tablas base (previas a las migraciones) sí.
columns = {k: v for k, v in columns.items() if k[0] not in dropped}

def q(s):
    return "'" + s.replace("'", "''") + "'"

t_vals = ',\n    '.join(f'({q(t)}, {q(m)})' for t, m in sorted(tables.items()))
c_vals = ',\n    '.join(f'({q(t)}, {q(c)}, {q(m)})' for (t, c), m in sorted(columns.items()))
f_vals = ',\n    '.join(f'({q(f)}, {q(m)})' for f, m in sorted(functions.items()))

out = f"""-- Qué le falta a la base respecto de supabase/migrations ({len(tables)} tablas, {len(columns)} columnas, {len(functions)} funciones).
-- Sólo lee: no cambia nada. Si devuelve 0 filas, la base está al día.
WITH
  t(tabla, migracion) AS (VALUES
    {t_vals}),
  c(tabla, columna, migracion) AS (VALUES
    {c_vals}),
  f(funcion, migracion) AS (VALUES
    {f_vals})
SELECT 'tabla' AS falta, t.tabla AS objeto, t.migracion
  FROM t
 WHERE NOT EXISTS (SELECT 1 FROM information_schema.tables x WHERE x.table_schema = 'public' AND x.table_name = t.tabla)
UNION ALL
SELECT 'columna', c.tabla || '.' || c.columna, c.migracion
  FROM c
 WHERE EXISTS (SELECT 1 FROM information_schema.tables x WHERE x.table_schema = 'public' AND x.table_name = c.tabla)
   AND NOT EXISTS (SELECT 1 FROM information_schema.columns x WHERE x.table_schema = 'public' AND x.table_name = c.tabla AND x.column_name = c.columna)
UNION ALL
SELECT 'funcion', f.funcion, f.migracion
  FROM f
 WHERE NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = f.funcion)
ORDER BY 3, 1, 2;
"""
open(os.path.join(ROOT, 'supabase', 'auditoria_migraciones.sql'), 'w', encoding='utf-8', newline='\n').write(out)
print(len(tables), 'tablas', len(columns), 'columnas', len(functions), 'funciones')
