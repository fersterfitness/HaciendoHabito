-- Seguridad: nadie puede darse más permisos desde su propio perfil.
--
-- Antes: la política `profiles_own` (FOR ALL, auth.uid() = id) dejaba a cada usuario modificar,
-- borrar y volver a crear su fila de `profiles` con cualquier `role` (incluido 'admin').
-- Ahora:
--   1) Se quita `profiles_own`. Quedan `profiles_select_own_or_admin` y `profiles_update_own_or_admin`;
--      los usuarios ya no pueden insertar ni borrar perfiles (los crea el trigger de alta).
--   2) Trigger que valida cambios de `role`: un profesional puede pasar entre entrenador y
--      nutricionista (lo permite Ajustes); cualquier otro cambio solo lo hace un admin.
--   3) Las funciones SECURITY DEFINER del esquema public quedan con search_path fijo.

DROP POLICY IF EXISTS profiles_own ON public.profiles;

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

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF OLD.role::text IN ('trainer', 'nutritionist') AND NEW.role::text IN ('trainer', 'nutritionist') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Solo un administrador puede cambiar este rol.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_profile_role() IS
  'Impide escalar permisos desde el propio perfil: solo un admin cambia roles (salvo entrenador ↔ nutricionista).';

DROP TRIGGER IF EXISTS trg_guard_profile_role ON public.profiles;
CREATE TRIGGER trg_guard_profile_role
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_role();

-- search_path fijo en todas las funciones SECURITY DEFINER de public que no lo tengan.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, '{}'::text[])) c WHERE c LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions, pg_temp', r.sig);
  END LOOP;
END;
$$;
