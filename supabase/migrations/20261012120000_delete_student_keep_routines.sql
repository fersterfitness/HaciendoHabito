-- Eliminar un alumno borra todos sus datos menos las rutinas.
-- Antes fallaba con «routine_pdfs_student_id_fkey» (FK sin ON DELETE) y, si no fallaba,
-- las rutinas se iban en cascada.
--
-- Las rutinas quedan sin alumno (student_id NULL) pero con former_student_id / former_student_name,
-- así no se confunden con las preestablecidas (biblioteca = student_id NULL y sin former_student_name).
-- Si el alumno se restaura desde el historial, las rutinas se vuelven a vincular.

ALTER TABLE public.routines
  ADD COLUMN IF NOT EXISTS former_student_id uuid,
  ADD COLUMN IF NOT EXISTS former_student_name text;

CREATE INDEX IF NOT EXISTS idx_routines_former_student
  ON public.routines (former_student_id)
  WHERE former_student_id IS NOT NULL;

-- Los PDFs de rutina se conservan junto con la rutina.
ALTER TABLE public.routine_pdfs
  ALTER COLUMN student_id DROP NOT NULL;

-- FKs hacia students:
--   routines / routine_pdfs → SET NULL (se conservan)
--   resto sin ON DELETE     → CASCADE si la columna es obligatoria, SET NULL si admite nulos
DO $$
DECLARE
  r record;
  v_action text;
BEGIN
  FOR r IN
    SELECT
      c.conname,
      c.conrelid,
      c.conrelid::regclass AS tbl,
      a.attname AS col,
      a.attnotnull AS notnull,
      c.confdeltype
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.students'::regclass
      AND array_length(c.conkey, 1) = 1
  LOOP
    IF r.conrelid IN ('public.routines'::regclass, 'public.routine_pdfs'::regclass) THEN
      v_action := 'SET NULL';
    ELSIF r.confdeltype IN ('a', 'r') THEN
      v_action := CASE WHEN r.notnull THEN 'CASCADE' ELSE 'SET NULL' END;
    ELSE
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.students(id) ON DELETE %s',
      r.tbl, r.conname, r.col, v_action
    );
  END LOOP;
END;
$$;

-- Antes de borrar: las rutinas guardan de quién eran y las activas pasan a completadas.
CREATE OR REPLACE FUNCTION public.detach_routines_before_student_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.routines
  SET
    former_student_id = OLD.id,
    former_student_name = OLD.full_name,
    status = CASE WHEN status IN ('activa', 'por_vencer') THEN 'completada'::routine_status ELSE status END,
    updated_at = now()
  WHERE student_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_detach_routines_before_student_delete ON public.students;
CREATE TRIGGER trg_detach_routines_before_student_delete
  BEFORE DELETE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.detach_routines_before_student_delete();

-- Al restaurar (restore_deleted_student reinserta con el mismo id) se recuperan sus rutinas.
CREATE OR REPLACE FUNCTION public.relink_routines_after_student_restore()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.routines
  SET
    student_id = NEW.id,
    former_student_id = NULL,
    former_student_name = NULL,
    updated_at = now()
  WHERE former_student_id = NEW.id
    AND student_id IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_relink_routines_after_student_restore ON public.students;
CREATE TRIGGER trg_relink_routines_after_student_restore
  AFTER INSERT ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.relink_routines_after_student_restore();
