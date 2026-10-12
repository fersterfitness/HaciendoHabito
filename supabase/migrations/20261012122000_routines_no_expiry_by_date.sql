-- La rutina ya no «vence» por fecha: el aviso sale cuando el alumno marca «Estoy en mi última semana»
-- en el formulario semanal (trigger apply_check_in_response_side_effects).
-- Se apaga el cron diario que pasaba rutinas a 'por_vencer' y mandaba «Rutina por vencer … vence en N días».

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'notify-expiring-routines'
       OR command ILIKE '%notify_expiring_routines%';
  END IF;
END;
$$;

-- Por si algo más la llama: queda sin efecto.
CREATE OR REPLACE FUNCTION public.notify_expiring_routines()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN;
END;
$$;

-- Las que el cron ya había marcado vuelven a activas.
UPDATE public.routines
SET status = 'activa', last_status_change = now(), updated_at = now()
WHERE status = 'por_vencer';
