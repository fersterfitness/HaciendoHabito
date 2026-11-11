-- Nombres de alumnos con el mismo formato: «TOMAS FERSTER» → «Tomas Ferster»,
-- «Bianca anabela Trofelli» → «Bianca Anabela Trofelli».
--
-- Solo se corrigen las palabras escritas TODAS en mayúscula o TODAS en minúscula; las mezcladas
-- («McDonald») quedan como están. «de», «del», «la», «y»… van en minúscula salvo al principio, y
-- II, III, IV… quedan en mayúscula. Mismo criterio que src/lib/personName.ts.
--
-- 1) Función hh_normalize_person_name(text).
-- 2) Trigger en students: todo alta o cambio de nombre (app, formularios públicos, funciones) queda
--    normalizado.
-- 3) Corrección de los nombres que ya están cargados. Antes de correr el archivo podés ver qué
--    cambiaría con la consulta de vista previa de más abajo.

CREATE OR REPLACE FUNCTION public.hh_normalize_person_name(p_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  words text[];
  w text;
  lw text;
  out_words text[] := '{}';
  i integer := 0;
BEGIN
  IF p_name IS NULL THEN
    RETURN NULL;
  END IF;
  words := regexp_split_to_array(btrim(p_name), '\s+');
  FOREACH w IN ARRAY words LOOP
    IF w = '' THEN
      CONTINUE;
    END IF;
    i := i + 1;
    lw := lower(w);
    IF w ~ '^(II|III|IV|VI|VII|VIII|IX|XI|XII)$'
       OR lw = upper(w)                              -- sin letras
       OR NOT (w = lw OR (w = upper(w) AND length(w) > 1)) THEN
      out_words := out_words || w;                   -- ya está bien o es mezcla a propósito
    ELSIF i > 1 AND lw IN ('de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'das', 'do', 'dos', 'di', 'van', 'von') THEN
      out_words := out_words || lw;
    ELSE
      -- initcap: mayúscula al principio y después de guion o apóstrofo («María-José», «D'Angelo»).
      out_words := out_words || initcap(lw);
    END IF;
  END LOOP;
  RETURN array_to_string(out_words, ' ');
END;
$$;

CREATE OR REPLACE FUNCTION public.students_normalize_full_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.full_name IS DISTINCT FROM OLD.full_name THEN
    NEW.full_name := public.hh_normalize_person_name(NEW.full_name);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_students_normalize_full_name ON public.students;
CREATE TRIGGER trg_students_normalize_full_name
  BEFORE INSERT OR UPDATE OF full_name ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.students_normalize_full_name();

-- Vista previa (correla sola, antes del UPDATE, para ver qué cambia):
--   SELECT full_name AS antes, public.hh_normalize_person_name(full_name) AS despues
--   FROM public.students
--   WHERE full_name IS DISTINCT FROM public.hh_normalize_person_name(full_name)
--   ORDER BY full_name;

-- Corrige los que ya están cargados. Solo toca los nombres que cambian.
UPDATE public.students
   SET full_name = public.hh_normalize_person_name(full_name)
 WHERE full_name IS DISTINCT FROM public.hh_normalize_person_name(full_name);
