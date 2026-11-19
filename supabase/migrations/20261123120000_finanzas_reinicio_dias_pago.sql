-- Feedback nov19 (Finanzas): bonificados, día de pago desde el formulario y reinicio de los cobros
-- de los alumnos de Tomi con los días de pago que pasó y noviembre como pagado (salvo Lucio).
--
-- Correr UNA sola vez, entero, en el SQL Editor de Supabase. Si algo no coincide, no cambia nada.
-- Antes de borrar, los cobros quedan copiados en public.income_backup_20261119.
-- Al final muestra cada alumno de la lista con lo que quedó cargado: revisar que no falte ninguno.

BEGIN;

-- ─── 1. Bonificados: no pagan cuota ─────────────────────────────────────────
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS payment_exempt boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.students.payment_exempt IS
  'Bonificado: no paga cuota (no figura como deudor ni recibe avisos de pago).';

-- ─── 2. Día de pago desde el formulario ─────────────────────────────────────
-- El formulario manda el día dentro de «Dato de pago» («Prefiere pagar el día 5 de cada mes.» o
-- «Prefiere pagar el último día de cada mes.»). Al crear el alumno queda como su día de pago.
CREATE OR REPLACE FUNCTION public.students_payment_day_from_intake()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_notes text;
  v_match text[];
  v_day integer;
BEGIN
  IF NEW.payment_day_from IS NOT NULL OR NEW.payment_day_to IS NOT NULL THEN
    RETURN NEW;
  END IF;
  v_notes := COALESCE(
    NEW.intake_ferster->>'payment_notes',
    NEW.intake_nutrition->>'payment_notes',
    NEW.intake_psychologist->>'payment_notes'
  );
  IF v_notes IS NULL THEN
    RETURN NEW;
  END IF;
  IF v_notes ~* '^Prefiere pagar el último día' THEN
    v_day := 31;
  ELSE
    v_match := regexp_match(v_notes, '^Prefiere pagar el día (\d{1,2}) de cada mes');
    IF v_match IS NOT NULL THEN
      v_day := v_match[1]::integer;
    END IF;
  END IF;
  IF v_day BETWEEN 1 AND 31 THEN
    NEW.payment_day_from := v_day;
    NEW.payment_day_to := v_day;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS students_payment_day_from_intake ON public.students;
CREATE TRIGGER students_payment_day_from_intake
  BEFORE INSERT OR UPDATE OF intake_ferster, intake_nutrition, intake_psychologist ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.students_payment_day_from_intake();

-- Alumnos que ya llegaron por el formulario con un día elegido y todavía no tienen día de pago.
UPDATE public.students
   SET intake_ferster = intake_ferster
 WHERE payment_day_from IS NULL
   AND payment_day_to IS NULL
   AND COALESCE(intake_ferster->>'payment_notes', intake_nutrition->>'payment_notes', intake_psychologist->>'payment_notes') ~* '^Prefiere pagar el';

-- ─── 3. Reinicio de los cobros de Tomi ──────────────────────────────────────
-- Tablas de trabajo comunes (no ON COMMIT DROP: el editor de Supabase no siempre corre todo en una sola
-- transacción). Se borran al principio por si quedaron de un intento anterior; las temporales desaparecen solas al cerrar la sesión.
DROP TABLE IF EXISTS _hh_match, _hh_owner, _hh_owner_cand, _hh_dias;
-- Días de pago del documento del entrenador (31 = último día del mes). Bonificados sin día.
CREATE TEMP TABLE _hh_dias (nombre text, apellido text, dia integer, bonificado boolean, pago_noviembre boolean);
INSERT INTO _hh_dias VALUES
  ('franco', 'chevalley', 5, false, true),
  ('yael', 'dominguez', 5, false, true),
  ('braian', 'etchepare', NULL, true, false),
  ('briana', 'cardozo', 31, false, true),
  ('lucio', 'casanave', 31, false, false),
  ('agustin', 'peluffo', 10, false, true),
  ('ailin', 'masdeu', 10, false, true),
  ('bianca', 'trofelli', 1, false, true),
  ('federico', 'ferster', NULL, true, false),
  ('gustavo', 'cabral', 1, false, true),
  ('juliana', 'caivano', 5, false, true),
  ('lujan', 'ayala', 1, false, true),
  ('maria rosa', 'villar', 1, false, true),
  ('matias', 'sambran', 15, false, true),
  ('santiago', 'scheifler', 10, false, true),
  ('yony', 'arganaraz', 5, false, true);

-- El dueño es el profesional que tiene como alumnos activos a la mayoría de la lista (no se busca por
-- nombre de perfil: así no depende de cómo esté escrito).
CREATE TEMP TABLE _hh_owner_cand AS
SELECT s.owner_id AS id, count(DISTINCT d.nombre || ' ' || d.apellido) AS n
  FROM _hh_dias d
  JOIN public.students s
    ON s.status = 'activo'
   AND translate(lower(s.full_name), 'áéíóúüñ', 'aeiouun') LIKE d.nombre || '%'
   AND translate(lower(s.full_name), 'áéíóúüñ', 'aeiouun') LIKE '%' || d.apellido || '%'
 GROUP BY s.owner_id;

