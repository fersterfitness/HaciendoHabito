-- Verificación de permisos (RLS y trigger de roles). Se puede correr cuando se quiera en el
-- SQL Editor y no deja cambios: cada prueba que modifica algo se deshace sola (sub-bloque que
-- termina en un error controlado). Resultado: una fila por chequeo (OK / FALLA).

CREATE TEMP TABLE IF NOT EXISTS _checks (orden int, chequeo text, resultado text);
TRUNCATE _checks;
GRANT ALL ON _checks TO authenticated, anon;

DO $$
DECLARE
  v_trainer uuid;
  v_student_user uuid;
  v_count int;
  v_ok boolean;
  v_err text;
BEGIN
  SELECT id INTO v_trainer FROM public.profiles WHERE role::text = 'trainer' ORDER BY created_at LIMIT 1;
  SELECT id INTO v_student_user FROM public.profiles WHERE role::text = 'student' ORDER BY created_at LIMIT 1;

  IF v_trainer IS NULL THEN
    INSERT INTO _checks VALUES (0, 'Hay un entrenador para probar', 'FALLA: no hay perfiles con rol trainer');
    RETURN;
  END IF;

  -- ── Como entrenador ──────────────────────────────────────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_trainer, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  -- 1. Hacerse admin: tiene que fallar.
  v_ok := false;
  BEGIN
    UPDATE public.profiles SET role = 'admin' WHERE id = v_trainer;
    RAISE EXCEPTION 'probe_rollback';
  EXCEPTION WHEN OTHERS THEN
    v_ok := SQLERRM <> 'probe_rollback';
  END;
  INSERT INTO _checks VALUES (1, 'Un entrenador no puede hacerse admin', CASE WHEN v_ok THEN 'OK' ELSE 'FALLA: pudo cambiar su rol a admin' END);

  -- 2. Pasar a nutricionista (permitido desde Ajustes). Se deshace igual.
  v_err := NULL;
  BEGIN
    UPDATE public.profiles SET role = 'nutritionist' WHERE id = v_trainer;
    RAISE EXCEPTION 'probe_rollback';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'probe_rollback' THEN v_err := SQLERRM; END IF;
  END;
  INSERT INTO _checks VALUES (2, 'Un entrenador puede pasar a nutricionista (Ajustes)', COALESCE('FALLA: ' || v_err, 'OK'));

  -- 3. Borrar su perfil: no tiene que borrar nada.
  v_count := 0;
  BEGIN
    DELETE FROM public.profiles WHERE id = v_trainer;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE EXCEPTION 'probe_rollback';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  INSERT INTO _checks VALUES (3, 'Un usuario no puede borrar su perfil', CASE WHEN v_count = 0 THEN 'OK' ELSE 'FALLA: lo borró' END);

  -- 4. Crear un perfil admin: tiene que fallar.
  v_ok := false;
  BEGIN
    INSERT INTO public.profiles (id, full_name, role) VALUES (gen_random_uuid(), 'prueba', 'admin');
    RAISE EXCEPTION 'probe_rollback';
  EXCEPTION WHEN OTHERS THEN
    v_ok := SQLERRM <> 'probe_rollback';
  END;
  INSERT INTO _checks VALUES (4, 'Un usuario no puede crear perfiles', CASE WHEN v_ok THEN 'OK' ELSE 'FALLA: pudo crear un perfil admin' END);

  -- 5 y 6. Datos de otros profesionales.
  SELECT count(*) INTO v_count
  FROM public.students s
  WHERE s.owner_id <> v_trainer
    AND NOT EXISTS (SELECT 1 FROM public.student_owners so WHERE so.student_id = s.id AND so.owner_id = v_trainer);
  INSERT INTO _checks VALUES (5, 'Un entrenador no ve alumnos de otros profesionales',
    CASE WHEN v_count = 0 THEN 'OK' ELSE 'FALLA: ve ' || v_count || ' alumnos ajenos' END);

  SELECT count(*) INTO v_count FROM public.income WHERE owner_id <> v_trainer;
  INSERT INTO _checks VALUES (6, 'Un entrenador no ve ingresos de otros',
    CASE WHEN v_count = 0 THEN 'OK' ELSE 'FALLA: ve ' || v_count || ' ingresos ajenos' END);

  EXECUTE 'RESET ROLE';

  -- ── Como alumno (si hay alguno con cuenta) ───────────────────────────────
  IF v_student_user IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_student_user, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    v_ok := false;
    BEGIN
      UPDATE public.profiles SET role = 'trainer' WHERE id = v_student_user;
      RAISE EXCEPTION 'probe_rollback';
    EXCEPTION WHEN OTHERS THEN
      v_ok := SQLERRM <> 'probe_rollback';
    END;
    INSERT INTO _checks VALUES (7, 'Un alumno no puede hacerse entrenador', CASE WHEN v_ok THEN 'OK' ELSE 'FALLA: pudo cambiar su rol' END);
    SELECT count(*) INTO v_count FROM public.income;
    INSERT INTO _checks VALUES (8, 'Un alumno no ve finanzas', CASE WHEN v_count = 0 THEN 'OK' ELSE 'FALLA: ve ' || v_count || ' ingresos' END);
    EXECUTE 'RESET ROLE';
  ELSE
    INSERT INTO _checks VALUES (7, 'Chequeos de alumno', 'SALTEADO: no hay usuarios con rol student');
  END IF;

  -- ── Sin sesión (clave pública) ──────────────────────────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  EXECUTE 'SET LOCAL ROLE anon';
  -- Sin permiso sobre la tabla (error) también cuenta como OK: no se ve nada.
  BEGIN
    SELECT count(*) INTO v_count FROM public.students;
  EXCEPTION WHEN insufficient_privilege THEN v_count := 0;
  END;
  INSERT INTO _checks VALUES (9, 'Sin sesión no se ven alumnos', CASE WHEN v_count = 0 THEN 'OK' ELSE 'FALLA: ve ' || v_count END);
  BEGIN
    SELECT count(*) INTO v_count FROM public.income;
  EXCEPTION WHEN insufficient_privilege THEN v_count := 0;
  END;
  INSERT INTO _checks VALUES (10, 'Sin sesión no se ven ingresos', CASE WHEN v_count = 0 THEN 'OK' ELSE 'FALLA: ve ' || v_count END);
  BEGIN
    SELECT count(*) INTO v_count FROM public.routines;
  EXCEPTION WHEN insufficient_privilege THEN v_count := 0;
  END;
  INSERT INTO _checks VALUES (11, 'Sin sesión no se ven rutinas', CASE WHEN v_count = 0 THEN 'OK' ELSE 'FALLA: ve ' || v_count END);
  EXECUTE 'RESET ROLE';
END;
$$;

SELECT chequeo, resultado FROM _checks ORDER BY orden;
