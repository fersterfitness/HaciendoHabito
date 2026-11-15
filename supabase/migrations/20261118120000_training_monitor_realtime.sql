-- Monitor de entrenamiento en tiempo real: publica para Realtime las dos tablas donde el alumno deja
-- lo que hace (series y cierre del día). Con esto, cada serie anotada le llega al entrenador al instante.
--
-- No cambia datos ni permisos: Realtime respeta el RLS que ya tienen las tablas (solo ve los registros
-- de sus propias rutinas). Sin esta migración el monitor igual funciona, refrescando cada 10 segundos.
-- Se puede correr más de una vez.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'routine_exercise_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.routine_exercise_logs;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'routine_day_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.routine_day_logs;
  END IF;
END $$;