DO $$
DECLARE
  v_max integer;
  v_tops integer;
BEGIN
  SELECT max(n) INTO v_max FROM _hh_owner_cand;
  SELECT count(*) INTO v_tops FROM _hh_owner_cand WHERE n = v_max;
  IF v_max IS NULL OR v_max < 8 OR v_tops <> 1 THEN
    RAISE EXCEPTION 'No se pudo saber de qué profesional son los alumnos de la lista (máximo % de 15, empatados %). No se cambió nada.',
      coalesce(v_max, 0), v_tops;
  END IF;
END;
$$;

CREATE TEMP TABLE _hh_owner AS
SELECT id FROM _hh_owner_cand ORDER BY n DESC LIMIT 1;

CREATE TEMP TABLE _hh_match AS
SELECT d.*, s.id AS student_id
  FROM _hh_dias d
  LEFT JOIN public.students s
    ON s.owner_id = (SELECT id FROM _hh_owner)
   AND s.status = 'activo'
   AND translate(lower(s.full_name), 'áéíóúüñ', 'aeiouun') LIKE d.nombre || '%'
   AND translate(lower(s.full_name), 'áéíóúüñ', 'aeiouun') LIKE '%' || d.apellido || '%';

DO $$
DECLARE
  v_dup text;
BEGIN
  SELECT string_agg(nombre || ' ' || apellido, ', ') INTO v_dup
    FROM (SELECT nombre, apellido FROM _hh_match GROUP BY nombre, apellido HAVING count(student_id) > 1) x;
  IF v_dup IS NOT NULL THEN
    RAISE EXCEPTION 'Hay más de un alumno activo que coincide con: %. No se cambió nada.', v_dup;
  END IF;
END;
$$;

-- Copia de los cobros antes de borrarlos (solo se puede leer desde el SQL Editor).
CREATE TABLE IF NOT EXISTS public.income_backup_20261119 AS
SELECT * FROM public.income WITH NO DATA;
ALTER TABLE public.income_backup_20261119 ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_owner uuid := (SELECT id FROM _hh_owner);
BEGIN
  IF EXISTS (SELECT 1 FROM public.income_backup_20261119 WHERE owner_id = v_owner) THEN
    RAISE EXCEPTION 'Este archivo ya se corrió (hay copia en income_backup_20261119). No se cambió nada.';
  END IF;

  INSERT INTO public.income_backup_20261119
  SELECT i.* FROM public.income i
   WHERE i.owner_id = v_owner
     AND i.student_id IS NOT NULL
     AND COALESCE(i.scope::text, 'business') = 'business';

  DELETE FROM public.income i
   WHERE i.owner_id = v_owner
     AND i.student_id IS NOT NULL
     AND COALESCE(i.scope::text, 'business') = 'business';

  -- Días de pago y bonificados de la lista.
  UPDATE public.students s
     SET payment_day_from = m.dia,
         payment_day_to = m.dia,
         payment_exempt = m.bonificado
    FROM _hh_match m
   WHERE s.id = m.student_id;

  -- Noviembre pagado: todos los alumnos activos de Tomi salvo los bonificados y los que no pagaron (Lucio).
  INSERT INTO public.income
    (owner_id, student_id, amount, payment_method, income_type, category, description, income_date, status, scope, notes)
  SELECT
    s.owner_id,
    s.id,
    COALESCE(
      NULLIF(s.monthly_fee_amount, 0),
      NULLIF(regexp_replace(COALESCE(w.price_label, ''), '[^0-9]', '', 'g'), '')::numeric,
      0
    ),
    'transferencia',
    'Cuota mensual',
    'Entrenamiento',
    'Pago de ' || s.full_name,
    make_date(2026, 11, LEAST(COALESCE(s.payment_day_to, s.payment_day_from, 1), 30)),
    'cobrado',
    'business',
    'Carga inicial (feedback nov19)'
  FROM public.students s
  LEFT JOIN public.web_plans w ON w.slug = s.selected_web_plan_slug
  WHERE s.owner_id = v_owner
    AND s.status = 'activo'
    AND NOT s.payment_exempt
    AND s.id NOT IN (SELECT student_id FROM _hh_match WHERE student_id IS NOT NULL AND NOT pago_noviembre);
END;
$$;

-- ─── 4. Resultado: la lista del documento y el resto de los alumnos activos ─
SELECT
  COALESCE(initcap(m.nombre || ' ' || m.apellido), '(no está en la lista)') AS de_la_lista,
  s.full_name AS alumno_en_la_app,
  s.payment_day_to AS dia_de_pago,
  s.payment_exempt AS bonificado,
  (SELECT sum(i.amount) FROM public.income i
    WHERE i.student_id = s.id AND i.status = 'cobrado' AND i.income_date >= '2026-11-01' AND i.income_date < '2026-12-01') AS cobrado_noviembre
FROM _hh_match m
FULL JOIN (
  SELECT * FROM public.students
   WHERE owner_id = (SELECT id FROM _hh_owner) AND status = 'activo'
) s ON s.id = m.student_id
ORDER BY (m.nombre IS NULL), s.full_name NULLS FIRST;

COMMIT;
