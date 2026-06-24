-- Debe ir en migración aparte: Postgres no permite usar un valor nuevo de enum en la misma transacción.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'psychologist';
