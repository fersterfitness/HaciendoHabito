-- Superadmin de Finanzas: una persona (Tomi) ve los ingresos y gastos de todos los profesionales.
-- El resto de los profesionales sigue viendo solo lo suyo.
--
-- 1) profiles.is_finance_superadmin: el permiso. Solo un admin o el SQL Editor lo puede cambiar.
-- 2) Políticas de SOLO LECTURA sobre income y expenses para el superadmin. Las políticas de Postgres
--    se suman (OR), así que no tocan las que ya existen: nadie pierde acceso a lo suyo y el
--    superadmin no puede editar ni borrar lo de otros. La app siempre filtra esas tablas por dueño,
--    así que en el resto de las pantallas Tomi sigue viendo solo lo propio.
--    A propósito NO se abre la tabla students: hay listados que confían solo en RLS y le
--    mostrarían alumnos ajenos. Los nombres salen de finance_student_names().
-- 3) finance_professionals() y finance_student_names(): selector de Finanzas y nombre del alumno de
--    cada cobro. A cualquiera que no sea superadmin le devuelven vacío.
-- 4) Al final: marcar a Tomi. HAY QUE PONER SU CORREO antes de correr el archivo.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_finance_superadmin boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_finance_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((SELECT p.is_finance_superadmin FROM public.profiles p WHERE p.id = auth.uid()), false)
$$;

REVOKE ALL ON FUNCTION public.is_finance_superadmin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_finance_superadmin() TO authenticated;

-- Mismo guardia que 20261030120000_security_profiles_role_guard.sql, más el permiso nuevo:
-- nadie se lo puede dar a sí mismo desde la app.
CREATE OR REPLACE FUNCTION public.guard_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Sin sesión de usuario: trigger de alta, service role o SQL Editor.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.is_app_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'No se pueden crear perfiles desde la app.' USING ERRCODE = '42501';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'No se puede cambiar el id del perfil.' USING ERRCODE = '42501';
  END IF;

  IF NEW.is_finance_superadmin IS DISTINCT FROM OLD.is_finance_superadmin THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar este permiso.' USING ERRCODE = '42501';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF OLD.role::text IN ('trainer', 'nutritionist') AND NEW.role::text IN ('trainer', 'nutritionist') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Solo un administrador puede cambiar este rol.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- Solo lectura para el superadmin (el SELECT envuelto se evalúa una vez por consulta, no por fila).
DROP POLICY IF EXISTS income_finance_superadmin_read ON public.income;
CREATE POLICY income_finance_superadmin_read ON public.income
  FOR SELECT TO authenticated
  USING ((SELECT public.is_finance_superadmin()));

DROP POLICY IF EXISTS expenses_finance_superadmin_read ON public.expenses;
CREATE POLICY expenses_finance_superadmin_read ON public.expenses
  FOR SELECT TO authenticated
  USING ((SELECT public.is_finance_superadmin()));

-- Nombre del alumno de cada cobro ajeno (solo id y nombre, nada más de la ficha).
CREATE OR REPLACE FUNCTION public.finance_student_names()
RETURNS TABLE (id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT s.id, s.full_name
  FROM public.students s
  WHERE public.is_finance_superadmin()
$$;

REVOKE ALL ON FUNCTION public.finance_student_names() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_student_names() TO authenticated;

CREATE OR REPLACE FUNCTION public.finance_professionals()
RETURNS TABLE (id uuid, full_name text, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.id, p.full_name, p.role::text
  FROM public.profiles p
  WHERE public.is_finance_superadmin()
    AND p.role::text IN ('admin', 'trainer', 'nutritionist', 'psychologist')
  ORDER BY p.full_name
$$;

REVOKE ALL ON FUNCTION public.finance_professionals() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_professionals() TO authenticated;

-- ── Marcar a Tomi ────────────────────────────────────────────────────────────
-- Reemplazá CORREO_DE_TOMI por el correo con el que Tomi entra a la app.
-- Para ver los correos de los profesionales:
--   SELECT u.email, p.full_name, p.role FROM auth.users u JOIN public.profiles p ON p.id = u.id ORDER BY p.full_name;
DO $$
DECLARE
  n integer;
BEGIN
  UPDATE public.profiles p
     SET is_finance_superadmin = true
   WHERE p.id IN (SELECT u.id FROM auth.users u WHERE lower(u.email) = lower('CORREO_DE_TOMI'));
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE NOTICE 'No se marcó a nadie: falta poner el correo de Tomi en este archivo (o no coincide).';
  ELSE
    RAISE NOTICE 'Listo: % perfil marcado como superadmin de Finanzas.', n;
  END IF;
END;
$$;
