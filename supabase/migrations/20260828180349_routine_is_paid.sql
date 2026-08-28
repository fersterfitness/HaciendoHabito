-- Abono de la rutina (check en ficha del alumno), independiente del precio del plan.

ALTER TABLE public.routines
  ADD COLUMN IF NOT EXISTS is_paid boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.routines.is_paid IS 'Si el alumno abonó esta rutina. El monto opcional sigue en routines.price.';
